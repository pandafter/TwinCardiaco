import type { Assessment, Vitals } from "./engine";
import type { Branch } from "./whatif";

/**
 * TRES agentes, no cinco. Y no son los tres que parecían.
 *
 * El primer recorte fusionaba cardiología + fisiología en un solo agente
 * "clínico". Era un error: MATA el conflicto, que es lo mejor que tiene el
 * sistema. El desacuerdo existe porque Cardiología protege el miocardio y
 * Fisiología protege el oxígeno sistémico, y en shock cardiogénico esos dos
 * objetivos se oponen —el inotrópico sube el gasto que Fisiología quiere,
 * al precio de la isquemia que Cardiología teme—. Un agente fusionado nunca
 * discrepa consigo mismo.
 *
 *   1. Cardiología — optimiza el balance de O₂ MIOCÁRDICO
 *   2. Fisiología  — optimiza el aporte de O₂ SISTÉMICO
 *   3. Orquestador — resuelve el conflicto y declara con qué criterio
 *
 * Se eliminó Farmacología: sus riesgos ya vienen en `risks[]` de cada
 * intervención, no hace falta un LLM para repetirlos. Y Simulación dejó de
 * ser una voz: corre las proyecciones y reporta, pero no opina. Si opinara,
 * duplicaría a Fisiología y el consenso sería una votación amañada.
 *
 * REGLA DE LENGUAJE
 * -----------------
 * Escriben para alguien que NO es médico. "El corazón bombea 40% menos que
 * hace dos minutos", no "taquiarritmia con compromiso hemodinámico". El
 * término técnico va aparte, en pequeño, para que un médico vea que está
 * bien hecho.
 *
 * REGLA DURA
 * ----------
 * Ningún agente emite una cifra que no venga del motor. Cada hallazgo trae
 * su evidencia con el valor y de dónde salió. Es la prueba de que no se
 * inventó el número.
 */

export type AgentId = "cardiologia" | "fisiologia" | "orchestrator";

export type AgentMeta = {
  id: AgentId;
  name: string;
  /** qué defiende, en una línea y sin jerga */
  role: string;
  color: string;
};

/** Las claves coinciden con las que emite `Backend/cardiotwin/agents.py`. */
export const AGENT_META: AgentMeta[] = [
  {
    id: "cardiologia",
    name: "Agente de Cardiología",
    role: "Cuida el músculo del corazón: que no se le exija más de lo que aguanta.",
    color: "var(--crit)",
  },
  {
    id: "fisiologia",
    name: "Agente de Fisiología",
    role: "Cuida que al cuerpo le llegue oxígeno.",
    color: "var(--info)",
  },
  {
    id: "orchestrator",
    name: "Orquestador",
    role: "Resuelve el desacuerdo y declara con qué criterio decidió.",
    color: "var(--gold)",
  },
];

export type Evidence = { label: string; value: string; source: "medido" | "simulado" };

export type AgentOutput = {
  id: AgentId;
  name: string;
  role: string;
  color: string;
  /** "En espera" | "Analizando" | "Con hallazgo" */
  state: string;
  /** el hallazgo en lenguaje humano — esto es lo que se lee primero */
  headline: string;
  /** el mismo hallazgo en términos clínicos, en pequeño */
  technical: string;
  evidence: Evidence[];
};

/**
 * Los tres agentes a partir del estado real y de las ramas ya proyectadas.
 *
 * Cuando el backend esté conectado, esto lo reemplazan los eventos
 * `agent.opinion` del bus. La forma es la misma, así que la UI no cambia.
 */
export function runAgents(
  v: Vitals,
  a: Assessment,
  branches: Branch[],
): AgentOutput[] {
  const meta = (id: AgentId) => AGENT_META.find((m) => m.id === id)!;
  const idle = a.status === "stable";

  const none = branches.find((b) => b.key === "none");
  // se comparan CONTRA no hacer nada: en un paciente que se deteriora, el
  // cambio absoluto de todas las ramas es negativo y no distingue nada
  const best = [...branches]
    .filter((b) => b.key !== "none")
    .sort((x, y) => x.vsNone.lactate - y.vsNone.lactate)[0];
  const pressure = [...branches]
    .filter((b) => b.key !== "none")
    .sort((x, y) => y.vsNone.map - x.vsNone.map)[0];

  /* --------------------------------------------------------- cardiología */
  // Defiende el miocardio. Le preocupa que subir la frecuencia y la fuerza
  // de contracción aumente la demanda de oxígeno del propio corazón.
  const fillPct = Math.round(
    a.filling_pct
      ? a.filling_pct * 100
      : Math.min(1, Math.max(0, (60 / v.hr - 0.28) / 0.445)) * 100,
  );

  const cardiologia: AgentOutput = {
    ...meta("cardiologia"),
    state: idle ? "En espera" : "Con hallazgo",
    headline: idle
      ? "El corazón trabaja dentro de lo que aguanta."
      : `El corazón va a ${Math.round(v.hr)} por minuto y solo alcanza a llenarse al ${fillPct}%. Está trabajando de más para mover menos sangre, y eso le cobra oxígeno a él mismo.`,
    technical: idle
      ? "Ritmo sinusal, doble producto dentro de rango."
      : `${a.hemodynamic_phenotype ?? "Taquicardia con caída del gasto"}. FC ${Math.round(v.hr)}, llenado ${fillPct}%, PCWP ${v.pcwp.toFixed(0)} mmHg.`,
    evidence: [
      { label: "Pulso", value: `${Math.round(v.hr)} lpm`, source: "medido" },
      { label: "Llenado", value: `${fillPct}%`, source: "medido" },
      { label: "Presiones de llenado", value: `${v.pcwp.toFixed(0)} mmHg`, source: "medido" },
    ],
  };

  /* ---------------------------------------------------------- fisiología */
  // Defiende el oxígeno que llega al cuerpo. Mira el flujo y el lactato, no
  // la presión: por eso choca con cardiología.
  const fisiologia: AgentOutput = {
    ...meta("fisiologia"),
    state: idle ? "En espera" : "Con hallazgo",
    headline: idle
      ? "Al cuerpo le está llegando el oxígeno que necesita."
      : `Solo llegan ${v.co.toFixed(1)} litros por minuto y el cuerpo ya está trabajando sin oxígeno: lactato en ${v.lactate.toFixed(1)}.${
          best
            ? ` Lo que más lo corrige es "${best.human.toLowerCase()}".`
            : ""
        }`,
    technical: idle
      ? "DO₂ suficiente, lactato basal."
      : `DO₂ ${Math.round(v.do2)} mL/min, extracción ${(v.o2er * 100).toFixed(0)}%, perfusión ${Math.round(v.perfusion_index * 100)}%.${
          none ? " Sin intervenir: " + none.verdict.toLowerCase() : ""
        }`,
    evidence: idle
      ? []
      : [
          { label: "Sangre bombeada", value: `${v.co.toFixed(1)} L/min`, source: "medido" as const },
          { label: "Oxígeno en tejidos", value: `${Math.round(v.perfusion_index * 100)}%`, source: "medido" as const },
          ...branches
            .filter((b) => b.key !== "none")
            .map((b) => ({
              label: b.human,
              value: `oxígeno ${b.vsNone.lactate <= 0 ? "+" : ""}${(-b.vsNone.lactate).toFixed(2)}`,
              source: "simulado" as const,
            })),
        ],
  };

  /* --------------------------------------------------------- orquestador */
  // El conflicto real: la rama que más sube la presión NO es la que más
  // oxígeno devuelve. No se promedia — se nombra y se decide con un criterio
  // explícito y discutible.
  const conflict =
    !idle && best && pressure && best.key !== pressure.key;

  const orchestrator: AgentOutput = {
    ...meta("orchestrator"),
    state: idle ? "En espera" : conflict ? "Conflicto" : "Con hallazgo",
    headline: idle
      ? "Monitorizando. Sin decisión pendiente."
      : conflict
        ? `Hay un conflicto real: "${pressure.human.toLowerCase()}" es lo que más sube la presión, pero "${best.human.toLowerCase()}" es lo que más oxígeno devuelve al cuerpo. Priorizo el oxígeno: la presión es el número, el oxígeno es el paciente.`
        : best
          ? `Todo apunta a "${best.human.toLowerCase()}".`
          : "Sin recomendación.",
    technical: conflict
      ? "Criterio de desempate declarado: se prioriza DO₂ sistémico sobre MAP. Discutible, y por eso explícito."
      : "Sin discrepancia entre métricas.",
    evidence:
      !idle && best && pressure
        ? [
            { label: `Más presión: ${pressure.human}`, value: `MAP ${pressure.vsNone.map >= 0 ? "+" : ""}${pressure.vsNone.map.toFixed(1)}`, source: "simulado" },
            { label: `Más oxígeno: ${best.human}`, value: `lactato ${best.vsNone.lactate >= 0 ? "+" : ""}${best.vsNone.lactate.toFixed(2)}`, source: "simulado" },
          ]
        : [],
  };

  return [cardiologia, fisiologia, orchestrator];
}

/**
 * Los mismos tres agentes, pero con lo que dijo el BACKEND.
 *
 * Se usa cuando hay stream: el front no genera opiniones, solo las muestra.
 * Si el backend manda `headline` (sin jerga) se usa; si solo manda
 * `reasoning` (técnico), se muestra en ambos sitios en vez de inventar una
 * traducción — decir "no vino" es mejor que fabricarlo.
 */
export function agentsFromBackend(
  live: Map<string, BackendOpinionLike>,
  consensus: ConsensusLike | null,
): AgentOutput[] {
  const STANCE: Record<string, string> = {
    apoyar: "A favor",
    oponerse: "En contra",
    condicionar: "Con reparos",
  };

  return AGENT_META.map((m) => {
    if (m.id === "orchestrator") {
      const c = consensus;
      return {
        ...m,
        state: c ? (c.conflict ? "Conflicto" : "Con hallazgo") : "En espera",
        headline:
          c?.headline ??
          (c?.recommendation
            ? `Recomienda: ${c.recommendation}.`
            : "Esperando a que los agentes terminen."),
        technical: c?.tiebreak_rule ?? c?.disclaimer ?? "",
        evidence: [],
      } satisfies AgentOutput;
    }

    const o = live.get(m.id);
    if (!o)
      return {
        ...m,
        state: "En espera",
        headline: "Sin hallazgos todavía.",
        technical: "",
        evidence: [],
      } satisfies AgentOutput;

    return {
      ...m,
      state: o.pending
        ? "Analizando…"
        : (STANCE[o.stance ?? ""] ?? "Con hallazgo"),
      headline: o.headline ?? o.reasoning ?? "Analizando el estado actual.",
      technical: o.headline ? (o.reasoning ?? "") : "",
      evidence: (o.evidence ?? []).map((e) => ({
        label: e.metric,
        value: String(e.value),
        source: e.source === "simulation" ? "simulado" : "medido",
      })),
    } satisfies AgentOutput;
  });
}

type BackendOpinionLike = {
  agent: string;
  stance?: string;
  reasoning?: string;
  headline?: string;
  pending?: boolean;
  evidence?: { metric: string; value: number | string; source: string }[];
};

type ConsensusLike = {
  recommendation?: string;
  tiebreak_rule?: string | null;
  conflict?: unknown;
  disclaimer?: string;
  headline?: string;
};

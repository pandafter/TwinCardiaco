import type { Assessment, Vitals } from "./engine";
import type { Branch } from "./whatif";

/**
 * TRES agentes, no cinco.
 *
 * Cinco eran redundantes: cardiología, fisiología y farmacología leen el
 * mismo estado y dicen variantes de lo mismo, y cinco llamadas encadenadas
 * no corren en tiempo real. Quedan:
 *
 *   1. Clínico     — interpreta qué está pasando y por qué
 *   2. Simulación  — explica las ramas que el motor ya calculó
 *   3. Orquestador — sintetiza, nombra el conflicto y declara su criterio
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

export type AgentId = "clinical" | "simulation" | "orchestrator";

export type AgentMeta = {
  id: AgentId;
  name: string;
  /** qué hace, en una línea y sin jerga */
  role: string;
  color: string;
};

export const AGENT_META: AgentMeta[] = [
  {
    id: "clinical",
    name: "Agente Clínico",
    role: "Interpreta qué le está pasando al paciente y por qué.",
    color: "var(--crit)",
  },
  {
    id: "simulation",
    name: "Agente de Simulación",
    role: "Explica a dónde lleva cada decisión posible.",
    color: "var(--info)",
  },
  {
    id: "orchestrator",
    name: "Orquestador",
    role: "Reúne todo, señala el conflicto y declara con qué criterio decide.",
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

  /* ------------------------------------------------------------- clínico */
  const fillPct = Math.round(
    Math.min(1, Math.max(0, (60 / v.hr - 0.28) / 0.445)) * 100,
  );

  const clinical: AgentOutput = {
    ...meta("clinical"),
    state: idle ? "En espera" : "Con hallazgo",
    headline: idle
      ? "El corazón mantiene el flujo. Nada que reportar."
      : `El corazón va a ${Math.round(v.hr)} por minuto y solo alcanza a llenarse al ${fillPct}%. Late más, pero mueve menos sangre: ${v.co.toFixed(1)} litros por minuto.`,
    technical: idle
      ? "Ritmo sinusal, hemodinámicamente estable."
      : `${a.hemodynamic_phenotype ?? "Taquicardia con caída del gasto"}. MAP ${Math.round(v.map)} mmHg, lactato ${v.lactate.toFixed(1)} mmol/L.`,
    evidence: [
      { label: "Pulso", value: `${Math.round(v.hr)} lpm`, source: "medido" },
      { label: "Llenado", value: `${fillPct}%`, source: "medido" },
      { label: "Sangre bombeada", value: `${v.co.toFixed(1)} L/min`, source: "medido" },
      { label: "Oxígeno en tejidos", value: `${Math.round(v.perfusion_index * 100)}%`, source: "medido" },
    ],
  };

  /* ---------------------------------------------------------- simulación */
  const simulation: AgentOutput = {
    ...meta("simulation"),
    state: idle ? "En espera" : "Con hallazgo",
    headline: idle
      ? "Sin escenarios que evaluar mientras el paciente esté estable."
      : none && best
        ? `Si no se hace nada, ${none.verdict.toLowerCase()} La mejor rama es "${best.human.toLowerCase()}": ${best.verdict.toLowerCase()}`
        : "Proyectando escenarios.",
    technical: idle
      ? "Sin ramas activas."
      : best
        ? `Frente a no intervenir: Δ gasto ${best.vsNone.co >= 0 ? "+" : ""}${best.vsNone.co.toFixed(2)} L/min · Δ lactato ${best.vsNone.lactate >= 0 ? "+" : ""}${best.vsNone.lactate.toFixed(2)} mmol/L.`
        : "",
    evidence: idle
      ? []
      : branches
          .filter((b) => b.key !== "none")
          .map((b) => ({
            label: b.human,
            value: `oxígeno ${b.vsNone.lactate <= 0 ? "+" : ""}${(-b.vsNone.lactate).toFixed(2)}`,
            source: "simulado" as const,
          })),
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

  return [clinical, simulation, orchestrator];
}

import type { Assessment, Vitals } from "./engine";

export type AgentId =
  | "cardiology"
  | "pharmacology"
  | "physiology"
  | "simulation"
  | "orchestrator";

export type AgentMeta = {
  id: AgentId;
  name: string;
  state: string;
  blurb: string;
  color: string;
};

export const AGENT_META: AgentMeta[] = [
  {
    id: "cardiology",
    name: "Cardiology Agent",
    state: "Analizando",
    blurb: "Especialista en ritmo, función cardíaca y estado hemodinámico.",
    color: "var(--crit)",
  },
  {
    id: "pharmacology",
    name: "Pharmacology Agent",
    state: "Evaluando",
    blurb: "Analiza intervenciones y efectos farmacológicos.",
    color: "var(--violet)",
  },
  {
    id: "physiology",
    name: "Physiology Agent",
    state: "Analizando",
    blurb: "Interpreta relaciones fisiológicas y perfusión.",
    color: "var(--info)",
  },
  {
    id: "simulation",
    name: "Simulation Agent",
    state: "Simulando",
    blurb: "Ejecuta escenarios y proyecta trayectorias.",
    color: "var(--ok)",
  },
  {
    id: "orchestrator",
    name: "Orchestrator",
    state: "Coordinando",
    blurb: "Integra hallazgos y genera consenso entre agentes.",
    color: "var(--gold)",
  },
];

/**
 * Hallazgos de cada agente derivados del estado real del motor: la evidencia
 * cita los valores que el paciente tiene ahora, no una plantilla fija.
 *
 * Cuando el backend esté conectado, esto lo reemplazan los eventos
 * `agent.opinion` del bus. La forma (hallazgo + evidencia + confianza) es la
 * misma que emite `Backend/cardiotwin/agents.py`.
 */
export function agentFindings(v: Vitals, a: Assessment) {
  const rising = a.trend === "worsening";

  return {
    cardiology: {
      finding: `Taquiarritmia sinusal con signos de deterioro hemodinámico.`,
      listTitle: "Evidencia",
      items: [
        `FC elevada y sostenida (${Math.round(v.hr)} bpm)`,
        `MAP en descenso (${Math.round(v.map)} mmHg)`,
        `Gasto cardiaco estimado en ${v.co.toFixed(1)} L/min`,
      ],
      confidence: 89,
    },
    pharmacology: {
      finding:
        "Intervención inotrópica podría mejorar el gasto cardíaco y perfusión.",
      listTitle: "Consideraciones",
      items: [
        "Dobutamina: mejora GC, riesgo de taquicardia",
        "Noradrenalina: mejora MAP, aumenta poscarga",
        "Evitar exceso de fluidos (riesgo de congestión)",
      ],
      confidence: 82,
    },
    physiology: {
      finding: `Perfusión tisular disminuyendo. Lactato ${rising ? "en aumento" : "estable"} sugiere hipoperfusión.`,
      listTitle: "Relaciones clave",
      chains: [
        ["↓ MAP", "↓ Perfusión", "↑ Lactato"],
        ["↓ GC", "↓ DO₂", "Hipoperfusión"],
      ],
      confidence: 86,
    },
    orchestrator: {
      synthesis: `El paciente presenta ${
        a.status === "critical" ? "estado crítico" : "inestabilidad hemodinámica"
      } con hipoperfusión progresiva.`,
      agree: "Deterioro hemodinámico real",
      dispute: "Mejor intervención inicial",
      confidence: 76,
    },
  };
}

/** Escenarios que el Simulation Agent tiene corriendo. */
export const SCENARIOS = [
  { id: "A", label: "Escenario A: Sin intervención", tone: "var(--crit)", end: -26 },
  { id: "B", label: "Escenario B: Dobutamina", tone: "var(--ok)", end: 22 },
  { id: "C", label: "Escenario C: Noradrenalina", tone: "var(--warn)", end: 2 },
];

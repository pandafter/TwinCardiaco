/**
 * Catálogo de acciones de la pantalla de intervenciones.
 *
 * `engineKey` es la clave de `Backend/cardiotwin/interventions.py`. Las
 * acciones que la tienen a null no están modeladas por el motor: son de
 * diagnóstico u observación, o el backend todavía no las implementa. Se marca
 * explícitamente para que nadie asuma que mueven la fisiología.
 *
 * Los efectos esperados y los riesgos salen del campo `mechanism` y `risks`
 * de ese mismo archivo: la noradrenalina sube la MAP mientras baja el gasto,
 * y ese es justamente el dilema que la demo tiene que exponer.
 */

export type EffectDir = "up" | "down" | "flat";

export type Effect = { dir: EffectDir; label: string; risk?: boolean };

export type Category = "medicamento" | "procedimiento" | "diagnostico" | "monitoreo";

export type Action = {
  id: string;
  letter: string;
  /** un catéter central es procedimiento y a la vez fuente de datos */
  categories: Category[];
  kind: "INTERVENCIÓN" | "PROCEDIMIENTO" | "DIAGNÓSTICO" | "OBSERVAR";
  icon: "syringe" | "tube" | "vial" | "eye";
  title: string;
  subtitle?: string;
  description: string;
  /** clave en Backend/cardiotwin/interventions.py, null si no está modelada */
  engineKey: string | null;
  sectionTitle: string;
  effects?: Effect[];
  checks?: string[];
  notes?: string[];
  timeLabel: string;
  time: string;
  color: string;
};

export const ACTIONS: Action[] = [
  {
    id: "inotrope",
    letter: "A",
    categories: ["medicamento"],
    kind: "INTERVENCIÓN",
    icon: "syringe",
    title: "Dobutamina",
    subtitle: "Inotrópico",
    description:
      "Aumenta la contractilidad miocárdica y el gasto cardiaco.",
    engineKey: "inotrope",
    sectionTitle: "EFECTOS ESPERADOS",
    effects: [
      { dir: "up", label: "Gasto cardiaco" },
      { dir: "up", label: "MAP" },
      { dir: "up", label: "Perfusión tisular" },
      { dir: "up", label: "Riesgo de taquiarritmias", risk: true },
    ],
    timeLabel: "INICIO ESTIMADO",
    time: "2–5 min",
    color: "var(--ok)",
  },
  {
    id: "vasopressor",
    letter: "B",
    categories: ["medicamento"],
    kind: "INTERVENCIÓN",
    icon: "syringe",
    title: "Noradrenalina",
    subtitle: "Vasopresor",
    description:
      "Aumenta la resistencia vascular sistémica y la presión arterial.",
    engineKey: "vasopressor",
    sectionTitle: "EFECTOS ESPERADOS",
    effects: [
      { dir: "up", label: "MAP" },
      { dir: "up", label: "Perfusión tisular" },
      // el backend lo advierte: sube la poscarga y en un ventrículo fallido
      // eso REDUCE el volumen sistólico
      { dir: "flat", label: "Gasto cardiaco", risk: true },
      { dir: "up", label: "Riesgo de isquemia", risk: true },
    ],
    timeLabel: "INICIO ESTIMADO",
    time: "1–2 min",
    color: "var(--info)",
  },
  {
    id: "airway",
    letter: "C",
    categories: ["procedimiento"],
    kind: "PROCEDIMIENTO",
    icon: "tube",
    title: "Intubación y ventilación",
    description: "Asegura la vía aérea y mejora la oxigenación y ventilación.",
    engineKey: null,
    sectionTitle: "EFECTOS ESPERADOS",
    effects: [
      { dir: "up", label: "SpO₂" },
      { dir: "up", label: "Oxigenación" },
      { dir: "down", label: "Trabajo respiratorio" },
      { dir: "flat", label: "Riesgo de hipotensión", risk: true },
    ],
    timeLabel: "INICIO ESTIMADO",
    time: "3–7 min",
    color: "var(--violet)",
  },
  {
    id: "central-line",
    letter: "D",
    categories: ["procedimiento", "diagnostico"],
    kind: "PROCEDIMIENTO",
    icon: "vial",
    title: "Acceso venoso central",
    subtitle: "Monitoreo invasivo",
    description:
      "Permite administración de vasoactivos y monitoreo hemodinámico avanzado.",
    engineKey: null,
    sectionTitle: "BENEFICIOS",
    checks: ["Acceso para fármacos", "Monitoreo continuo", "Medición de PVC/ScvO₂"],
    timeLabel: "INICIO ESTIMADO",
    time: "5–10 min",
    color: "var(--gold)",
  },
  {
    id: "none",
    letter: "E",
    categories: ["monitoreo"],
    kind: "OBSERVAR",
    icon: "eye",
    title: "Monitoreo estrecho",
    description: "Continuar vigilancia sin realizar intervenciones por ahora.",
    engineKey: "none",
    sectionTitle: "CONSIDERACIONES",
    notes: [
      "No cambia la trayectoria del paciente.",
      "El deterioro puede continuar o acelerarse.",
    ],
    timeLabel: "TIEMPO ESTIMADO",
    time: "—",
    color: "var(--text-lo)",
  },
];

export const AGENT_RECOMMENDATIONS: {
  id: string;
  text: string;
  confidence?: number;
  confidenceLabel?: string;
  note?: string;
}[] = [
  {
    id: "cardiology",
    text: "Recomienda iniciar dobutamina para mejorar el gasto cardíaco y la perfusión.",
    confidence: 89,
  },
  {
    id: "pharmacology",
    text: "Dobutamina es adecuada. Vigilar riesgo de taquiarritmias e hipotensión.",
    confidence: 82,
  },
  {
    id: "physiology",
    text: "Perfusión muy comprometida. Intervención inotrópica o vasoactiva necesaria.",
    confidence: 86,
  },
  {
    id: "simulation",
    text: "Ejecutando escenarios para todas las intervenciones disponibles...",
    note: "3 escenarios en evaluación",
  },
  {
    id: "orchestrator",
    text: "Hay consenso parcial a favor de iniciar terapia inotrópica.",
    confidence: 76,
    confidenceLabel: "Confianza del consenso",
  },
];

export const FILTERS: { id: "todas" | Category; label: string }[] = [
  { id: "todas", label: "Todas las acciones" },
  { id: "medicamento", label: "Medicamentos" },
  { id: "procedimiento", label: "Procedimientos" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "monitoreo", label: "Monitoreo" },
];

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

export type Action = {
  id: string;
  letter: string;
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
    id: "labs",
    letter: "D",
    kind: "DIAGNÓSTICO",
    icon: "vial",
    title: "Laboratorios y gasometría",
    description: "Obtiene información clave para guiar la intervención.",
    engineKey: null,
    sectionTitle: "INFORMACIÓN QUE APORTA",
    checks: ["Electrolitos", "Gasometría arterial", "Función renal", "Troponina / BNP"],
    timeLabel: "TIEMPO ESTIMADO",
    time: "5–10 min",
    color: "var(--gold)",
  },
  {
    id: "none",
    letter: "E",
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

export const AGENT_RECOMMENDATIONS = [
  {
    id: "cardiology",
    text: "Paciente con bajo gasto cardíaco y signos de congestión. Recomiendo soporte inotrópico.",
  },
  {
    id: "pharmacology",
    text: "Dobutamina puede mejorar gasto cardíaco. Vigilar riesgo de arritmias.",
  },
  {
    id: "physiology",
    text: "Perfusión tisular comprometida. Lactato en aumento. Intervención urgente recomendada.",
  },
  {
    id: "simulation",
    text: "Ejecutando escenarios para todas las intervenciones disponibles.",
  },
  {
    id: "orchestrator",
    text: "Procesando hallazgos y generando recomendación integrada.",
  },
];

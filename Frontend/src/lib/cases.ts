export type Severity = "Moderada" | "Alta" | "Crítica";
export type Sex = "M" | "F";

export type ClinicalCase = {
  id: string;
  title: string;
  blurb: string;
  age: number;
  sex: Sex;
  severity: Severity;
  recommended?: boolean;
  /** panel de detalle */
  summary: string;
  background: string;
  vitals: { key: string; label: string; value: string; unit?: string; tone?: "hi" | "ok" | "warn" | "crit"; trend?: boolean }[];
  derived: { key: string; label: string; value: string; unit?: string; tone?: "hi" | "ok" | "warn" | "crit" }[];
  goal: string;
};

export const SEVERITY_TONE: Record<Severity, { color: string; bars: number }> = {
  Moderada: { color: "var(--warn)", bars: 3 },
  Alta: { color: "var(--crit)", bars: 4 },
  Crítica: { color: "var(--crit)", bars: 4 },
};

export const CASES: ClinicalCase[] = [
  {
    id: "ic-descompensada",
    title: "Insuficiencia cardíaca descompensada",
    blurb:
      "Paciente con signos de congestión y deterioro hemodinámico progresivo.",
    age: 67,
    sex: "M",
    severity: "Moderada",
    recommended: true,
    summary:
      "Paciente masculino de 67 años con antecedente de insuficiencia cardíaca con fracción de eyección reducida. Ingresa por disnea progresiva, edema periférico y fatiga. Los signos vitales muestran tendencia al deterioro.",
    background: "IC crónica",
    vitals: [
      { key: "hr", label: "Frecuencia cardiaca", value: "88", unit: "lpm", trend: true },
      { key: "bp", label: "Presión arterial", value: "118/72", unit: "mmHg" },
      { key: "map", label: "MAP", value: "87", unit: "mmHg" },
      { key: "spo2", label: "SpO₂", value: "96", unit: "%" },
      { key: "rr", label: "Frecuencia respiratoria", value: "20", unit: "rpm" },
    ],
    derived: [
      { key: "lactate", label: "Lactato", value: "2.1", unit: "mmol/L" },
      { key: "co", label: "Gasto cardiaco", value: "4.2", unit: "L/min" },
      { key: "perf", label: "Perfusión", value: "Adecuada", tone: "ok" },
      { key: "hemo", label: "Estado hemodinámico", value: "Estable", tone: "ok" },
      { key: "rhythm", label: "Ritmo", value: "Sinusal", tone: "ok" },
    ],
    goal: "Estabiliza al paciente y evita la progresión hacia un estado crítico.",
  },
  {
    id: "tsv",
    title: "Taquiarritmia supraventricular",
    blurb: "Inicio súbito de taquicardia con inestabilidad hemodinámica.",
    age: 58,
    sex: "F",
    severity: "Moderada",
    summary:
      "Paciente femenina de 58 años sin cardiopatía estructural conocida. Presenta inicio súbito de palpitaciones con frecuencia ventricular rápida y descenso de la presión arterial.",
    background: "Sin cardiopatía",
    vitals: [
      { key: "hr", label: "Frecuencia cardiaca", value: "168", unit: "lpm", tone: "crit", trend: true },
      { key: "bp", label: "Presión arterial", value: "96/58", unit: "mmHg", tone: "warn" },
      { key: "map", label: "MAP", value: "71", unit: "mmHg", tone: "warn" },
      { key: "spo2", label: "SpO₂", value: "94", unit: "%" },
      { key: "rr", label: "Frecuencia respiratoria", value: "24", unit: "rpm", tone: "warn" },
    ],
    derived: [
      { key: "lactate", label: "Lactato", value: "2.6", unit: "mmol/L", tone: "warn" },
      { key: "co", label: "Gasto cardiaco", value: "3.4", unit: "L/min", tone: "warn" },
      { key: "perf", label: "Perfusión", value: "Reducida", tone: "warn" },
      { key: "hemo", label: "Estado hemodinámico", value: "Inestable", tone: "warn" },
      { key: "rhythm", label: "Ritmo", value: "FA con RVR", tone: "crit" },
    ],
    goal: "Recupera un ritmo eficaz antes de que la perfusión se comprometa.",
  },
  {
    id: "sca",
    title: "Síndrome coronario agudo",
    blurb: "Dolor torácico y cambios isquémicos en ECG. Elevación de biomarcadores.",
    age: 62,
    sex: "M",
    severity: "Alta",
    summary:
      "Paciente masculino de 62 años con factores de riesgo cardiovascular. Dolor torácico opresivo de dos horas de evolución con cambios isquémicos en el electrocardiograma.",
    background: "HTA, dislipidemia",
    vitals: [
      { key: "hr", label: "Frecuencia cardiaca", value: "104", unit: "lpm", trend: true },
      { key: "bp", label: "Presión arterial", value: "104/64", unit: "mmHg" },
      { key: "map", label: "MAP", value: "77", unit: "mmHg" },
      { key: "spo2", label: "SpO₂", value: "93", unit: "%", tone: "warn" },
      { key: "rr", label: "Frecuencia respiratoria", value: "22", unit: "rpm", tone: "warn" },
    ],
    derived: [
      { key: "lactate", label: "Lactato", value: "2.9", unit: "mmol/L", tone: "warn" },
      { key: "co", label: "Gasto cardiaco", value: "3.8", unit: "L/min", tone: "warn" },
      { key: "perf", label: "Perfusión", value: "Limítrofe", tone: "warn" },
      { key: "hemo", label: "Estado hemodinámico", value: "Inestable", tone: "warn" },
      { key: "rhythm", label: "Ritmo", value: "Sinusal", tone: "ok" },
    ],
    goal: "Sostén la perfusión mientras el daño isquémico progresa.",
  },
  {
    id: "choque",
    title: "Choque cardiogénico",
    blurb: "Hipoperfusión severa secundaria a falla cardíaca aguda.",
    age: 71,
    sex: "F",
    severity: "Crítica",
    summary:
      "Paciente femenina de 71 años con falla cardíaca aguda e hipoperfusión sistémica. Piel fría, oliguria y lactato en ascenso pese al soporte inicial.",
    background: "IC crónica avanzada",
    vitals: [
      { key: "hr", label: "Frecuencia cardiaca", value: "126", unit: "lpm", tone: "crit", trend: true },
      { key: "bp", label: "Presión arterial", value: "82/48", unit: "mmHg", tone: "crit" },
      { key: "map", label: "MAP", value: "59", unit: "mmHg", tone: "crit" },
      { key: "spo2", label: "SpO₂", value: "89", unit: "%", tone: "crit" },
      { key: "rr", label: "Frecuencia respiratoria", value: "28", unit: "rpm", tone: "crit" },
    ],
    derived: [
      { key: "lactate", label: "Lactato", value: "5.4", unit: "mmol/L", tone: "crit" },
      { key: "co", label: "Gasto cardiaco", value: "2.4", unit: "L/min", tone: "crit" },
      { key: "perf", label: "Perfusión", value: "Crítica", tone: "crit" },
      { key: "hemo", label: "Estado hemodinámico", value: "Crítico", tone: "crit" },
      { key: "rhythm", label: "Ritmo", value: "Sinusal", tone: "ok" },
    ],
    goal: "Revierte la hipoperfusión antes de que el daño sea irreversible.",
  },
];

export const WIZARD_STEPS = [
  { n: "01", title: "Seleccionar paciente", hint: "Elige un caso o crea uno nuevo" },
  { n: "02", title: "Configurar escenario", hint: "Patología, severidad y objetivos" },
  { n: "03", title: "Revisar y confirmar", hint: "Verifica información del caso" },
  { n: "04", title: "Iniciar simulación", hint: "El paciente comenzará en vivo" },
];

export const DATA_SOURCES = [
  { name: "MIT-BIH Arrhythmia Database", tag: "ECG" },
  { name: "PhysioNet MIMIC-III (De-identified)", tag: "VITALES" },
  { name: "Datos sintéticos validados", tag: "LABS" },
];

export const CAPABILITIES = [
  "Administrar medicamentos",
  "Solicitar pruebas diagnósticas",
  "Realizar procedimientos",
  "Comparar escenarios",
  "Ver predicciones y trayectorias",
];

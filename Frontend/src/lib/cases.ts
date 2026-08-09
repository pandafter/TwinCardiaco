export type Severity = "Moderada" | "Alta" | "Crítica";
export type Sex = "M" | "F";
export type Tone = "hi" | "ok" | "warn" | "crit";

/**
 * Preset de fisiologia que el backend acepta. Todos los campos son
 * opcionales; lo que no venga usa el valor por defecto del motor (paciente
 * sano de 70 kg). Sirve para arrancar cada caso en su punto de partida
 * clinico en vez de siempre desde cero.
 */
export type SimulationPreset = {
  /** none|cardiogenic|hypovolemic|septic */
  shockType?: "none" | "cardiogenic" | "hypovolemic" | "septic";
  /** 0-5 */
  severity?: number;
  initialHr?: number;
  /** setpoint del barorreflejo — util para taquiarritmias */
  hrBaseline?: number;
  /** fraccion de lo normal, 0.1-1.5 */
  initialContractility?: number;
  initialHemoglobin?: number;
  initialLactate?: number;
};

export type LabRow = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  /** rango de referencia opcional, se muestra pequeño debajo del valor */
  ref?: string;
};

export type ClinicalCase = {
  id: string;
  title: string;
  blurb: string;
  age: number;
  sex: Sex;
  severity: Severity;
  /** recomendado = simulable con confianza. Todos ya son simulables via preset. */
  recommended?: boolean;
  /** true si viene de localStorage (caso creado por el usuario) */
  custom?: boolean;
  summary: string;
  background: string;
  vitals: { key: string; label: string; value: string; unit?: string; tone?: Tone; trend?: boolean }[];
  derived: { key: string; label: string; value: string; unit?: string; tone?: Tone }[];
  /** paraclinicos coherentes con la patologia. Puede estar vacio en casos custom. */
  paraclinicos: LabRow[];
  goal: string;
  /** que se le pide al backend al iniciar la simulacion */
  simulation: SimulationPreset;
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
    paraclinicos: [
      { key: "ntprobnp", label: "NT-proBNP", value: "3.850", unit: "pg/mL", tone: "warn", ref: "<300" },
      { key: "trop", label: "Troponina I", value: "0.03", unit: "ng/mL", ref: "<0.04" },
      { key: "cr", label: "Creatinina", value: "1.4", unit: "mg/dL", tone: "warn", ref: "0.7-1.2" },
      { key: "urea", label: "Urea", value: "62", unit: "mg/dL", tone: "warn", ref: "15-45" },
      { key: "na", label: "Sodio", value: "134", unit: "mmol/L", tone: "warn", ref: "135-145" },
      { key: "k", label: "Potasio", value: "4.1", unit: "mmol/L", ref: "3.5-5.0" },
      { key: "ph", label: "pH art.", value: "7.38", tone: "ok", ref: "7.35-7.45" },
      { key: "hco3", label: "HCO₃⁻", value: "23", unit: "mmol/L", ref: "22-26" },
      { key: "lact-art", label: "Lactato art.", value: "2.1", unit: "mmol/L", tone: "warn", ref: "<2.0" },
    ],
    goal: "Estabiliza al paciente y evita la progresión hacia un estado crítico.",
    simulation: { shockType: "cardiogenic", severity: 0.5, initialContractility: 0.65 },
  },
  {
    id: "tsv",
    title: "Taquiarritmia supraventricular",
    blurb: "Inicio súbito de taquicardia con inestabilidad hemodinámica.",
    age: 58,
    sex: "F",
    severity: "Moderada",
    recommended: true,
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
    paraclinicos: [
      { key: "tsh", label: "TSH", value: "0.08", unit: "mUI/L", tone: "warn", ref: "0.4-4.5" },
      { key: "t4l", label: "T4 libre", value: "2.4", unit: "ng/dL", tone: "warn", ref: "0.8-1.8" },
      { key: "trop", label: "Troponina I", value: "0.02", unit: "ng/mL", ref: "<0.04" },
      { key: "k", label: "Potasio", value: "3.6", unit: "mmol/L", tone: "warn", ref: "3.5-5.0" },
      { key: "mg", label: "Magnesio", value: "1.6", unit: "mg/dL", tone: "warn", ref: "1.7-2.4" },
      { key: "ca", label: "Ca iónico", value: "4.5", unit: "mg/dL", ref: "4.5-5.3" },
      { key: "ph", label: "pH art.", value: "7.42", tone: "ok", ref: "7.35-7.45" },
      { key: "hco3", label: "HCO₃⁻", value: "24", unit: "mmol/L", ref: "22-26" },
      { key: "lact-art", label: "Lactato art.", value: "2.6", unit: "mmol/L", tone: "warn", ref: "<2.0" },
    ],
    goal: "Recupera un ritmo eficaz antes de que la perfusión se comprometa.",
    simulation: {
      shockType: "none", initialHr: 168, hrBaseline: 155, initialLactate: 2.6,
    },
  },
  {
    id: "sca",
    title: "Síndrome coronario agudo",
    blurb: "Dolor torácico y cambios isquémicos en ECG. Elevación de biomarcadores.",
    age: 62,
    sex: "M",
    severity: "Alta",
    recommended: true,
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
    paraclinicos: [
      { key: "trop", label: "Troponina I", value: "4.8", unit: "ng/mL", tone: "crit", ref: "<0.04" },
      { key: "ckmb", label: "CK-MB", value: "42", unit: "U/L", tone: "crit", ref: "<25" },
      { key: "pcr", label: "PCR", value: "12", unit: "mg/L", tone: "warn", ref: "<3" },
      { key: "glu", label: "Glicemia", value: "178", unit: "mg/dL", tone: "warn", ref: "70-110" },
      { key: "cr", label: "Creatinina", value: "1.1", unit: "mg/dL", ref: "0.7-1.2" },
      { key: "k", label: "Potasio", value: "4.2", unit: "mmol/L", ref: "3.5-5.0" },
      { key: "ph", label: "pH art.", value: "7.36", tone: "ok", ref: "7.35-7.45" },
      { key: "hco3", label: "HCO₃⁻", value: "22", unit: "mmol/L", ref: "22-26" },
      { key: "lact-art", label: "Lactato art.", value: "2.9", unit: "mmol/L", tone: "warn", ref: "<2.0" },
    ],
    goal: "Sostén la perfusión mientras el daño isquémico progresa.",
    simulation: { shockType: "cardiogenic", severity: 1.2, initialContractility: 0.75, initialLactate: 2.9 },
  },
  {
    id: "choque",
    title: "Choque cardiogénico",
    blurb: "Hipoperfusión severa secundaria a falla cardíaca aguda.",
    age: 71,
    sex: "F",
    severity: "Crítica",
    recommended: true,
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
    paraclinicos: [
      { key: "trop", label: "Troponina I", value: "8.2", unit: "ng/mL", tone: "crit", ref: "<0.04" },
      { key: "ntprobnp", label: "NT-proBNP", value: "12.500", unit: "pg/mL", tone: "crit", ref: "<300" },
      { key: "cr", label: "Creatinina", value: "2.1", unit: "mg/dL", tone: "crit", ref: "0.7-1.2" },
      { key: "urea", label: "Urea", value: "88", unit: "mg/dL", tone: "crit", ref: "15-45" },
      { key: "na", label: "Sodio", value: "131", unit: "mmol/L", tone: "warn", ref: "135-145" },
      { key: "k", label: "Potasio", value: "5.2", unit: "mmol/L", tone: "warn", ref: "3.5-5.0" },
      { key: "ph", label: "pH art.", value: "7.24", tone: "crit", ref: "7.35-7.45" },
      { key: "hco3", label: "HCO₃⁻", value: "15", unit: "mmol/L", tone: "crit", ref: "22-26" },
      { key: "eb", label: "Exceso base", value: "-9", unit: "mmol/L", tone: "crit", ref: "-2 a +2" },
      { key: "lact-art", label: "Lactato art.", value: "5.4", unit: "mmol/L", tone: "crit", ref: "<2.0" },
    ],
    goal: "Revierte la hipoperfusión antes de que el daño sea irreversible.",
    simulation: { shockType: "cardiogenic", severity: 3.0, initialContractility: 0.40, initialLactate: 5.4 },
  },
];

/* ---------------------------------------------------------------- custom */

const CUSTOM_KEY = "cardiotwin.customCases.v1";

/** Lee los casos que el usuario ha creado en este navegador. */
export function loadCustomCases(): ClinicalCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ClinicalCase[];
    // Marca custom por si el JSON quedo sin el flag
    return arr.map((c) => ({ ...c, custom: true }));
  } catch {
    return [];
  }
}

export function saveCustomCases(cases: ClinicalCase[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(cases));
  } catch {
    /* quota o storage bloqueado: se pierde silenciosamente, no es critico */
  }
}

/**
 * Sintetiza un caso completo a partir del preset guiado. La UI del modal
 * "Crear caso" pide solo lo esencial y esta funcion rellena vitales,
 * derivados y paraclinicos de forma coherente con la patologia elegida.
 * No pretende ser clinicamente exacto; pretende ser INTERNAMENTE coherente.
 */
export type CustomCaseInput = {
  title: string;
  age: number;
  sex: Sex;
  background: string;
  pathology: "cardiogenic" | "hypovolemic" | "septic" | "tachyarrhythmia" | "none";
  severity: number; // 0-3
  initialHr?: number;
  initialContractility?: number;
  initialLactate?: number;
  goal?: string;
};

const PATHOLOGY_LABEL: Record<CustomCaseInput["pathology"], string> = {
  cardiogenic: "Cardiogénico",
  hypovolemic: "Hipovolémico",
  septic: "Séptico",
  tachyarrhythmia: "Taquiarritmia",
  none: "Sin insulto",
};

export function synthesizeCustomCase(input: CustomCaseInput): ClinicalCase {
  const sev = input.severity;
  const tone: Tone = sev >= 2.5 ? "crit" : sev >= 1.2 ? "warn" : "ok";
  const severityLabel: Severity =
    sev >= 2.5 ? "Crítica" : sev >= 1.2 ? "Alta" : "Moderada";

  // Vitales base y ajustes por patologia + severidad. Es sintesis
  // razonable, no clinica: sirve para que el caso se vea completo antes
  // de que el motor tome el control.
  const hr =
    input.initialHr ??
    (input.pathology === "tachyarrhythmia"
      ? 150 + Math.round(sev * 6)
      : 80 + Math.round(sev * 12));
  const map = Math.max(48, 92 - Math.round(sev * 11));
  const sbp = Math.round(map + 22);
  const dbp = Math.round(map - 15);
  const spo2 =
    input.pathology === "cardiogenic"
      ? Math.max(84, 97 - Math.round(sev * 2.5))
      : 96 - Math.round(sev);
  const rr = 16 + Math.round(sev * 3);
  const lactate = input.initialLactate ?? Math.max(1.0, 1.2 + sev * 1.1);
  const co =
    input.pathology === "cardiogenic"
      ? Math.max(2.0, 5.0 - sev * 0.9)
      : Math.max(2.5, 4.8 - sev * 0.5);
  const cr = Math.min(3.0, 0.9 + sev * 0.35);
  const trop =
    input.pathology === "cardiogenic" ? Math.min(20, 0.05 + sev * 2.1) : 0.02;
  const bnp = Math.round(
    input.pathology === "cardiogenic" ? 500 + sev * 3500 : 120 + sev * 200,
  );
  const ph = Math.max(7.15, 7.42 - sev * 0.05);
  const hco3 = Math.max(12, 25 - sev * 3);

  const paraclinicos: LabRow[] = [
    { key: "trop", label: "Troponina I", value: trop.toFixed(2), unit: "ng/mL", tone: trop > 0.04 ? "crit" : "ok", ref: "<0.04" },
    { key: "ntprobnp", label: "NT-proBNP", value: bnp.toLocaleString("es-CO"), unit: "pg/mL", tone: bnp > 900 ? "crit" : bnp > 300 ? "warn" : "ok", ref: "<300" },
    { key: "cr", label: "Creatinina", value: cr.toFixed(1), unit: "mg/dL", tone: cr > 1.4 ? "crit" : cr > 1.2 ? "warn" : "ok", ref: "0.7-1.2" },
    { key: "na", label: "Sodio", value: String(Math.max(128, 138 - Math.round(sev * 2))), unit: "mmol/L", ref: "135-145" },
    { key: "k", label: "Potasio", value: (4.0 + (input.pathology === "cardiogenic" ? sev * 0.25 : 0)).toFixed(1), unit: "mmol/L", ref: "3.5-5.0" },
    { key: "ph", label: "pH art.", value: ph.toFixed(2), tone: ph < 7.30 ? "crit" : ph < 7.35 ? "warn" : "ok", ref: "7.35-7.45" },
    { key: "hco3", label: "HCO₃⁻", value: String(Math.round(hco3)), unit: "mmol/L", tone: hco3 < 18 ? "crit" : hco3 < 22 ? "warn" : "ok", ref: "22-26" },
    { key: "lact-art", label: "Lactato art.", value: lactate.toFixed(1), unit: "mmol/L", tone: lactate > 4 ? "crit" : lactate > 2 ? "warn" : "ok", ref: "<2.0" },
  ];

  if (input.pathology === "tachyarrhythmia") {
    paraclinicos.splice(2, 0,
      { key: "tsh", label: "TSH", value: "0.09", unit: "mUI/L", tone: "warn", ref: "0.4-4.5" },
      { key: "mg", label: "Magnesio", value: "1.6", unit: "mg/dL", tone: "warn", ref: "1.7-2.4" },
    );
  }
  if (input.pathology === "septic") {
    paraclinicos.splice(0, 0,
      { key: "pcr", label: "PCR", value: String(50 + Math.round(sev * 80)), unit: "mg/L", tone: "crit", ref: "<3" },
      { key: "leuco", label: "Leucocitos", value: (12 + sev * 3).toFixed(1), unit: "×10³/µL", tone: "warn", ref: "4-11" },
    );
  }

  const id = `custom-${Date.now().toString(36)}`;
  const simulation: SimulationPreset =
    input.pathology === "tachyarrhythmia"
      ? {
          shockType: "none",
          initialHr: hr,
          hrBaseline: Math.max(120, hr - 15),
          initialLactate: lactate,
        }
      : input.pathology === "none"
      ? { shockType: "none", initialLactate: lactate }
      : {
          shockType: input.pathology,
          severity: sev,
          initialContractility: input.initialContractility,
          initialLactate: lactate,
        };

  return {
    id,
    title: input.title || `Caso ${PATHOLOGY_LABEL[input.pathology]}`,
    blurb: `${PATHOLOGY_LABEL[input.pathology]} — severidad ${sev.toFixed(1)}.`,
    age: input.age,
    sex: input.sex,
    severity: severityLabel,
    recommended: true,
    custom: true,
    summary: `Paciente ${input.sex === "M" ? "masculino" : "femenino"} de ${input.age} años. Antecedente: ${input.background || "no referido"}. Presentación compatible con ${PATHOLOGY_LABEL[input.pathology].toLowerCase()} de severidad ${severityLabel.toLowerCase()}.`,
    background: input.background || PATHOLOGY_LABEL[input.pathology],
    vitals: [
      { key: "hr", label: "Frecuencia cardiaca", value: String(hr), unit: "lpm", tone: hr > 130 ? "crit" : hr > 100 ? "warn" : undefined, trend: true },
      { key: "bp", label: "Presión arterial", value: `${sbp}/${dbp}`, unit: "mmHg", tone },
      { key: "map", label: "MAP", value: String(map), unit: "mmHg", tone },
      { key: "spo2", label: "SpO₂", value: String(spo2), unit: "%", tone: spo2 < 90 ? "crit" : spo2 < 94 ? "warn" : undefined },
      { key: "rr", label: "Frecuencia respiratoria", value: String(rr), unit: "rpm", tone: rr > 24 ? "warn" : undefined },
    ],
    derived: [
      { key: "lactate", label: "Lactato", value: lactate.toFixed(1), unit: "mmol/L", tone: lactate > 4 ? "crit" : lactate > 2 ? "warn" : undefined },
      { key: "co", label: "Gasto cardiaco", value: co.toFixed(1), unit: "L/min", tone },
      { key: "perf", label: "Perfusión", value: tone === "crit" ? "Crítica" : tone === "warn" ? "Reducida" : "Adecuada", tone },
      { key: "hemo", label: "Estado hemodinámico", value: tone === "crit" ? "Crítico" : tone === "warn" ? "Inestable" : "Estable", tone },
      { key: "rhythm", label: "Ritmo", value: input.pathology === "tachyarrhythmia" ? "FA con RVR" : "Sinusal", tone: input.pathology === "tachyarrhythmia" ? "crit" : "ok" },
    ],
    paraclinicos,
    goal: input.goal || "Estabiliza al paciente y evita la progresión del deterioro.",
    simulation,
  };
}

/* ---------------------------------------------------------------- misc */

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

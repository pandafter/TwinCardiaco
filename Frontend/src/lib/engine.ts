/**
 * Motor fisiológico local (mock).
 *
 * Existe para que el monitor se vea vivo sin depender del backend. El payload
 * que produce es EL MISMO que emite `Backend/cardiotwin/physiology.py` en
 * `PhysioState.vitals()` y `assess_state()`, de modo que cambiar a datos
 * reales sea sustituir la fuente en `usePatientState`, no reescribir la UI.
 *
 * El backend integra un modelo 0D de dos compartimentos con barorreflejo.
 * Esto NO lo replica: aproxima la misma cadena causal con ecuaciones simples
 * y un guion determinista, para que la demo salga igual siempre.
 *
 *   PULSO ↑ → LLENADO ↓ → BOMBEO ↓ → PRESIÓN ↓ → OXÍGENO ↓
 */

export type Rhythm = "sinus" | "sinus_tach" | "afib_rvr";
export type Status = "stable" | "unstable" | "critical";
export type Trend = "worsening" | "steady" | "improving";

/** Espejo de PhysioState.vitals() del backend. */
export type Vitals = {
  t: number;
  hr: number;
  sbp: number;
  dbp: number;
  map: number;
  spo2: number;
  rr: number;
  lactate: number;
  co: number;
  ci: number;
  sv: number;
  cvp: number;
  pcwp: number;
  svr: number;
  do2: number;
  o2er: number;
  rhythm: Rhythm;
  perfusion_index: number;
  temp: number;
};

/** Espejo de assess_state() del backend. */
export type Assessment = {
  status: Status;
  label: string;
  critical_criteria: string[];
  instability_criteria: string[];
  hemodynamic_phenotype: string | null;
  /** Trayectoria del MODELO sin intervenir. No es predicción clínica. */
  time_to_critical_s: number | null;
  deterioration_risk: number;
  trend: Trend;
  /** 0–1, qué tanto alcanza a llenarse el ventrículo entre latidos */
  filling_pct: number;
};

export type Frame = { vitals: Vitals; assess: Assessment };

const SV_MAX = 95; // mL
const SYSTOLE = 0.28; // s, la sístole no se acorta tanto como el ciclo
const FILL_DEN = 0.445; // s de diástole para llenado completo
const SVR_BASE = 900;
const BSA = 1.73;
const LACTATE_THRESHOLD = 0.75; // perfusión por debajo de la cual se acumula
const LACTATE_GAIN = 0.5;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Guion del deterioro, reproducible: la demo tiene que salir igual siempre. */
function scriptedHr(t: number) {
  if (t < 30) return 78;
  // la taquicardia entra de golpe y luego trepa
  if (t < 130) return 108 + ((t - 30) / 100) * 34;
  return 142 + Math.min(12, (t - 130) * 0.05);
}

function scriptedRhythm(t: number, hr: number): Rhythm {
  if (t < 30) return "sinus";
  return hr > 100 ? "sinus_tach" : "sinus";
}

/**
 * Ruido determinista: mismo t, mismo valor. Nada de Math.random.
 *
 * Usa un hash entero y no Math.sin: la precisión de las funciones
 * trigonométricas NO está garantizada bit a bit entre motores JS, y la
 * diferencia se acumulaba a lo largo del arranque hasta romper la hidratación
 * (servidor y cliente dibujaban coordenadas distintas en el último decimal).
 * Con enteros de 32 bits el resultado es idéntico en cualquier plataforma.
 */
function noise(t: number, seed: number, amp: number) {
  let x = (Math.round(t * 1000) ^ Math.imul(seed, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return (x / 0xffffffff - 0.5) * 2 * amp;
}

export class Engine {
  t = 0;
  private lactate = 0.9;
  private svr = SVR_BASE;
  private contractility = 1;
  private mapS = 88;
  private mapSlope = 0;
  private history: Vitals[] = [];
  private lastCo = 7.4;

  /** Efectos farmacológicos activos, como drug_* en PhysioState del backend. */
  private drugContractility = 0;
  private drugSvr = 0;
  private drugHr = 0;
  private onset = 0; // s que tarda el fármaco en alcanzar su efecto pleno
  /** instante de la intervención, null si no se ha aplicado ninguna */
  interventionAt: number | null = null;
  interventionKey: string | null = null;
  private mapAtIntervention = 0;
  private coAtIntervention = 0;
  private hrBaseAtIntervention = 0;

  constructor(
    startAt = 0,
    intervention?: { at: number; key: string; efficacy?: number },
  ) {
    const dt = 0.25;
    const steps = Math.round(startAt / dt);
    for (let i = 0; i < steps; i++) {
      if (intervention && this.interventionAt === null && this.t >= intervention.at)
        this.applyIntervention(intervention.key, intervention.efficacy);
      this.step(dt);
    }
  }

  /**
   * Aplica una intervención. Los coeficientes son los de
   * Backend/cardiotwin/interventions.py: _inotrope y _vasopressor.
   *
   * El inotrópico sube la contractilidad y baja la SVR (vasodilatación
   * beta-2); el vasopresor hace lo contrario. Esa diferencia es lo que hace
   * que uno mejore el gasto y el otro solo la presión.
   */
  applyIntervention(key: string, efficacy = 1) {
    this.interventionAt = this.t;
    this.interventionKey = key;
    this.mapAtIntervention = this.mapS;
    this.coAtIntervention = this.lastCo;
    // El guion representa la progresión natural de la enfermedad. Una vez se
    // interviene deja de mandar: a partir de aquí el estado lo decide la
    // fisiología, no el reloj.
    this.hrBaseAtIntervention = scriptedHr(this.t);

    // `efficacy` escala el efecto: 0 = "¿y si el fármaco no le hace efecto?",
    // 0.5 = media dosis. Es lo que permite responder preguntas en lenguaje
    // natural sin salirse del espacio de parámetros del motor.
    const e = clamp(efficacy, 0, 2);

    if (key === "inotrope") {
      this.drugContractility += 0.38 * e;
      this.drugSvr -= 0.22 * e;
      this.drugHr += 14 * e;
      this.onset = 45;
    } else if (key === "vasopressor") {
      this.drugContractility += 0.12 * e;
      this.drugSvr += 0.5 * e;
      this.drugHr += 5 * e;
      this.onset = 30;
    } else if (key === "fluid") {
      this.drugContractility += 0.18 * e;
      this.onset = 60;
    }
  }

  /** 0→1 según el tiempo transcurrido desde la intervención. */
  private drugRamp() {
    if (this.interventionAt === null) return 0;
    if (this.onset <= 0) return 1;
    return clamp((this.t - this.interventionAt) / this.onset, 0, 1);
  }

  step(dt: number): Frame {
    this.t += dt;
    const t = this.t;

    const ramp = this.drugRamp();

    // La taquicardia era compensatoria por gasto bajo: cuando el gasto se
    // recupera, cede. Se mide sobre el gasto y no sobre la presión, porque un
    // vasopresor sube la presión sin resolver la causa.
    const baroRelief =
      this.interventionAt === null
        ? 0
        : clamp((this.lastCo - this.coAtIntervention) * 12, 0, 32);

    const scripted =
      this.interventionAt === null ? scriptedHr(t) : this.hrBaseAtIntervention;
    const hrBase = scripted + this.drugHr * ramp - baroRelief;
    const hr = hrBase + noise(t, 1, hrBase * 0.015);
    const rhythm = scriptedRhythm(t, hr);

    // PULSO ↑ → LLENADO ↓
    const tDiastole = Math.max(0.05, 60 / hr - SYSTOLE);
    const filling = clamp(tDiastole / FILL_DEN, 0, 1);

    // la isquemia debilita la bomba
    const targetContractility = clamp(
      1 - Math.max(0, this.lactate - 2) * 0.045,
      0.72,
      1,
    );
    this.contractility += (targetContractility - this.contractility) * dt * 0.4;

    // LLENADO ↓ → BOMBEO ↓
    // La SVR es poscarga: en un ventrículo fallido, subirla REDUCE el
    // volumen sistólico. Es lo que hace que el vasopresor suba la presión
    // mientras el gasto no mejora (Backend/cardiotwin/interventions.py).
    const svrEff = this.svr * (1 + this.drugSvr * ramp);
    const afterload = clamp(1 - (svrEff / SVR_BASE - 1) * 0.3, 0.55, 1.12);

    const svRaw =
      SV_MAX *
      filling *
      this.contractility *
      (1 + this.drugContractility * ramp) *
      afterload;
    // meseta de Frank-Starling: por encima del volumen normal el ventrículo
    // deja de responder. Solo satura por arriba, no toca el rango basal.
    const sv = svRaw <= SV_MAX ? svRaw : SV_MAX + (svRaw - SV_MAX) * 0.3;
    const co = (sv * hr) / 1000;
    const ci = co / BSA;
    this.lastCo = co;

    // vasoconstricción compensatoria (barorreflejo, muy simplificado)
    const targetSvr = SVR_BASE * (1 + clamp(75 - this.mapS, 0, 40) * 0.0075);
    this.svr += (targetSvr - this.svr) * dt * 0.25;

    // BOMBEO ↓ → PRESIÓN ↓
    const prevMap = this.mapS;
    this.mapS = (co * svrEff) / 80 + 4;
    const map = this.mapS + noise(t, 2, 0.6);
    this.mapSlope += ((this.mapS - prevMap) / dt - this.mapSlope) * dt * 0.15;

    // PRESIÓN ↓ → OXÍGENO ↓
    // La perfusión tisular depende del FLUJO, no solo de la presión. Con solo
    // la MAP, un vasopresor "resolvía" la hipoperfusión subiendo el número
    // sin mover el gasto — que es precisamente el error que el gemelo debe
    // dejar en evidencia.
    const perfusion = clamp(
      (this.mapS / 85) * 0.45 + (co / 7.4) * 0.55,
      0,
      1,
    );
    this.lactate +=
      (perfusion < LACTATE_THRESHOLD
        ? (LACTATE_THRESHOLD - perfusion) * LACTATE_GAIN
        : -0.018 * this.lactate) * dt;
    this.lactate = clamp(this.lactate, 0.5, 18);

    const spo2 = 97 - (1 - perfusion) * 24 + noise(t, 3, 0.5);
    const rr = 14 + (1 - perfusion) * 30 + noise(t, 4, 0.6);
    const temp = 36.9 - (1 - perfusion) * 0.6 + noise(t, 5, 0.05);
    const sbp = map * 1.345 + noise(t, 6, 1.2);
    const dbp = map * 0.827 + noise(t, 7, 0.9);

    // el volumen se represa cuando la bomba falla
    const cvp = 5 + clamp((1 - this.contractility) * 40, 0, 12);
    const pcwp = 8 + clamp((1 - this.contractility) * 55, 0, 16);

    // transporte de oxígeno
    const do2 = co * 15 * 1.34 * (spo2 / 100) * 10;
    const o2er = clamp(250 / Math.max(do2, 1), 0, 0.62);

    const vitals: Vitals = {
      t: Math.round(t * 10) / 10,
      hr,
      sbp,
      dbp,
      map,
      spo2,
      rr,
      lactate: this.lactate,
      co,
      ci,
      sv,
      cvp,
      pcwp,
      svr: this.svr,
      do2,
      o2er,
      rhythm,
      perfusion_index: perfusion,
      temp,
    };

    this.history.push(vitals);
    if (this.history.length > 1250) this.history.shift(); // 5 min a 4 Hz

    return { vitals, assess: this.assess(vitals, filling) };
  }

  /** Mismos umbrales que Backend/cardiotwin/interventions.py: assess_state(). */
  private assess(v: Vitals, filling: number): Assessment {
    const crit: string[] = [];
    const unstable: string[] = [];

    if (v.map < 60) crit.push(`MAP ${v.map.toFixed(0)} < 60 mmHg`);
    else if (v.map < 70) unstable.push(`MAP ${v.map.toFixed(0)} < 70 mmHg`);

    if (v.lactate > 4) crit.push(`Lactato ${v.lactate.toFixed(1)} > 4.0 mmol/L`);
    else if (v.lactate > 2)
      unstable.push(`Lactato ${v.lactate.toFixed(1)} > 2.0 mmol/L`);

    if (v.ci < 1.8) crit.push(`Índice cardiaco ${v.ci.toFixed(1)} < 1.8`);
    else if (v.ci < 2.2) unstable.push(`Índice cardiaco ${v.ci.toFixed(1)} < 2.2`);

    if (v.spo2 < 88) crit.push(`SpO₂ ${v.spo2.toFixed(0)}% < 88%`);
    else if (v.spo2 < 94) unstable.push(`SpO₂ ${v.spo2.toFixed(0)}% < 94%`);

    if (v.do2 < 330) crit.push(`DO₂ ${v.do2.toFixed(0)} < 330 mL/min`);
    if (v.hr > 110) unstable.push(`FC ${v.hr.toFixed(0)} > 110 lpm`);

    const status: Status = crit.length
      ? "critical"
      : unstable.length
        ? "unstable"
        : "stable";
    const label = crit.length
      ? "ESTADO CRÍTICO"
      : unstable.length
        ? "HEMODINÁMICA INESTABLE"
        : "ESTABLE";

    let phenotype: string | null = null;
    if (v.ci < 2.2 && v.pcwp > 18)
      phenotype = "patrón cardiogénico (CI bajo con presiones de llenado altas)";
    else if (v.ci < 2.2 && v.pcwp < 10)
      phenotype = "patrón hipovolémico (CI bajo con presiones de llenado bajas)";
    else if (v.ci > 3.5 && v.svr < 800)
      phenotype = "patrón distributivo (gasto alto con resistencia baja)";

    // Si YA está crítico, el tiempo restante es cero: devolver null aquí
    // ("no cruza") es el mismo falso negativo que el backend corrigió en
    // time_to_critical(). El monitor muestra 00:00, no "--:--".
    const time_to_critical_s =
      status === "critical"
        ? 0
        : status === "unstable" && this.mapSlope < -0.005
          ? clamp((this.mapS - 50) / -this.mapSlope, 0, 99 * 60)
          : null;

    return {
      status,
      label,
      critical_criteria: crit,
      instability_criteria: unstable,
      hemodynamic_phenotype: phenotype,
      time_to_critical_s,
      deterioration_risk: Math.round(
        clamp((1 - v.perfusion_index) * 170 + (v.lactate - 1) * 7, 0, 99),
      ),
      trend:
        this.mapSlope < -0.01
          ? "worsening"
          : this.mapSlope > 0.01
            ? "improving"
            : "steady",
      filling_pct: filling,
    };
  }

  getHistory(): Vitals[] {
    return this.history;
  }
}

/* ------------------------------------------------------- umbrales de alarma */

export type Level = "ok" | "warn" | "crit";

export const LEVEL: Record<string, (v: number) => Level> = {
  hr: (v) => (v > 120 ? "crit" : v > 100 || v < 60 ? "warn" : "ok"),
  sbp: (v) => (v < 90 ? "crit" : v < 100 ? "warn" : "ok"),
  // mismos cortes que assess(): crítico <60, inestable <70. Antes la UI
  // pintaba crítico en 65 mientras el estado global decía 60: dos verdades.
  map: (v) => (v < 60 ? "crit" : v < 70 ? "warn" : "ok"),
  spo2: (v) => (v < 92 ? "crit" : v < 95 ? "warn" : "ok"),
  rr: (v) => (v > 26 ? "crit" : v > 22 ? "warn" : "ok"),
  lactate: (v) => (v > 4 ? "crit" : v > 2 ? "warn" : "ok"),
  temp: (v) => (v < 35.5 || v > 38.3 ? "crit" : v < 36 || v > 37.8 ? "warn" : "ok"),
};

/**
 * Presentación única del estado hemodinámico. Antes cada pantalla decidía su
 * color y casi todas pintaban rojo fijo: un paciente estable salía en alarma.
 */
export const STATUS_UI: Record<
  Status,
  { label: string; color: string; border: string; bg: string; note: string }
> = {
  stable: {
    label: "ESTABLE",
    color: "var(--ok)",
    border: "rgba(63,191,127,0.35)",
    bg: "rgba(63,191,127,0.07)",
    note: "Sin criterios de inestabilidad. Monitorización continua.",
  },
  unstable: {
    label: "HEMODINÁMICA INESTABLE",
    color: "var(--warn)",
    border: "rgba(224,163,64,0.4)",
    bg: "rgba(224,163,64,0.07)",
    note: "Deterioro en curso. Requiere evaluación e intervención.",
  },
  critical: {
    label: "ESTADO CRÍTICO",
    color: "var(--crit)",
    border: "rgba(229,72,77,0.4)",
    bg: "rgba(229,72,77,0.07)",
    note: "Criterios críticos cumplidos. Intervención inmediata.",
  },
};

export function trendUI(trend: Trend) {
  // "empeorando ↑" era ambiguo: ¿sube qué? La flecha ahora es de rumbo.
  return trend === "worsening"
    ? { label: "Empeorando", glyph: "↘", color: "var(--crit)" }
    : trend === "improving"
      ? { label: "Mejorando", glyph: "↗", color: "var(--ok)" }
      : { label: "Sin cambios", glyph: "→", color: "var(--warn)" };
}

export function rhythmLabel(r: Rhythm) {
  return r === "afib_rvr"
    ? "Fibrilación auricular con RVR"
    : r === "sinus_tach"
      ? "Taquicardia sinusal"
      : "Ritmo sinusal";
}

export function mmss(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* --------------------------------------------------------- eventos del caso */

export type CaseEvent = {
  t: number;
  strong: string;
  rest: string;
  color: string;
  crit?: boolean;
};

/**
 * Eventos derivados de la historia REAL: el primer instante en que cada
 * variable cruzó su umbral. Antes el feed y la línea de tiempo eran texto
 * quemado con horas fijas — decían "MAP cayó por debajo de 60" con la MAP
 * en 88, y eso en una demo es indefendible.
 */
export function caseEvents(history: Vitals[]): CaseEvent[] {
  const out: CaseEvent[] = [];
  const first = (pred: (v: Vitals) => boolean) => history.find(pred);

  const mk = (
    v: Vitals | undefined,
    strong: string,
    rest: (v: Vitals) => string,
    color: string,
    crit = false,
  ) => {
    if (v) out.push({ t: v.t, strong, rest: rest(v), color, crit });
  };

  mk(first((v) => v.hr > 100), "Frecuencia cardiaca", (v) => ` superó 100 bpm (${Math.round(v.hr)})`, "var(--warn)");
  mk(first((v) => v.rhythm !== "sinus"), "Ritmo", (v) => `: ${rhythmLabel(v.rhythm).toLowerCase()}`, "var(--crit)");
  mk(first((v) => v.hr > 120), "Taquicardia", () => " sostenida > 120 bpm", "var(--crit)");
  mk(first((v) => v.map < 70), "MAP", (v) => ` cayó por debajo de 70 mmHg (${Math.round(v.map)})`, "var(--warn)");
  mk(first((v) => v.lactate > 2), "Lactato", (v) => ` superó 2.0 mmol/L (${v.lactate.toFixed(1)})`, "var(--violet)");
  mk(first((v) => v.spo2 < 94), "SpO₂", (v) => ` por debajo de 94% (${Math.round(v.spo2)}%)`, "var(--info)");
  mk(first((v) => v.map < 60), "MAP crítica", (v) => `: ${Math.round(v.map)} mmHg`, "var(--crit)", true);
  mk(first((v) => v.lactate > 4), "Lactato crítico", (v) => `: ${v.lactate.toFixed(1)} mmol/L`, "var(--crit)", true);

  return out.sort((a, b) => b.t - a.t);
}

/** Reloj de pared del caso, para los timestamps del feed. */
export function caseClock(t: number, base = 13 * 3600 + 58 * 60) {
  const s = Math.floor(base + t);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    hhmm: `${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}`,
    hhmmss: `${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`,
  };
}

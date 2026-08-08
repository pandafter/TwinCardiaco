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
const LACTATE_THRESHOLD = 0.85; // perfusión por debajo de la cual se acumula
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

/** Ruido determinista: mismo t, mismo valor. Nada de Math.random. */
function noise(t: number, seed: number, amp: number) {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amp;
}

export class Engine {
  t = 0;
  private lactate = 0.9;
  private svr = SVR_BASE;
  private contractility = 1;
  private mapS = 88;
  private mapSlope = 0;
  private history: Vitals[] = [];

  constructor(startAt = 0) {
    const dt = 0.25;
    for (let i = 0; i < Math.round(startAt / dt); i++) this.step(dt);
  }

  step(dt: number): Frame {
    this.t += dt;
    const t = this.t;

    const hrBase = scriptedHr(t);
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
    const sv = SV_MAX * filling * this.contractility;
    const co = (sv * hr) / 1000;
    const ci = co / BSA;

    // vasoconstricción compensatoria (barorreflejo, muy simplificado)
    const targetSvr = SVR_BASE * (1 + clamp(75 - this.mapS, 0, 40) * 0.0075);
    this.svr += (targetSvr - this.svr) * dt * 0.25;

    // BOMBEO ↓ → PRESIÓN ↓
    const prevMap = this.mapS;
    this.mapS = (co * this.svr) / 80 + 4;
    const map = this.mapS + noise(t, 2, 0.6);
    this.mapSlope += ((this.mapS - prevMap) / dt - this.mapSlope) * dt * 0.15;

    // PRESIÓN ↓ → OXÍGENO ↓
    const perfusion = clamp(this.mapS / 85, 0, 1);
    this.lactate +=
      (perfusion < LACTATE_THRESHOLD
        ? (LACTATE_THRESHOLD - perfusion) * LACTATE_GAIN
        : -0.06 * this.lactate) * dt;
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

    const time_to_critical_s =
      status === "unstable" && this.mapSlope < -0.005
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
  map: (v) => (v < 65 ? "crit" : v < 70 ? "warn" : "ok"),
  spo2: (v) => (v < 92 ? "crit" : v < 95 ? "warn" : "ok"),
  rr: (v) => (v > 26 ? "crit" : v > 22 ? "warn" : "ok"),
  lactate: (v) => (v > 4 ? "crit" : v > 2 ? "warn" : "ok"),
  temp: (v) => (v < 35.5 || v > 38.3 ? "crit" : v < 36 || v > 37.8 ? "warn" : "ok"),
};

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

/** Reloj de pared del caso, para los timestamps del feed. */
export function caseClock(t: number, base = 13 * 3600 + 58 * 60) {
  const s = Math.floor(base + t);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    hhmm: `${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}`,
    hhmmss: `${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`,
  };
}

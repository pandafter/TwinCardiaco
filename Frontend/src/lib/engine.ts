/**
 * Motor fisiológico. Vive aislado: los componentes solo dibujan lo que reciben.
 * Hoy corre local a 4 ticks/s; mañana se reemplaza por el stream real sin
 * tocar la UI.
 *
 * La cadena que todo el producto hace visible:
 *   PULSO ↑ → LLENADO ↓ → BOMBEO ↓ → PRESIÓN ↓ → OXÍGENO ↓
 */

export type Rhythm = "SINUS" | "AFIB_RVR";
export type Status = "STABLE" | "UNSTABLE" | "CRITICAL";
export type Trend = "WORSENING" | "STEADY" | "IMPROVING";

export type PatientState = {
  /** segundos desde el inicio del caso */
  t: number;
  vitals: {
    hr: number;
    sbp: number;
    dbp: number;
    map: number;
    spo2: number;
    rr: number;
    lactate: number;
    temp: number;
    rhythm: Rhythm;
  };
  derived: {
    cardiacOutput: number;
    strokeVolume: number;
    /** 0–1, qué tanto alcanza a llenarse el ventrículo entre latidos */
    fillingPct: number;
    perfusion: number;
    status: Status;
    /** segundos hasta estado crítico, null si no hay deterioro proyectado */
    timeToCritical: number | null;
    /** 0–100 */
    deteriorationRisk: number;
    trend: Trend;
  };
};

export type Sample = {
  t: number;
  hr: number;
  map: number;
  spo2: number;
  lactate: number;
  rr: number;
  temp: number;
  sbp: number;
  dbp: number;
};

const SV_MAX = 95; // mL, volumen sistólico máximo
const SYSTOLE = 0.22; // s, duración de la sístole
const FILL_DEN = 0.42; // s, diástole necesaria para llenado completo
const SVR_BASE = 900;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Guion del deterioro. Reproducible: la demo tiene que salir igual siempre. */
function scriptedHr(t: number) {
  if (t < 30) return 78;
  if (t < 120) return 130 + ((t - 30) / 90) * 30;
  return 160 + Math.min(14, (t - 120) * 0.09);
}

function scriptedRhythm(t: number): Rhythm {
  return t < 30 ? "SINUS" : "AFIB_RVR";
}

/** Ruido determinista: mismo t, mismo valor. Sin Math.random. */
function noise(t: number, seed: number, amp: number) {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amp;
}

export class Engine {
  t = 0;
  private lactate = 0.9;
  private svr = SVR_BASE;
  private contractility = 1;
  private map = 88;
  private mapSlope = 0; // mmHg/s, media móvil
  private history: Sample[] = [];

  constructor(startAt = 0) {
    // avanzar hasta startAt genera además el historial de la ventana visible
    const dt = 0.25;
    for (let i = 0; i < Math.round(startAt / dt); i++) this.step(dt);
  }

  step(dt: number): PatientState {
    this.t += dt;
    const t = this.t;

    const rhythm = scriptedRhythm(t);
    const hr = scriptedHr(t) + noise(t, 1, scriptedHr(t) * 0.015);

    // PULSO ↑ → LLENADO ↓
    const tDiastole = Math.max(0.05, 60 / hr - SYSTOLE);
    const fillingPct = clamp(tDiastole / FILL_DEN, 0, 1);

    // la isquemia debilita la bomba
    const targetContractility = clamp(1 - Math.max(0, this.lactate - 2) * 0.045, 0.72, 1);
    this.contractility += (targetContractility - this.contractility) * dt * 0.4;

    // LLENADO ↓ → BOMBEO ↓
    const strokeVolume =
      SV_MAX * fillingPct * this.contractility * (rhythm === "AFIB_RVR" ? 0.82 : 1);
    const cardiacOutput = (strokeVolume * hr) / 1000;

    // vasoconstricción compensatoria
    const targetSvr = SVR_BASE * (1 + clamp(75 - this.map, 0, 40) * 0.0075);
    this.svr += (targetSvr - this.svr) * dt * 0.25;

    // BOMBEO ↓ → PRESIÓN ↓
    const prevMap = this.map;
    this.map = (cardiacOutput * this.svr) / 80 + 4;
    const map = this.map + noise(t, 2, 0.6);
    this.mapSlope += ((this.map - prevMap) / dt - this.mapSlope) * dt * 0.5;

    // PRESIÓN ↓ → OXÍGENO ↓
    const perfusion = clamp(this.map / 85, 0, 1);
    this.lactate +=
      (perfusion < 0.85 ? (0.85 - perfusion) * 0.9 : -0.06 * this.lactate) * dt;
    this.lactate = clamp(this.lactate, 0.5, 18);

    const spo2 = 97 - (1 - perfusion) * 24 + noise(t, 3, 0.5);
    const rr = 14 + (1 - perfusion) * 30 + noise(t, 4, 0.6);
    const temp = 36.9 - (1 - perfusion) * 0.6 + noise(t, 5, 0.05);
    const sbp = map * 1.345 + noise(t, 6, 1.2);
    const dbp = map * 0.827 + noise(t, 7, 0.9);

    const status: Status =
      this.map >= 70 && this.lactate < 2.2
        ? "STABLE"
        : this.map >= 52
          ? "UNSTABLE"
          : "CRITICAL";

    // proyección lineal con la pendiente actual de MAP
    const timeToCritical =
      status !== "CRITICAL" && this.mapSlope < -0.005
        ? clamp((this.map - 52) / -this.mapSlope, 0, 99 * 60)
        : null;

    const deteriorationRisk = Math.round(
      clamp((1 - perfusion) * 150 + (this.lactate - 1) * 6, 0, 99),
    );

    const trend: Trend =
      this.mapSlope < -0.01 ? "WORSENING" : this.mapSlope > 0.01 ? "IMPROVING" : "STEADY";

    const sample: Sample = {
      t,
      hr,
      map,
      spo2,
      lactate: this.lactate,
      rr,
      temp,
      sbp,
      dbp,
    };
    this.history.push(sample);
    // ventana de 5 minutos a 4 Hz
    if (this.history.length > 1250) this.history.shift();

    return {
      t,
      vitals: {
        hr,
        sbp,
        dbp,
        map,
        spo2,
        rr,
        lactate: this.lactate,
        temp,
        rhythm,
      },
      derived: {
        cardiacOutput,
        strokeVolume,
        fillingPct,
        perfusion,
        status,
        timeToCritical,
        deteriorationRisk,
        trend,
      },
    };
  }

  /** Copia del historial para los gráficos. */
  getHistory(): Sample[] {
    return this.history;
  }

  /** Estado actual sin avanzar el reloj. */
  peek(): PatientState {
    const saved = {
      t: this.t,
      lactate: this.lactate,
      svr: this.svr,
      contractility: this.contractility,
      map: this.map,
      mapSlope: this.mapSlope,
      len: this.history.length,
    };
    const s = this.step(0.0001);
    this.t = saved.t;
    this.lactate = saved.lactate;
    this.svr = saved.svr;
    this.contractility = saved.contractility;
    this.map = saved.map;
    this.mapSlope = saved.mapSlope;
    this.history.length = saved.len;
    s.t = saved.t;
    return s;
  }
}

/* ------------------------------------------------------- umbrales de alarma */

export type Level = "ok" | "warn" | "crit";

export function hrLevel(v: number): Level {
  return v > 120 ? "crit" : v > 100 || v < 60 ? "warn" : "ok";
}
export function mapLevel(v: number): Level {
  return v < 65 ? "crit" : v < 70 ? "warn" : "ok";
}
export function sbpLevel(v: number): Level {
  return v < 90 ? "crit" : v < 100 ? "warn" : "ok";
}
export function spo2Level(v: number): Level {
  return v < 92 ? "crit" : v < 95 ? "warn" : "ok";
}
export function rrLevel(v: number): Level {
  return v > 26 ? "crit" : v > 22 ? "warn" : "ok";
}
export function lactateLevel(v: number): Level {
  return v > 4 ? "crit" : v > 2 ? "warn" : "ok";
}
export function tempLevel(v: number): Level {
  return v < 35.5 || v > 38.3 ? "crit" : v < 36 || v > 37.8 ? "warn" : "ok";
}

export function rhythmLabel(r: Rhythm, hr: number) {
  if (r === "AFIB_RVR") return "Fibrilación auricular con RVR";
  return hr > 100 ? "Taquicardia sinusal" : "Ritmo sinusal";
}

export function statusLabel(s: Status) {
  return s === "STABLE" ? "ESTABLE" : s === "UNSTABLE" ? "INESTABLE" : "CRÍTICO";
}

export function mmss(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Reloj de pared del caso, para timestamps tipo 14:02:33. */
export function caseClock(t: number, base = 13 * 3600 + 58 * 60) {
  const s = Math.floor(base + t);
  const hh = String(Math.floor(s / 3600) % 24).padStart(2, "0");
  const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { hhmm: `${hh}:${mm}`, hhmmss: `${hh}:${mm}:${ss}` };
}

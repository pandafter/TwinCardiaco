import { Engine, type Status, type Vitals } from "./engine";

/**
 * Compara qué le pasa al MISMO paciente según la decisión que se tome.
 *
 * Las tres ramas arrancan del estado exacto del punto de decisión: se
 * construye un motor por rama y se le aplica su intervención. No hay curvas
 * dibujadas a mano; si se cambia una constante del motor, estas líneas cambian.
 */

export type ScenarioKey = "none" | "inotrope" | "vasopressor";

export type ScenarioPoint = {
  t: number;
  /** minutos respecto al punto de decisión */
  min: number;
  /** índice fisiológico, 0 en el punto de decisión */
  index: number;
  map: number;
  hr: number;
  spo2: number;
  lactate: number;
  /** el tramo que va más allá de "ahora" es proyección, no medición */
  projected: boolean;
};

export type ScenarioResult = {
  key: ScenarioKey;
  points: ScenarioPoint[];
  /** segundos hasta cruzar a crítico; null si no llega en el horizonte */
  timeToCritical: number | null;
  finalStatus: Status;
  /** variación de cada vital respecto al punto de decisión */
  deltas: { hr: number; map: number; spo2: number; lactate: number };
};

export const SCENARIO_META: Record<
  ScenarioKey,
  { letter: string; title: string; sub: string; color: string }
> = {
  none: {
    letter: "A",
    title: "SIN INTERVENIR",
    sub: "Escenario A",
    color: "var(--crit)",
  },
  inotrope: {
    letter: "B",
    title: "INTERVENCIÓN A",
    sub: "Dobutamina",
    color: "var(--ok)",
  },
  vasopressor: {
    letter: "C",
    title: "INTERVENCIÓN B",
    sub: "Noradrenalina",
    color: "var(--warn)",
  },
};

/**
 * El motor corre en tiempo comprimido: 1 s de simulación ≈ 10 s de reloj
 * clínico, igual que el `time_scale` del backend. Así un deterioro de media
 * hora cabe en una demo.
 */
export const TIME_SCALE = 10;

/**
 * Índice fisiológico: cuánto mejor o peor está el paciente respecto al punto
 * de decisión. Positivo = mejora. Vale 0 para las tres ramas en t=0, que es
 * lo que permite compararlas.
 *
 * Satura con tanh y no con un corte duro: si no, las tres curvas llegan al
 * tope en el primer minuto y dejan de distinguirse.
 */
function physIndex(v: Vitals, base: Vitals) {
  const raw =
    (v.map - base.map) / 11 +
    (base.lactate - v.lactate) / 3.5 +
    (v.spo2 - base.spo2) / 7 +
    (base.hr - v.hr) / 45;
  return 3 * Math.tanh(raw / 2.2);
}

export function simulateScenarios({
  decisionAt = 100,
  elapsed = 60,
  horizon = 200,
  dt = 1,
}: {
  /** segundo del caso en el que se toma la decisión */
  decisionAt?: number;
  /** segundos ya transcurridos: lo anterior es medido, lo demás proyectado */
  elapsed?: number;
  /** segundos simulados hacia delante */
  horizon?: number;
  dt?: number;
} = {}): ScenarioResult[] {
  const keys: ScenarioKey[] = ["none", "inotrope", "vasopressor"];

  return keys.map((key) => {
    const engine = new Engine(decisionAt);
    const base = engine.step(0.01).vitals;
    if (key !== "none") engine.applyIntervention(key);

    const points: ScenarioPoint[] = [];
    let timeToCritical: number | null = null;
    let finalStatus: Status = "unstable";
    let last = base;

    // tramo previo a la decisión, común a las tres ramas
    for (const v of engine.getHistory().filter((_, i) => i % 16 === 0).slice(-16)) {
      points.push({
        t: v.t,
        min: ((v.t - decisionAt) * TIME_SCALE) / 60,
        index: physIndex(v, base),
        map: v.map,
        hr: v.hr,
        spo2: v.spo2,
        lactate: v.lactate,
        projected: false,
      });
    }

    for (let s = 0; s < horizon; s += dt) {
      const frame = engine.step(dt);
      const v = frame.vitals;
      last = v;
      finalStatus = frame.assess.status;
      if (timeToCritical === null && frame.assess.status === "critical")
        timeToCritical = s * TIME_SCALE;

      points.push({
        t: v.t,
        min: ((v.t - decisionAt) * TIME_SCALE) / 60,
        index: physIndex(v, base),
        map: v.map,
        hr: v.hr,
        spo2: v.spo2,
        lactate: v.lactate,
        projected: s > elapsed,
      });
    }

    return {
      key,
      points,
      timeToCritical,
      finalStatus,
      deltas: {
        hr: last.hr - base.hr,
        map: last.map - base.map,
        spo2: last.spo2 - base.spo2,
        lactate: last.lactate - base.lactate,
      },
    };
  });
}

/** Flecha doble si el cambio es grande, simple si es moderado, raya si apenas. */
export function arrow(delta: number, scale: number, goodDown = false) {
  const n = delta / scale;
  const dir = n > 0 ? "up" : "down";
  const mag = Math.abs(n);
  const glyph = mag < 0.5 ? "→" : mag < 1.6 ? (dir === "up" ? "↑" : "↓") : dir === "up" ? "↑↑" : "↓↓";
  const improving = goodDown ? delta < 0 : delta > 0;
  return {
    glyph,
    color:
      mag < 0.5 ? "var(--warn)" : improving ? "var(--ok)" : "var(--crit)",
  };
}

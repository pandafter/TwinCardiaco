import type { Rhythm } from "@/lib/engine";

export const QRS_NORMAL_MS = 90;
export const CARDIAC_PATTERN_BEATS = 10;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** Jitter entero determinista: reproducible entre servidor y navegador. */
export function beatJitter(index: number) {
  let value = Math.imul(index + 1, 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x85ebca6b) >>> 0;
  value = (value ^ (value >>> 13)) >>> 0;
  return (value / 0xffffffff - 0.5) * 2;
}

export const isIrregular = (rhythm: Rhythm) => rhythm === "afib_rvr";

export function beatInterval(hr: number, index: number, irregular: boolean) {
  const rr = 60 / Math.max(30, hr);
  return irregular ? rr * (1 + beatJitter(index) * 0.25) : rr;
}

export type CardiacCycle = {
  rrMs: number;
  pDurationMs: number;
  prMs: number;
  qrsStartMs: number;
  qrsMs: number;
  qtMs: number;
  tEndMs: number;
  systoleMs: number;
  diastoleMs: number;
};

/**
 * Intervalos absolutos del ciclo.
 *
 * El QRS conserva su anchura. Al subir la frecuencia se acortan PR, QT y,
 * sobre todo, la línea de base diastólica. Si PR + QT supera el RR, P y T se
 * solapan de forma visible, como en una taquicardia real.
 */
export function cardiacCycle(
  hr: number,
  rhythm: Rhythm,
  ischemia = 0,
  qrsMs = QRS_NORMAL_MS,
  rrSeconds = 60 / Math.max(30, hr),
): CardiacCycle {
  const rrMs = rrSeconds * 1000;
  const prMs = clamp(160 - 0.25 * (hr - 60), 110, 200);
  const qrsStartMs = rhythm === "afib_rvr" ? 0 : prMs;
  const qtcMs = 400 + 60 * clamp(ischemia, 0, 1);
  const qtMs = Math.max(qrsMs + 100, qtcMs * Math.sqrt(rrSeconds));
  const tEndMs = qrsStartMs + qtMs;
  const systoleMs = Math.min(
    rrMs * 0.78,
    Math.max(150, 300 * Math.sqrt(rrSeconds)),
  );
  return {
    rrMs,
    pDurationMs: 90,
    prMs,
    qrsStartMs,
    qrsMs,
    qtMs,
    tEndMs,
    systoleMs,
    diastoleMs: Math.max(0, rrMs - systoleMs),
  };
}

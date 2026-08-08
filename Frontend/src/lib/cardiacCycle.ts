/**
 * Reloj del ciclo cardíaco.
 *
 * Separado del render a propósito: son funciones puras, testeables en consola,
 * y las consume tanto el corazón 3D como cualquier otra vista que necesite
 * saber en qué punto del latido estamos.
 *
 * LO QUE HACE QUE SE VEA REAL
 * ---------------------------
 * La sístole dura ~0.30 s y NO se acorta cuando sube la frecuencia: lo que se
 * acorta es la diástole. A 78 lpm el corazón pasa el 39 % del ciclo contraído
 * y el 61 % llenándose. A 160 lpm pasa el 75 % contraído y apenas le queda
 * tiempo de llenarse.
 *
 * Por eso la animación no es cosmética: el corazón ES la explicación de
 * `PULSO ↑ → LLENADO ↓`. No hay que rotularlo, se ve.
 */

import type { Rhythm } from "@/lib/engine";

/** Duración de la sístole ventricular. Casi constante en el corazón real. */
export const SYSTOLE_S = 0.3;

/** Intervalo PR: las aurículas se contraen 0.16 s antes que los ventrículos. */
export const PR_S = 0.16;

/** Duración de la patada auricular. */
export const ATRIAL_S = 0.11;

/** Frecuencia del temblor fibrilatorio, en Hz (~400/min). */
export const FIB_HZ = 6.5;

/** Jitter determinista por latido: mismo índice, mismo valor, demo reproducible. */
export function beatJitter(i: number) {
  const x = Math.sin(i * 91.317) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2;
}

/**
 * Intervalo R-R del latido `i`, en segundos.
 * En fibrilación auricular la conducción AV es errática: ±25 %. Es el rasgo
 * que hace reconocible una FA a simple vista.
 */
export function beatInterval(hr: number, i: number, irregular: boolean) {
  const rr = 60 / Math.max(30, hr);
  return irregular ? rr * (1 + beatJitter(i) * 0.25) : rr;
}

export const isIrregular = (r: Rhythm) => r === "afib_rvr";

const smoothstep = (u: number) => u * u * (3 - 2 * u);

/**
 * Contracción ventricular, 0 (relajado) → 1 (sístole máxima).
 *
 * `dt` son los segundos transcurridos desde el QRS. La contracción es rápida
 * (35 % de la sístole) y la relajación algo más lenta, como en el ventrículo
 * real. Si el ciclo es tan corto que no cabe una sístole completa, se comprime
 * — es lo que ocurre en taquicardia extrema.
 */
export function ventricularContraction(dt: number, rr: number) {
  const sys = Math.min(SYSTOLE_S, rr * 0.78);
  if (dt < 0 || dt >= sys) return 0;
  const u = dt / sys;
  if (u < 0.35) return smoothstep(u / 0.35);
  return 1 - smoothstep((u - 0.35) / 0.65);
}

/**
 * Contracción auricular ("patada auricular"), 0 → 1.
 *
 * Precede al ventrículo en `PR_S`. En fibrilación **no existe**: las aurículas
 * no se contraen de forma coordinada, tiemblan. Ahí está el 20-30 % del llenado
 * ventricular que el paciente pierde, y por eso una FA rápida descompensa.
 */
export function atrialContraction(dt: number) {
  if (dt < 0 || dt >= ATRIAL_S) return 0;
  const u = dt / ATRIAL_S;
  return Math.sin(u * Math.PI);
}

/**
 * Flujo coronario, 0 → 1.
 *
 * Máximo en DIÁSTOLE, no en sístole: al contraerse, el miocardio comprime sus
 * propias arterias. Por eso la taquicardia es doblemente mala — el músculo
 * necesita más oxígeno justo cuando le queda menos tiempo para recibirlo.
 */
export function coronaryFlow(dt: number, rr: number) {
  const sys = Math.min(SYSTOLE_S, rr * 0.78);
  if (dt < 0) return 1;
  if (dt < sys) return 0.18 + 0.12 * (dt / sys);
  const u = (dt - sys) / Math.max(0.001, rr - sys);
  return 0.3 + 0.7 * Math.sin(Math.min(1, u) * Math.PI);
}

/**
 * Estrés miocárdico aproximado, 0–1. Solo alimenta el color del músculo.
 *
 * PROVISIONAL. El backend ya calcula esto de verdad en `myocardial_o2_balance`
 * y lo expone en `GET /api/heart3d` como `myocardium_ischemia`. En cuanto la
 * vista lea del stream, esta función sobra: bórrala y pasa el valor real.
 *
 * La idea que aproxima: la demanda de oxígeno del miocardio sube con la
 * frecuencia, y la oferta cae con la perfusión. Taquicardia con hipotensión
 * es la peor combinación posible para el músculo cardíaco.
 */
export function myocardialStress(hr: number, perfusion: number) {
  const v = (hr / 100) * 0.55 - perfusion * 0.75 + 0.35;
  return Math.min(1, Math.max(0, v));
}

/**
 * Secuenciador de latidos.
 *
 * Agenda latido a latido en vez de usar una duración fija de animación: una
 * `animation-duration` de CSS no permite intervalos irregulares, y sin
 * irregularidad la fibrilación no se distingue de una taquicardia sinusal.
 *
 * Lee la frecuencia de una ref en cada latido, así que sigue los cambios del
 * motor sin reiniciarse ni perder el latido en curso.
 */
export class BeatSequencer {
  /** Índice del latido actual. */
  beat = 0;
  /** Instante (en segundos del reloj de la escena) en que empezó la onda P. */
  start = 0;
  /** Duración del ciclo actual. */
  rr = 60 / 78;

  constructor(private read: () => { hr: number; irregular: boolean }) {
    const { hr, irregular } = read();
    this.rr = beatInterval(hr, 0, irregular);
  }

  /**
   * Avanza el secuenciador al instante `now` y devuelve los segundos desde el
   * inicio del ciclo actual. Tolera pestañas en segundo plano: si han pasado
   * varios ciclos de golpe, los consume sin bloquear.
   */
  advance(now: number): number {
    let guard = 0;
    while (now - this.start >= this.rr && guard++ < 60) {
      this.start += this.rr;
      this.beat++;
      const { hr, irregular } = this.read();
      this.rr = beatInterval(hr, this.beat, irregular);
    }
    // si el guard saltó (pestaña dormida mucho rato), resincroniza
    if (now - this.start >= this.rr) this.start = now;
    return now - this.start;
  }
}

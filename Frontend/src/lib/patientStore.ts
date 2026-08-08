"use client";

import { Engine, type Frame } from "./engine";

/**
 * Paciente compartido de la sesión.
 *
 * Antes cada página instanciaba su propio Engine, así que navegar de
 * /monitor a /interventions REINICIABA el caso a t=0: no había un paciente,
 * había uno por pantalla. Este singleton es el dueño único del motor en el
 * cliente; todas las pantallas "en vivo" se suscriben aquí.
 *
 * Cuando el backend esté conectado, esta clase es el único sitio que cambia:
 * en vez de step() local, consume `vitals.tick` del stream (Portal o SSE).
 * Las pantallas no se enteran.
 *
 * Las URLs con `?t=...&freeze=1` (capturas de diseño) siguen usando un motor
 * local propio vía usePatientState: ese camino no se toca.
 */
class PatientStore {
  engine = new Engine();
  frame: Frame = this.engine.step(0.25);
  paused = false;
  /** intervención aplicada en esta sesión, para que /response pueda leerla */
  applied: { key: string; at: number } | null = null;

  private subs = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    this.ensureLoop();
    return () => {
      this.subs.delete(fn);
      // sin suscriptores no hay quien mire: se detiene el reloj. En una
      // navegación normal el gap es de milisegundos y no se percibe.
      if (this.subs.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  private ensureLoop() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.paused) return;
      this.frame = this.engine.step(0.25);
      this.notify();
    }, 250);
  }

  private notify() {
    for (const fn of this.subs) fn();
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.notify();
  }

  /** Aplica una intervención al paciente REAL (no a una rama simulada). */
  applyIntervention(key: string) {
    if (key === "none" || this.engine.interventionAt !== null) return;
    this.engine.applyIntervention(key);
    this.applied = { key, at: this.engine.t };
    this.frame = this.engine.step(0.05);
    this.notify();
  }

  /** Reinicia el caso. Esencial para ensayar la demo N veces. */
  reset() {
    this.engine = new Engine();
    this.frame = this.engine.step(0.25);
    this.paused = false;
    this.applied = null;
    this.notify();
  }
}

export const patientStore = new PatientStore();

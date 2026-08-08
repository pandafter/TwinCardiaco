"use client";

import { Engine, type Frame, type Vitals } from "./engine";
import {
  LiveSource,
  applyIntervention,
  resetCase,
  runWhatIf,
  type BackendConflict,
  type BackendConsensus,
  type BackendOpinion,
  type BackendSimulation,
  type BackendVitals,
  type LiveStatus,
} from "./live";

/**
 * Paciente compartido de la sesión. Dueño único del estado en el cliente.
 *
 * DOS FUENTES, UNA MANDA
 * ----------------------
 * Mientras el backend esté vivo, el servidor es la única verdad: el front no
 * calcula nada clínico, solo guarda los ticks para dibujar las curvas.
 *
 * Si el stream no conecta o enmudece, se cae al motor local. No son dos
 * verdades simultáneas: el local está apagado mientras haya backend, y la
 * fuente activa se muestra en pantalla para que nadie se confunda delante
 * del jurado.
 *
 * Este es el ÚNICO archivo que sabe de dónde vienen los datos.
 */
class PatientStore {
  engine = new Engine();
  frame: Frame = this.engine.step(0.25);
  history: Vitals[] = [];
  paused = false;

  /** de dónde salen los datos ahora mismo */
  source: "backend" | "local" = "local";
  liveStatus: LiveStatus = "offline";

  /** intervención aplicada en esta sesión */
  applied: string | null = null;

  /* --- lo que manda el backend, tal cual llega -------------------------- */
  agents = new Map<string, BackendOpinion & { pending?: boolean }>();
  conflict: BackendConflict | null = null;
  consensus: BackendConsensus | null = null;
  simulation: BackendSimulation | null = null;

  private subs = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private live: LiveSource | null = null;

  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    this.start();
    return () => {
      this.subs.delete(fn);
      if (this.subs.size === 0) this.stop();
    };
  }

  /* ------------------------------------------------------------ arranque */

  private start() {
    if (!this.live) {
      this.live = new LiveSource({
        onFrame: (f, raw) => this.onBackendFrame(f, raw),
        onTransition: () => this.notify(),
        onAgentStarted: (o) => {
          this.agents.set(o.agent, { ...o, pending: true });
          this.notify();
        },
        onAgentOpinion: (o) => {
          this.agents.set(o.agent, { ...o, pending: false });
          this.notify();
        },
        onConflict: (c) => {
          this.conflict = c;
          this.notify();
        },
        onConsensus: (c) => {
          this.consensus = c;
          this.notify();
        },
        onSimulation: (s) => {
          this.simulation = s;
          this.notify();
        },
        onStatus: (s) => {
          this.liveStatus = s;
          if (s === "live") {
            this.source = "backend";
            this.stopLocalClock();
          } else {
            // el backend se cayó: el motor local retoma donde estaba
            this.source = "local";
            this.startLocalClock();
          }
          this.notify();
        },
      });
      this.live.connect();
    }
    if (this.source === "local") this.startLocalClock();
  }

  private stop() {
    this.stopLocalClock();
    this.live?.close();
    this.live = null;
  }

  /* ------------------------------------------------------------- backend */

  private onBackendFrame(f: Frame, raw: BackendVitals) {
    this.frame = f;
    this.history.push(f.vitals);
    if (this.history.length > 600) this.history.shift();
    // Las ramas what-if se piden ANTES de que nadie pase el mouse: el hover
    // solo lee del caché, así los ~300 ms del servidor no se ven nunca.
    if (raw.perfusion_index < 0.8 && !this.simulation) void this.prefetchWhatIf();
    this.notify();
  }

  private async prefetchWhatIf() {
    const s = await runWhatIf();
    if (s) {
      this.simulation = s;
      this.notify();
    }
  }

  /* --------------------------------------------------------------- local */

  private startLocalClock() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.paused || this.source === "backend") return;
      this.frame = this.engine.step(0.25);
      this.history = [...this.engine.getHistory()];
      this.notify();
    }, 250);
  }

  private stopLocalClock() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  /* ------------------------------------------------------------ acciones */

  setPaused(p: boolean) {
    this.paused = p;
    this.notify();
  }

  /**
   * Propone una intervención. Con backend, la decide el servidor y vuelve
   * por el stream: el cliente nunca modifica el estado del paciente.
   */
  applyInterventionKey(key: string) {
    if (key === "none" || this.applied) return;
    this.applied = key;
    if (this.source === "backend") {
      void applyIntervention(key);
    } else {
      this.engine.applyIntervention(key);
      this.frame = this.engine.step(0.05);
    }
    this.notify();
  }

  reset() {
    this.applied = null;
    this.conflict = null;
    this.consensus = null;
    this.simulation = null;
    this.agents.clear();
    if (this.source === "backend") {
      void resetCase();
    } else {
      this.engine = new Engine();
      this.frame = this.engine.step(0.25);
      this.history = [];
    }
    this.paused = false;
    this.notify();
  }

  private notify() {
    for (const fn of this.subs) fn();
  }
}

export const patientStore = new PatientStore();

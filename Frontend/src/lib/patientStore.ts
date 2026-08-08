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
  type Handlers,
  type LiveStatus,
} from "./live";

/**
 * Por dónde llegan los datos ahora mismo. Los dos primeros son el backend; se
 * distinguen porque el jurado tiene que poder ver cuál está en uso.
 */
export type Transport = "portal" | "sse" | null;

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

  /**
   * Cuál de los dos transportes del backend está sirviendo. `source` sigue
   * diciendo backend-o-local para no cambiar lo que ya lee la UI; esto añade
   * el detalle de si ese backend llega por Portal o por el SSE de reserva.
   */
  transport: Transport = null;

  /** Usuarios conectados al mismo paciente. Sale de la presencia de Portal. */
  connected = 0;

  /**
   * Con Portal listo, los frames del SSE se ignoran.
   *
   * Los dos transportes llevan los mismos eventos: si se aceptaran ambos, cada
   * tick entraría dos veces en `history` y las curvas irían al doble de
   * velocidad. Portal manda y el SSE queda de reserva, que es el orden que
   * pide el proyecto.
   */
  private portalReady = false;

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
      this.live = new LiveSource(this.handlersFor("sse"));
      this.live.connect();
    }
    if (this.source === "local") this.startLocalClock();
  }

  /**
   * El camino de entrada, uno solo, parametrizado por transporte.
   *
   * Portal y el SSE alimentan exactamente esto. Tener un solo camino es lo que
   * evita que cambiar de transporte cambie el comportamiento de la pantalla.
   */
  private handlersFor(from: Exclude<Transport, null>): Handlers {
    const stale = () => from === "sse" && this.portalReady;
    return {
      onFrame: (f, raw) => {
        if (stale()) return;
        // Que llegue un frame ES la prueba de que este transporte sirve, así
        // que reclama la fuente aquí y no solo en onStatus. Sin esto, Portal
        // cayéndose con el SSE aún vivo dejaba la pantalla en el motor local:
        // LiveSource no reemite "live" porque para él nada cambió, y el reloj
        // local acababa peleando contra los frames del SSE.
        if (this.transport !== from) {
          this.source = "backend";
          this.transport = from;
          this.liveStatus = "live";
          this.stopLocalClock();
        }
        this.onBackendFrame(f, raw);
      },
      onTransition: () => {
        if (stale()) return;
        this.notify();
      },
      onAgentStarted: (o) => {
        if (stale()) return;
        this.agents.set(o.agent, { ...o, pending: true });
        this.notify();
      },
      onAgentOpinion: (o) => {
        if (stale()) return;
        this.agents.set(o.agent, { ...o, pending: false });
        this.notify();
      },
      onConflict: (c) => {
        if (stale()) return;
        this.conflict = c;
        this.notify();
      },
      onConsensus: (c) => {
        if (stale()) return;
        this.consensus = c;
        this.notify();
      },
      onSimulation: (s) => {
        if (stale()) return;
        this.simulation = s;
        this.notify();
      },
      onStatus: (s) => {
        if (from === "portal") this.portalReady = s === "live";

        if (s === "live") {
          // El SSE no se declara fuente mientras Portal sirve.
          if (!stale()) {
            this.liveStatus = "live";
            this.source = "backend";
            this.transport = from;
            this.stopLocalClock();
          }
          this.notify();
          return;
        }

        // Se cayó un transporte. Si no era el que servía, no hay nada que
        // degradar: anunciarlo bajaría una pantalla que va perfectamente.
        if (this.transport !== from) {
          this.notify();
          return;
        }

        // Portal cae con el SSE vivo: relevo directo, sin pasar por el motor
        // local. Es la degradación que promete el proyecto —si Portal cae, la
        // simulación sigue y el front cae a SSE— y sin este caso se vería un
        // parpadeo al motor local hasta el siguiente tick.
        if (from === "portal" && this.live?.status === "live") {
          this.transport = "sse";
          this.notify();
          return;
        }

        // No queda backend: el motor local retoma donde estaba.
        this.liveStatus = s;
        this.source = "local";
        this.transport = null;
        this.startLocalClock();
        this.notify();
      },
    };
  }

  /**
   * Handlers para el transporte de Portal. Memoizados: el puente los pasa a
   * un efecto de React, y una identidad nueva por render lo reengancharía en
   * bucle.
   */
  readonly portal: Handlers = this.handlersFor("portal");

  /** Usuarios en el canal. Solo Portal lo sabe; el SSE no tiene presencia. */
  setConnected(n: number) {
    if (this.connected === n) return;
    this.connected = n;
    this.notify();
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

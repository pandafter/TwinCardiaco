"use client";

import { Engine, type Frame, type Vitals } from "./engine";
import {
  LiveSource,
  applyIntervention,
  conveneDebate,
  resetCase,
  runWhatIf,
  type BackendConflict,
  type BackendConsensus,
  type BackendDebateError,
  type BackendDebateEvent,
  type BackendDebateRound,
  type BackendDebateStarted,
  type BackendDebateTurnDelta,
  type BackendDebateTurnDone,
  type BackendDebateTurnStarted,
  type BackendOpinion,
  type BackendSimulation,
  type BackendVitals,
  type LiveStatus,
} from "./live";

export type DebateEvidence = {
  metric: string;
  value: number | string;
  source: string;
};

export type DebateTurn = {
  id: string;
  round: number;
  agent: string;
  replyTo: string | null;
  text: string;
  pending: boolean;
  nextSeq: number;
  buffered: Map<number, string>;
  stance?: string;
  intervention?: string | null;
  confidence?: number;
  evidence: DebateEvidence[];
  citationsVerified: boolean | null;
  source: "llm" | "reglas" | null;
};

export type DebateState = {
  id: string;
  trigger: string;
  patientState: string;
  round: number;
  roundKind: string;
  active: boolean;
  turns: Map<string, DebateTurn>;
  verdict: BackendConsensus | null;
  error: string | null;
};

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
  transport: "portal" | "sse" | "local" = "local";
  connected = 0;
  liveStatus: LiveStatus = "offline";
  private sseStatus: LiveStatus = "offline";
  private portalStatus: LiveStatus = "offline";
  private portalLastFrameAt = 0;
  private seenIds = new Set<string>();
  private seenOrder: string[] = [];

  /** intervención aplicada en esta sesión */
  applied: string | null = null;

  /* --- lo que manda el backend, tal cual llega -------------------------- */
  agents = new Map<string, BackendOpinion & { pending?: boolean }>();
  conflict: BackendConflict | null = null;
  consensus: BackendConsensus | null = null;
  simulation: BackendSimulation | null = null;
  debate: DebateState | null = null;

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
        onFrame: (f, raw, wire) =>
          this.onBackendFrame(f, raw, "sse", wire.id),
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
        onDebate: (event) => this.onDebate(event),
        onStatus: (s) => this.onTransportStatus("sse", s),
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

  private onBackendFrame(
    f: Frame,
    raw: BackendVitals,
    transport: "portal" | "sse",
    eventId?: string,
  ) {
    // Portal reclama la fuente al entregar datos, no solo al conectar. Un
    // socket listo pero sin ticks nunca desplaza al SSE que sí está vivo.
    if (transport === "portal") {
      this.portalLastFrameAt = Date.now();
      this.source = "backend";
      this.transport = "portal";
      this.liveStatus = "live";
      this.stopLocalClock();
    } else if (
      this.transport === "portal" &&
      this.portalStatus === "live" &&
      Date.now() - this.portalLastFrameAt < 2_500
    ) {
      // Un socket abierto no garantiza datos frescos. Portal conserva la
      // prioridad solo mientras haya entregado una vital recientemente; si
      // se queda mudo, el siguiente tick SSE toma el relevo sin esperar a que
      // el WebSocket declare una desconexión.
      return;
    } else {
      this.source = "backend";
      this.transport = "sse";
      this.liveStatus = "live";
      this.stopLocalClock();
    }

    if (eventId) {
      if (this.seenIds.has(eventId)) {
        this.notify();
        return;
      }
      this.seenIds.add(eventId);
      this.seenOrder.push(eventId);
      if (this.seenOrder.length > 500) {
        const old = this.seenOrder.shift();
        if (old) this.seenIds.delete(old);
      }
    }
    // Detecta reset del backend (el `/api/scenario/reset` o `/preset` crea un
    // motor nuevo con t=0). Si el nuevo tick trae un sim_time MENOR que el
    // ultimo del buffer, el paciente se reinicio y hay que descartar la
    // historia vieja. Sin este check, la curva engancha samples de t=200 con
    // samples de t=0 y el path SVG dibuja los picos verticales locos que se
    // veian tras cada reinicio.
    const last = this.history[this.history.length - 1];
    if (last && raw.t + 0.5 < last.t) {
      this.history = [];
      this.applied = null;
      this.conflict = null;
      this.consensus = null;
      this.simulation = null;
      this.debate = null;
      this.agents.clear();
    }
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

  private onDebate(event: BackendDebateEvent) {
    if (event.type === "debate.started") {
      const payload = event.payload as BackendDebateStarted;
      this.debate = {
        id: payload.debate_id,
        trigger: payload.trigger,
        patientState: payload.state,
        round: 0,
        roundKind: "preparando",
        active: true,
        turns: new Map(),
        verdict: null,
        error: null,
      };
      this.notify();
      return;
    }

    const debate = this.debate;
    const debateId = "debate_id" in event.payload
      ? event.payload.debate_id
      : undefined;
    if (!debate || debate.id !== debateId) return;

    if (event.type === "debate.round.started") {
      const payload = event.payload as BackendDebateRound;
      debate.round = payload.round;
      debate.roundKind = payload.kind;
    } else if (event.type === "debate.turn.started") {
      const payload = event.payload as BackendDebateTurnStarted;
      if (!debate.turns.has(payload.turn_id)) {
        debate.turns.set(payload.turn_id, {
          id: payload.turn_id,
          round: payload.round,
          agent: payload.agent,
          replyTo: payload.reply_to,
          text: "",
          pending: true,
          nextSeq: 0,
          buffered: new Map(),
          evidence: [],
          citationsVerified: null,
          source: null,
        });
      }
    } else if (event.type === "debate.turn.delta") {
      const payload = event.payload as BackendDebateTurnDelta;
      const turn = debate.turns.get(payload.turn_id);
      if (!turn || payload.seq < turn.nextSeq) return;
      if (payload.seq > turn.nextSeq) {
        turn.buffered.set(payload.seq, payload.delta);
      } else {
        turn.text += payload.delta;
        turn.nextSeq += 1;
        while (turn.buffered.has(turn.nextSeq)) {
          turn.text += turn.buffered.get(turn.nextSeq)!;
          turn.buffered.delete(turn.nextSeq);
          turn.nextSeq += 1;
        }
      }
    } else if (event.type === "debate.turn.done") {
      const payload = event.payload as BackendDebateTurnDone;
      const turn = debate.turns.get(payload.turn_id);
      if (turn) {
        // Autoridad final: corrige huecos, duplicados o replay desordenado.
        turn.text = payload.text;
        turn.pending = false;
        turn.nextSeq = payload.next_seq;
        turn.buffered.clear();
        turn.stance = payload.stance;
        turn.intervention = payload.intervention;
        turn.confidence = payload.confidence;
        turn.evidence = payload.evidence;
        turn.citationsVerified = payload.citations_verified;
        turn.source = payload.source;
      }
    } else if (event.type === "debate.verdict") {
      debate.verdict = event.payload as BackendConsensus;
      debate.active = false;
    } else if (event.type === "debate.error") {
      debate.error = (event.payload as BackendDebateError).error;
      debate.active = false;
    }
    this.notify();
  }

  private onTransportStatus(
    transport: "portal" | "sse",
    status: LiveStatus,
  ) {
    if (transport === "portal") this.portalStatus = status;
    else this.sseStatus = status;

    if (transport === "portal" && status !== "live" && this.transport === "portal") {
      if (this.sseStatus === "live") {
        this.source = "backend";
        this.transport = "sse";
        this.liveStatus = "live";
        this.stopLocalClock();
      } else {
        this.source = "local";
        this.transport = "local";
        this.liveStatus = "offline";
        this.startLocalClock();
      }
    } else if (transport === "sse" && status !== "live" && this.transport === "sse") {
      if (this.portalStatus !== "live") {
        this.source = "local";
        this.transport = "local";
        this.liveStatus = "offline";
        this.startLocalClock();
      }
    }
    this.notify();
  }

  /** Adaptador común para que Portal y SSE alimenten el mismo reducer. */
  portal = {
    onFrame: (f: Frame, raw: BackendVitals, eventId?: string) =>
      this.onBackendFrame(f, raw, "portal", eventId),
    onTransition: () => this.notify(),
    onAgentStarted: (opinion: BackendOpinion) => {
      this.agents.set(opinion.agent, { ...opinion, pending: true });
      this.notify();
    },
    onAgentOpinion: (opinion: BackendOpinion) => {
      this.agents.set(opinion.agent, { ...opinion, pending: false });
      this.notify();
    },
    onConflict: (conflict: BackendConflict) => {
      this.conflict = conflict;
      this.notify();
    },
    onConsensus: (consensus: BackendConsensus) => {
      this.consensus = consensus;
      this.notify();
    },
    onSimulation: (simulation: BackendSimulation) => {
      this.simulation = simulation;
      this.notify();
    },
    onDebate: (event: BackendDebateEvent) => this.onDebate(event),
    onStatus: (status: LiveStatus) =>
      this.onTransportStatus("portal", status),
  };

  setConnected(count: number) {
    this.connected = Math.max(0, count);
    this.notify();
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
    this.debate = null;
    this.agents.clear();
    // Se limpia SIEMPRE, no solo en modo local. Antes solo se vaciaba en
    // local y el backend hacia su reset por su lado; el buffer del front
    // sobrevivia con samples antiguos y la curva iba de t=200 a t=0 con
    // picos verticales al reconectar los puntos.
    this.history = [];
    if (this.source === "backend") {
      void resetCase();
    } else {
      this.engine = new Engine();
      this.frame = this.engine.step(0.25);
    }
    this.paused = false;
    this.notify();
  }

  convene() {
    if (this.source !== "backend") return;
    void conveneDebate();
  }

  private notify() {
    for (const fn of this.subs) fn();
  }
}

export const patientStore = new PatientStore();

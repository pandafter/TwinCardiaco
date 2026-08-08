import type { Assessment, Frame, Rhythm, Status, Trend, Vitals } from "./engine";

/**
 * Puente con el backend: SSE en `/api/stream`.
 *
 * REGLA QUE ESTE ARCHIVO HACE CUMPLIR
 * -----------------------------------
 * El front NO calcula nada clínico. Aquí solo se TRADUCEN los campos que
 * manda el servidor al shape que la UI ya dibuja. Si un valor no viene del
 * backend, no se inventa: se deja en null y la UI lo oculta.
 *
 * Lo único que hacemos con los datos es acumularlos en un buffer para las
 * curvas de tendencia. Eso es memoria, no cálculo.
 *
 * DEGRADACIÓN
 * -----------
 * Si el stream no conecta o se queda mudo, el store vuelve al motor local.
 * No son dos fuentes de verdad: es un plan B explícito, apagado mientras
 * haya backend, y visible en pantalla para que nadie se confunda.
 */

export const API =
  process.env.NEXT_PUBLIC_CARDIOTWIN_API ?? "http://localhost:8000";

/** Los 7 eventos que consumimos. Ni uno más. */
export type BackendEvent =
  | "vitals.tick"
  | "state.transition"
  | "threshold.crossed"
  | "agent.started"
  | "agent.opinion"
  | "agent.conflict"
  | "orchestrator.consensus"
  | "simulation.result";

/** Campos reales de `PhysioState.vitals()`. */
export type BackendVitals = {
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
  rhythm: string;
  perfusion_index: number;
  mvo2?: number;
  myocardial_o2_balance?: number;
  /** pedidos al backend; si no llegan, la UI los oculta */
  filling_pct?: number;
  deterioration_risk?: number;
  trend?: Trend;
};

export type BackendTransition = {
  from: Status;
  to: Status;
  label: string;
  criteria: string[];
  phenotype: string | null;
  time_to_critical_s: number | null;
  projection_disclaimer?: string;
};

export type BackendOpinion = {
  agent: string;
  name?: string;
  objective?: string;
  stance?: "apoyar" | "oponerse" | "condicionar";
  intervention?: string | null;
  confidence?: number;
  evidence?: { metric: string; value: number | string; source: string }[];
  reasoning?: string;
  /** headline sin jerga; si el backend no lo manda, se usa `reasoning` */
  headline?: string;
};

export type BackendConflict = {
  intervention: string;
  supporting: BackendOpinion[];
  opposing: BackendOpinion[];
  note?: string;
};

export type BackendConsensus = {
  trigger?: string;
  state?: string;
  recommendation?: string;
  tiebreak_rule?: string | null;
  conflict?: BackendConflict | null;
  disclaimer?: string;
  headline?: string;
};

export type BackendScenario = {
  intervention: string;
  name: string;
  trajectory: BackendVitals[];
  final_status: Status;
  final_label: string;
  time_to_critical_s: number | null;
  deltas: Record<string, number>;
  mechanism?: string;
  risks?: string[];
};

export type BackendSimulation = {
  from_state: BackendVitals;
  scenarios: BackendScenario[];
  best_by_metric: Record<string, string | null>;
  note?: string;
};

/* ------------------------------------------------------------ traducción */

const RHYTHM: Record<string, Rhythm> = {
  sinusal: "sinus",
  "taquicardia sinusal": "sinus_tach",
  "taquicardia sinusal severa": "sinus_tach",
  "bradicardia sinusal": "sinus",
  afib_rvr: "afib_rvr",
};

/** Traduce un `vitals.tick` al tipo que la UI ya usa. Sin derivar nada. */
export function toVitals(b: BackendVitals): Vitals {
  return {
    t: b.t,
    hr: b.hr,
    sbp: b.sbp,
    dbp: b.dbp,
    map: b.map,
    spo2: b.spo2,
    rr: b.rr,
    lactate: b.lactate,
    co: b.co,
    ci: b.ci,
    sv: b.sv,
    cvp: b.cvp,
    pcwp: b.pcwp,
    svr: b.svr,
    do2: b.do2,
    o2er: b.o2er,
    rhythm: RHYTHM[b.rhythm] ?? "sinus_tach",
    perfusion_index: b.perfusion_index,
    // el backend no modela temperatura; se muestra el valor de referencia
    temp: 36.8,
  };
}

/**
 * Arma el assessment con lo último que dijo el servidor.
 *
 * `state.transition` llega solo en los cambios, así que se conserva el
 * último conocido. Conservar no es calcular.
 */
export function toAssessment(
  b: BackendVitals,
  last: BackendTransition | null,
): Assessment {
  return {
    status: last?.to ?? "stable",
    label: last?.label ?? "ESTABLE",
    critical_criteria: last?.to === "critical" ? (last?.criteria ?? []) : [],
    instability_criteria: last?.to === "unstable" ? (last?.criteria ?? []) : [],
    hemodynamic_phenotype: last?.phenotype ?? null,
    time_to_critical_s: last?.time_to_critical_s ?? null,
    // vienen del servidor o no se muestran: el front no los deriva
    deterioration_risk: b.deterioration_risk ?? 0,
    trend: b.trend ?? "steady",
    filling_pct: b.filling_pct ?? 0,
  };
}

export function toFrame(
  b: BackendVitals,
  last: BackendTransition | null,
): Frame {
  return { vitals: toVitals(b), assess: toAssessment(b, last) };
}

/* ------------------------------------------------------------- conexión */

export type LiveStatus = "connecting" | "live" | "offline";

type Handlers = {
  onFrame: (f: Frame, raw: BackendVitals) => void;
  onTransition: (t: BackendTransition) => void;
  onAgentStarted: (o: BackendOpinion) => void;
  onAgentOpinion: (o: BackendOpinion) => void;
  onConflict: (c: BackendConflict) => void;
  onConsensus: (c: BackendConsensus) => void;
  onSimulation: (s: BackendSimulation) => void;
  onStatus: (s: LiveStatus) => void;
};

/** Segundos sin un tick tras los que se considera caído el stream. */
const STALE_MS = 6000;
/** Espera entre reintentos de conexión. */
const RETRY_MS = 15000;

export class LiveSource {
  private es: EventSource | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTransition: BackendTransition | null = null;
  private closed = false;
  status: LiveStatus = "offline";

  constructor(private h: Handlers) {}

  connect() {
    if (typeof window === "undefined" || this.es || this.closed) return;
    this.setStatus("connecting");

    let es: EventSource;
    try {
      es = new EventSource(`${API}/api/stream`);
    } catch {
      this.setStatus("offline");
      return;
    }
    this.es = es;

    const on = <T,>(type: BackendEvent, fn: (payload: T) => void) =>
      es.addEventListener(type, (ev) => {
        try {
          fn(JSON.parse((ev as MessageEvent).data).payload as T);
        } catch {
          /* un evento malformado no puede tumbar el monitor */
        }
      });

    on<BackendVitals>("vitals.tick", (v) => {
      this.setStatus("live");
      this.armStale();
      this.h.onFrame(toFrame(v, this.lastTransition), v);
    });
    on<BackendTransition>("state.transition", (t) => {
      this.lastTransition = t;
      this.h.onTransition(t);
    });
    on<BackendOpinion>("agent.started", (o) => this.h.onAgentStarted(o));
    on<BackendOpinion>("agent.opinion", (o) => this.h.onAgentOpinion(o));
    on<BackendConflict>("agent.conflict", (c) => this.h.onConflict(c));
    on<BackendConsensus>("orchestrator.consensus", (c) => this.h.onConsensus(c));
    on<BackendSimulation>("simulation.result", (s) => this.h.onSimulation(s));

    // EventSource reintenta solo, cada pocos ms y para siempre. Sin backend
    // eso llena la consola de errores y no aporta nada: se cierra y se
    // reintenta con calma, para que el día que el backend suba, enganche.
    es.onerror = () => {
      this.setStatus("offline");
      es.close();
      if (this.es === es) this.es = null;
      this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    if (this.closed || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, RETRY_MS);
  }

  /** Si el stream enmudece, se declara caído y el store vuelve al local. */
  private armStale() {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.setStatus("offline"), STALE_MS);
  }

  private setStatus(s: LiveStatus) {
    if (this.status === s) return;
    this.status = s;
    this.h.onStatus(s);
  }

  close() {
    this.closed = true;
    this.es?.close();
    this.es = null;
    if (this.staleTimer) clearTimeout(this.staleTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.setStatus("offline");
  }
}

/* ---------------------------------------------------------------- acciones */

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const r = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Propuesta de intervención. El servidor valida y republica: nunca aplicamos local. */
export const applyIntervention = (key: string, actor = "usuario") =>
  post<{ ok: boolean }>("/api/intervention", { key, actor });

/** Dispara las ramas what-if. Se llama ANTES del hover y se cachea. */
export const runWhatIf = (interventions?: string[]) =>
  post<BackendSimulation>("/api/whatif", { interventions, horizon_s: 900 });

/** Pregunta en lenguaje natural → parámetros del motor. */
export type AskResult =
  | {
      supported: true;
      intervention: string;
      efficacy: number;
      delay_s: number;
      echo: string;
      simulation?: BackendScenario;
    }
  | { supported: false; reason: string };

export const ask = (question: string) =>
  post<AskResult>("/api/ask", { question });

export const resetCase = () => post<unknown>("/api/scenario/reset", {});
export const triggerShock = (type = "cardiogenic", severity = 1) =>
  post<unknown>("/api/scenario/shock", { type, severity });

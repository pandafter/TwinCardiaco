"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePatientState } from "@/hooks/usePatientState";
import {
  LEVEL,
  STATUS_UI,
  mmss,
  rhythmLabel,
  type Assessment,
  type Level,
  type Vitals,
} from "@/lib/engine";
import { agentsFromBackend, agentsFromLlm, runAgents } from "@/lib/agents";
import { deliberate, type LiveAgents } from "@/lib/ai/bridge";
import { projectAll, type Branch, type BranchKey } from "@/lib/whatif";
import {
  Droplet,
  Flask,
  Gauge,
  HeartRate,
  LogoMark,
  Pressure,
} from "@/components/icons";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { DecisionBar } from "./DecisionBar";
import { FlowGuide, phaseOf } from "./FlowGuide";
import { EcgStrip, ecgFindings } from "./EcgStrip";
import { useRoom, type RoomState } from "@/hooks/useRoom";
import { RoomPresence } from "./RoomBar";
import { Sparkline } from "./Sparkline";
import { Stage, type SceneKey } from "./Stage";

const TONE: Record<Level, string> = {
  ok: "var(--text-hi)",
  warn: "var(--warn)",
  crit: "var(--crit)",
};

/**
 * Cinco vitales, no siete. Temperatura y respiraciones no deciden nada en
 * este caso y solo llenaban la columna. Cada uno lleva su nombre en
 * lenguaje normal; el término clínico va al lado, pequeño.
 *
 * `band` es el rango normal: sin él el sparkline es decoración.
 */
const VITALS = [
  { key: "hr", label: "Pulso", tech: "FC", unit: "lpm", icon: HeartRate, color: "var(--crit)", digits: 0, band: { lo: 60, hi: 100 } },
  { key: "bp", label: "Presión arterial", tech: "sist/diast", unit: "mmHg", icon: Pressure, color: "var(--crit)", digits: 0, band: { lo: 100, hi: 140 } },
  { key: "map", label: "Presión de bombeo", tech: "MAP", unit: "mmHg", icon: Gauge, color: "var(--warn)", digits: 0, band: { lo: 70, hi: 100 } },
  { key: "spo2", label: "Oxígeno en sangre", tech: "SpO₂", unit: "%", icon: Droplet, color: "var(--info)", digits: 0, band: { lo: 95, hi: 100 } },
  { key: "lactate", label: "Falta de oxígeno", tech: "lactato", unit: "mmol/L", icon: Flask, color: "var(--violet)", digits: 1, band: { lo: 0, hi: 2 } },
] as const;

export function MonitorScreen({
  startAt = 0,
  frozen = false,
  live = false,
  roomId = null,
}: {
  startAt?: number;
  frozen?: boolean;
  live?: boolean;
  /** `?sala=x`: cuando hay dos personas, decidir pasa a ser proponer */
  roomId?: string | null;
}) {
  const { vitals, assess, history, controls, engine, backend } =
    usePatientState({ startAt, frozen, live });

  const [hovered, setHovered] = useState<Branch | null>(null);
  const [asked, setAsked] = useState<Branch | null>(null);
  const [pinned, setPinned] = useState<SceneKey | null>(null);

  const bucket = Math.floor(vitals.t / 10) * 10;
  const branches = useMemo(() => projectAll(bucket), [bucket]);

  const fromBackend = controls?.source === "backend" && !!backend;

  /**
   * Los tres agentes, del modelo real.
   *
   * Se pide UNA vez por hito del caso, no en cada tick: tres llamadas a un
   * LLM cada 250 ms sería absurdo y además la opinión no cambia entre
   * latidos. Los hitos son el paso a inestable, el paso a crítico y cada
   * intervención aplicada. Mientras la respuesta llega, y si nunca llega, se
   * muestran los agentes locales — y la pantalla dice cuál está viendo.
   */
  const [llmAgents, setLlmAgents] = useState<LiveAgents | null>(null);
  const [llmBusy, setLlmBusy] = useState(false);
  const localAgents = useMemo(
    () =>
      fromBackend
        ? agentsFromBackend(backend!.agents, backend!.consensus)
        : runAgents(vitals, assess, branches),
    [fromBackend, backend, vitals, assess, branches],
  );

  // TODAS las aplicadas, no la última. Poder intervenir varias veces es lo
  // que separa un simulador de una encuesta de una sola pregunta.
  const applied = fromBackend
    ? backend!.applied
      ? [backend!.applied]
      : []
    : engine.interventionLog;
  const arrested = assess.status === "arrest";

  // El hito: cambia con el estado o con cada decisión tomada.
  const milestone = `${assess.status}:${applied.length}`;

  useEffect(() => {
    if (frozen || assess.status === "stable") return;
    let alive = true;
    // Marcar "cargando" al lanzar la petición es justo para lo que existe
    // este efecto: sincronizarse con un sistema externo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLlmBusy(true);
    deliberate(vitals, assess, branches, applied)
      .then((r) => {
        if (alive && r) setLlmAgents(r);
      })
      .finally(() => alive && setLlmBusy(false));
    return () => {
      alive = false;
    };
    // deliberadamente solo el hito: ver el comentario de arriba
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone, frozen]);

  const agents = useMemo(
    () =>
      llmAgents
        ? agentsFromLlm(llmAgents, vitals, assess, branches)
        : localAgents,
    [llmAgents, vitals, assess, branches, localAgents],
  );
  const phase = phaseOf(
    assess,
    agents.some((a) => a.state !== "En espera"),
    applied.length ? applied[applied.length - 1] : null,
  );
  const projection = hovered ?? asked;

  /**
   * La sala.
   *
   * `?sala=x` la activa; sin ese parámetro nada de esto existe y el monitor
   * se comporta como siempre. Cuando hay dos personas, el clic deja de
   * aplicar y pasa a PROPONER: la otra aprueba o veta, y solo entonces el
   * fármaco entra — en las dos pantallas a la vez.
   */
  const room = useRoom(roomId, (intervention) => controls?.apply(intervention));

  const decide = (k: BranchKey) => {
    if (room.shared) {
      const b = branches.find((x) => x.key === k);
      room.propose(k, b?.human ?? k);
      return;
    }
    controls?.apply(k);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page">
      <TopBar
        assess={assess}
        transport={controls?.transport ?? null}
        connected={controls?.connected ?? 0}
        controls={controls}
        room={room}
      />
      <FlowGuide phase={phase} />

      <div className="grid min-h-0 flex-1 grid-cols-[19.5rem_minmax(0,1fr)] gap-3 px-3 py-3">
        <SideColumn vitals={vitals} history={history} />
        <Stage
          phase={phase}
          vitals={vitals}
          assess={assess}
          history={history}
          agents={agents}
          agentsSource={llmAgents ? "llm" : llmBusy ? "pending" : "local"}
          debate={fromBackend ? backend!.debate : null}
          onConvene={() => controls?.convene()}
          branches={branches}
          projection={projection}
          applied={applied.length ? applied[applied.length - 1] : null}
          pinned={pinned}
          onPin={setPinned}
          transport={controls?.transport ?? null}
        />
      </div>

      <DecisionBar
        branches={branches}
        // El MISMO instante que las cuatro ramas, no `vitals.t`. Las ramas se
        // proyectan desde el bucket de 10 s para poder cachearlas; preguntando
        // desde el tiempo exacto se comparaban dos instantes distintos y
        // "¿y si no hago nada?" devolvía +2.5 mmHg contra sí mismo.
        decisionAt={bucket}
        vitals={vitals}
        assess={assess}
        onHover={setHovered}
        onAsk={setAsked}
        onApply={decide}
        applied={applied}
        arrested={arrested}
        room={room}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ topbar */

/**
 * Una sola barra, y el borde inferior ES la barra de riesgo.
 *
 * El riesgo de deterioro tenía su propio bloque con etiqueta, barra y
 * porcentaje: tres elementos para un número que solo necesita responder
 * "¿cuánto?". Como línea de ancho completo se lee de reojo y no ocupa nada.
 */
function TopBar({
  assess,
  transport,
  connected,
  controls,
  room,
}: {
  assess: Assessment;
  transport: "portal" | "sse" | "local" | null;
  connected: number;
  controls: ReturnType<typeof usePatientState>["controls"];
  room: RoomState;
}) {
  const ui = STATUS_UI[assess.status];
  /**
   * Dos relojes, y solo se muestra el que importa.
   *
   * "Tiempo hasta estado crítico" es un umbral administrativo; "tiempo hasta
   * que el corazón deje de latir" es lo que de verdad está en juego. En
   * cuanto el segundo existe, desplaza al primero.
   */
  const tta = assess.time_to_arrest_s;
  const ttc = assess.time_to_critical_s;
  const clock = tta !== null ? tta : ttc;
  const isArrestClock = tta !== null;
  const urgent = clock !== null && clock < 120;

  return (
    <header className="relative flex shrink-0 items-center gap-4 border-b border-line px-4 py-2.5">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
      >
        <LogoMark className="h-[1.5rem] w-[1.5rem] text-crit" />
        <span className="text-label font-semibold tracking-[0.05em] text-hi">
          CARDIAC <span className="font-light text-mid">TWIN</span>
        </span>
      </Link>

      <span className="text-micro text-lo">
        Simulador de decisiones · paciente virtual, datos sintéticos
      </span>

      {/* el estado, con el peso visual que le toca */}
      <motion.div
        key={assess.status}
        initial={{ scale: 0.96, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative ml-auto flex items-center gap-2.5 rounded-lg border px-4 py-2"
        style={{ borderColor: ui.border, background: ui.bg }}
      >
        <span className="relative flex h-[0.45rem] w-[0.45rem] items-center justify-center">
          {assess.status !== "stable" && (
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: ui.color,
                animation: "ping-ring 1.8s ease-out infinite",
              }}
            />
          )}
          <span
            className="h-full w-full rounded-full"
            style={{ background: ui.color }}
          />
        </span>
        <span
          className="text-body font-semibold tracking-[0.02em]"
          style={{ color: ui.color }}
        >
          {ui.label}
        </span>
        <span className="border-l border-line pl-2.5 text-micro text-lo">
          riesgo{" "}
          <span className="num font-mono text-label" style={{ color: ui.color }}>
            {assess.deterioration_risk}%
          </span>
        </span>
      </motion.div>

      {/* el reloj: cuando queda poco, es lo más grande de la pantalla */}
      <div className="flex flex-col items-end">
        <span
          className="text-micro tracking-[0.12em]"
          style={{ color: isArrestClock ? "var(--crit)" : "var(--text-dim)" }}
        >
          {assess.status === "arrest"
            ? "EL CORAZÓN SE DETUVO"
            : isArrestClock
              ? "HASTA QUE EL CORAZÓN DEJE DE LATIR"
              : clock === null
                ? "SIN DETERIORO PROYECTADO"
                : "TIEMPO HASTA ESTADO CRÍTICO"}
        </span>
        <motion.span
          animate={urgent ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
          transition={
            urgent ? { duration: 1.4, repeat: Infinity } : { duration: 0.3 }
          }
          className="num font-mono text-num leading-none font-semibold"
          style={{
            color:
              clock === null
                ? "var(--text-dim)"
                : isArrestClock || assess.status === "critical"
                  ? "var(--crit)"
                  : "var(--warn)",
          }}
        >
          {/* llegado a cero el contador ya no cuenta nada: lo dice */}
          {assess.status === "arrest"
            ? "ASISTOLIA"
            : clock === null
              ? "--:--"
              : clock <= 0
                ? "AHORA"
                : mmss(clock)}
        </motion.span>
      </div>

      <RoomPresence room={room} />

      <div className="flex items-center gap-2 border-l border-line pl-4">
        {transport && (
          <span
            className="rounded border px-2 py-[0.2rem] text-micro"
            title={
              transport === "portal"
                ? "Estado compartido por Portal en tiempo real"
                : transport === "sse"
                  ? "Portal no está disponible: respaldo SSE activo"
                  : "El servidor no responde: motor local de respaldo"
            }
            style={
              transport === "portal"
                ? { borderColor: "rgba(63,191,127,0.35)", color: "var(--ok)" }
                : transport === "sse"
                  ? { borderColor: "rgba(213,165,57,0.4)", color: "var(--warn)" }
                  : { borderColor: "var(--line-strong)", color: "var(--text-lo)" }
            }
          >
            {transport === "portal"
              ? `PORTAL · ${connected} viendo`
              : transport === "sse"
                ? "SSE · respaldo"
                : "LOCAL · sin servidor"}
          </span>
        )}
        {controls && (
          <>
            <GhostButton onClick={controls.togglePause}>
              {controls.paused ? "Reanudar" : "Pausar"}
            </GhostButton>
            <GhostButton onClick={controls.reset}>Reiniciar</GhostButton>
          </>
        )}
      </div>

      {/* riesgo de deterioro: el propio borde del header */}
      <div
        title={`Riesgo de deterioro: ${assess.deterioration_risk}%`}
        className="absolute inset-x-0 bottom-[-1px] h-[0.14rem] overflow-hidden"
      >
        <motion.div
          className="h-full"
          animate={{ width: `${assess.deterioration_risk}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: `linear-gradient(90deg, transparent, ${ui.color})`,
          }}
        />
      </div>
    </header>
  );
}

function GhostButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className="rounded-lg border border-line-strong px-3 py-1.5 text-label text-mid transition-colors hover:border-lo hover:bg-card-hover hover:text-hi"
    >
      {children}
    </motion.button>
  );
}

/* ---------------------------------------------------------- columna lateral */

function SideColumn({
  vitals,
  history,
}: {
  vitals: Vitals;
  history: Vitals[];
}) {
  // Perfusión 0.78 → sin hallazgos; 0.30 → isquemia marcada. La curva del
  // motor no es lineal, pero el mapeo a píxeles sí puede serlo.
  const ischemia = Math.min(
    1,
    Math.max(0, (0.78 - vitals.perfusion_index) / 0.48),
  );

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <Panel
        title="SIGNOS VITALES"
        right={
          <span className="flex items-center gap-1.5 text-micro text-ok">
            <span
              className="h-[0.3rem] w-[0.3rem] rounded-full bg-ok"
              style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
            />
            EN VIVO
          </span>
        }
        className="flex-1"
      >
        <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden px-4 py-2.5">
          {VITALS.map((r) => (
            <VitalRow key={r.key} row={r} vitals={vitals} history={history} />
          ))}
        </div>
      </Panel>

      <Panel
        title="ECG"
        right={
          <span
            className="text-micro"
            style={{
              color:
                vitals.rhythm === "sinus" ? "var(--ok)" : "var(--crit)",
            }}
          >
            {rhythmLabel(vitals.rhythm)}
          </span>
        }
      >
        <div className="px-3 py-1.5">
          <EcgStrip
            hr={vitals.hr}
            rhythm={vitals.rhythm}
            amplitude={Math.min(1.15, Math.max(0.55, vitals.sv / 80))}
            // La isquemia del trazado sale de la perfusión que calcula el
            // motor. Empieza a notarse por debajo del 78% y satura en el
            // 30%: es una traducción a píxeles, no un cálculo clínico.
            ischemia={ischemia}
            className="h-[3.4rem] w-full"
          />
        </div>

        {/* Los hallazgos, nombrados. Un trazado que cambia sin que nadie
            diga qué cambió solo lo lee quien ya sabe leerlo. */}
        <div className="flex flex-wrap gap-1 px-3 pb-1.5">
          <AnimatePresence mode="popLayout">
            {ecgFindings(ischemia, vitals.rhythm).map((f) => (
              <motion.span
                key={f}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="rounded border px-1.5 py-[0.1rem] text-micro"
                style={{
                  borderColor:
                    f === "Sin alteraciones"
                      ? "var(--line)"
                      : "color-mix(in srgb, var(--crit) 32%, transparent)",
                  color:
                    f === "Sin alteraciones" ? "var(--text-lo)" : "var(--crit)",
                }}
              >
                {f}
              </motion.span>
            ))}
          </AnimatePresence>
          <a
            href="https://physionet.org/content/mitdb/1.0.0/"
            target="_blank"
            rel="noreferrer"
            title="Morfología QRS derivada de MIT-BIH Arrhythmia Database v1.0.0"
            className="ml-auto self-center text-[0.55rem] text-dim transition-colors hover:text-lo"
          >
            QRS · MIT-BIH/PhysioNet
          </a>
        </div>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col rounded-[0.7rem] border border-line bg-card ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
        <h2 className="text-micro tracking-[0.14em] text-mid">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

function VitalRow({
  row,
  vitals,
  history,
}: {
  row: (typeof VITALS)[number];
  vitals: Vitals;
  history: Vitals[];
}) {
  const isBp = row.key === "bp";
  const raw = isBp ? vitals.sbp : (vitals[row.key as keyof Vitals] as number);
  const level: Level = isBp
    ? LEVEL.sbp(vitals.sbp)
    : (LEVEL[row.key]?.(raw) ?? "ok");
  const Icon = row.icon;

  const series = history
    .filter((_, i) => i % 8 === 0)
    .slice(-24)
    .map((h) => (isBp ? h.sbp : (h[row.key as keyof Vitals] as number)));

  // La escala incluye la banda normal: si la curva se sale, se ve que se sale.
  const lo = Math.min(row.band.lo, ...(series.length ? series : [row.band.lo]));
  const hi = Math.max(row.band.hi, ...(series.length ? series : [row.band.hi]));
  const pad = Math.max((hi - lo) * 0.12, row.digits ? 0.1 : 1.5);

  // dirección del cambio en los últimos ~6 s
  const prev = series.length > 3 ? series[series.length - 4] : raw;
  const delta = raw - prev;
  const moving = Math.abs(delta) > (row.digits ? 0.05 : 0.8);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon
          className="h-[0.9rem] w-[0.9rem] shrink-0"
          style={{ color: level === "ok" ? "var(--text-lo)" : row.color }}
        />
        <span className="truncate text-label text-mid">{row.label}</span>
        <span className="text-micro text-dim">{row.tech}</span>
        {moving && (
          <motion.span
            initial={{ opacity: 0, y: delta > 0 ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="ml-auto text-micro"
            style={{ color: level === "ok" ? "var(--text-lo)" : row.color }}
          >
            {delta > 0 ? "▲" : "▼"}
          </motion.span>
        )}
      </div>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <span
          className="font-mono text-num leading-none font-semibold"
          style={{ color: TONE[level] }}
        >
          {isBp ? (
            <span className="num">
              <AnimatedNumber value={vitals.sbp} />/
              <AnimatedNumber value={vitals.dbp} />
            </span>
          ) : (
            <AnimatedNumber value={raw} digits={row.digits} />
          )}
          <span className="ml-1 text-micro font-normal text-dim">
            {row.unit}
          </span>
        </span>
        <Sparkline
          values={series}
          min={lo - pad}
          max={hi + pad}
          color={row.color}
          band={row.band}
          width={92}
          height={28}
        />
      </div>
    </div>
  );
}

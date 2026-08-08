"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
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
import { agentsFromBackend, runAgents } from "@/lib/agents";
import { projectAll, type Branch, type BranchKey } from "@/lib/whatif";
import {
  Droplet,
  Flask,
  Gauge,
  HeartRate,
  LogoMark,
  Pressure,
} from "@/components/icons";
import { DecisionBar } from "./DecisionBar";
import { FlowGuide, phaseOf } from "./FlowGuide";
import { EcgStrip } from "./EcgStrip";
import { Sparkline } from "./Sparkline";
import { Stage, type SceneKey } from "./Stage";

const TONE: Record<Level, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
};

/**
 * Cinco vitales, no siete. Temperatura y respiraciones no deciden nada en
 * este caso y solo llenaban la columna. Cada uno lleva su nombre en
 * lenguaje normal; el término clínico va al lado, pequeño.
 */
const VITALS = [
  { key: "hr", label: "Pulso", tech: "FC", unit: "lpm", icon: HeartRate, color: "var(--crit)", digits: 0 },
  { key: "bp", label: "Presión arterial", tech: "sist/diast", unit: "mmHg", icon: Pressure, color: "var(--crit)", digits: 0 },
  { key: "map", label: "Presión de bombeo", tech: "MAP", unit: "mmHg", icon: Gauge, color: "var(--warn)", digits: 0 },
  { key: "spo2", label: "Oxígeno en sangre", tech: "SpO₂", unit: "%", icon: Droplet, color: "var(--info)", digits: 0 },
  { key: "lactate", label: "Falta de oxígeno", tech: "lactato", unit: "mmol/L", icon: Flask, color: "var(--violet)", digits: 1 },
] as const;

export function MonitorScreen({
  startAt = 0,
  frozen = false,
  live = false,
}: {
  startAt?: number;
  frozen?: boolean;
  live?: boolean;
}) {
  const { vitals, assess, history, controls, engine, backend } =
    usePatientState({ startAt, frozen, live });

  const [hovered, setHovered] = useState<Branch | null>(null);
  const [asked, setAsked] = useState<Branch | null>(null);
  const [pinned, setPinned] = useState<SceneKey | null>(null);

  const bucket = Math.floor(vitals.t / 10) * 10;
  const branches = useMemo(() => projectAll(bucket), [bucket]);

  const fromBackend = controls?.source === "backend" && !!backend;
  const agents = useMemo(
    () =>
      fromBackend
        ? agentsFromBackend(backend!.agents, backend!.consensus)
        : runAgents(vitals, assess, branches),
    [fromBackend, backend, vitals, assess, branches],
  );

  const applied = fromBackend ? backend!.applied : engine.interventionKey;
  const phase = phaseOf(
    assess,
    agents.some((a) => a.state !== "En espera"),
    applied,
  );
  const projection = hovered ?? asked;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page">
      <TopBar
        assess={assess}
        source={controls?.source ?? null}
        controls={controls}
      />
      <FlowGuide phase={phase} />

      <div className="grid min-h-0 flex-1 grid-cols-[19rem_minmax(0,1fr)] gap-3 px-3 py-3">
        <SideColumn vitals={vitals} history={history} />
        <Stage
          phase={phase}
          vitals={vitals}
          assess={assess}
          history={history}
          agents={agents}
          branches={branches}
          projection={projection}
          applied={applied}
          pinned={pinned}
          onPin={setPinned}
        />
      </div>

      <DecisionBar
        branches={branches}
        decisionAt={vitals.t}
        onHover={setHovered}
        onAsk={setAsked}
        onApply={(k: BranchKey) => controls?.apply(k)}
        applied={applied}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ topbar */

/**
 * Una sola barra. Antes eran tres franjas apiladas que se comían el 15% del
 * alto sin decir gran cosa.
 */
function TopBar({
  assess,
  source,
  controls,
}: {
  assess: Assessment;
  source: "backend" | "local" | null;
  controls: ReturnType<typeof usePatientState>["controls"];
}) {
  const ui = STATUS_UI[assess.status];
  const ttc = assess.time_to_critical_s;
  const urgent = ttc !== null && ttc < 120;

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-line px-4 py-2.5">
      <Link
        href="/"
        className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <LogoMark className="h-[1.5rem] w-[1.5rem] text-crit" />
        <span className="text-[0.9375rem] font-semibold tracking-[0.05em] text-hi">
          CARDIAC <span className="font-light text-mid">TWIN</span>
        </span>
      </Link>

      <span className="text-[0.6875rem] text-lo">
        Simulador de decisiones · paciente virtual, datos sintéticos
      </span>

      {/* el estado, con el peso visual que le toca */}
      <motion.div
        key={assess.status}
        initial={{ scale: 0.96, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="ml-auto flex items-center gap-3 rounded-lg border px-4 py-2"
        style={{ borderColor: ui.border, background: ui.bg }}
      >
        <span
          className="h-[0.45rem] w-[0.45rem] rounded-full"
          style={{
            background: ui.color,
            animation:
              assess.status === "stable"
                ? undefined
                : "pulse-dot 1.4s ease-in-out infinite",
          }}
        />
        <span
          className="text-[0.8125rem] font-semibold tracking-[0.02em]"
          style={{ color: ui.color }}
        >
          {ui.label}
        </span>
      </motion.div>

      <RiskBar assess={assess} />

      {/* el reloj: cuando queda poco, es lo más grande de la pantalla */}
      <div className="flex flex-col items-end">
        <span className="text-[0.5625rem] tracking-[0.14em] text-dim">
          TIEMPO HASTA ESTADO CRÍTICO
        </span>
        <motion.span
          animate={urgent ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
          transition={
            urgent ? { duration: 1.4, repeat: Infinity } : { duration: 0.3 }
          }
          className="font-mono text-[1.75rem] leading-none font-semibold tabular-nums"
          style={{ color: ttc === null ? "var(--text-dim)" : "var(--crit)" }}
        >
          {ttc === null ? "--:--" : mmss(ttc)}
        </motion.span>
      </div>

      <div className="flex items-center gap-2 border-l border-line pl-4">
        {source && (
          <span
            className="rounded border px-2 py-[0.2rem] text-[0.5625rem]"
            style={
              source === "backend"
                ? { borderColor: "rgba(63,191,127,0.35)", color: "var(--ok)" }
                : { borderColor: "var(--line-strong)", color: "var(--text-lo)" }
            }
          >
            {source === "backend" ? "servidor" : "local"}
          </span>
        )}
        {controls && (
          <>
            <button
              onClick={controls.togglePause}
              className="rounded-lg border border-line-strong px-3 py-2 text-[0.6875rem] text-mid transition-colors hover:border-lo hover:text-hi"
            >
              {controls.paused ? "Reanudar" : "Pausar"}
            </button>
            <button
              onClick={controls.reset}
              className="rounded-lg border border-line-strong px-3 py-2 text-[0.6875rem] text-mid transition-colors hover:border-lo hover:text-hi"
            >
              Reiniciar
            </button>
          </>
        )}
      </div>
    </header>
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
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-[0.7rem] border border-line bg-card">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-[0.6875rem] tracking-[0.14em] text-mid">
            SIGNOS VITALES
          </span>
          <span className="flex items-center gap-1.5 text-[0.5625rem] text-ok">
            <span
              className="h-[0.3rem] w-[0.3rem] rounded-full bg-ok"
              style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
            />
            EN VIVO
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-around px-4 py-3">
          {VITALS.map((r) => (
            <VitalRow key={r.key} row={r} vitals={vitals} history={history} />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 shrink-0 flex-col rounded-[0.7rem] border border-line bg-card">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-[0.6875rem] tracking-[0.14em] text-mid">
            ECG
          </span>
          <span
            className={`text-[0.625rem] ${vitals.rhythm === "sinus" ? "text-ok" : "text-crit"}`}
          >
            {rhythmLabel(vitals.rhythm)}
          </span>
        </div>
        <div className="px-3 py-2">
          <EcgStrip
            hr={vitals.hr}
            rhythm={vitals.rhythm}
            amplitude={Math.min(1.15, Math.max(0.55, vitals.sv / 80))}
            className="h-[4rem] w-full"
          />
        </div>
      </div>

    </div>
  );
}

/** Barra de riesgo, compacta. Vive en la cabecera, donde sí hay sitio. */
function RiskBar({ assess }: { assess: Assessment }) {
  const c = STATUS_UI[assess.status].color;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.5625rem] tracking-[0.14em] text-dim">
        RIESGO DE DETERIORO
      </span>
      <div className="flex items-center gap-2">
        <div className="h-[0.3rem] w-[6rem] overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${assess.deterioration_risk}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: c }}
          />
        </div>
        <span
          className="font-mono text-[0.8125rem] leading-none tabular-nums"
          style={{ color: c }}
        >
          {assess.deterioration_risk}%
        </span>
      </div>
    </div>
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

  const lo = series.length ? Math.min(...series) : 0;
  const hi = series.length ? Math.max(...series) : 1;
  const pad = Math.max((hi - lo) * 0.35, row.digits ? 0.15 : 2);

  const value = isBp
    ? `${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)}`
    : raw.toFixed(row.digits);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon
          className="h-[0.9rem] w-[0.9rem] shrink-0"
          style={{ color: row.color }}
        />
        <span className="truncate text-[0.6875rem] text-mid">{row.label}</span>
        <span className="text-[0.5625rem] text-dim">{row.tech}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span
          className={`font-mono text-[1.6rem] leading-none font-semibold tabular-nums ${TONE[level]}`}
        >
          {value}
          <span className="ml-1 text-[0.625rem] font-normal text-dim">
            {row.unit}
          </span>
        </span>
        <Sparkline
          values={series}
          min={lo - pad}
          max={hi + pad}
          color={row.color}
          width={92}
          height={26}
        />
      </div>
    </div>
  );
}

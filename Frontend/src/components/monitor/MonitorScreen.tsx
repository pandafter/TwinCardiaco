"use client";

import { useMemo, useState } from "react";
import { usePatientState } from "@/hooks/usePatientState";
import {
  LEVEL,
  STATUS_UI,
  caseClock,
  caseEvents,
  rhythmLabel,
  trendUI,
  type Assessment,
  type Level,
  type Vitals,
} from "@/lib/engine";
import { runAgents, type AgentOutput } from "@/lib/agents";
import { projectAll, type Branch, type BranchKey } from "@/lib/whatif";
import {
  AgentCardio,
  AgentOrchestrator,
  AgentSim,
  Droplet,
  Flask,
  Gauge,
  HeartRate,
  Lungs,
  Pressure,
  Thermometer,
} from "@/components/icons";
import { BottomNav, MonitorActions, TopBar } from "@/components/shell/Shell";
import { BeatingHeart } from "./BeatingHeart";
import { CausalChain } from "./CausalChain";
import { DecisionBar } from "./DecisionBar";
import { EcgStrip } from "./EcgStrip";
import { Sparkline } from "./Sparkline";
import { SERIES, TrendChart } from "./TrendChart";

const TONE: Record<Level, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
};

/**
 * Cada vital lleva su nombre en lenguaje normal. El jurado no es médico: si
 * tiene que aprender qué es la MAP, la pantalla ya falló.
 */
const VITAL_ROWS = [
  { key: "hr", label: "Pulso", tech: "frecuencia cardíaca", unit: "bpm", icon: HeartRate, color: "var(--crit)", min: 40, max: 180, digits: 0 },
  { key: "bp", label: "Presión arterial", tech: "sistólica / diastólica", unit: "mmHg", icon: Pressure, color: "var(--crit)", min: 40, max: 120, digits: 0 },
  { key: "map", label: "Presión de bombeo", tech: "MAP", unit: "mmHg", icon: Gauge, color: "var(--crit)", min: 40, max: 100, digits: 0 },
  { key: "spo2", label: "Oxígeno en sangre", tech: "SpO₂", unit: "%", icon: Droplet, color: "var(--info)", min: 70, max: 100, digits: 0 },
  { key: "rr", label: "Respiraciones", tech: "frecuencia respiratoria", unit: "rpm", icon: Lungs, color: "var(--warn)", min: 8, max: 40, digits: 0 },
  { key: "lactate", label: "Falta de oxígeno en tejidos", tech: "lactato", unit: "mmol/L", icon: Flask, color: "var(--violet)", min: 0, max: 10, digits: 1 },
  { key: "temp", label: "Temperatura", tech: "central", unit: "°C", icon: Thermometer, color: "var(--ok)", min: 35, max: 39, digits: 1 },
] as const;

const AGENT_ICON = {
  clinical: AgentCardio,
  simulation: AgentSim,
  orchestrator: AgentOrchestrator,
} as const;

export function MonitorScreen({
  startAt = 0,
  frozen = false,
  live = false,
}: {
  startAt?: number;
  frozen?: boolean;
  live?: boolean;
}) {
  const { vitals, assess, history, controls, engine } = usePatientState({
    startAt,
    frozen,
    live,
  });

  const [hovered, setHovered] = useState<Branch | null>(null);
  const [asked, setAsked] = useState<Branch | null>(null);

  // Las ramas se precalculan y se refrescan cada ~10 s de simulación: cuando
  // el usuario pasa el mouse, la trayectoria ya existe y aparece al instante.
  const bucket = Math.floor(vitals.t / 10) * 10;
  const branches = useMemo(() => projectAll(bucket), [bucket]);

  const agents = useMemo(
    () => runAgents(vitals, assess, branches),
    [vitals, assess, branches],
  );

  const applied = engine.interventionKey;
  const projection = hovered ?? asked;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page">
      <TopBar assess={assess} />
      <Explainer />

      <div className="grid min-h-0 flex-1 grid-cols-[17.4rem_minmax(0,1fr)_20.5rem] gap-2.5 px-3 py-2.5">
        <LeftColumn vitals={vitals} history={history} />
        <CenterColumn
          vitals={vitals}
          assess={assess}
          history={history}
          projection={projection}
        />
        <RightColumn agents={agents} history={history} />
      </div>

      <DecisionBar
        branches={branches}
        decisionAt={vitals.t}
        onHover={setHovered}
        onAsk={setAsked}
        onApply={(k: BranchKey) => controls?.apply(k)}
        applied={applied}
      />

      <BottomNav active="Paciente">
        <MonitorActions controls={controls} />
      </BottomNav>
    </div>
  );
}

/**
 * Una franja que dice qué es esto. Sin ella, alguien que abre la pantalla ve
 * números moviéndose y no sabe qué está mirando ni por qué debería importarle.
 */
function Explainer() {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line bg-[rgba(56,189,248,0.04)] px-4 py-1.5">
      <span className="rounded border border-[rgba(56,189,248,0.3)] px-2 py-[0.1rem] text-[0.4375rem] tracking-[0.14em] text-cyan">
        SIMULADOR
      </span>
      <span className="text-[0.5625rem] text-mid">
        Paciente virtual con un corazón que está fallando como bomba.{" "}
        <span className="text-hi">
          Todo lo que ves se calcula en vivo
        </span>
        : prueba una decisión y mira cómo cambia su futuro.
      </span>
      <span className="ml-auto text-[0.4375rem] text-dim">
        Prototipo de investigación y educación · datos sintéticos · no es una
        herramienta clínica
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ columna izq */

function LeftColumn({
  vitals,
  history,
}: {
  vitals: Vitals;
  history: Vitals[];
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader title="SIGNOS VITALES" live />
        <div className="flex min-h-0 flex-1 flex-col justify-between px-3 py-2">
          {VITAL_ROWS.map((r) => (
            <VitalRow key={r.key} row={r} vitals={vitals} history={history} />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="ECG II" live />
        <div className="px-3 pt-2 pb-3">
          <div className="text-[0.5rem] text-dim">
            FC: {Math.round(vitals.hr)} bpm · Ganancia: 10 mm/mV · 25 mm/s
          </div>
          <EcgStrip
            hr={vitals.hr}
            rhythm={vitals.rhythm}
            amplitude={Math.min(1.15, Math.max(0.55, vitals.sv / 80))}
            className="mt-1.5 h-[5.6rem] w-full"
          />
          <div className="mt-1 text-[0.5625rem] text-lo">
            Ritmo:{" "}
            <span className={vitals.rhythm === "sinus" ? "text-ok" : "text-crit"}>
              {rhythmLabel(vitals.rhythm)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function VitalRow({
  row,
  vitals,
  history,
}: {
  row: (typeof VITAL_ROWS)[number];
  vitals: Vitals;
  history: Vitals[];
}) {
  const isBp = row.key === "bp";
  const raw = isBp ? vitals.sbp : (vitals[row.key as keyof Vitals] as number);
  const level: Level = isBp ? LEVEL.sbp(vitals.sbp) : (LEVEL[row.key]?.(raw) ?? "ok");
  const Icon = row.icon;

  const series = history
    .filter((_, i) => i % 8 === 0)
    .slice(-26)
    .map((h) => (isBp ? h.sbp : (h[row.key as keyof Vitals] as number)));

  // autoescala como un monitor real: si la ventana es plana, la tira no dice
  // nada. Las etiquetas muestran el rango real, no uno inventado.
  const lo = series.length ? Math.min(...series) : row.min;
  const hi = series.length ? Math.max(...series) : row.max;
  const pad = Math.max((hi - lo) * 0.35, row.digits ? 0.15 : 2);
  const sMin = lo - pad;
  const sMax = hi + pad;

  const value = isBp
    ? `${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)}`
    : raw.toFixed(row.digits);

  const trendDelta =
    series.length > 6 ? series[series.length - 1] - series[series.length - 6] : 0;
  const trendGlyph =
    Math.abs(trendDelta) < (row.digits ? 0.15 : 2)
      ? null
      : trendDelta > 0
        ? "↑"
        : "↓";

  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0" style={{ color: row.color }}>
        <Icon className="h-[0.95rem] w-[0.95rem]" />
      </span>
      <div className="min-w-0 flex-1">
        {/* nombre humano arriba, término clínico debajo */}
        <div className="truncate text-[0.5625rem] text-mid">{row.label}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span
            className={`font-mono text-[1.15rem] leading-none font-semibold tabular-nums ${TONE[level]}`}
          >
            {value}
          </span>
          <span className="text-[0.5rem] text-dim">{row.unit}</span>
          {trendGlyph && (
            <span className={`ml-1 text-[0.6rem] ${TONE[level]}`}>
              {trendGlyph}
            </span>
          )}
        </div>
        <div className="truncate text-[0.4375rem] text-dim">{row.tech}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Sparkline
          values={series}
          min={sMin}
          max={sMax}
          color={row.color}
          width={70}
          height={28}
        />
        <div className="flex h-[28px] w-[1.4rem] flex-col justify-between text-[0.4375rem] text-dim">
          <span>{sMax.toFixed(row.digits)}</span>
          <span>{sMin.toFixed(row.digits)}</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- columna centro */

function CenterColumn({
  vitals,
  assess,
  history,
  projection,
}: {
  vitals: Vitals;
  assess: Assessment;
  history: Vitals[];
  projection: Branch | null;
}) {
  const ui = STATUS_UI[assess.status];
  const trend = trendUI(assess.trend);

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      {/* La cadena causal es lo primero y lo más grande del centro: es lo que
          hace visible que hay un motor calculando, sin explicar nada. */}
      <Card className="flex min-h-0 flex-[1.05] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
          <span className="text-[0.5625rem] tracking-[0.16em] text-mid">
            QUÉ LE ESTÁ PASANDO AL PACIENTE
          </span>
          <span className="flex items-center gap-2.5 text-[0.5rem]">
            <span style={{ color: ui.color }}>{ui.label}</span>
            <span className="text-dim">·</span>
            <span style={{ color: trend.color }}>
              {trend.label} {trend.glyph}
            </span>
            <span className="text-dim">·</span>
            <span className="text-lo">
              riesgo{" "}
              <span className="font-mono text-mid">
                {assess.deterioration_risk}%
              </span>
            </span>
          </span>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 50% 70% at 16% 50%, rgba(30,90,140,0.16) 0%, transparent 70%)",
            }}
          />
          <div className="relative h-full w-[18%] shrink-0">
            <BeatingHeart
              hr={vitals.hr}
              rhythm={vitals.rhythm}
              strokeVolume={vitals.sv}
              perfusion={vitals.perfusion_index}
              className="absolute top-1/2 left-1/2 h-[88%] w-[86%] -translate-x-1/2 -translate-y-1/2"
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <CausalChain vitals={vitals} assess={assess} history={history} />
          </div>
        </div>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <span className="text-[0.5625rem] tracking-[0.16em] text-mid">
            TRAYECTORIA
          </span>
          <span className="flex items-center gap-3">
            {SERIES.map((s) => (
              <span
                key={s.key}
                className="flex items-center gap-1.5 text-[0.5rem] text-mid"
              >
                <span
                  className="h-[0.3rem] w-[0.3rem] rounded-full"
                  style={{ background: s.color }}
                />
                {s.label}
              </span>
            ))}
            <span className="ml-1 flex items-center gap-1.5 text-[0.5rem] text-dim">
              <span className="inline-block h-0 w-4 border-t border-dashed border-[var(--text-lo)]" />
              proyectado
            </span>
          </span>
        </div>

        <div className="min-h-0 flex-1 px-2">
          <TrendChart history={history} projection={projection} />
        </div>

        <div className="shrink-0 px-4 pb-2">
          {projection ? (
            <div
              className="rounded-md border px-3 py-1.5 text-[0.5rem]"
              style={{
                borderColor: `color-mix(in srgb, ${projection.color} 35%, transparent)`,
                background: `color-mix(in srgb, ${projection.color} 7%, transparent)`,
              }}
            >
              <span style={{ color: projection.color }}>
                {projection.human}
              </span>
              <span className="text-mid"> — {projection.verdict}</span>
              <span className="ml-2 text-dim">
                Línea punteada: futuro simulado, no medido.
              </span>
            </div>
          ) : (
            <div className="rounded-md border border-line bg-card px-3 py-1.5 text-[0.5rem] text-lo">
              Pasa el mouse por una opción de abajo para ver su trayectoria
              proyectada aquí.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------- columna derecha */

function RightColumn({
  agents,
  history,
}: {
  agents: AgentOutput[];
  history: Vitals[];
}) {
  const events = caseEvents(history).slice(0, 6);
  const active = agents.some((a) => a.state !== "En espera");

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <Card className="flex min-h-0 flex-[1.6] flex-col overflow-hidden">
        <CardHeader
          title="AGENTES DE IA"
          live={active}
          liveLabel={active ? "ANALIZANDO" : "EN ESPERA"}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {agents.map((a, i) => {
            const Icon = AGENT_ICON[a.id];
            return (
              <div
                key={a.id}
                className={`px-3 py-2.5 ${i ? "border-t border-line" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-[1.6rem] w-[1.6rem] shrink-0 items-center justify-center rounded-[0.45rem] border"
                    style={{
                      borderColor: `color-mix(in srgb, ${a.color} 35%, transparent)`,
                      background: `color-mix(in srgb, ${a.color} 10%, transparent)`,
                      color: a.color,
                    }}
                  >
                    <Icon className="h-[0.85rem] w-[0.85rem]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.625rem] text-hi">
                    {a.name}
                  </span>
                  <span
                    className="shrink-0 rounded border px-1.5 py-[0.06rem] text-[0.4375rem]"
                    style={{
                      borderColor: `color-mix(in srgb, ${a.color} 30%, transparent)`,
                      color: a.state === "En espera" ? "var(--text-lo)" : a.color,
                    }}
                  >
                    {a.state}
                  </span>
                </div>

                <div className="mt-1 text-[0.4375rem] text-dim">{a.role}</div>

                {/* el hallazgo en español de a pie */}
                <p className="mt-1.5 text-[0.5625rem] leading-[1.55] text-hi">
                  {a.headline}
                </p>
                {/* y el mismo hallazgo en clínico, para que un médico lo valide */}
                <p className="mt-1 text-[0.4375rem] leading-[1.5] text-dim">
                  {a.technical}
                </p>

                {a.evidence.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {a.evidence.map((e) => (
                      <span
                        key={e.label}
                        className="rounded border px-1.5 py-[0.1rem] text-[0.4375rem]"
                        style={{
                          borderColor:
                            e.source === "simulado"
                              ? "rgba(169,123,214,0.3)"
                              : "var(--line)",
                          color: "var(--text-lo)",
                        }}
                      >
                        {e.label}{" "}
                        <span className="font-mono text-mid">{e.value}</span>
                        <span className="ml-1 text-dim">
                          {e.source === "simulado" ? "sim" : "med"}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader title="LO QUE HA PASADO" />
        <div className="flex min-h-0 flex-1 flex-col justify-around px-3 py-2">
          {events.length === 0 && (
            <div className="text-[0.5rem] text-lo">
              Sin eventos todavía. El paciente está estable.
            </div>
          )}
          {events.map((e) => (
            <div key={e.strong + e.t} className="flex items-center gap-2">
              <span
                className="h-[0.3rem] w-[0.3rem] shrink-0 rounded-full"
                style={{ background: e.color }}
              />
              <span className="shrink-0 font-mono text-[0.5rem] text-lo">
                {caseClock(e.t).hhmmss}
              </span>
              <span className="truncate text-[0.5rem] text-mid">
                <span className="text-hi">{e.strong}</span>
                {e.rest}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[0.6rem] border border-line bg-card ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({
  title,
  live,
  liveLabel = "EN VIVO",
}: {
  title: string;
  live?: boolean;
  liveLabel?: string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
      <span className="text-[0.5625rem] tracking-[0.14em] text-mid">
        {title}
      </span>
      {live && (
        <span className="flex items-center gap-1.5 text-[0.4375rem] tracking-[0.1em] text-ok">
          <span
            className="h-[0.3rem] w-[0.3rem] rounded-full bg-ok"
            style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
          />
          {liveLabel}
        </span>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { usePatientState } from "@/hooks/usePatientState";
import { LEVEL, rhythmLabel, type Level, type Vitals } from "@/lib/engine";
import { ACTIONS, AGENT_RECOMMENDATIONS, type Action, type Effect } from "@/lib/interventions";
import { AGENT_META } from "@/lib/agents";
import {
  AgentCardio,
  AgentOrchestrator,
  AgentPharma,
  AgentPhysio,
  AgentSim,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckSquare,
  Clock,
  Droplet,
  Eye,
  Flask,
  Gauge,
  HeartRate,
  Info,
  Lungs,
  Pressure,
  Syringe,
  Tube,
  Vial,
} from "@/components/icons";
import { BottomNav, TopBar } from "@/components/shell/Shell";
import { EcgStrip } from "@/components/monitor/EcgStrip";
import { BodyDiagram } from "./BodyDiagram";

const TONE: Record<Level, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
};

const ACTION_ICON = { syringe: Syringe, tube: Tube, vial: Vial, eye: Eye };

const AGENT_ICON = {
  cardiology: AgentCardio,
  pharmacology: AgentPharma,
  physiology: AgentPhysio,
  simulation: AgentSim,
  orchestrator: AgentOrchestrator,
};

const VITALS = [
  { key: "hr", label: "Frecuencia cardíaca", unit: "bpm", icon: HeartRate, color: "var(--crit)", dir: "up", digits: 0 },
  { key: "bp", label: "Presión arterial", unit: "mmHg", icon: Pressure, color: "var(--crit)", dir: "down", digits: 0 },
  { key: "map", label: "MAP", unit: "mmHg", icon: Gauge, color: "var(--crit)", dir: "down", digits: 0 },
  { key: "spo2", label: "SpO₂", unit: "%", icon: Droplet, color: "var(--info)", dir: "down", digits: 0 },
  { key: "rr", label: "Frecuencia respiratoria", unit: "rpm", icon: Lungs, color: "var(--warn)", dir: "up", digits: 0 },
  { key: "lactate", label: "Lactato", unit: "mmol/L", icon: Flask, color: "var(--violet)", dir: "up", digits: 1 },
] as const;

export function InterventionsScreen({
  startAt = 0,
  frozen = false,
}: {
  startAt?: number;
  frozen?: boolean;
}) {
  const { vitals, assess } = usePatientState({ startAt, frozen });
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page">
      <TopBar vitals={vitals} assess={assess} compact />

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[14.5rem_minmax(0,1fr)_16.5rem] gap-2.5 px-3 py-2.5">
        <PatientColumn vitals={vitals} assess={assess} />
        <ActionColumn chosen={chosen} onChoose={setChosen} />
        <AgentColumn />
      </div>

      <BottomNav active="Intervenciones" accent="var(--gold)" items={7} underline>
        <button className="flex items-center gap-2 rounded-lg border border-[#e5484d] bg-crit px-6 py-2.5 text-[0.625rem] font-medium text-[#1a0708] transition-opacity hover:opacity-90">
          <Bell className="h-[0.75rem] w-[0.75rem]" />
          Emergencia
        </button>
      </BottomNav>
    </div>
  );
}

/* --------------------------------------------------------------- columna 1 */

function PatientColumn({
  vitals,
  assess,
}: {
  vitals: Vitals;
  assess: ReturnType<typeof usePatientState>["assess"];
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <Card className="flex flex-col">
        <div className="shrink-0 px-3 py-2.5 text-[0.5625rem] tracking-[0.14em] text-mid">
          ESTADO ACTUAL DEL PACIENTE
        </div>

        <BodyDiagram
          perfusion={vitals.perfusion_index}
          className="h-[9.5rem] w-full shrink-0"
        />

        <div className="shrink-0 px-3 pt-2">
          <div className="text-[0.5rem] tracking-[0.14em] text-dim">
            ESTADO HEMODINÁMICO
          </div>
          <div className="mt-1 text-[0.95rem] font-semibold text-crit">
            {assess.status === "critical"
              ? "CRÍTICO"
              : assess.status === "unstable"
                ? "INESTABLE"
                : "ESTABLE"}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-3 pt-3.5 pb-3.5">
          {VITALS.map((v) => {
            const isBp = v.key === "bp";
            const raw = isBp
              ? vitals.sbp
              : (vitals[v.key as keyof Vitals] as number);
            const level: Level = isBp
              ? LEVEL.sbp(vitals.sbp)
              : (LEVEL[v.key]?.(raw) ?? "ok");
            const Icon = v.icon;
            return (
              <div key={v.key} className="flex items-center gap-2">
                <span className="shrink-0" style={{ color: v.color }}>
                  <Icon className="h-[0.9rem] w-[0.9rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.5rem] text-mid">
                    {v.label}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span
                      className={`font-mono text-[0.95rem] leading-none font-semibold tabular-nums ${TONE[level]}`}
                    >
                      {isBp
                        ? `${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)}`
                        : raw.toFixed(v.digits)}
                    </span>
                    <span className="text-[0.4375rem] text-dim">{v.unit}</span>
                  </div>
                </div>
                <span
                  className="shrink-0 text-[0.7rem]"
                  style={{ color: v.dir === "up" ? "var(--crit)" : "var(--info)" }}
                >
                  {v.dir === "up" ? "↑" : "↓"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="shrink-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[0.5625rem] tracking-[0.14em] text-mid">
            ECG EN VIVO
          </span>
          <span className="text-[0.5rem] text-crit">
            {rhythmLabel(vitals.rhythm)}
          </span>
        </div>
        <EcgStrip
          hr={vitals.hr}
          rhythm={vitals.rhythm}
          amplitude={Math.min(1.15, Math.max(0.55, vitals.sv / 80))}
          className="h-[4.2rem] w-full"
        />
        <div className="px-3 pt-1 pb-2.5 text-[0.4375rem] text-dim">
          Velocidad: 25 mm/s &nbsp;|&nbsp; Ganancia: 10 mm/mV
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- columna 2 */

function ActionColumn({
  chosen,
  onChoose,
}: {
  chosen: string | null;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-[0.8125rem] font-medium tracking-[0.08em] text-hi">
          SELECCIONA UNA INTERVENCIÓN
        </h1>
        <p className="mt-1 text-[0.5625rem] text-mid">
          Elige la mejor acción basada en el estado actual y las recomendaciones
          de los agentes.
        </p>
      </div>

      <div className="mt-2.5 flex shrink-0 items-center gap-3 rounded-[0.6rem] border border-[rgba(229,72,77,0.32)] bg-[rgba(229,72,77,0.06)] px-4 py-2.5">
        <AlertTriangle className="h-[1rem] w-[1rem] shrink-0 text-crit" />
        <div className="text-[0.5625rem] leading-[1.6] text-mid">
          El paciente está en deterioro hemodinámico progresivo.
          <br />
          <span className="font-medium text-crit">Cada segundo cuenta.</span>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-5 gap-2.5">
        {ACTIONS.map((a) => (
          <ActionCard
            key={a.id}
            a={a}
            chosen={chosen === a.id}
            onChoose={() => onChoose(a.id)}
          />
        ))}
      </div>

      <div className="mt-2.5 flex shrink-0 items-center gap-3 rounded-[0.6rem] border border-line bg-card px-4 py-3">
        <Info className="h-[1rem] w-[1rem] shrink-0 text-info" />
        <div className="flex-1">
          <div className="text-[0.625rem] text-info">
            Revisa las simulaciones de escenarios antes de decidir.
          </div>
          <div className="mt-1 text-[0.5rem] text-lo">
            Compara el posible impacto de cada intervención en la evolución del
            paciente.
          </div>
        </div>
        <a
          href="/agents"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-line-strong px-4 py-2.5 text-[0.5625rem] text-mid transition-colors hover:border-lo hover:text-hi"
        >
          Ver simulaciones
          <ArrowRight className="h-[0.7rem] w-[0.7rem]" />
        </a>
      </div>
    </div>
  );
}

function ActionCard({
  a,
  chosen,
  onChoose,
}: {
  a: Action;
  chosen: boolean;
  onChoose: () => void;
}) {
  const Icon = ACTION_ICON[a.icon];

  return (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[0.6rem] border bg-[#0a0e14] p-3 transition-colors"
      style={{
        borderColor: chosen
          ? a.color
          : a.id === "labs"
            ? "var(--line-gold)"
            : "var(--line)",
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-[1rem] w-[1rem] shrink-0" style={{ color: a.color }} />
        <div className="min-w-0">
          <div className="truncate text-[0.4375rem] tracking-[0.14em] text-dim">
            {a.kind}
          </div>
          <div
            className="text-[0.75rem] leading-tight font-semibold"
            style={{ color: a.color }}
          >
            {a.letter}
          </div>
        </div>
      </div>

      <div className="mt-2.5 text-[0.6875rem] leading-tight text-hi">
        {a.title}
      </div>
      {a.subtitle && (
        <div className="mt-0.5 text-[0.5rem] text-lo">{a.subtitle}</div>
      )}
      <p className="mt-2 text-[0.5rem] leading-[1.55] text-mid">
        {a.description}
      </p>

      <div className="mt-3 text-[0.4375rem] tracking-[0.12em] text-dim">
        {a.sectionTitle}
      </div>

      {a.effects && (
        <ul className="mt-1.5 space-y-1">
          {a.effects.map((e) => (
            <EffectRow key={e.label} e={e} />
          ))}
        </ul>
      )}
      {a.checks && (
        <ul className="mt-1.5 space-y-1">
          {a.checks.map((c) => (
            <li key={c} className="flex items-center gap-1.5 text-[0.5rem] text-mid">
              <CheckSquare className="h-[0.6rem] w-[0.6rem] shrink-0 text-lo" />
              {c}
            </li>
          ))}
        </ul>
      )}
      {a.notes && (
        <ul className="mt-1.5 space-y-1.5">
          {a.notes.map((n) => (
            <li key={n} className="text-[0.5rem] leading-[1.5] text-mid">
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-3">
        <div className="text-[0.4375rem] tracking-[0.12em] text-dim">
          {a.timeLabel}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <Clock className="h-[0.7rem] w-[0.7rem]" style={{ color: a.color }} />
          <span className="text-[0.5625rem]" style={{ color: a.color }}>
            {a.time}
          </span>
        </div>
        <button
          onClick={onChoose}
          className="mt-2 w-full rounded-md border py-2 text-[0.5625rem] transition-colors"
          style={{
            borderColor: `color-mix(in srgb, ${a.color} 45%, transparent)`,
            color: a.color,
            background: chosen
              ? `color-mix(in srgb, ${a.color} 16%, transparent)`
              : "transparent",
          }}
        >
          {chosen ? "Seleccionada" : "Seleccionar"}
        </button>
      </div>
    </div>
  );
}

function EffectRow({ e }: { e: Effect }) {
  const glyph = e.dir === "up" ? "↑" : e.dir === "down" ? "↓" : "—";
  const color = e.risk
    ? "var(--warn)"
    : e.dir === "down"
      ? "var(--info)"
      : "var(--ok)";
  return (
    <li className="flex items-center gap-1.5 text-[0.5rem] text-mid">
      <span className="w-[0.5rem] shrink-0" style={{ color }}>
        {glyph}
      </span>
      {e.label}
    </li>
  );
}

/* --------------------------------------------------------------- columna 3 */

function AgentColumn() {
  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <Card className="flex flex-col">
        <div className="shrink-0 px-3 py-2.5 text-[0.5625rem] tracking-[0.14em] text-mid">
          RECOMENDACIONES DE AGENTES
        </div>
        <div className="flex flex-col gap-4 px-3 pb-3.5">
          {AGENT_RECOMMENDATIONS.map((r) => {
            const meta = AGENT_META.find((m) => m.id === r.id)!;
            const Icon = AGENT_ICON[r.id as keyof typeof AGENT_ICON];
            return (
              <div key={r.id} className="flex items-start gap-2">
                <span
                  className="flex h-[1.8rem] w-[1.8rem] shrink-0 items-center justify-center rounded-[0.4rem] border"
                  style={{
                    borderColor: `color-mix(in srgb, ${meta.color} 35%, transparent)`,
                    background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
                    color: meta.color,
                  }}
                >
                  <Icon className="h-[0.9rem] w-[0.9rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-[0.5625rem] text-hi">
                      {meta.name}
                    </span>
                    <span
                      className="shrink-0 text-[0.4375rem]"
                      style={{ color: meta.color }}
                    >
                      {meta.state}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.5rem] leading-[1.5] text-mid">
                    {r.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="shrink-0 p-3">
        <div className="text-[0.5625rem] tracking-[0.14em] text-mid">
          ACUERDO ACTUAL
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-mono text-[0.9rem] font-semibold text-hi">76%</span>
          <span className="text-[0.5rem] text-lo">Confianza del consenso</span>
        </div>
        <div className="mt-2 h-[0.2rem] overflow-hidden rounded-full bg-line">
          <div className="h-full w-[76%] rounded-full bg-warn" />
        </div>
        <div className="mt-2.5 flex items-start gap-1.5 rounded-md border border-line px-2.5 py-2">
          <Info className="mt-[0.1rem] h-[0.6rem] w-[0.6rem] shrink-0 text-dim" />
          <span className="text-[0.4375rem] leading-[1.5] text-lo">
            Los agentes coinciden en la necesidad de intervenir ahora.
          </span>
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

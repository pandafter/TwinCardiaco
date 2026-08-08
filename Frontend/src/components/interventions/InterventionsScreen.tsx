"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePatientState } from "@/hooks/usePatientState";
import {
  LEVEL,
  STATUS_UI,
  trendUI,
  type Level,
  type Vitals,
} from "@/lib/engine";
import {
  ACTIONS,
  AGENT_RECOMMENDATIONS,
  FILTERS,
  type Action,
  type Category,
  type Effect,
} from "@/lib/interventions";
import { AGENT_META } from "@/lib/agents";
import {
  AgentCardio,
  AgentOrchestrator,
  AgentPharma,
  AgentPhysio,
  AgentSim,
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  Clock,
  Droplet,
  Eye,
  Flask,
  Gauge,
  HeartRate,
  Info,
  Lungs,
  Plus,
  Pressure,
  Syringe,
  Tube,
  Vial,
  Waves,
  X,
} from "@/components/icons";
import { BottomNav, TopBar } from "@/components/shell/Shell";
import { BeatingHeart } from "@/components/monitor/BeatingHeart";
import { EcgStrip } from "@/components/monitor/EcgStrip";
import { Sparkline } from "@/components/monitor/Sparkline";

const TONE: Record<Level, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
};

const ACTION_ICON = { syringe: Syringe, tube: Tube, vial: Vial, eye: Eye };

const FILTER_ICON: Record<string, typeof Syringe> = {
  todas: Waves,
  medicamento: Syringe,
  procedimiento: Tube,
  diagnostico: Vial,
  monitoreo: Eye,
};

const AGENT_ICON = {
  cardiology: AgentCardio,
  pharmacology: AgentPharma,
  physiology: AgentPhysio,
  simulation: AgentSim,
  orchestrator: AgentOrchestrator,
};

const VITALS = [
  { key: "hr", label: "Frecuencia cardíaca", unit: "bpm", icon: HeartRate, color: "var(--crit)", min: 40, max: 180, digits: 0 },
  { key: "bp", label: "Presión arterial", unit: "mmHg", icon: Pressure, color: "var(--crit)", min: 40, max: 120, digits: 0 },
  { key: "map", label: "MAP", unit: "mmHg", icon: Gauge, color: "var(--crit)", min: 40, max: 100, digits: 0 },
  { key: "spo2", label: "SpO₂", unit: "%", icon: Droplet, color: "var(--info)", min: 70, max: 100, digits: 0 },
  { key: "rr", label: "Frecuencia respiratoria", unit: "rpm", icon: Lungs, color: "var(--warn)", min: 8, max: 40, digits: 0 },
  { key: "lactate", label: "Lactato", unit: "mmol/L", icon: Flask, color: "var(--violet)", min: 0, max: 10, digits: 1 },
] as const;

export function InterventionsScreen({
  startAt = 0,
  frozen = false,
  live = false,
}: {
  startAt?: number;
  frozen?: boolean;
  live?: boolean;
}) {
  const router = useRouter();
  const { vitals, assess, history, controls } = usePatientState({
    startAt,
    frozen,
    live,
  });
  const [chosen, setChosen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todas" | Category>("todas");

  const shown = ACTIONS.filter(
    (a) => filter === "todas" || a.categories.includes(filter),
  );

  const chosenAction = ACTIONS.find((a) => a.id === chosen) ?? null;
  const canApply = !!chosenAction?.engineKey;
  const now = Math.round(vitals.t);

  /**
   * Cada intervención se aplica INDIVIDUALMENTE al paciente de la sesión y
   * lleva a su propia pantalla de respuesta. "Observar" no toca el motor.
   */
  const applyChosen = () => {
    if (!chosenAction?.engineKey) return;
    if (chosenAction.engineKey === "none") {
      router.push("/monitor");
      return;
    }
    controls?.apply(chosenAction.engineKey);
    router.push(
      `/response?iv=${chosenAction.engineKey}&at=${now}&t=${now}`,
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page">
      <TopBar vitals={vitals} assess={assess} compact />

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[15rem_minmax(0,1fr)_16.5rem] gap-2.5 px-3 py-2.5">
        <PatientColumn vitals={vitals} assess={assess} history={history} />
        <ActionColumn
          shown={shown}
          chosen={chosen}
          onChoose={setChosen}
          filter={filter}
          onFilter={setFilter}
          assess={assess}
          decisionAt={now}
        />
        <AgentColumn />
      </div>

      <BottomNav active="Intervenciones" accent="var(--gold)" items={6} underline>
        <a
          href="/monitor"
          className="flex items-center gap-2 rounded-lg border border-line-strong px-6 py-2.5 text-[0.625rem] text-mid transition-colors hover:border-lo hover:text-hi"
        >
          <X className="h-[0.7rem] w-[0.7rem]" />
          Volver al monitor
        </a>
        <button
          onClick={applyChosen}
          disabled={!canApply}
          className={`flex items-center gap-2.5 rounded-lg border px-6 py-2.5 text-[0.625rem] font-medium transition-opacity ${
            canApply
              ? "border-[#e5484d] bg-crit text-[#1a0708] hover:opacity-90"
              : "cursor-not-allowed border-line-strong text-lo opacity-60"
          }`}
        >
          {chosenAction
            ? chosenAction.engineKey === "none"
              ? "Continuar observando"
              : canApply
                ? `Aplicar: ${chosenAction.title}`
                : "No modelada en el motor"
            : "Selecciona una intervención"}
          <ArrowRight className="h-[0.8rem] w-[0.8rem]" />
        </button>
      </BottomNav>
    </div>
  );
}

/* --------------------------------------------------------------- columna 1 */

function PatientColumn({
  vitals,
  assess,
  history,
}: {
  vitals: Vitals;
  assess: ReturnType<typeof usePatientState>["assess"];
  history: Vitals[];
}) {
  const ui = STATUS_UI[assess.status];
  const trend = trendUI(assess.trend);
  const status =
    assess.status === "critical"
      ? "CRÍTICO"
      : assess.status === "unstable"
        ? "INESTABLE"
        : "ESTABLE";

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-3 py-2.5 text-[0.5625rem] tracking-[0.14em] text-mid">
          ESTADO ACTUAL DEL PACIENTE
        </div>

        <div className="relative h-[9rem] shrink-0 overflow-hidden">
          <BeatingHeart
            hr={vitals.hr}
            rhythm={vitals.rhythm}
            strokeVolume={vitals.sv}
            perfusion={vitals.perfusion_index}
            className="absolute top-1/2 left-[27%] h-[92%] w-[46%] -translate-x-1/2 -translate-y-1/2"
          />
          {/* EcgStrip trae su propio `relative`, que en Tailwind gana sobre
              un `absolute` pasado por className: hay que envolverlo. */}
          <div className="absolute top-1/2 right-0 h-[3.6rem] w-[50%] -translate-y-1/2">
            <EcgStrip
              hr={vitals.hr}
              rhythm={vitals.rhythm}
              amplitude={Math.min(1.1, Math.max(0.5, vitals.sv / 85))}
              className="h-full w-full"
            />
          </div>
        </div>

        <div className="shrink-0 px-3 pb-1">
          <span
            className="rounded border px-2 py-[0.15rem] text-[0.5rem] tracking-[0.1em]"
            style={{ borderColor: ui.border, background: ui.bg, color: ui.color }}
          >
            {status}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-between px-3 pt-2.5 pb-3">
          {VITALS.map((v) => {
            const isBp = v.key === "bp";
            const raw = isBp
              ? vitals.sbp
              : (vitals[v.key as keyof Vitals] as number);
            const level: Level = isBp
              ? LEVEL.sbp(vitals.sbp)
              : (LEVEL[v.key]?.(raw) ?? "ok");
            const Icon = v.icon;
            const series = history
              .filter((_, i) => i % 8 === 0)
              .slice(-22)
              .map((h) => (isBp ? h.sbp : (h[v.key as keyof Vitals] as number)));
            return (
              <div key={v.key} className="flex items-center gap-2">
                <span className="shrink-0" style={{ color: v.color }}>
                  <Icon className="h-[0.9rem] w-[0.9rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.5625rem] text-mid">
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
                <div className="flex shrink-0 items-center gap-1">
                  <Sparkline
                    values={series}
                    min={v.min}
                    max={v.max}
                    color={v.color}
                    width={52}
                    height={24}
                  />
                  <div className="flex h-[24px] w-[1.1rem] flex-col justify-between text-[0.4375rem] text-dim">
                    <span>{v.max}</span>
                    <span>{v.min}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="shrink-0 p-3">
        <div className="text-[0.5625rem] tracking-[0.14em] text-mid">
          TENDENCIA GLOBAL
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span
            className="text-[0.8125rem] font-medium"
            style={{ color: trend.color }}
          >
            {assess.trend === "worsening"
              ? "Deterioro rápido"
              : assess.trend === "improving"
                ? "Mejorando"
                : "Sin cambios"}
          </span>
          <span className="text-[0.8rem]" style={{ color: trend.color }}>
            {trend.glyph}
          </span>
        </div>
        <div className="mt-1 text-[0.4375rem] text-dim">
          Comparado con los últimos 15 min
        </div>
        <div className="mt-2">
          <Sparkline
            values={history
              .filter((_, i) => i % 6 === 0)
              .slice(-40)
              .map((h) => h.map)}
            min={40}
            max={100}
            color="var(--crit)"
            width={272}
            height={26}
          />
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- columna 2 */

function ActionColumn({
  shown,
  chosen,
  onChoose,
  filter,
  onFilter,
  assess,
  decisionAt,
}: {
  shown: Action[];
  chosen: string | null;
  onChoose: (id: string) => void;
  filter: string;
  onFilter: (f: "todas" | Category) => void;
  assess: ReturnType<typeof usePatientState>["assess"];
  decisionAt: number;
}) {
  const worsening = assess.status !== "stable";
  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-[0.8125rem] font-medium tracking-[0.08em] text-hi">
          DECISIÓN DE INTERVENCIÓN
        </h1>
        <p className="mt-1 text-[0.5625rem] text-mid">
          Selecciona la mejor acción basada en el estado actual y las
          recomendaciones de los agentes.
        </p>
      </div>

      {worsening ? (
        <div className="mt-2.5 flex shrink-0 items-center gap-3 rounded-[0.6rem] border border-[rgba(229,72,77,0.32)] bg-[rgba(229,72,77,0.06)] px-4 py-2.5">
          <AlertTriangle className="h-[1rem] w-[1rem] shrink-0 text-crit" />
          <div className="text-[0.5625rem] leading-[1.6] text-mid">
            El paciente está en deterioro hemodinámico progresivo.
            <br />
            <span className="font-medium text-crit">
              Actuar ahora puede cambiar el desenlace.
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex shrink-0 items-center gap-3 rounded-[0.6rem] border border-[rgba(63,191,127,0.3)] bg-[rgba(63,191,127,0.05)] px-4 py-2.5">
          <Info className="h-[1rem] w-[1rem] shrink-0 text-ok" />
          <div className="text-[0.5625rem] leading-[1.6] text-mid">
            El paciente está estable.
            <br />
            <span className="font-medium text-ok">
              Puedes explorar escenarios sin urgencia de intervenir.
            </span>
          </div>
        </div>
      )}

      <div className="mt-2.5 flex shrink-0 items-center gap-1 border-b border-line">
        {FILTERS.map((f) => {
          const Icon = FILTER_ICON[f.id];
          const on = f.id === filter;
          return (
            <button
              key={f.id}
              onClick={() => onFilter(f.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[0.5625rem] transition-colors ${
                on
                  ? "border-gold text-gold"
                  : "border-transparent text-lo hover:text-mid"
              }`}
            >
              <Icon className="h-[0.75rem] w-[0.75rem]" />
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-5 gap-2.5">
        {shown.map((a) => (
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
            Todas las intervenciones se simularán antes de aplicarse.
          </div>
          <div className="mt-1 text-[0.5rem] text-lo">
            Podrás comparar los escenarios proyectados y sus posibles resultados.
          </div>
        </div>
        <a
          href={`/compare?at=${decisionAt}&t=${decisionAt}`}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-[rgba(90,169,230,0.4)] bg-[rgba(90,169,230,0.1)] px-4 py-2.5 text-[0.5625rem] text-info transition-colors hover:bg-[rgba(90,169,230,0.16)]"
        >
          Ver simulaciones (what-if)
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
  const isIntervention = a.kind === "INTERVENCIÓN";

  return (
    <div
      className="flex min-w-0 flex-col rounded-[0.6rem] border bg-[#0a0e14] p-3.5 transition-colors"
      style={{
        borderColor: chosen ? a.color : "var(--line)",
        boxShadow: chosen
          ? `0 0 1.6rem -0.7rem ${a.color}`
          : undefined,
      }}
    >
      <div className="flex items-center gap-1.5">
        {!isIntervention && (
          <Icon
            className="h-[0.65rem] w-[0.65rem] shrink-0"
            style={{ color: a.color }}
          />
        )}
        <span
          className="truncate text-[0.5rem] tracking-[0.14em]"
          style={{ color: isIntervention ? a.color : "var(--text-dim)" }}
        >
          {isIntervention ? `${a.kind} ${a.letter}` : a.kind}
        </span>
      </div>

      <div className="mt-2 text-[0.8125rem] leading-tight font-medium text-hi">
        {a.title}
      </div>
      <div className="mt-1 text-[0.5625rem] text-lo">{a.subtitle}</div>

      {/* el icono grande ancla visualmente cada tarjeta */}
      <div
        className="mt-3 flex h-[3rem] w-[3rem] items-center justify-center rounded-[0.55rem] border"
        style={{
          borderColor: `color-mix(in srgb, ${a.color} 30%, transparent)`,
          background: `color-mix(in srgb, ${a.color} 9%, transparent)`,
          color: a.color,
        }}
      >
        <Icon className="h-[1.45rem] w-[1.45rem]" />
      </div>

      <p className="mt-3 text-[0.5625rem] leading-[1.6] text-mid">
        {a.description}
      </p>

      <div className="mt-3.5 text-[0.5rem] tracking-[0.12em] text-dim">
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
            <li
              key={c}
              className="flex items-center gap-1.5 text-[0.5625rem] text-mid"
            >
              <CheckSquare className="h-[0.65rem] w-[0.65rem] shrink-0 text-lo" />
              {c}
            </li>
          ))}
        </ul>
      )}
      {a.notes && (
        <ul className="mt-1.5 space-y-1.5">
          {a.notes.map((n) => (
            <li key={n} className="text-[0.5625rem] leading-[1.6] text-mid">
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-3">
        <div className="text-[0.5rem] tracking-[0.12em] text-dim">
          {a.timeLabel}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Clock className="h-[0.8rem] w-[0.8rem]" style={{ color: a.color }} />
          <span className="text-[0.625rem]" style={{ color: a.color }}>
            {a.time}
          </span>
        </div>
        {a.engineKey === null ? (
          // acción no modelada por el motor: se dice, no se finge
          <div className="mt-2.5 w-full rounded-md border border-line py-2.5 text-center text-[0.5625rem] text-lo">
            No modelada en el motor (MVP)
          </div>
        ) : (
          <button
            onClick={onChoose}
            className="mt-2.5 w-full rounded-md border py-2.5 text-[0.625rem] transition-colors"
            style={{
              borderColor: `color-mix(in srgb, ${a.color} 45%, transparent)`,
              color: a.color,
              background: chosen
                ? `color-mix(in srgb, ${a.color} 16%, transparent)`
                : "transparent",
            }}
          >
            {chosen ? "Seleccionada ✓" : "Seleccionar"}
          </button>
        )}
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
    <li className="flex items-center gap-1.5 text-[0.5625rem] text-mid">
      <span className="w-[0.55rem] shrink-0" style={{ color }}>
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
      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-3 py-2.5 text-[0.5625rem] tracking-[0.14em] text-mid">
          RECOMENDACIONES DE LOS AGENTES
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-between">
          {AGENT_RECOMMENDATIONS.map((r, i) => {
            const meta = AGENT_META.find((m) => m.id === r.id)!;
            const Icon = AGENT_ICON[r.id as keyof typeof AGENT_ICON];
            return (
              <div
                key={r.id}
                className={`flex items-start gap-2 px-3 py-2.5 ${i ? "border-t border-line" : ""}`}
              >
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

                  {r.confidence !== undefined && (
                    <div className="mt-1.5">
                      <div className="flex items-baseline gap-1 text-[0.4375rem] text-lo">
                        {r.confidenceLabel ?? "Confianza"}:
                        <span className="font-mono text-mid">
                          {r.confidence}%
                        </span>
                      </div>
                      <div className="mt-1 h-[0.15rem] overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${r.confidence}%`,
                            background: meta.color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {r.note && (
                    <div className="mt-1.5 flex items-center gap-1 text-[0.4375rem] text-lo">
                      <Plus className="h-[0.5rem] w-[0.5rem]" />
                      {r.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="shrink-0 border-[rgba(224,163,64,0.3)] bg-[rgba(224,163,64,0.04)] p-3">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-[0.7rem] w-[0.7rem] text-warn" />
          <span className="text-[0.5rem] tracking-[0.12em] text-warn">
            NOTA DEL ORQUESTADOR
          </span>
        </div>
        <p className="mt-2 text-[0.5rem] leading-[1.6] text-mid">
          El deterioro es rápido. Intervenir en los próximos 2 minutos puede
          mejorar significativamente la trayectoria del paciente.
        </p>
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

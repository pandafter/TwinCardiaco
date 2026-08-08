"use client";

import { useState } from "react";
import { usePatientState } from "@/hooks/usePatientState";
import { caseClock, type Vitals } from "@/lib/engine";
import { AGENT_META, SCENARIOS, agentFindings, type AgentId } from "@/lib/agents";
import {
  AgentCardio,
  AgentOrchestrator,
  AgentPharma,
  AgentPhysio,
  AgentSim,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Message,
  Flask,
  Gauge,
  HeartRate,
  Plus,
  Waves,
  Info,
} from "@/components/icons";
import { BottomNav, TopBar } from "@/components/shell/Shell";
import { ScenarioChart } from "./ScenarioChart";

const ICON: Record<AgentId, typeof AgentCardio> = {
  cardiology: AgentCardio,
  pharmacology: AgentPharma,
  physiology: AgentPhysio,
  simulation: AgentSim,
  orchestrator: AgentOrchestrator,
};

export function AgentsScreen({
  startAt = 0,
  frozen = false,
}: {
  startAt?: number;
  frozen?: boolean;
}) {
  const { vitals, assess } = usePatientState({ startAt, frozen });
  const [selected, setSelected] = useState<AgentId>("cardiology");
  const f = agentFindings(vitals, assess);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page">
      <TopBar vitals={vitals} assess={assess} subtitle="AI COMMAND CENTER" compact />

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[15.5rem_minmax(0,1fr)] gap-2.5 px-3 py-2.5">
        <AgentRail selected={selected} onSelect={setSelected} />
        <Activity vitals={vitals} f={f} />
      </div>

      <BottomNav active="Agentes" accent="var(--gold)" items={7} underline>
        <a
          href="/monitor"
          className="flex items-center gap-2.5 rounded-lg border border-[#8c6a28] bg-[rgba(200,155,72,0.1)] px-5 py-2.5 text-[0.625rem] font-medium text-gold transition-colors hover:bg-[rgba(200,155,72,0.18)]"
        >
          Volver al Twin
          <ArrowRight className="h-[0.8rem] w-[0.8rem]" />
        </a>
      </BottomNav>
    </div>
  );
}

/* --------------------------------------------------------------- columna 1 */

function AgentRail({
  selected,
  onSelect,
}: {
  selected: AgentId;
  onSelect: (id: AgentId) => void;
}) {
  return (
    <Card className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5">
        <span className="text-[0.5625rem] tracking-[0.14em] text-mid">
          AGENTES DE IA
        </span>
        <span className="rounded border border-[rgba(63,191,127,0.3)] bg-[rgba(63,191,127,0.08)] px-1.5 py-[0.08rem] text-[0.4375rem] tracking-[0.08em] text-ok">
          5 ACTIVOS
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {AGENT_META.map((a) => {
          const Icon = ICON[a.id];
          const on = a.id === selected;
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className="flex items-start gap-2.5 rounded-[0.55rem] border p-2.5 text-left transition-colors"
              style={{
                borderColor: on ? "var(--line-gold)" : "var(--line)",
                background: on ? "rgba(200,155,72,0.05)" : "var(--bg-card)",
              }}
            >
              <span
                className="flex h-[2rem] w-[2rem] shrink-0 items-center justify-center rounded-[0.45rem] border"
                style={{
                  borderColor: `color-mix(in srgb, ${a.color} 35%, transparent)`,
                  background: `color-mix(in srgb, ${a.color} 10%, transparent)`,
                  color: a.color,
                }}
              >
                <Icon className="h-[1rem] w-[1rem]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[0.6875rem] text-hi">
                    {a.name}
                  </span>
                  <ChevronRight className="h-[0.65rem] w-[0.65rem] shrink-0 text-dim" />
                </div>
                <div
                  className="mt-1 flex items-center gap-1 text-[0.5rem]"
                  style={{ color: a.color }}
                >
                  <span
                    className="h-[0.25rem] w-[0.25rem] rounded-full"
                    style={{
                      background: a.color,
                      animation: "pulse-dot 1.8s ease-in-out infinite",
                    }}
                  />
                  {a.state} ⟩
                </div>
                <p className="mt-1.5 text-[0.5rem] leading-[1.5] text-mid">
                  {a.blurb}
                </p>
              </div>
            </button>
          );
        })}

        <button className="flex shrink-0 items-center justify-center gap-1.5 rounded-[0.55rem] border border-dashed border-line-strong py-2.5 text-[0.5625rem] text-lo transition-colors hover:text-mid">
          <Plus className="h-[0.7rem] w-[0.7rem]" />
          Agregar agente personalizado
        </button>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- columna 2 */

type Findings = ReturnType<typeof agentFindings>;

function Activity({ vitals, f }: { vitals: Vitals; f: Findings }) {
  const now = vitals.t;

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="shrink-0 pb-2">
        <div className="text-[0.5625rem] tracking-[0.14em] text-mid">
          ACTIVIDAD DE AGENTES EN TIEMPO REAL
        </div>
        <div className="mt-1 text-[0.5625rem] text-lo">
          Los agentes analizan continuamente los cambios fisiológicos y
          comparten hallazgos.
        </div>
      </div>

      {/* La columna derecha es una pila continua: Physiology, memoria y
          consenso comparten ancho. La izquierda es su propia retícula, así el
          consenso no comprime las tarjetas de arriba. */}
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.28fr)] gap-2.5">
        <div className="col-span-2 grid min-h-0 min-w-0 grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2.5">
          <AgentCard
            id="cardiology"
            at={now - 1}
            finding={f.cardiology.finding}
            listTitle={f.cardiology.listTitle}
            items={f.cardiology.items}
            confidence={f.cardiology.confidence}
          />
          <AgentCard
            id="pharmacology"
            at={now - 2}
            finding={f.pharmacology.finding}
            listTitle={f.pharmacology.listTitle}
            items={f.pharmacology.items}
            confidence={f.pharmacology.confidence}
          />

          <SimulationCard at={now} />
          <OrchestratorCard at={now} f={f} />

          <Card className="col-span-2 shrink-0">
            <div className="px-4 py-2 text-[0.5625rem] tracking-[0.14em] text-mid">
              LÍNEA DE TIEMPO DE EVENTOS E INTERACCIONES
            </div>
            <Timeline now={now} vitals={vitals} />
          </Card>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
          <AgentCard
            id="physiology"
            at={now - 3}
            finding={f.physiology.finding}
            listTitle={f.physiology.listTitle}
            chains={f.physiology.chains}
            confidence={f.physiology.confidence}
            className="flex-1"
          />
          <MemoryCard vitals={vitals} className="flex-1" />
          <ConsensusCard now={now} f={f} />
          <AskAgentCard />
        </div>
      </div>
    </div>
  );
}

function AgentCard({
  id,
  at,
  finding,
  listTitle,
  items,
  chains,
  confidence,
  className = "",
}: {
  id: AgentId;
  at: number;
  finding: string;
  listTitle: string;
  items?: string[];
  chains?: string[][];
  confidence: number;
  className?: string;
}) {
  const meta = AGENT_META.find((m) => m.id === id)!;
  const Icon = ICON[id];

  return (
    <div className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[0.55rem] border border-line bg-[#0a0e14] p-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-[0.95rem] w-[0.95rem]" style={{ color: meta.color }} />
        <span className="min-w-0 flex-1 truncate text-[0.5625rem] tracking-[0.06em] text-hi">
          {meta.name.toUpperCase()}
        </span>
        <span
          className="flex items-center gap-1 text-[0.5rem]"
          style={{ color: meta.color }}
        >
          {meta.state}
          <span
            className="h-[0.25rem] w-[0.25rem] rounded-full"
            style={{
              background: meta.color,
              animation: "pulse-dot 1.8s ease-in-out infinite",
            }}
          />
        </span>
      </div>
      <div className="mt-1 text-right font-mono text-[0.5rem] text-dim">
        {caseClock(at).hhmmss}
      </div>

      <div className="mt-2 text-[0.5625rem] text-hi">Hallazgo principal</div>
      <p className="mt-1.5 text-[0.5rem] leading-[1.6] text-mid">{finding}</p>

      <div className="mt-3 text-[0.5625rem] text-hi">{listTitle}</div>
      {items && (
        <ul className="mt-1.5 space-y-1">
          {items.map((t) => (
            <li
              key={t}
              className="flex gap-1.5 text-[0.5rem] leading-[1.5] text-mid"
            >
              <span className="mt-[0.35rem] h-[0.15rem] w-[0.15rem] shrink-0 rounded-full bg-lo" />
              {t}
            </li>
          ))}
        </ul>
      )}
      {chains && (
        <div className="mt-2 space-y-1.5">
          {chains.map((c) => (
            <div
              key={c.join()}
              className="flex items-center justify-between rounded-md border border-line bg-card px-2 py-1.5"
            >
              {c.map((step, i) => (
                <span key={step} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[0.5rem] text-dim">→</span>}
                  <span className="text-[0.5rem] text-mid">{step}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      <ConfidenceBar
        label="Confianza"
        value={confidence}
        color={meta.color}
        className="mt-auto pt-3"
      />
    </div>
  );
}

function SimulationCard({ at }: { at: number }) {
  const meta = AGENT_META.find((m) => m.id === "simulation")!;
  return (
    <div className="col-span-1 flex min-h-0 min-w-0 flex-col rounded-[0.55rem] border border-line bg-[#0a0e14] p-3">
      <div className="flex items-center gap-2">
        <AgentSim className="h-[0.95rem] w-[0.95rem]" style={{ color: meta.color }} />
        <span className="min-w-0 flex-1 truncate text-[0.5625rem] tracking-[0.06em] text-hi">
          SIMULATION AGENT
        </span>
        <span className="text-[0.5rem]" style={{ color: meta.color }}>
          Simulando
        </span>
      </div>
      <div className="mt-1 text-right font-mono text-[0.5rem] text-dim">
        {caseClock(at).hhmmss}
      </div>

      <div className="mt-2 text-[0.5625rem] text-hi">
        Escenarios en ejecución: 3
      </div>
      <div className="mt-2 flex min-h-0 flex-1 gap-2">
        <ul className="flex w-[45%] flex-col gap-1.5">
          {SCENARIOS.map((s) => (
            <li
              key={s.id}
              className="flex gap-1.5 text-[0.5rem] leading-[1.4] text-mid"
            >
              <span
                className="mt-[0.3rem] h-[0.15rem] w-[0.15rem] shrink-0 rounded-full"
                style={{ background: s.tone }}
              />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="min-w-0 flex-1">
          <ScenarioChart />
        </div>
      </div>

      <ConfidenceBar
        label="Progreso"
        value={67}
        color="var(--ok)"
        className="mt-auto pt-2"
      />
    </div>
  );
}

function OrchestratorCard({ at, f }: { at: number; f: Findings }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[0.55rem] border border-line bg-[#0a0e14] p-3">
      <div className="flex items-center gap-2">
        <AgentOrchestrator
          className="h-[0.95rem] w-[0.95rem]"
          style={{ color: "var(--gold)" }}
        />
        <span className="min-w-0 flex-1 truncate text-[0.5625rem] tracking-[0.06em] text-hi">
          ORCHESTRATOR
        </span>
        <span className="text-[0.5rem] text-gold">Coordinando</span>
      </div>
      <div className="mt-1 text-right font-mono text-[0.5rem] text-dim">
        {caseClock(at).hhmmss}
      </div>

      <div className="mt-2 text-[0.5625rem] text-hi">Síntesis actual</div>
      <p className="mt-1.5 text-[0.5rem] leading-[1.6] text-mid">
        {f.orchestrator.synthesis}
      </p>

      <div className="mt-3 text-[0.5625rem] text-hi">Estado del consenso</div>
      <div className="mt-1.5 rounded-md border border-[rgba(224,163,64,0.35)] bg-[rgba(224,163,64,0.06)] p-2.5">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-[0.7rem] w-[0.7rem] text-warn" />
          <span className="text-[0.5625rem] tracking-[0.06em] text-warn">
            ACUERDO PARCIAL
          </span>
        </div>
        <div className="mt-1.5 text-[0.5rem] leading-[1.6] text-mid">
          Acuerdan: {f.orchestrator.agree}
          <br />
          En discusión: {f.orchestrator.dispute}
        </div>
      </div>

      <ConfidenceBar
        label="Confianza del consenso"
        value={f.orchestrator.confidence}
        color="var(--warn)"
        className="mt-auto pt-3"
      />
    </div>
  );
}

function Timeline({ now, vitals }: { now: number; vitals: Vitals }) {
  const nodes = [
    { icon: Waves, c: "var(--ok)", at: 25, l: ["Nuevo evento", "fisiológico"] },
    { icon: HeartRate, c: "var(--crit)", at: 27, l: ["FC aumentó", `a ${Math.round(vitals.hr)} bpm`] },
    { icon: Gauge, c: "var(--crit)", at: 30, l: ["MAP cayó", "< 60 mmHg"] },
    { icon: Flask, c: "var(--violet)", at: 31, l: ["Lactato aumentó", `a ${vitals.lactate.toFixed(1)} mmol/L`] },
    { icon: AlertTriangle, c: "var(--crit)", at: 33, l: ["Deterioro", "hemodinámico", "detectado"], focus: true },
    { icon: AgentPhysio, c: "var(--info)", at: 34, l: ["Agentes", "activados"] },
    { icon: AgentSim, c: "var(--ok)", at: 34, l: ["Simulación de", "escenarios", "iniciada"] },
    { icon: Info, c: "var(--text-lo)", at: null, l: ["En espera de", "intervención", "humana"] },
  ];

  return (
    <div className="relative px-6 pb-3">
      <div className="absolute top-[1.35rem] right-8 left-8 border-t border-dashed border-line-strong" />
      <div className="relative flex items-start justify-between">
        {nodes.map((n, i) => {
          const Icon = n.icon;
          return (
            <div key={i} className="flex w-[6.2rem] flex-col items-center">
              <span
                className="flex h-[1.9rem] w-[1.9rem] items-center justify-center rounded-full border bg-card"
                style={{
                  borderColor: n.focus
                    ? "var(--crit)"
                    : `color-mix(in srgb, ${n.c} 30%, transparent)`,
                  color: n.c,
                  boxShadow: n.focus
                    ? "0 0 0 0.22rem rgba(229,72,77,0.14)"
                    : undefined,
                }}
              >
                <Icon className="h-[0.85rem] w-[0.85rem]" />
              </span>
              <span className="mt-1.5 font-mono text-[0.5rem] text-lo">
                {n.at === null ? "—" : caseClock(now - 60 + n.at).hhmmss}
              </span>
              <span className="mt-1 text-center text-[0.4375rem] leading-[1.5] text-mid">
                {n.l.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- columna 3 */

function MemoryCard({ vitals, className = "" }: { vitals: Vitals; className?: string }) {
  const now = vitals.t;
  const memory = [
    { icon: Waves, c: "var(--ok)", at: 27, t: "Nuevo evento fisiológico recibido", s: `Incremento de FC a ${Math.round(vitals.hr)} bpm` },
    { icon: HeartRate, c: "var(--ok)", at: 28, t: "ECG actualizado", s: "Taquicardia sinusal" },
    { icon: Gauge, c: "var(--crit)", at: 30, t: "MAP cayó por debajo de 60 mmHg", s: null },
    { icon: Flask, c: "var(--violet)", at: 31, t: `Lactato aumentó a ${vitals.lactate.toFixed(1)} mmol/L`, s: null },
    { icon: AlertTriangle, c: "var(--crit)", at: 33, t: "Deterioro hemodinámico detectado", s: null },
    { icon: AgentSim, c: "var(--crit)", at: 34, t: "Simulación de escenarios iniciada", s: null },
  ];

  return (
    <Card className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5">
        <span className="text-[0.5625rem] tracking-[0.14em] text-mid">
          MEMORIA COMPARTIDA
        </span>
        <button className="rounded border border-line px-2 py-[0.15rem] text-[0.5rem] text-lo hover:text-mid">
          Ver todo
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-around px-3 py-2">
        {memory.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="flex items-start gap-2">
              <Icon
                className="mt-[0.1rem] h-[0.8rem] w-[0.8rem] shrink-0"
                style={{ color: m.c }}
              />
              <span className="shrink-0 font-mono text-[0.5rem] text-lo">
                {caseClock(now - 60 + m.at).hhmmss}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.5rem] text-hi">{m.t}</div>
                {m.s && (
                  <div className="mt-0.5 truncate text-[0.4375rem] text-dim">
                    {m.s}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ConsensusCard({ now, f }: { now: number; f: Findings }) {
  return (
    <Card className="flex min-w-0 shrink-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5">
        <span className="text-[0.5625rem] tracking-[0.14em] text-mid">
          CONSENSO ACTUAL
        </span>
        <span className="font-mono text-[0.4375rem] text-dim">
          Actualizado: {caseClock(now).hhmmss}
        </span>
      </div>
      <div className="flex gap-3 p-3">
        <ConsensusDial value={f.orchestrator.confidence} />
        <div className="min-w-0 flex-1">
          <div className="text-[0.5625rem] text-hi">Conclusión</div>
          <p className="mt-1 text-[0.5rem] leading-[1.6] text-mid">
            Paciente deteriorándose. Requiere intervención para mejorar
            perfusión y estabilizar estado hemodinámico.
          </p>
          <div className="mt-2 text-[0.5625rem] text-hi">
            Recomendación provisional
          </div>
          <p className="mt-1 text-[0.5rem] leading-[1.6] text-warn">
            Considerar intervención inotrópica o vasopresora.
          </p>
        </div>
      </div>
      <div className="mx-3 mb-3 flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5">
        <Info className="h-[0.65rem] w-[0.65rem] shrink-0 text-dim" />
        <span className="text-[0.4375rem] leading-tight text-dim">
          Prototipo educativo. No diagnostica ni recomienda tratamientos.
        </span>
      </div>
    </Card>
  );
}

function AskAgentCard() {
  return (
    <Card className="flex min-w-0 shrink-0 flex-col p-3">
      <div className="text-[0.625rem] text-hi">
        ¿Necesitas apoyo de un agente?
      </div>
      <div className="mt-1 text-[0.5rem] text-lo">
        Selecciona un agente para consultarlo directamente.
      </div>
      <div className="mt-2.5 flex gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-between rounded-md border border-line-strong bg-card px-3 py-2 text-[0.5625rem] text-lo">
          Seleccionar agente...
          <ChevronDown className="h-[0.7rem] w-[0.7rem]" />
        </div>
        <button className="flex w-[2.6rem] shrink-0 items-center justify-center rounded-md border border-[rgba(90,169,230,0.4)] bg-[rgba(90,169,230,0.12)] text-info">
          <Message className="h-[0.8rem] w-[0.8rem]" />
        </button>
      </div>
    </Card>
  );
}

function ConsensusDial({ value }: { value: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[5.5rem] w-[5.5rem] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--ok)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-[1.05rem] leading-none font-semibold text-hi tabular-nums">
          {value}
          <span className="text-[0.6rem]">%</span>
        </div>
        <div className="mt-0.5 text-[0.4375rem] text-dim">Confianza</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function ConfidenceBar({
  label,
  value,
  color,
  className = "",
}: {
  label: string;
  value: number;
  color: string;
  className?: string;
}) {
  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <span className="shrink-0 text-[0.5rem] text-lo">{label}</span>
      <div className="h-[0.2rem] flex-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="shrink-0 font-mono text-[0.5rem] text-mid tabular-nums">
        {value}%
      </span>
    </div>
  );
}

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

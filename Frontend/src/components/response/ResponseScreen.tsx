"use client";

import { usePatientState } from "@/hooks/usePatientState";
import { caseClock, LEVEL, type Vitals } from "@/lib/engine";
import { AGENT_META } from "@/lib/agents";
import {
  AgentCardio,
  AgentOrchestrator,
  AgentPharma,
  AgentPhysio,
  AgentSim,
  ArrowRight,
  ChevronDown,
  Clock,
  Droplet,
  Flask,
  Gauge,
  Gear,
  HeartRate,
  LogoMark,
  Message,
  Plus,
  Syringe,
  Users,
  Waves,
  CheckCircle,
} from "@/components/icons";
import { BeatingHeart } from "@/components/monitor/BeatingHeart";
import { Sparkline } from "@/components/monitor/Sparkline";
import { TrajectoryChart } from "./TrajectoryChart";

const AGENT_ICON = {
  cardiology: AgentCardio,
  pharmacology: AgentPharma,
  physiology: AgentPhysio,
  simulation: AgentSim,
  orchestrator: AgentOrchestrator,
};

const AGENT_STATUS: Record<string, string> = {
  cardiology: "Reevaluando el ritmo. La frecuencia va cediendo.",
  pharmacology: "Respuesta esperada al fármaco.",
  physiology: "La perfusión mejora.",
  simulation: "Trayectoria actualizada.",
  orchestrator: "Consenso: trayectoria de estabilización.",
};

const ROWS = [
  { key: "hr", label: "FC", unit: "bpm", color: "var(--crit)", min: 60, max: 160, digits: 0, good: "down" },
  { key: "map", label: "MAP", unit: "mmHg", color: "var(--info)", min: 40, max: 100, digits: 0, good: "up" },
  { key: "spo2", label: "SpO₂", unit: "%", color: "var(--info)", min: 80, max: 100, digits: 0, good: "up" },
  { key: "lactate", label: "Lactato", unit: "mmol/L", color: "var(--violet)", min: 0, max: 6, digits: 1, good: "down" },
] as const;

export function ResponseScreen({
  startAt = 160,
  interventionAt = 100,
  interventionKey = "inotrope",
  frozen = false,
}: {
  startAt?: number;
  interventionAt?: number;
  interventionKey?: string;
  frozen?: boolean;
}) {
  const { vitals, assess, history, engine } = usePatientState({
    startAt,
    frozen,
    intervention: { at: interventionAt, key: interventionKey },
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page">
      <TopBar vitals={vitals} />

      <div className="grid min-h-0 flex-1 grid-cols-[19rem_minmax(0,1fr)_19rem] gap-2.5 px-3 pt-2.5">
        <PhysiologyColumn
          vitals={vitals}
          history={history}
          assess={assess}
          interventionAt={engine.interventionAt}
        />
        <HeartStage vitals={vitals} assess={assess} />
        <AgentsColumn vitals={vitals} />
      </div>

      <Timeline vitals={vitals} interventionAt={engine.interventionAt} />

      <div className="grid h-[15.5rem] shrink-0 grid-cols-[minmax(0,1fr)_19rem] gap-2.5 px-3 pb-3">
        <Card className="flex min-h-0 flex-col p-3">
          <div className="flex shrink-0 items-start justify-between">
            <div>
              <div className="text-[0.6875rem] tracking-[0.12em] text-hi">
                TRAYECTORIA FISIOLÓGICA
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <Legend color="var(--crit)" label="Antes de intervenir" />
                <Legend color="var(--ok)" label="Después de intervenir" />
                <Legend color="var(--ok)" label="Proyectado" dashed />
              </div>
            </div>
            <div className="flex flex-1 justify-around pt-1">
              <span className="text-[0.625rem] tracking-[0.1em] text-crit">
                ANTES DE INTERVENIR
              </span>
              <span className="text-[0.625rem] tracking-[0.1em] text-ok">
                DESPUÉS DE INTERVENIR
              </span>
            </div>
          </div>
          <div className="mt-1 min-h-0 flex-1">
            <TrajectoryChart
              history={history}
              interventionAt={engine.interventionAt}
            />
          </div>
        </Card>

        <PortalStatus />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ topbar */

function TopBar({ vitals }: { vitals: Vitals }) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-[1.5rem] w-[1.5rem] text-crit" />
          <span className="text-[1.05rem] font-semibold tracking-[0.06em] text-hi">
            CARDIAC <span className="font-light text-mid">TWIN</span>
          </span>
        </div>
        <div className="leading-tight">
          <div className="text-[0.625rem] text-mid">
            PACIENTE: <span className="text-hi">CT-0427</span>
          </div>
          <div className="mt-0.5 text-[0.5625rem] text-lo">
            Masculino · 67 años · 78 kg · 172 cm
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[0.75rem] tracking-[0.16em] text-hi">EN VIVO</span>
        <span
          className="h-[0.4rem] w-[0.4rem] rounded-full bg-crit"
          style={{ animation: "pulse-dot 1.4s ease-in-out infinite" }}
        />
      </div>

      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-[0.625rem] tracking-[0.08em] text-ok">
          <span className="h-[0.35rem] w-[0.35rem] rounded-full bg-ok" />
          PORTAL CONECTADO
        </span>
        <IconButton>
          <Message className="h-[0.85rem] w-[0.85rem]" />
        </IconButton>
        <button className="flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-[0.625rem] text-mid">
          <Users className="h-[0.85rem] w-[0.85rem]" />2
          <ChevronDown className="h-[0.6rem] w-[0.6rem]" />
        </button>
        <IconButton>
          <Gear className="h-[0.85rem] w-[0.85rem]" />
        </IconButton>
      </div>
    </header>
  );
}

const IconButton = ({ children }: { children: React.ReactNode }) => (
  <button className="flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-lg border border-line-strong text-lo transition-colors hover:text-mid">
    {children}
  </button>
);

/* --------------------------------------------------------------- columna 1 */

function PhysiologyColumn({
  vitals,
  history,
  assess,
  interventionAt,
}: {
  vitals: Vitals;
  history: Vitals[];
  assess: ReturnType<typeof usePatientState>["assess"];
  interventionAt: number | null;
}) {
  return (
    <Card className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5">
        <span className="flex items-center gap-2 text-[0.6875rem] tracking-[0.12em] text-hi">
          <Waves className="h-[0.85rem] w-[0.85rem] text-info" />
          FISIOLOGÍA EN VIVO
        </span>
        <LiveTag />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between px-3 py-2.5">
        {ROWS.map((r) => (
          <VitalTrend
            key={r.key}
            row={r}
            vitals={vitals}
            history={history}
            interventionAt={interventionAt}
          />
        ))}

        <div className="mt-1 border-t border-line pt-2.5">
          <div className="text-[0.5625rem] text-mid">Estado hemodinámico</div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-[0.8125rem] font-semibold text-crit">
              CRÍTICO
            </span>
            <span className="h-px flex-1 bg-line-strong" />
            <ArrowRight className="h-[0.8rem] w-[0.8rem] text-lo" />
            <span className="text-[0.8125rem] font-semibold text-ok">
              {assess.trend === "improving" ? "MEJORANDO" : "ESTABILIZANDO"}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Los últimos cuatro valores desde la intervención: la mejora como secuencia. */
function VitalTrend({
  row,
  vitals,
  history,
  interventionAt,
}: {
  row: (typeof ROWS)[number];
  vitals: Vitals;
  history: Vitals[];
  interventionAt: number | null;
}) {
  const key = row.key as keyof Vitals;
  // desde el momento de la intervención hasta ahora: la secuencia tiene que
  // enseñar la respuesta, no los últimos segundos de la meseta
  const from = Math.max(
    0,
    history.findIndex((v) => v.t >= (interventionAt ?? 0)),
  );
  const window = history.slice(from);
  const steps = [0, 0.34, 0.67].map((f) => {
    const v = window[Math.floor(f * Math.max(1, window.length - 1))];
    return (v?.[key] as number) ?? (vitals[key] as number);
  });
  const now = vitals[key] as number;
  const level = LEVEL[row.key]?.(now) ?? "ok";
  const improving =
    row.good === "down" ? now < steps[0] : now > steps[0];

  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <div className="w-[3.2rem] shrink-0">
          <div className="text-[0.75rem] text-hi">{row.label}</div>
          <div className="text-[0.5rem] text-dim">{row.unit}</div>
        </div>

        <div className="flex flex-1 items-baseline justify-end gap-1.5 font-mono tabular-nums">
          {steps.map((v, i) => (
            <span key={i} className="flex items-baseline gap-1.5">
              <span className="text-[0.75rem] text-lo">
                {v.toFixed(row.digits)}
              </span>
              <span className="text-[0.6rem] text-dim">→</span>
            </span>
          ))}
          <span
            className={`text-[1.05rem] font-semibold ${improving ? "text-ok" : level === "crit" ? "text-crit" : "text-hi"}`}
          >
            {now.toFixed(row.digits)}
          </span>
        </div>

        <span className={`shrink-0 text-[0.8rem] ${improving ? "text-ok" : "text-crit"}`}>
          {row.good === "down" ? (improving ? "⌄" : "⌃") : improving ? "⌃" : "⌄"}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <Sparkline
          values={history.filter((_, i) => i % 5 === 0).slice(-60).map((h) => h[key] as number)}
          min={row.min}
          max={row.max}
          color={row.color}
          width={228}
          height={26}
        />
        <div className="flex h-[26px] flex-col justify-between text-[0.4375rem] text-dim">
          <span>{row.max}</span>
          <span>{row.min}</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- columna 2 */

function HeartStage({
  vitals,
  assess,
}: {
  vitals: Vitals;
  assess: ReturnType<typeof usePatientState>["assess"];
}) {
  return (
    <Card className="relative flex min-h-0 flex-col overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 65% at 50% 42%, rgba(30,90,140,0.16) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-between px-4 pt-6">
        <VerticalGauge
          title={["GASTO", "CARDIACO"]}
          unit="L/min"
          value={vitals.co}
          min={0}
          max={10}
          ticks={[0, 2.5, 5, 7.5, 10]}
          color="var(--info)"
        />

        <BeatingHeart
          hr={vitals.hr}
          rhythm={vitals.rhythm}
          strokeVolume={vitals.sv}
          perfusion={vitals.perfusion_index}
          className="h-full w-[46%]"
        />

        <VerticalGauge
          title={["ÍNDICE", "CARDIACO"]}
          unit="L/min/m²"
          value={vitals.ci}
          min={0}
          max={6}
          ticks={[0, 2, 4, 6]}
          color="var(--ok)"
          align="right"
        />
      </div>

      <div className="relative shrink-0 pb-3 text-center">
        <div className="text-[0.6875rem] tracking-[0.14em] text-mid">
          RESPUESTA A LA INTERVENCIÓN — EN VIVO
        </div>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="rounded-md border border-[rgba(229,72,77,0.5)] bg-[rgba(229,72,77,0.08)] px-6 py-2 text-[0.9rem] font-semibold tracking-[0.06em] text-crit">
            CRÍTICO
          </span>
          <span className="text-[0.9rem] text-ok">›››</span>
          <span
            className="rounded-md border px-6 py-2 text-[0.9rem] font-semibold tracking-[0.06em] text-ok"
            style={{
              borderColor: "var(--ok)",
              background: "rgba(63,191,127,0.1)",
              boxShadow: "0 0 1.8rem -0.6rem var(--ok)",
            }}
          >
            {assess.status === "stable" ? "ESTABLE" : "ESTABILIZANDO"}
          </span>
        </div>
      </div>
    </Card>
  );
}

function VerticalGauge({
  title,
  unit,
  value,
  min,
  max,
  ticks,
  color,
  align = "left",
}: {
  title: string[];
  unit: string;
  value: number;
  min: number;
  max: number;
  ticks: number[];
  color: string;
  align?: "left" | "right";
}) {
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return (
    <div className={`flex shrink-0 flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      <div className={`text-[0.5rem] leading-[1.5] tracking-[0.14em] text-mid ${align === "right" ? "text-right" : ""}`}>
        {title.map((t) => (
          <div key={t}>{t}</div>
        ))}
        <div className="text-dim">{unit}</div>
      </div>

      <div className={`mt-2 flex items-stretch gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <div className="relative h-[9rem] w-[0.5rem] overflow-hidden rounded-full bg-[#0e1622]">
          <div
            className="absolute inset-x-0 bottom-0 rounded-full"
            style={{ height: `${pct * 100}%`, background: color }}
          />
        </div>
        <div className="flex h-[9rem] flex-col justify-between text-[0.4375rem] text-dim">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t.toFixed(1)}</span>
          ))}
        </div>
      </div>

      <div className="mt-1.5 font-mono text-[0.95rem] font-semibold tabular-nums" style={{ color }}>
        {value.toFixed(1)}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- columna 3 */

function AgentsColumn({ vitals }: { vitals: Vitals }) {
  return (
    <Card className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5">
        <span className="text-[0.6875rem] tracking-[0.12em] text-hi">
          AGENTES DE IA — EN VIVO
        </span>
        <LiveTag />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-around px-3 py-2">
        {AGENT_META.map((a) => {
          const Icon = AGENT_ICON[a.id];
          return (
            <div key={a.id} className="flex items-center gap-2.5">
              <span
                className="flex h-[2.1rem] w-[2.1rem] shrink-0 items-center justify-center rounded-full border"
                style={{
                  borderColor: `color-mix(in srgb, ${a.color} 40%, transparent)`,
                  background: `color-mix(in srgb, ${a.color} 10%, transparent)`,
                  color: a.color,
                }}
              >
                <Icon className="h-[1rem] w-[1rem]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.5625rem] tracking-[0.08em] text-hi">
                  {a.name.toUpperCase()}
                </div>
                <p className="mt-0.5 text-[0.5rem] leading-[1.45] text-mid">
                  {AGENT_STATUS[a.id]}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-[0.4375rem] text-dim">
                  {caseClock(vitals.t).hhmmss}
                </span>
                <LiveTag small />
                <MiniEcg />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-line px-3 py-2">
        <span className="text-[0.5625rem] tracking-[0.1em] text-mid">
          AGENTES SINCRONIZADOS
        </span>
        <span className="font-mono text-[0.75rem] text-ok">5 / 5</span>
      </div>
    </Card>
  );
}

const MiniEcg = () => (
  <svg viewBox="0 0 60 14" className="h-[0.7rem] w-[2.6rem]" fill="none">
    <path
      d="M1 8h8l2-5 3 9 2-4h6l2-4 3 8 2-4h8l2-3 3 6 2-3h11"
      stroke="var(--ok)"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

function LiveTag({ small }: { small?: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 tracking-[0.1em] text-ok ${small ? "text-[0.4375rem]" : "text-[0.5rem]"}`}
    >
      <span
        className="h-[0.3rem] w-[0.3rem] rounded-full bg-ok"
        style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
      />
      EN VIVO
    </span>
  );
}

/* -------------------------------------------------------------- timeline */

function Timeline({
  vitals,
  interventionAt,
}: {
  vitals: Vitals;
  interventionAt: number | null;
}) {
  const iv = interventionAt ?? vitals.t;
  const nodes = [
    { icon: Syringe, at: iv, l: ["Intervención", "administrada"] },
    { icon: HeartRate, at: iv + 3, l: ["Respuesta de FC", "detectada"] },
    { icon: Gauge, at: iv + 6, l: ["MAP en", "ascenso"] },
    { icon: Droplet, at: iv + 10, l: ["Perfusión", "mejorando"] },
    { icon: CheckCircle, at: vitals.t, l: ["Estado del gemelo", "actualizado"], done: true },
  ];

  return (
    <div className="mx-3 my-2.5 flex shrink-0 items-center gap-4 rounded-[0.6rem] border border-line bg-card px-4 py-2.5">
      <span className="flex h-[2.2rem] w-[2.2rem] shrink-0 items-center justify-center rounded-full border border-line-strong text-lo">
        <Clock className="h-[1rem] w-[1rem]" />
      </span>

      <div className="relative flex flex-1 items-start justify-between">
        <div className="absolute top-[1.1rem] right-6 left-6 border-t border-dashed border-line-strong" />
        {nodes.map((n, i) => {
          const Icon = n.icon;
          return (
            <div key={i} className="relative flex flex-col items-center gap-1.5">
              <span
                className="flex h-[2.2rem] w-[2.2rem] items-center justify-center rounded-full border bg-card"
                style={{
                  borderColor: n.done ? "var(--info)" : "var(--line-strong)",
                  color: n.done ? "var(--info)" : "var(--text-mid)",
                  boxShadow: n.done ? "0 0 0 0.2rem rgba(90,169,230,0.12)" : undefined,
                }}
              >
                <Icon className="h-[0.95rem] w-[0.95rem]" />
              </span>
              <span className="font-mono text-[0.5rem] text-lo">
                {caseClock(n.at).hhmmss}
              </span>
              <span className="text-center text-[0.5rem] leading-[1.4] text-mid">
                {n.l.map((x) => (
                  <span key={x} className="block">
                    {x}
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

/* ---------------------------------------------------------- portal status */

function PortalStatus() {
  return (
    <Card className="flex min-w-0 flex-col p-3">
      <div className="flex items-start justify-between">
        <span className="text-[0.6875rem] tracking-[0.12em] text-hi">
          ESTADO DEL PORTAL
        </span>
        <svg viewBox="0 0 40 40" className="h-[2.4rem] w-[2.4rem]" fill="none">
          <circle cx="20" cy="20" r="15" stroke="var(--line-strong)" strokeWidth="1" />
          <ellipse cx="20" cy="20" rx="6" ry="15" stroke="var(--line-strong)" strokeWidth="1" />
          <path d="M5 20h30M8 12h24M8 28h24" stroke="var(--line-strong)" strokeWidth="1" />
          <circle cx="20" cy="20" r="2.4" fill="var(--info)" />
        </svg>
      </div>

      <div className="mt-2.5 space-y-1.5">
        <Bullet color="var(--ok)">4 agentes sincronizados</Bullet>
        <Bullet color="var(--ok)">2 usuarios conectados</Bullet>
      </div>

      <div className="mt-auto pt-3">
        <div className="text-[0.5rem] tracking-[0.14em] text-dim">
          FLUJO DE DATOS
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[0.5625rem] text-ok">Todo nominal</span>
          <div className="flex flex-1 items-end gap-[0.1rem]">
            {Array.from({ length: 26 }, (_, i) => (
              <span
                key={i}
                className="flex-1 rounded-[0.05rem] bg-ok"
                style={{ height: `${0.2 + (i % 5) * 0.14}rem`, opacity: 0.4 + (i % 5) * 0.12 }}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

const Bullet = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-[0.5625rem] text-mid">
    <span className="h-[0.3rem] w-[0.3rem] rounded-full" style={{ background: color }} />
    {children}
  </div>
);

const Legend = ({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) => (
  <span className="flex items-center gap-2 text-[0.5rem] text-mid">
    <svg width="18" height="4" className="shrink-0">
      <line
        x1="0"
        y1="2"
        x2="18"
        y2="2"
        stroke={color}
        strokeWidth="1.6"
        strokeDasharray={dashed ? "3 2" : undefined}
        opacity={dashed ? 0.6 : 1}
      />
    </svg>
    {label}
  </span>
);

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

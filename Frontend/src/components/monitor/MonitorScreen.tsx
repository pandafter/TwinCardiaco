"use client";

import { usePatientState } from "@/hooks/usePatientState";
import {
  LEVEL,
  caseClock,
  mmss,
  rhythmLabel,
  type Level,
  type Vitals,
} from "@/lib/engine";
import {
  AgentCardio,
  AgentOrchestrator,
  AgentPharma,
  AgentPhysio,
  AgentSim,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronRight,
  Droplet,
  Flask,
  Gauge,
  HeartRate,
  LogoMark,
  Lungs,
  NavAgents,
  NavHistory,
  NavResults,
  NavSimulations,
  Pause,
  Plus,
  Pressure,
  Thermometer,
  CheckSquare,
} from "@/components/icons";
import { BeatingHeart } from "./BeatingHeart";
import { EcgStrip } from "./EcgStrip";
import { Sparkline } from "./Sparkline";
import { SERIES, TrendChart } from "./TrendChart";

const TONE: Record<Level, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
};

const VITAL_ROWS = [
  { key: "hr", label: "Frecuencia cardíaca", unit: "bpm", icon: HeartRate, color: "var(--crit)", min: 40, max: 180, digits: 0 },
  { key: "bp", label: "Presión arterial", unit: "mmHg", icon: Pressure, color: "var(--crit)", min: 40, max: 120, digits: 0 },
  { key: "map", label: "MAP (Presión arterial media)", unit: "mmHg", icon: Gauge, color: "var(--crit)", min: 40, max: 100, digits: 0 },
  { key: "spo2", label: "SpO₂", unit: "%", icon: Droplet, color: "var(--info)", min: 70, max: 100, digits: 0 },
  { key: "rr", label: "Frecuencia respiratoria", unit: "rpm", icon: Lungs, color: "var(--warn)", min: 8, max: 40, digits: 0 },
  { key: "lactate", label: "Lactato", unit: "mmol/L", icon: Flask, color: "var(--violet)", min: 0, max: 10, digits: 1 },
  { key: "temp", label: "Temperatura", unit: "°C", icon: Thermometer, color: "var(--ok)", min: 35, max: 39, digits: 1 },
] as const;

const AGENTS = [
  { name: "Cardiology Agent", state: "Analizando", icon: AgentCardio, color: "var(--crit)", note: "Taquicardia sinusal con signos de deterioro hemodinámico. Reducción de MAP significativa.", at: 33 },
  { name: "Pharmacology Agent", state: "Evaluando", icon: AgentPharma, color: "var(--violet)", note: "Evaluando intervenciones vasoactivas apropiadas para el estado actual.", at: 32 },
  { name: "Physiology Agent", state: "Analizando", icon: AgentPhysio, color: "var(--info)", note: "Disminución de perfusión tisular detectada. Lactato en aumento.", at: 31 },
  { name: "Simulation Agent", state: "Simulando", icon: AgentSim, color: "var(--ok)", note: "Ejecutando escenarios de intervención y proyectando trayectorias.", at: 34 },
  { name: "Orchestrator", state: "Coordinando", icon: AgentOrchestrator, color: "var(--gold)", note: "Integrando hallazgos de agentes y actualizando consenso.", at: 34 },
] as const;

const NAV = [
  { label: "Paciente", icon: HeartRate },
  { label: "Agentes", icon: NavAgents },
  { label: "Intervenciones", icon: CheckSquare },
  { label: "Simulaciones", icon: NavSimulations },
  { label: "Resultados", icon: NavResults },
  { label: "Historial", icon: NavHistory },
] as const;

export function MonitorScreen({
  startAt = 0,
  frozen = false,
}: {
  startAt?: number;
  frozen?: boolean;
}) {
  const { vitals, assess, history } = usePatientState({ startAt, frozen });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page">
      <TopBar vitals={vitals} assess={assess} />

      <div className="grid min-h-0 flex-1 grid-cols-[17.4rem_1fr_20.5rem] gap-2.5 px-3 py-2.5">
        <LeftColumn vitals={vitals} history={history} />
        <CenterColumn vitals={vitals} assess={assess} history={history} />
        <RightColumn vitals={vitals} />
      </div>

      <BottomNav />
    </div>
  );
}

/* ------------------------------------------------------------------ topbar */

function TopBar({
  vitals,
  assess,
}: {
  vitals: Vitals;
  assess: ReturnType<typeof usePatientState>["assess"];
}) {
  const ttc = assess.time_to_critical_s;

  return (
    <header className="flex shrink-0 items-stretch gap-3 border-b border-line px-3 py-2.5">
      <div className="flex items-center gap-2.5 pr-3">
        <div className="flex h-[2.5rem] w-[2.5rem] items-center justify-center rounded-[0.6rem] border border-line-strong bg-card text-crit">
          <LogoMark className="h-[1.4rem] w-[1.4rem]" />
        </div>
        <div className="leading-none">
          <div className="text-[1.05rem] font-semibold tracking-[0.06em] text-hi">
            CARDIAC <span className="font-light text-mid">TWIN</span>
          </div>
          <div className="mt-1.5 text-[0.4375rem] tracking-[0.2em] text-dim">
            REAL-TIME CARDIAC DIGITAL TWIN
          </div>
        </div>
      </div>

      <Divider />

      <div className="flex flex-col justify-center px-1">
        <div className="text-[0.4375rem] tracking-[0.18em] text-dim">
          CASO ACTUAL
        </div>
        <div className="mt-1.5 text-[0.75rem] text-hi">
          Insuficiencia cardíaca descompensada
        </div>
        <div className="mt-1 text-[0.5625rem] text-lo">
          Paciente ID: CT-4782 · Masculino 67 años
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex w-[21.5rem] items-center gap-3 rounded-[0.6rem] border border-[rgba(229,72,77,0.35)] bg-[rgba(229,72,77,0.07)] px-4 py-2.5">
          <AlertTriangle className="h-[1.15rem] w-[1.15rem] shrink-0 text-crit" />
          <div>
            <div className="text-[0.8125rem] font-semibold tracking-[0.02em] text-crit">
              {assess.label}
            </div>
            <div className="mt-1 text-[0.5625rem] text-mid">
              Deterioro en curso. Requiere evaluación e intervención.
            </div>
          </div>
        </div>
      </div>

      <Divider />

      <div className="flex flex-col items-center justify-center px-2">
        <div className="text-center text-[0.4375rem] leading-[1.5] tracking-[0.16em] text-dim">
          TIEMPO ESTIMADO
          <br />
          HASTA ESTADO CRÍTICO
        </div>
        <div className="mt-1 font-mono text-[1.6rem] leading-none font-semibold tracking-[0.02em] text-crit tabular-nums">
          {ttc === null ? "--:--" : mmss(ttc)}
        </div>
        <div className="mt-1 text-[0.4375rem] tracking-[0.14em] text-dim">
          min : seg
        </div>
      </div>

      <Divider />

      <div className="flex flex-col justify-center gap-1.5 pl-1">
        <div className="text-[0.4375rem] tracking-[0.18em] text-dim">
          COLABORACIÓN EN VIVO
        </div>
        <div className="text-[0.625rem] text-ok">3 conectados</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[
              { i: "L", c: "var(--info)" },
              { i: "R", c: "var(--crit)" },
              { i: "A", c: "var(--ok)" },
            ].map((a, n) => (
              <span
                key={a.i}
                className="flex h-[1.35rem] w-[1.35rem] items-center justify-center rounded-full border border-shell text-[0.5rem] font-medium"
                style={{
                  marginLeft: n ? "-0.3rem" : 0,
                  background: `color-mix(in srgb, ${a.c} 22%, transparent)`,
                  color: a.c,
                }}
              >
                {a.i}
              </span>
            ))}
            <span className="ml-[-0.3rem] flex h-[1.35rem] w-[1.35rem] items-center justify-center rounded-full border border-line-strong bg-card text-lo">
              <Plus className="h-[0.6rem] w-[0.6rem]" />
            </span>
          </div>
          <button className="rounded-md border border-line-strong px-3 py-1.5 text-[0.5625rem] text-mid transition-colors hover:border-lo hover:text-hi">
            Invitar
          </button>
        </div>
      </div>
    </header>
  );
}

const Divider = () => <div className="my-1 w-px shrink-0 bg-line" />;

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
            Ritmo: <span className="text-crit">{rhythmLabel(vitals.rhythm)}</span>
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

  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0" style={{ color: row.color }}>
        <Icon className="h-[0.95rem] w-[0.95rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.5625rem] text-mid">{row.label}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span
            className={`font-mono text-[1.15rem] leading-none font-semibold tabular-nums ${TONE[level]}`}
          >
            {value}
          </span>
          <span className="text-[0.5rem] text-dim">{row.unit}</span>
          {row.key === "hr" && (
            <span className="ml-1 text-[0.6rem] text-crit">↑</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Sparkline
          values={series}
          min={sMin}
          max={sMax}
          color={row.color}
          width={78}
          height={30}
        />
        <div className="flex h-[30px] w-[1.4rem] flex-col justify-between text-[0.4375rem] text-dim">
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
}: {
  vitals: Vitals;
  assess: ReturnType<typeof usePatientState>["assess"];
  history: Vitals[];
}) {
  const risk = assess.deterioration_risk;

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <Card className="flex min-h-0 flex-[1.05] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-5 border-b border-line px-4">
          <Tab active>VISTA 3D</Tab>
          <Tab>VISTA FISIOLÓGICA</Tab>
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 55% 70% at 50% 48%, rgba(30,90,140,0.18) 0%, rgba(10,20,35,0.4) 55%, transparent 100%)",
            }}
          />

          <BeatingHeart
            hr={vitals.hr}
            rhythm={vitals.rhythm}
            strokeVolume={vitals.sv}
            perfusion={vitals.perfusion_index}
            className="absolute top-1/2 left-1/2 h-[92%] w-[26%] -translate-x-1/2 -translate-y-1/2"
          />

          {/* estado hemodinámico */}
          <Floating className="top-1/2 left-4 w-[10.5rem] -translate-y-1/2">
            <Label>ESTADO HEMODINÁMICO</Label>
            <div className="mt-1.5 text-[0.9rem] font-semibold text-crit">
              {assess.status === "critical"
                ? "CRÍTICO"
                : assess.status === "unstable"
                  ? "INESTABLE"
                  : "ESTABLE"}
            </div>
            <RiskDial value={risk} />
            <div className="mt-2.5 rounded-md border border-line bg-card px-2.5 py-1.5 text-center text-[0.5rem] text-lo">
              Tendencia:{" "}
              <span className="text-crit">
                {assess.trend === "worsening"
                  ? "Empeorando ↑"
                  : assess.trend === "improving"
                    ? "Mejorando ↓"
                    : "Estable →"}
              </span>
            </div>
          </Floating>

          {/* flujo y perfusión */}
          <Floating className="top-1/2 right-4 w-[9.5rem] -translate-y-1/2">
            <Label>FLUJO Y PERFUSIÓN</Label>
            <div className="mt-2 flex items-center gap-2">
              <PerfusionBody perfusion={vitals.perfusion_index} />
              <PerfusionScale />
            </div>
            <div className="mt-2 text-center text-[0.5rem] text-lo">
              Perfusión tisular
            </div>
            <div
              className={`text-center text-[0.75rem] font-semibold ${
                vitals.perfusion_index > 0.75
                  ? "text-ok"
                  : vitals.perfusion_index > 0.6
                    ? "text-warn"
                    : "text-crit"
              }`}
            >
              {vitals.perfusion_index > 0.75
                ? "ADECUADA"
                : vitals.perfusion_index > 0.6
                  ? "LIMÍTROFE"
                  : "COMPROMETIDA"}
            </div>
          </Floating>
        </div>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
          <span className="text-[0.5625rem] tracking-[0.16em] text-mid">
            TENDENCIAS FISIOLÓGICAS
          </span>
          <button className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[0.5625rem] text-mid">
            Tiempo real
            <ChevronDown className="h-[0.6rem] w-[0.6rem]" />
          </button>
        </div>

        <div className="flex shrink-0 gap-4 px-4 pb-1">
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
        </div>

        <div className="min-h-0 flex-1 px-2">
          <TrendChart history={history} />
        </div>

        <div className="grid shrink-0 grid-cols-4 gap-2 px-4 pt-1">
          {[
            { t: caseClock(30).hhmm, e: "Aumento de FC" },
            { t: caseClock(55).hhmm, e: "Disminución de MAP" },
            { t: caseClock(80).hhmm, e: "Lactato en aumento" },
            {
              t: caseClock(Math.max(0, vitals.t - 8)).hhmm,
              e: "Inestabilidad detectada",
              crit: true,
            },
          ].map((c) => (
            <div
              key={c.t}
              className={`rounded-md border px-2.5 py-1.5 ${
                c.crit
                  ? "border-[rgba(229,72,77,0.4)] bg-[rgba(229,72,77,0.06)]"
                  : "border-line bg-card"
              }`}
            >
              <div
                className={`font-mono text-[0.5625rem] ${c.crit ? "text-crit" : "text-mid"}`}
              >
                {c.t}
              </div>
              <div
                className={`mt-0.5 text-[0.5rem] ${c.crit ? "text-crit" : "text-lo"}`}
              >
                {c.e}
              </div>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2.5 px-4 py-2.5">
          <span className="rounded border border-[rgba(63,191,127,0.35)] bg-[rgba(63,191,127,0.08)] px-2 py-1 text-[0.5rem] tracking-[0.08em] text-ok">
            STREAM ACTIVO
          </span>
          <span className="text-[0.5625rem] text-lo">
            Datos fisiológicos recibiéndose en tiempo real
          </span>
          <Sparkline
            values={history.slice(-40).map((h) => h.map)}
            min={40}
            max={100}
            color="var(--ok)"
            width={90}
            height={16}
          />
        </div>
      </Card>
    </div>
  );
}

function Tab({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      className={`-mb-px border-b-2 py-2.5 text-[0.5625rem] tracking-[0.12em] transition-colors ${
        active ? "border-cyan text-cyan" : "border-transparent text-lo"
      }`}
    >
      {children}
    </button>
  );
}

function Floating({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute rounded-[0.6rem] border border-line bg-[rgba(8,12,18,0.82)] p-3 backdrop-blur-sm ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[0.4375rem] tracking-[0.18em] text-dim">{children}</div>
);

function RiskDial({ value }: { value: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto mt-3 h-[6.2rem] w-[6.2rem]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--crit)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-[1.4rem] leading-none font-semibold text-crit tabular-nums">
          {value}
          <span className="text-[0.7rem]">%</span>
        </div>
        <div className="mt-1 text-center text-[0.4375rem] leading-tight tracking-[0.1em] text-dim">
          RIESGO DE
          <br />
          DETERIORO
        </div>
      </div>
    </div>
  );
}

/** Silueta con el árbol vascular teñido según la perfusión. */
function PerfusionBody({ perfusion }: { perfusion: number }) {
  const hue = 120 * Math.min(1, Math.max(0, (perfusion - 0.4) / 0.6));
  const c = `hsl(${hue} 75% 55%)`;
  return (
    <svg viewBox="0 0 60 120" className="h-[6.5rem] w-auto">
      <g stroke="var(--line-strong)" strokeWidth="1.2" fill="none">
        <circle cx="30" cy="12" r="7.5" />
        <path d="M30 20v34M30 24 14 36M30 24l16 12M22 54l-4 30M38 54l4 30M18 84l-2 22M42 84l2 22" />
      </g>
      <g stroke={c} strokeWidth="1.5" fill="none" opacity="0.9">
        <path d="M30 26v26" />
        <path d="M30 30 20 38M30 30l10 8" />
        <path d="M25 52l-3 28M35 52l3 28" />
      </g>
      <circle cx="30" cy="34" r="3.2" fill={c} opacity="0.85" />
    </svg>
  );
}

function PerfusionScale() {
  return (
    <div className="flex h-[6.5rem] flex-col items-center justify-between">
      <span className="text-[0.4375rem] text-ok">100%</span>
      <div
        className="w-[0.35rem] flex-1 rounded-full"
        style={{
          background:
            "linear-gradient(to bottom, var(--ok), var(--warn) 55%, var(--crit))",
        }}
      />
      <span className="text-[0.4375rem] text-crit">0%</span>
    </div>
  );
}

/* --------------------------------------------------------- columna derecha */

function RightColumn({ vitals }: { vitals: Vitals }) {
  const now = vitals.t;

  const events = [
    { c: "var(--ok)", t: now - 1, b: "Simulation Agent", e: " inició 3 escenarios" },
    { c: "var(--crit)", t: now - 2, b: "Cardiology Agent", e: " detectó deterioro" },
    { c: "var(--violet)", t: now - 4, b: "Lactato", e: ` aumentó a ${vitals.lactate.toFixed(1)} mmol/L` },
    { c: "var(--warn)", t: now - 5, b: "MAP", e: " cayó por debajo de 60 mmHg" },
    { c: "var(--crit)", t: now - 8, b: "Frecuencia cardiaca", e: ` aumentó a ${Math.round(vitals.hr)} bpm` },
    { c: "var(--ok)", t: now - 10, b: "Nuevo evento", e: " fisiológico recibido" },
  ];

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <Card className="flex min-h-0 flex-col">
        <CardHeader title="AGENTES DE IA" live liveLabel="ACTIVOS" />
        <div className="flex flex-col">
          {AGENTS.map((a, i) => {
            const Icon = a.icon;
            return (
              <div
                key={a.name}
                className={`flex items-start gap-2.5 px-3 py-2.5 ${i ? "border-t border-line" : ""}`}
              >
                <span
                  className="flex h-[2rem] w-[2rem] shrink-0 items-center justify-center rounded-[0.5rem] border"
                  style={{
                    borderColor: `color-mix(in srgb, ${a.color} 35%, transparent)`,
                    background: `color-mix(in srgb, ${a.color} 10%, transparent)`,
                    color: a.color,
                  }}
                >
                  <Icon className="h-[1rem] w-[1rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[0.6875rem] text-hi">
                      {a.name}
                    </span>
                    <span
                      className="shrink-0 rounded border px-1.5 py-[0.06rem] text-[0.4375rem]"
                      style={{
                        borderColor: `color-mix(in srgb, ${a.color} 30%, transparent)`,
                        color: a.color,
                      }}
                    >
                      {a.state}
                    </span>
                    <ChevronRight className="h-[0.65rem] w-[0.65rem] shrink-0 text-dim" />
                  </div>
                  <p className="mt-1 text-[0.5rem] leading-[1.5] text-mid">
                    {a.note}
                  </p>
                  <div className="mt-1 text-right font-mono text-[0.4375rem] text-dim">
                    {caseClock(now - 60 + a.at).hhmmss}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5">
          <span className="text-[0.5625rem] tracking-[0.14em] text-mid">
            LÍNEA DE EVENTOS EN TIEMPO REAL
          </span>
          <button className="text-[0.5rem] text-lo hover:text-mid">
            Ver todos
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-around px-3 py-2">
          {events.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="h-[0.3rem] w-[0.3rem] shrink-0 rounded-full"
                style={{ background: e.c }}
              />
              <span className="shrink-0 font-mono text-[0.5rem] text-lo">
                {caseClock(e.t).hhmmss}
              </span>
              <span className="truncate text-[0.5rem] text-mid">
                <span className="text-hi">{e.b}</span>
                {e.e}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ nav inferior */

function BottomNav() {
  return (
    <nav className="flex shrink-0 items-center justify-between border-t border-line px-3 py-2">
      <div className="flex items-center gap-1">
        {NAV.map((n, i) => {
          const Icon = n.icon;
          const active = i === 0;
          return (
            <button
              key={n.label}
              className={`flex w-[5.2rem] flex-col items-center gap-1.5 rounded-lg px-2 py-2 transition-colors ${
                active
                  ? "bg-[rgba(229,72,77,0.08)] text-crit"
                  : "text-lo hover:text-mid"
              }`}
            >
              <Icon className="h-[1.05rem] w-[1.05rem]" />
              <span className="text-[0.5rem]">{n.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5">
        <button className="flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2.5 text-[0.625rem] text-mid transition-colors hover:border-lo hover:text-hi">
          <Pause className="h-[0.75rem] w-[0.75rem]" />
          Pausar simulación
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-[rgba(229,72,77,0.45)] bg-[rgba(229,72,77,0.1)] px-4 py-2.5 text-[0.625rem] font-medium text-crit transition-colors hover:bg-[rgba(229,72,77,0.16)]">
          <Bell className="h-[0.75rem] w-[0.75rem]" />
          Emergencia
        </button>
      </div>
    </nav>
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
    <div
      className={`rounded-[0.6rem] border border-line bg-card ${className}`}
    >
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
    <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2.5">
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

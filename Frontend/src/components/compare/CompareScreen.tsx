"use client";

import { useMemo } from "react";
import { usePatientState } from "@/hooks/usePatientState";
import { caseClock, mmss, type Vitals } from "@/lib/engine";
import {
  arrow,
  SCENARIO_META,
  simulateScenarios,
  type ScenarioResult,
} from "@/lib/scenarios";
import {
  AgentOrchestrator,
  AgentPhysio,
  AgentSim,
  CheckCircle,
  ChevronDown,
  Clock,
  Eye,
  Gear,
  Info,
  LogoMark,
  Message,
  Person,
  Shield,
  Syringe,
  Users,
  X,
} from "@/components/icons";
import { BODY, CORONARIES, VESSELS } from "@/components/HeartVisual";
import { BeatingHeart } from "@/components/monitor/BeatingHeart";
import { ComparisonChart } from "./ComparisonChart";

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  none: { text: "CRÍTICO", color: "var(--crit)" },
  inotrope: { text: "ESTABILIZANDO", color: "var(--ok)" },
  vasopressor: { text: "RESPUESTA PARCIAL", color: "var(--warn)" },
};

const OUTCOME: Record<string, string> = {
  none: "Deterioro proyectado",
  inotrope: "Estabilización proyectada",
  vasopressor: "Respuesta parcial proyectada",
};

const STABILITY: Record<string, string> = {
  none: "Empeorando",
  inotrope: "Mejorando",
  vasopressor: "Mejora parcial",
};

export function CompareScreen({
  decisionAt = 100,
  startAt = 160,
  frozen = false,
}: {
  decisionAt?: number;
  startAt?: number;
  frozen?: boolean;
}) {
  const { vitals } = usePatientState({
    startAt,
    frozen,
    intervention: { at: decisionAt, key: "inotrope" },
  });

  // tres motores desde el mismo estado; no son curvas dibujadas
  const results = useMemo(
    () => simulateScenarios({ decisionAt }),
    [decisionAt],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-page">
      <TopBar />

      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)_21rem] gap-2.5 px-3 pt-2.5">
        <PatientSummary vitals={vitals} />

        <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
          <Headline />
          <div className="grid shrink-0 grid-cols-3 gap-2.5">
            {results.map((r) => (
              <ScenarioCard key={r.key} r={r} />
            ))}
          </div>
          <Card className="flex min-h-0 flex-1 flex-col p-3">
            <div className="shrink-0 text-[0.75rem] tracking-[0.12em] text-hi">
              TRAYECTORIAS FISIOLÓGICAS PROYECTADAS
            </div>
            <div className="flex min-h-0 flex-1 gap-3">
              <div className="flex w-[10rem] shrink-0 flex-col justify-between py-3">
                <div className="flex flex-col gap-1.5">
                  {results.map((r) => (
                    <span
                      key={r.key}
                      className="flex items-center gap-2 text-[0.5625rem] text-mid"
                    >
                      <svg width="20" height="4">
                        <line x1="0" y1="2" x2="20" y2="2" stroke={SCENARIO_META[r.key].color} strokeWidth="2" />
                      </svg>
                      {SCENARIO_META[r.key].title}
                    </span>
                  ))}
                </div>
                <div className="rounded-md border border-line px-2.5 py-2 text-[0.5rem] leading-[1.5] tracking-[0.06em] text-lo">
                  TODAS LAS TRAYECTORIAS PARTEN DEL MISMO ESTADO DEL PACIENTE EN
                  EL PUNTO DE DECISIÓN
                </div>
              </div>
              <div className="min-h-0 min-w-0 flex-1">
                <ComparisonChart results={results} />
              </div>
            </div>
          </Card>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          <DecisionImpact results={results} />
          <AiSummary />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_21rem] gap-2.5 px-3 py-2.5">
        <Pipeline />
        <PortalStatus />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ topbar */

function TopBar() {
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
            PACIENTE: <span className="text-hi">PT-0427</span>
          </div>
          <div className="mt-0.5 text-[0.5625rem] text-lo">
            Masculino · 67 años · 78 kg · 172 cm
          </div>
        </div>
      </div>

      <span className="flex items-center gap-2 text-[0.8125rem] tracking-[0.12em] text-hi">
        <CheckCircle className="h-[1.1rem] w-[1.1rem] text-ok" />
        SIMULACIÓN COMPLETA
      </span>

      <div className="flex items-center gap-2.5">
        <Tag color="var(--text-lo)">EN VIVO</Tag>
        <Tag color="var(--ok)">PORTAL CONECTADO</Tag>
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

const Tag = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span className="flex items-center gap-1.5 text-[0.625rem] tracking-[0.08em]" style={{ color }}>
    <span className="h-[0.35rem] w-[0.35rem] rounded-full" style={{ background: color }} />
    {children}
  </span>
);

const IconButton = ({ children }: { children: React.ReactNode }) => (
  <button className="flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-lg border border-line-strong text-lo transition-colors hover:text-mid">
    {children}
  </button>
);

/* --------------------------------------------------------------- columna 1 */

function PatientSummary({ vitals }: { vitals: Vitals }) {
  const rows = [
    { l: "FC", v: Math.round(vitals.hr), u: "bpm", c: "text-hi" },
    { l: "MAP", v: Math.round(vitals.map), u: "mmHg", c: "text-ok" },
    { l: "SpO₂", v: Math.round(vitals.spo2), u: "%", c: "text-ok" },
    { l: "Lactato", v: vitals.lactate.toFixed(1), u: "mmol/L", c: "text-ok" },
  ];

  return (
    <Card className="flex min-h-0 flex-col">
      <div className="shrink-0 px-3 py-2.5 text-[0.6875rem] tracking-[0.12em] text-hi">
        RESUMEN DEL PACIENTE
      </div>

      <div className="relative h-[10rem] shrink-0">
        <BeatingHeart
          hr={vitals.hr}
          rhythm={vitals.rhythm}
          strokeVolume={vitals.sv}
          perfusion={vitals.perfusion_index}
          className="absolute inset-0 mx-auto h-full w-[72%]"
        />
      </div>

      <div className="px-3 pt-3">
        <div className="text-[0.5625rem] tracking-[0.1em] text-mid">
          ESTADO ACTUAL
        </div>
        <div className="mt-0.5 text-[0.5rem] text-dim">
          A las {caseClock(vitals.t).hhmmss}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-3 pt-3">
        {rows.map((r) => (
          <div key={r.l} className="flex items-baseline justify-between border-b border-line pb-2">
            <span className="text-[0.625rem] text-mid">{r.l}</span>
            <span className="flex items-baseline gap-1">
              <span className={`font-mono text-[0.95rem] font-semibold tabular-nums ${r.c}`}>
                {r.v}
              </span>
              <span className="text-[0.5rem] text-dim">{r.u}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto p-3">
        <div className="rounded-lg border border-line bg-[#0a0e14] px-3 py-3 text-center">
          <div className="text-[0.5625rem] tracking-[0.1em] text-mid">
            ESTADO HEMODINÁMICO
          </div>
          <div className="mt-1.5 text-[0.9rem] font-semibold text-ok">
            ESTABILIZANDO
          </div>
        </div>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- titular */

function Headline() {
  return (
    <div className="relative flex shrink-0 items-center justify-center py-1">
      <WireHeart className="absolute right-2 h-[7.5rem] w-[7.5rem] opacity-70" />
      <div className="relative text-center">
        <h1 className="text-[1.85rem] leading-[1.15] font-bold tracking-[0.01em] text-hi">
          MISMO PACIENTE.
          <br />
          DISTINTA DECISIÓN.
          <br />
          DISTINTA TRAYECTORIA.
        </h1>
        <p className="mt-2 text-[0.6875rem] text-mid">
          Compara los desenlaces fisiológicos proyectados de cada intervención.
        </p>
      </div>
    </div>
  );
}

/** Corazón de malla: marca que lo de esta pantalla es simulado, no medido. */
function WireHeart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 224" className={className} fill="none">
      <g stroke="var(--info)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
        <path d={BODY} strokeDasharray="1.5 5" />
        {VESSELS.map(([d], i) => (
          <path key={i} d={d} strokeDasharray="1.5 5" />
        ))}
      </g>
      <g stroke="var(--info)" strokeWidth="1" strokeDasharray="1 6" opacity="0.5">
        {CORONARIES.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------- tarjetas de rama */

function ScenarioCard({ r }: { r: ScenarioResult }) {
  const meta = SCENARIO_META[r.key];
  const st = STATUS_LABEL[r.key];
  const Icon = r.key === "none" ? X : r.key === "inotrope" ? Syringe : Eye;

  const vitals = [
    { l: "FC", ...arrow(r.deltas.hr, 12, true) },
    { l: "MAP", ...arrow(r.deltas.map, 9) },
    { l: "SpO₂", ...arrow(r.deltas.spo2, 3) },
    { l: "Lactato", ...arrow(r.deltas.lactate, 1.6, true) },
  ];

  return (
    <div
      className="flex flex-col rounded-[0.6rem] border p-3"
      style={{
        borderColor: `color-mix(in srgb, ${meta.color} 42%, transparent)`,
        background: `color-mix(in srgb, ${meta.color} 5%, var(--bg-card))`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-[2rem] w-[2rem] shrink-0 items-center justify-center rounded-full border"
          style={{ borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)`, color: meta.color }}
        >
          <Icon className="h-[0.95rem] w-[0.95rem]" />
        </span>
        <div className="min-w-0">
          <div className="text-[0.5rem] tracking-[0.14em]" style={{ color: meta.color }}>
            ESCENARIO {meta.letter}
          </div>
          <div className="text-[0.75rem] font-medium text-hi">{meta.title}</div>
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.5rem] tracking-[0.12em] text-dim">ESTADO</div>
          <div className="mt-1 text-[0.8125rem] leading-tight font-semibold" style={{ color: st.color }}>
            {st.text}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[0.5rem] tracking-[0.12em] text-dim">TRAYECTORIA</div>
          <MiniTrajectory r={r} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 border-y border-line py-2">
        {vitals.map((v, i) => (
          <div key={v.l} className={`text-center ${i ? "border-l border-line" : ""}`}>
            <div className="text-[0.5rem] text-mid">{v.l}</div>
            <div className="mt-1 text-[0.75rem]" style={{ color: v.color }}>
              {v.glyph}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2.5">
        <div className="text-[0.5rem] tracking-[0.12em] text-dim">DESENLACE</div>
        <div className="mt-1 text-[0.6875rem]" style={{ color: meta.color }}>
          {OUTCOME[r.key]}
        </div>
      </div>
    </div>
  );
}

function MiniTrajectory({ r }: { r: ScenarioResult }) {
  const meta = SCENARIO_META[r.key];
  const pts = r.points.filter((_, i) => i % 4 === 0);
  const w = 150;
  const h = 42;
  const d = pts
    .map((p, i) => {
      const px = (i / Math.max(1, pts.length - 1)) * w;
      const py = h - ((p.index + 3) / 6) * h;
      return `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-[2.6rem] w-full" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={meta.color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* --------------------------------------------------------------- columna 3 */

function DecisionImpact({ results }: { results: ScenarioResult[] }) {
  return (
    <Card className="flex shrink-0 flex-col p-3">
      <div className="text-[0.75rem] tracking-[0.12em] text-hi">
        IMPACTO DE LA DECISIÓN
      </div>

      <Block icon={<Clock className="h-[0.85rem] w-[0.85rem]" />} title="TIEMPO HASTA ESTADO CRÍTICO">
        {results.map((r) => (
          <Row key={r.key} color={SCENARIO_META[r.key].color} label={SCENARIO_META[r.key].title}>
            <span className="font-mono text-[0.75rem] text-hi tabular-nums">
              {r.timeToCritical === null ? ">05:00" : mmss(r.timeToCritical)}
            </span>
          </Row>
        ))}
      </Block>

      <Block icon={<Shield className="h-[0.85rem] w-[0.85rem]" />} title="ESTABILIDAD HEMODINÁMICA">
        {results.map((r) => (
          <Row key={r.key} color={SCENARIO_META[r.key].color} label={SCENARIO_META[r.key].title}>
            <span className="text-[0.6875rem] text-hi">{STABILITY[r.key]}</span>
          </Row>
        ))}
      </Block>

      <div className="mt-3 flex items-start gap-2 border-t border-line pt-2.5">
        <span className="flex-1 text-[0.5rem] leading-[1.6] tracking-[0.06em] text-dim">
          TRAYECTORIAS SIMULADAS — PROTOTIPO DE INVESTIGACIÓN Y EDUCACIÓN
        </span>
        <Info className="h-[0.8rem] w-[0.8rem] shrink-0 text-dim" />
      </div>
    </Card>
  );
}

function Block({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-lo">
        {icon}
        <span className="text-[0.5625rem] tracking-[0.1em] text-mid">{title}</span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Row({
  color,
  label,
  children,
}: {
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-[0.625rem] text-mid">
        <span className="h-[0.3rem] w-[0.3rem] rounded-full" style={{ background: color }} />
        {label}
      </span>
      {children}
    </div>
  );
}

function AiSummary() {
  return (
    <Card className="flex min-h-0 flex-1 flex-col p-3">
      <div className="text-[0.75rem] tracking-[0.12em] text-hi">
        SÍNTESIS DE LA IA
      </div>

      <div className="mt-3 flex items-start gap-2.5">
        <span className="flex h-[2.1rem] w-[2.1rem] shrink-0 items-center justify-center rounded-full border border-[rgba(200,155,72,0.4)] bg-[rgba(200,155,72,0.08)] text-gold">
          <AgentOrchestrator className="h-[1rem] w-[1rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[0.625rem] tracking-[0.08em] text-hi">
              ORQUESTADOR
            </span>
            <span className="flex items-center gap-1 text-[0.5rem] text-ok">
              <span
                className="h-[0.3rem] w-[0.3rem] rounded-full bg-ok"
                style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
              />
              EN VIVO
            </span>
          </div>
          <p className="mt-2 text-[0.625rem] leading-[1.6] text-hi">
            <span className="text-ok">La intervención A</span> produjo la
            trayectoria simulada más favorable bajo los supuestos actuales del
            modelo.
          </p>
        </div>
      </div>

      <p className="mt-3 border-t border-dashed border-line pt-3 text-[0.625rem] leading-[1.6] text-mid">
        Los agentes alcanzaron consenso con incertidumbre moderada.
      </p>

      <div className="mt-auto flex items-center justify-between pt-3">
        <span className="text-[0.5625rem] tracking-[0.1em] text-mid">
          INCERTIDUMBRE
        </span>
        <span className="flex items-center gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="h-[0.42rem] w-[0.42rem] rounded-full"
              style={{
                background: i < 4 ? "var(--info)" : "transparent",
                border: i < 4 ? undefined : "1px solid var(--line-strong)",
              }}
            />
          ))}
        </span>
        <span className="text-[0.625rem] text-mid">MODERADA</span>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- pipeline */

function Pipeline() {
  const steps = [
    { icon: Person, title: "ESTADO DEL PACIENTE", sub: "Datos adquiridos", at: 0 },
    { icon: AgentPhysio, title: "ANÁLISIS DE IA", sub: "4 agentes analizando", at: 49 },
    { icon: AgentSim, title: "SIMULACIÓN WHAT-IF", sub: "Múltiples escenarios", at: 173 },
    { icon: Syringe, title: "DECISIÓN HUMANA", sub: "Intervención seleccionada", at: 309 },
    { icon: CheckCircle, title: "DESENLACE PROYECTADO", sub: "Trayectorias generadas", at: 323 },
  ];

  return (
    <Card className="flex items-center px-4 py-3">
      <div className="relative flex flex-1 items-start justify-between">
        <div className="absolute top-[1.15rem] right-10 left-10 h-px bg-line-strong" />
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="relative flex flex-col items-center gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-[2.3rem] w-[2.3rem] items-center justify-center rounded-full border border-[rgba(90,169,230,0.45)] bg-card text-info">
                  <Icon className="h-[1rem] w-[1rem]" />
                </span>
                <div className="text-left">
                  <div className="text-[0.5625rem] tracking-[0.08em] text-hi">
                    {s.title}
                  </div>
                  <div className="mt-0.5 text-[0.5rem] text-mid">{s.sub}</div>
                  <div className="mt-0.5 font-mono text-[0.5rem] text-dim">
                    {caseClock(s.at).hhmmss}
                  </div>
                </div>
              </div>
              <CheckCircle className="h-[1rem] w-[1rem] text-info" />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PortalStatus() {
  return (
    <Card className="flex items-center justify-between p-3">
      <div>
        <div className="text-[0.6875rem] tracking-[0.12em] text-hi">
          ESTADO DEL PORTAL
        </div>
        <div className="mt-2 space-y-1">
          {["Portal sincronizado", "4 agentes de IA", "2 usuarios conectados"].map((t) => (
            <div key={t} className="flex items-center gap-2 text-[0.5625rem] text-mid">
              <span className="h-[0.3rem] w-[0.3rem] rounded-full bg-ok" />
              {t}
            </div>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 60 60" className="h-[3.6rem] w-[3.6rem]" fill="none">
        <circle cx="30" cy="30" r="22" stroke="var(--line-strong)" strokeWidth="1" />
        <ellipse cx="30" cy="30" rx="9" ry="22" stroke="var(--line-strong)" strokeWidth="1" />
        <path d="M8 30h44M12 19h36M12 41h36" stroke="var(--line-strong)" strokeWidth="1" />
        <circle cx="30" cy="30" r="3.4" fill="var(--info)" />
      </svg>
    </Card>
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

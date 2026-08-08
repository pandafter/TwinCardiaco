"use client";

import { useState } from "react";
import {
  CASES,
  CAPABILITIES,
  DATA_SOURCES,
  SEVERITY_TONE,
  WIZARD_STEPS,
  type ClinicalCase,
} from "@/lib/cases";
import { HeartVisual } from "./HeartVisual";
import {
  ArrowRight,
  Bulb,
  CheckSquare,
  ChevronRight,
  Droplet,
  Female,
  Flask,
  Gauge,
  Gear,
  HeartRate,
  Info,
  LogoMark,
  Lungs,
  Male,
  Output,
  Person,
  Pressure,
  Shield,
  Target,
  Users,
  Waves,
  CheckCircle,
} from "./icons";

const TONE: Record<string, string> = {
  hi: "text-hi",
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
};

const VITAL_ICON: Record<string, typeof HeartRate> = {
  hr: HeartRate,
  bp: Pressure,
  map: Gauge,
  spo2: Droplet,
  rr: Lungs,
  lactate: Flask,
  co: Output,
  perf: CheckCircle,
  hemo: Shield,
  rhythm: Waves,
};

const VITAL_ICON_TONE: Record<string, string> = {
  hr: "text-mid",
  bp: "text-crit",
  map: "text-ok",
  spo2: "text-[#5aa9e6]",
  rr: "text-warn",
  lactate: "text-[#a97bd6]",
  co: "text-[#5aa9e6]",
  perf: "text-ok",
  hemo: "text-ok",
  rhythm: "text-mid",
};

export function SelectPatientScreen() {
  const [selectedId, setSelectedId] = useState(CASES[0].id);
  const active = CASES.find((c) => c.id === selectedId) ?? CASES[0];

  return (
    <div className="h-full w-full bg-page p-2.5">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[0.875rem] border border-line bg-shell">
        <TopBar />
        <div className="grid min-h-0 flex-1 grid-cols-[14.25rem_22.25rem_1fr] items-start gap-5 px-5 pt-4">
          <LeftRail />
          <CenterColumn selectedId={selectedId} onSelect={setSelectedId} />
          <CaseDetail c={active} />
        </div>
        <Footer />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ topbar */

function TopBar() {
  return (
    <header
      data-shot="topbar"
      className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5"
    >
      <div className="flex items-center gap-2.5">
        <LogoMark className="h-[1.8rem] w-[1.8rem] text-gold" />
        <div className="leading-none">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[1.3rem] font-semibold tracking-[0.1em] text-hi">
              CARDIAC
            </span>
            <span className="text-[1.3rem] font-light tracking-[0.1em] text-mid">
              TWIN
            </span>
          </div>
          <div className="mt-1.5 text-[0.5rem] tracking-[0.22em] text-dim">
            REAL-TIME CARDIAC DIGITAL TWIN
          </div>
        </div>
      </div>

      <nav className="flex items-start">
        {WIZARD_STEPS.map((s, i) => {
          const isActive = i === 0;
          return (
            <div key={s.n} className="flex items-start">
              {/* el label va fuera del flujo: si expande la columna, las
                  líneas conectoras se acortan y el stepper se desalinea */}
              <div className="relative w-[2rem]">
                <div
                  className={[
                    "flex h-[2rem] w-[2rem] items-center justify-center rounded-full border text-[0.6875rem] font-medium tabular-nums",
                    isActive
                      ? "border-gold text-gold shadow-[0_0_0_0.25rem_rgba(200,155,72,0.07)]"
                      : "border-line-strong text-lo",
                  ].join(" ")}
                >
                  {s.n}
                </div>
                <div
                  className={[
                    "absolute top-full left-1/2 mt-2 -translate-x-1/2 text-[0.625rem] whitespace-nowrap",
                    isActive ? "text-hi" : "text-lo",
                  ].join(" ")}
                >
                  {s.title}
                </div>
              </div>
              {i < WIZARD_STEPS.length - 1 && (
                <div className="mx-[1.125rem] mt-[1rem] h-px w-[5.75rem] shrink-0 bg-line-strong" />
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2.5 rounded-lg border border-line-strong px-3 py-2">
          <Users className="h-[1.05rem] w-[1.05rem] text-lo" />
          <div className="leading-tight">
            <div className="text-[0.6875rem] text-hi">Colaboración</div>
            <div className="mt-0.5 text-[0.625rem] text-ok">3 conectados</div>
          </div>
        </div>
        <button className="flex h-[2.3rem] w-[2.3rem] items-center justify-center rounded-lg border border-line-strong text-lo transition-colors hover:text-mid">
          <Gear className="h-[1.05rem] w-[1.05rem]" />
        </button>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- left rail */

function LeftRail() {
  return (
    <aside data-shot="rail" className="flex h-full min-h-0 flex-col gap-3.5">
      <div className="mb-[3.25rem]">
        <div className="mb-2.5 text-[0.5625rem] tracking-[0.2em] text-lo">
          PASOS
        </div>
        <div className="overflow-hidden rounded-[0.625rem] border border-line">
          {WIZARD_STEPS.map((s, i) => {
            const isActive = i === 0;
            return (
              <div
                key={s.n}
                className={[
                  "relative flex items-start gap-2.5 px-3 py-2",
                  i > 0 ? "border-t border-line" : "",
                  isActive ? "bg-[#0f1319]" : "",
                ].join(" ")}
              >
                {isActive && (
                  <span className="absolute top-0 bottom-0 left-0 w-[0.125rem] bg-gold" />
                )}
                <div
                  className={[
                    "mt-px flex h-[1.35rem] w-[1.35rem] shrink-0 items-center justify-center rounded-full border text-[0.5625rem] tabular-nums",
                    isActive
                      ? "border-gold text-gold"
                      : "border-line-strong text-lo",
                  ].join(" ")}
                >
                  {i + 1}
                </div>
                <div className="leading-tight">
                  <div
                    className={[
                      "text-[0.6875rem]",
                      isActive ? "text-hi" : "text-mid",
                    ].join(" ")}
                  >
                    {s.title}
                  </div>
                  <div className="mt-1 text-[0.5625rem] leading-snug text-dim">
                    {s.hint}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Panel className="p-3.5">
        <div className="flex items-center gap-2">
          <Bulb className="h-[0.9rem] w-[0.9rem] text-gold" />
          <span className="text-[0.6875rem] text-hi">¿Qué es Cardiac Twin?</span>
        </div>
        <p className="mt-2.5 text-[0.625rem] leading-[1.65] text-mid">
          Un gemelo digital del corazón que evoluciona en tiempo real. Observa,
          analiza y prueba decisiones antes de aplicarlas en la vida real.
        </p>
      </Panel>

      <Panel className="p-3.5">
        <div className="text-[0.6875rem] text-hi">Fuentes de datos</div>
        <ul className="mt-3 space-y-2.5">
          {DATA_SOURCES.map((d) => (
            <li key={d.tag} className="flex items-center justify-between gap-1.5">
              <span className="flex min-w-0 items-center gap-1.5 text-[0.5rem] text-mid">
                <span className="h-[0.14rem] w-[0.14rem] shrink-0 rounded-full bg-lo" />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="shrink-0 rounded-[0.1875rem] border border-line-strong bg-[#0e1319] px-1 py-[0.08rem] text-[0.4375rem] tracking-[0.08em] text-lo">
                {d.tag}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="mt-auto mb-4 flex items-start gap-2.5 p-3.5">
        <Shield className="mt-px h-[0.95rem] w-[0.95rem] shrink-0 text-gold-dim" />
        <div>
          <div className="text-[0.625rem] text-mid">Privacidad y seguridad</div>
          <p className="mt-1 text-[0.5rem] leading-[1.6] text-dim">
            Todos los datos son de-identificados y usados solo con fines
            educativos.
          </p>
        </div>
      </Panel>
    </aside>
  );
}

/* ----------------------------------------------------------- center column */

function CenterColumn({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section data-shot="center" className="flex flex-col">
      <h1 className="text-[0.9375rem] font-medium tracking-[0.09em] text-hi">
        SELECCIONA UN PACIENTE
      </h1>
      <p className="mt-1.5 text-[0.625rem] text-mid">
        Elige un caso clínico existente o crea un paciente personalizado.
      </p>

      <div className="mt-3.5 flex items-center gap-5 rounded-[0.625rem] border border-line px-4">
        <Tab active>Casos predefinidos</Tab>
        <Tab>Crear nuevo paciente</Tab>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {CASES.map((c) => (
          <CaseCard
            key={c.id}
            c={c}
            selected={c.id === selectedId}
            onSelect={() => onSelect(c.id)}
          />
        ))}
      </div>

      <button className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-line py-3 text-[0.625rem] text-mid transition-colors hover:border-line-strong hover:text-hi">
        Ver todos los casos (12)
        <ChevronRight className="h-[0.75rem] w-[0.75rem]" />
      </button>
    </section>
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
      className={[
        "border-b-2 py-2.5 text-[0.6875rem] transition-colors",
        active
          ? "border-gold text-gold"
          : "border-transparent text-lo hover:text-mid",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CaseCard({
  c,
  selected,
  onSelect,
}: {
  c: ClinicalCase;
  selected: boolean;
  onSelect: () => void;
}) {
  const sev = SEVERITY_TONE[c.severity];
  const SexIcon = c.sex === "M" ? Male : Female;

  return (
    <button
      onClick={onSelect}
      className={[
        "flex w-full items-start gap-3 rounded-[0.625rem] border p-3 text-left transition-colors",
        selected
          ? "border-[#b08a3c] bg-card-hi shadow-[0_0_0_1px_rgba(200,155,72,0.12),0_0_2rem_-0.5rem_rgba(200,155,72,0.25)]"
          : "border-line bg-card hover:border-line-strong hover:bg-[#0e1319]",
      ].join(" ")}
    >
      <div className="relative h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-lg border border-line bg-[#0a0d12]">
        <HeartVisual className="absolute inset-0 h-full w-full" />
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[0.8125rem] leading-snug font-medium text-hi">
            {c.title}
          </h3>
          {c.recommended && <RecommendedChip />}
        </div>
        <p className="mt-1.5 text-[0.625rem] leading-[1.55] text-mid">
          {c.blurb}
        </p>
        <div className="mt-2.5 flex items-center gap-3">
          <Meta icon={<Person className="h-[0.7rem] w-[0.7rem]" />}>
            {c.age} años
          </Meta>
          <SexIcon className="h-[0.7rem] w-[0.7rem] text-lo" />
          <span className="flex items-center gap-1.5 text-[0.5625rem] text-lo">
            Severidad: <span style={{ color: sev.color }}>{c.severity}</span>
            <SeverityBars level={sev.bars} color={sev.color} />
          </span>
        </div>
      </div>
    </button>
  );
}

function Meta({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1 text-[0.5625rem] text-lo">
      <span className="text-lo">{icon}</span>
      {children}
    </span>
  );
}

function SeverityBars({ level, color }: { level: number; color: string }) {
  return (
    <span className="flex items-end gap-[0.09rem]">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[0.14rem] rounded-[0.03rem]"
          style={{
            height: `${0.28 + i * 0.07}rem`,
            background: i < level ? color : "#262e38",
          }}
        />
      ))}
    </span>
  );
}

function RecommendedChip() {
  return (
    <span className="shrink-0 rounded-[0.1875rem] border border-[#75591f] bg-[rgba(200,155,72,0.09)] px-1.5 py-[0.1rem] text-[0.4375rem] tracking-[0.12em] text-gold">
      RECOMENDADO
    </span>
  );
}

/* ------------------------------------------------------------ case detail */

function CaseDetail({ c }: { c: ClinicalCase }) {
  const SexIcon = c.sex === "M" ? Male : Female;
  const sev = SEVERITY_TONE[c.severity];

  return (
    <section
      data-shot="detail"
      className="mt-[3.4rem] flex flex-col overflow-hidden rounded-[0.625rem] border border-line bg-panel"
    >
      <div className="relative shrink-0 px-4 pt-4 pb-3.5">
        <div className="pointer-events-none absolute top-0 right-3 h-[12.5rem] w-[11rem]">
          <HeartVisual variant="hero" className="h-full w-full" />
        </div>
        <div className="relative flex items-center gap-2.5">
          <h2 className="text-[1.2rem] font-medium text-hi">{c.title}</h2>
          {c.recommended && <RecommendedChip />}
        </div>

        <div className="relative mt-4 max-w-[24.5rem]">
          <div className="text-[0.6875rem] text-hi">Resumen del caso</div>
          <p className="mt-2 text-[0.625rem] leading-[1.7] text-mid">
            {c.summary}
          </p>
        </div>

        <div className="relative mt-3.5 flex gap-2">
          <FactChip icon={null} value={`${c.age} años`} label="Edad" />
          <FactChip
            icon={<SexIcon className="h-[0.8rem] w-[0.8rem] text-[#5aa9e6]" />}
            value={c.sex === "M" ? "Masculino" : "Femenino"}
            label="Sexo"
          />
          <FactChip
            icon={<HeartRate className="h-[0.8rem] w-[0.8rem] text-crit" />}
            value={c.background}
            label="Antecedente"
          />
          <FactChip
            icon={<SeverityBars level={sev.bars} color={sev.color} />}
            value={c.severity}
            label="Severidad"
          />
        </div>
      </div>

      <div className="mx-4 mb-4 flex flex-col rounded-[0.625rem] border border-line p-3.5">
        <div className="text-[0.6875rem] text-hi">Variables iniciales</div>

        <div className="mt-3 grid grid-cols-[1fr_1fr_1.28fr] items-start gap-2">
          <VitalBox rows={c.vitals} />
          <VitalBox rows={c.derived} />
          <div className="flex flex-col gap-2.5">
            <Panel className="p-2.5">
              <div className="flex items-center gap-1.5">
                <Target className="h-[0.8rem] w-[0.8rem] text-gold" />
                <span className="text-[0.625rem] text-hi">
                  Objetivo del escenario
                </span>
              </div>
              <p className="mt-2 text-[0.5625rem] leading-[1.65] text-mid">
                {c.goal}
              </p>
            </Panel>
            <Panel className="p-2.5">
              <div className="text-[0.625rem] text-hi">Qué podrás hacer</div>
              <ul className="mt-2 space-y-[0.35rem]">
                {CAPABILITIES.map((cap) => (
                  <li
                    key={cap}
                    className="flex items-center gap-1.5 text-[0.5625rem] leading-tight text-mid"
                  >
                    <CheckSquare className="h-[0.7rem] w-[0.7rem] shrink-0 text-lo" />
                    {cap}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-line px-3 py-2.5">
          <Info className="h-[0.8rem] w-[0.8rem] shrink-0 text-lo" />
          <span className="text-[0.5625rem] text-lo">
            Estos valores corresponden al estado inicial. Evolucionarán en tiempo
            real.
          </span>
        </div>
      </div>
    </section>
  );
}

function FactChip({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 rounded-lg border border-line bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[0.75rem] text-hi">{value}</span>
      </div>
      <span className="text-[0.5rem] text-dim">{label}</span>
    </div>
  );
}

function VitalBox({
  rows,
}: {
  rows: ClinicalCase["vitals"] | ClinicalCase["derived"];
}) {
  return (
    <Panel className="flex flex-col gap-[1.7rem] p-3.5">
      {rows.map((r) => {
        const Icon = VITAL_ICON[r.key] ?? HeartRate;
        const isWord = !/\d/.test(r.value);
        return (
          <div key={r.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <Icon
                className={`h-[0.75rem] w-[0.75rem] shrink-0 ${
                  VITAL_ICON_TONE[r.key] ?? "text-lo"
                }`}
              />
              <span className="truncate text-[0.5625rem] text-mid">
                {r.label}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-1">
              <span
                className={[
                  isWord
                    ? "text-[0.5625rem]"
                    : "font-mono text-[0.6875rem] font-semibold tabular-nums",
                  TONE[r.tone ?? "hi"],
                ].join(" ")}
              >
                {r.value}
              </span>
              {r.unit && (
                <span className="text-[0.5rem] text-dim">{r.unit}</span>
              )}
              {"trend" in r && r.trend && (
                <span className="text-[0.5rem] text-ok">↑</span>
              )}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer() {
  return (
    <footer className="flex shrink-0 items-center justify-end gap-2.5 px-5 pt-3 pb-4">
      <button className="rounded-lg border border-line-strong px-7 py-2.5 text-[0.6875rem] text-mid transition-colors hover:border-lo hover:text-hi">
        Cancelar
      </button>
      <a
        href="/monitor"
        className="flex items-center gap-2.5 rounded-lg border border-[#d8ae5c] bg-[#c69a45] px-6 py-2.5 text-[0.6875rem] font-medium text-[#14100a] transition-colors hover:bg-[#d3a751]"
      >
        Siguiente: Configurar escenario
        <ArrowRight className="h-[0.85rem] w-[0.85rem]" />
      </a>
    </footer>
  );
}

/* ------------------------------------------------------------------ shared */

function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[0.625rem] border border-line bg-card ${className}`}>
      {children}
    </div>
  );
}

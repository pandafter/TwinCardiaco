"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CASES,
  DATA_SOURCES,
  SEVERITY_TONE,
  type ClinicalCase,
} from "@/lib/cases";
import { HeartVisual } from "./HeartVisual";
import {
  ArrowRight,
  CheckCircle,
  Droplet,
  Female,
  Flask,
  Gauge,
  HeartRate,
  LogoMark,
  Lungs,
  Male,
  Output,
  Person,
  Pressure,
  Shield,
  Waves,
} from "./icons";

/**
 * Pantalla de entrada.
 *
 * Reescrita por tres motivos, y ninguno era estético:
 *
 *  - El stepper "01 → 04" prometía cuatro pasos que no existen: solo hay uno.
 *    Un jurado que hace clic esperando "Configurar escenario" encuentra el
 *    monitor. Fuera.
 *  - "3 conectados" y el botón Invitar mostraban una presencia que el sistema
 *    no tiene. Fuera.
 *  - El layout usaba márgenes mágicos (`mt-[3.4rem]`, `mb-[3.25rem]`) contra
 *    un grid `items-start`: el corazón hero se salía de su tarjeta y tapaba el
 *    título, y el pie se solapaba con la última tarjeta del rail.
 *
 * Y una cosa que sí es de honestidad: el motor solo simula el caso
 * recomendado. Los otros tres se pueden leer, pero se dice en pantalla que no
 * corren, en vez de dejar que alguien lo descubra en la demo.
 */

const ease = [0.22, 1, 0.36, 1] as const;

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
  spo2: "text-info",
  rr: "text-warn",
  lactate: "text-violet",
  co: "text-info",
  perf: "text-ok",
  hemo: "text-ok",
  rhythm: "text-mid",
};

/** Lo que el simulador hace de verdad hoy. Ni más ni menos. */
const CAPABILITIES = [
  "Ver la cadena causal del deterioro en vivo",
  "Escuchar a tres agentes que no coinciden",
  "Proyectar cuatro decisiones antes de tomarlas",
  "Preguntar cualquier escenario en español",
];

export function SelectPatientScreen() {
  const [selectedId, setSelectedId] = useState(CASES[0].id);
  const active = CASES.find((c) => c.id === selectedId) ?? CASES[0];
  const runnable = CASES.find((c) => c.recommended) ?? CASES[0];

  return (
    <div className="h-full w-full bg-page p-2.5">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[0.875rem] border border-line bg-shell">
        <TopBar />

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,25rem)_minmax(0,1fr)] gap-5 overflow-hidden px-5 pt-4 pb-3">
          <CaseList selectedId={selectedId} onSelect={setSelectedId} />
          <CaseDetail c={active} />
        </div>

        <Footer runnable={runnable} selected={active} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ topbar */

function TopBar() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
      <div className="flex items-center gap-2.5">
        <LogoMark className="h-[1.7rem] w-[1.7rem] text-crit" />
        <div className="leading-none">
          <div className="flex items-baseline gap-1.5">
            <span className="text-title font-semibold tracking-[0.1em] text-hi">
              CARDIAC
            </span>
            <span className="text-title font-light tracking-[0.1em] text-mid">
              TWIN
            </span>
          </div>
          <div className="mt-1.5 text-micro tracking-[0.2em] text-dim">
            SIMULADOR DE DECISIONES CLÍNICAS
          </div>
        </div>
      </div>

      <p className="max-w-[34rem] text-label leading-[1.6] text-mid">
        Un paciente virtual se deteriora solo. Tres agentes lo analizan y
        discrepan.{" "}
        <span className="text-hi">
          Tú ves a dónde lleva cada decisión antes de tomarla.
        </span>
      </p>

      <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5">
        <Shield className="h-[0.9rem] w-[0.9rem] text-gold-dim" />
        <span className="text-micro leading-[1.5] text-lo">
          Datos sintéticos
          <br />
          Sin validación clínica
        </span>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------- los casos */

function CaseList({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col">
      <h1 className="shrink-0 text-lead font-medium tracking-[0.06em] text-hi">
        SELECCIONA UN PACIENTE
      </h1>
      <p className="mt-1 shrink-0 text-label text-mid">
        Elige el caso clínico que quieres simular.
      </p>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {CASES.map((c, i) => (
          <CaseCard
            key={c.id}
            c={c}
            index={i}
            selected={c.id === selectedId}
            onSelect={() => onSelect(c.id)}
          />
        ))}
      </div>

      <ul className="mt-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-micro tracking-[0.14em] text-dim">
          FUENTES DE DATOS
        </span>
        {DATA_SOURCES.map((d) => (
          <li
            key={d.tag}
            className="flex items-center gap-1.5 text-micro text-lo"
          >
            <span className="h-[0.16rem] w-[0.16rem] rounded-full bg-lo" />
            {d.name}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CaseCard({
  c,
  index,
  selected,
  onSelect,
}: {
  c: ClinicalCase;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const sev = SEVERITY_TONE[c.severity];
  const SexIcon = c.sex === "M" ? Male : Female;

  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "relative flex w-full shrink-0 items-start gap-3 overflow-hidden rounded-[0.7rem] border p-3 text-left transition-colors",
        selected
          ? "border-line-gold bg-card-hi"
          : "border-line bg-card hover:border-line-strong hover:bg-card-hover",
      ].join(" ")}
    >
      {/* la barra de selección se desliza entre tarjetas en vez de saltar */}
      {selected && (
        <motion.span
          layoutId="case-marker"
          transition={{ duration: 0.35, ease }}
          className="absolute inset-y-0 left-0 w-[0.16rem] bg-gold"
        />
      )}

      <div className="relative h-[4.6rem] w-[4.6rem] shrink-0 overflow-hidden rounded-lg border border-line bg-page">
        <HeartVisual className="absolute inset-0 h-full w-full" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-body leading-snug font-medium text-hi">
            {c.title}
          </h2>
          {c.recommended ? (
            <Chip tone="gold">SIMULABLE</Chip>
          ) : (
            <Chip tone="mute">solo ficha</Chip>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-micro leading-[1.5] text-mid">
          {c.blurb}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex items-center gap-1 text-micro text-lo">
            <Person className="h-[0.7rem] w-[0.7rem]" />
            {c.age} años
          </span>
          <SexIcon className="h-[0.7rem] w-[0.7rem] text-lo" />
          <span className="flex items-center gap-1.5 text-micro text-lo">
            Severidad: <span style={{ color: sev.color }}>{c.severity}</span>
            <SeverityBars level={sev.bars} color={sev.color} />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "gold" | "mute";
  children: React.ReactNode;
}) {
  return (
    <span
      className="shrink-0 rounded border px-1.5 py-[0.1rem] text-micro tracking-[0.1em]"
      style={
        tone === "gold"
          ? {
              borderColor: "var(--line-gold)",
              background: "var(--gold-soft)",
              color: "var(--gold)",
            }
          : { borderColor: "var(--line)", color: "var(--text-dim)" }
      }
    >
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
            background: i < level ? color : "var(--line-strong)",
          }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------ case detail */

function CaseDetail({ c }: { c: ClinicalCase }) {
  const SexIcon = c.sex === "M" ? Male : Female;
  const sev = SEVERITY_TONE[c.severity];

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[0.7rem] border border-line bg-panel">
      {/* El corazón vive DENTRO de su caja y se desvanece hacia el texto.
          Antes era un absolute de altura fija que se salía por arriba. */}
      <div className="relative shrink-0 overflow-hidden px-5 pt-4 pb-4">
        <div
          className="pointer-events-none absolute -top-6 right-0 h-[13rem] w-[12rem] opacity-70"
          style={{
            maskImage:
              "radial-gradient(ellipse at 65% 45%, #000 35%, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 65% 45%, #000 35%, transparent 72%)",
          }}
        >
          <HeartVisual variant="hero" className="h-full w-full" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease }}
            className="relative"
          >
            <div className="flex items-center gap-2.5">
              <h2 className="text-title font-medium text-hi">{c.title}</h2>
              {c.recommended && <Chip tone="gold">SIMULABLE</Chip>}
            </div>

            <p className="mt-3 max-w-[30rem] text-label leading-[1.65] text-mid">
              {c.summary}
            </p>

            <div className="mt-3.5 flex max-w-[38rem] gap-2">
              <FactChip icon={null} value={`${c.age} años`} label="Edad" />
              <FactChip
                icon={<SexIcon className="h-[0.8rem] w-[0.8rem] text-info" />}
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
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mx-5 mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.7rem] border border-line">
        <div className="flex shrink-0 items-baseline gap-3 border-b border-line px-4 py-2">
          <h3 className="text-micro tracking-[0.14em] text-mid">
            ESTADO INICIAL
          </h3>
          <span className="text-micro text-dim">
            Estos valores evolucionan solos en cuanto empieza la simulación.
          </span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr_1.15fr] gap-3 overflow-hidden p-3.5">
          <VitalBox caseId={c.id} rows={c.vitals} />
          <VitalBox caseId={c.id} rows={c.derived} />
          <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden">
            <div className="rounded-[0.6rem] border border-line-gold bg-[var(--gold-soft)] p-3">
              <div className="text-micro tracking-[0.12em] text-gold">
                OBJETIVO
              </div>
              <p className="mt-1.5 text-label leading-[1.5] text-hi">{c.goal}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-[0.6rem] border border-line bg-card p-3">
              <div className="text-micro tracking-[0.12em] text-dim">
                QUÉ PODRÁS HACER
              </div>
              <ul className="mt-2 space-y-1.5">
                {CAPABILITIES.map((cap) => (
                  <li
                    key={cap}
                    className="flex items-start gap-1.5 text-micro leading-[1.45] text-mid"
                  >
                    <span className="mt-[0.3rem] h-[0.2rem] w-[0.2rem] shrink-0 rounded-full bg-gold-dim" />
                    {cap}
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-line bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-1.5">
        {icon}
        <span className="truncate text-label text-hi">{value}</span>
      </div>
      <span className="text-micro text-dim">{label}</span>
    </div>
  );
}

function VitalBox({
  caseId,
  rows,
}: {
  caseId: string;
  rows: ClinicalCase["vitals"] | ClinicalCase["derived"];
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-[0.6rem] border border-line bg-card px-3.5">
      {rows.map((r, i) => {
        const Icon = VITAL_ICON[r.key] ?? HeartRate;
        const isWord = !/\d/.test(r.value);
        return (
          <motion.div
            key={`${caseId}-${r.key}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3, ease }}
            // filas de altura igual con separador: el aire sobrante se lee
            // como estructura en vez de como un layout mal calculado
            className={`flex flex-1 items-center justify-between gap-2 ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Icon
                className={`h-[0.75rem] w-[0.75rem] shrink-0 ${
                  VITAL_ICON_TONE[r.key] ?? "text-lo"
                }`}
              />
              <span className="truncate text-micro text-mid">{r.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-1">
              <span
                className={[
                  isWord
                    ? "text-micro"
                    : "num font-mono text-label font-semibold",
                  TONE[r.tone ?? "hi"],
                ].join(" ")}
              >
                {r.value}
              </span>
              {r.unit && <span className="text-micro text-dim">{r.unit}</span>}
              {"trend" in r && r.trend && (
                <span className="text-micro text-warn">↑</span>
              )}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer({
  runnable,
  selected,
}: {
  runnable: ClinicalCase;
  selected: ClinicalCase;
}) {
  const willRun = selected.id === runnable.id;

  return (
    <footer className="flex shrink-0 items-center gap-3 border-t border-line px-5 py-3">
      <span className="mr-auto text-label text-lo">
        El paciente empieza estable y se deteriora solo. Tú decides cuándo y
        cómo intervenir.
      </span>

      {/* Decir qué va a pasar es más barato que explicarlo en vivo cuando el
          jurado elija el caso equivocado. */}
      {!willRun && (
        <span className="text-micro text-warn">
          Esta versión solo simula «{runnable.title}»
        </span>
      )}

      <motion.a
        href="/monitor"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg px-6 py-2.5 text-label font-semibold text-[#14100a]"
        style={{ background: "var(--gold)" }}
      >
        <span
          className="pointer-events-none absolute inset-y-0 w-1/3 opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
            animation: "sweep 1.4s ease-in-out infinite",
          }}
        />
        <span className="relative">Iniciar simulación</span>
        <ArrowRight className="relative h-[0.85rem] w-[0.85rem] transition-transform group-hover:translate-x-0.5" />
      </motion.a>
    </footer>
  );
}

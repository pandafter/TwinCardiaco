"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CASES,
  DATA_SOURCES,
  SEVERITY_TONE,
  loadCustomCases,
  saveCustomCases,
  synthesizeCustomCase,
  type ClinicalCase,
  type CustomCaseInput,
  type LabRow,
} from "@/lib/cases";
import { startScenario } from "@/lib/live";
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

export function SelectPatientScreen() {
  // Los casos custom viven en localStorage. Se cargan en el efecto porque
  // el server-render no tiene acceso a `window`; hasta que llegan, se
  // muestran solo los cuatro casos canonicos.
  const [customs, setCustoms] = useState<ClinicalCase[]>([]);
  useEffect(() => setCustoms(loadCustomCases()), []);

  const allCases = useMemo(() => [...customs, ...CASES], [customs]);
  const [selectedId, setSelectedId] = useState(CASES[0].id);
  const active =
    allCases.find((c) => c.id === selectedId) ?? allCases[0] ?? CASES[0];

  const [showCreator, setShowCreator] = useState(false);
  const [starting, setStarting] = useState(false);

  const persistCustoms = (next: ClinicalCase[]) => {
    setCustoms(next);
    saveCustomCases(next);
  };

  const onCreate = (input: CustomCaseInput) => {
    const c = synthesizeCustomCase(input);
    persistCustoms([c, ...customs]);
    setSelectedId(c.id);
    setShowCreator(false);
  };

  const onDelete = (id: string) => {
    const next = customs.filter((c) => c.id !== id);
    persistCustoms(next);
    if (id === selectedId) setSelectedId(CASES[0].id);
  };

  const onStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      // Aplicamos el preset del caso ANTES de navegar: si el backend esta
      // caido, el error se ve aqui en vez de dejar al usuario en un
      // monitor vacio. En cualquier caso, seguimos: el motor arranca en
      // el paciente sano por defecto y el usuario puede leerlo asi.
      await startScenario(presetToBody(active));
    } finally {
      window.location.href = "/monitor";
    }
  };

  return (
    <div className="h-full w-full bg-page p-2.5">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[0.875rem] border border-line bg-shell">
        <TopBar />

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,25rem)_minmax(0,1fr)] gap-5 overflow-hidden px-5 pt-4 pb-3">
          <CaseList
            cases={allCases}
            selectedId={active.id}
            onSelect={setSelectedId}
            onOpenCreator={() => setShowCreator(true)}
            onDelete={onDelete}
          />
          <CaseDetail c={active} />
        </div>

        <Footer selected={active} starting={starting} onStart={onStart} />

        <AnimatePresence>
          {showCreator && (
            <CustomCaseModal
              onClose={() => setShowCreator(false)}
              onSave={onCreate}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function presetToBody(c: ClinicalCase) {
  const p = c.simulation;
  return {
    shock_type: p.shockType,
    severity: p.severity,
    heart_rate: p.initialHr,
    hr_baseline: p.hrBaseline,
    contractility: p.initialContractility,
    hemoglobin: p.initialHemoglobin,
    lactate: p.initialLactate,
  };
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
  cases,
  selectedId,
  onSelect,
  onOpenCreator,
  onDelete,
}: {
  cases: ClinicalCase[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenCreator: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div>
          <h1 className="text-lead font-medium tracking-[0.06em] text-hi">
            SELECCIONA UN PACIENTE
          </h1>
          <p className="mt-1 text-label text-mid">
            Elige un caso clínico o crea el tuyo.
          </p>
        </div>
        <button
          onClick={onOpenCreator}
          className="shrink-0 rounded-lg border border-line-gold bg-[var(--gold-soft)] px-2.5 py-1.5 text-micro tracking-[0.08em] text-gold transition-colors hover:brightness-110"
          aria-label="Crear un caso personalizado"
        >
          + Crear caso
        </button>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {cases.map((c, i) => (
          <CaseCard
            key={c.id}
            c={c}
            index={i}
            selected={c.id === selectedId}
            onSelect={() => onSelect(c.id)}
            onDelete={c.custom ? () => onDelete(c.id) : undefined}
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
  onDelete,
}: {
  c: ClinicalCase;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const sev = SEVERITY_TONE[c.severity];
  const SexIcon = c.sex === "M" ? Male : Female;

  return (
    // `motion.div` con role=button en vez de `motion.button`: el boton de
    // borrar (×) es un <button> anidado y HTML invalido — en React 19 con
    // Turbopack la hidratacion puede tirar la tarjeta al DOM. Con div no
    // hay anidacion.
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={[
        "relative flex w-full shrink-0 cursor-pointer items-start gap-3 overflow-hidden rounded-[0.7rem] border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]",
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
          <div className="flex shrink-0 items-center gap-1.5">
            {c.custom && <Chip tone="mute">TUYO</Chip>}
            <Chip tone="gold">SIMULABLE</Chip>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                aria-label={`Eliminar ${c.title}`}
                className="rounded border border-line px-1.5 py-[0.05rem] text-micro text-dim hover:border-crit hover:text-crit"
              >
                ×
              </button>
            )}
          </div>
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
    </motion.div>
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
            <ParaclinicosBox caseId={c.id} rows={c.paraclinicos} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ParaclinicosBox({
  caseId,
  rows,
}: {
  caseId: string;
  rows: LabRow[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.6rem] border border-line bg-card">
      <div className="flex shrink-0 items-baseline justify-between border-b border-line px-3 py-2">
        <span className="text-micro tracking-[0.12em] text-mid">
          PARACLÍNICOS
        </span>
        <span className="text-micro text-dim">
          {rows.length ? "al ingreso" : "sin datos"}
        </span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5">
        {rows.map((r, i) => (
          <motion.li
            key={`${caseId}-${r.key}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.28, ease }}
            className={`flex items-baseline justify-between gap-3 py-1.5 ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            <span className="min-w-0 truncate text-micro text-mid">
              {r.label}
            </span>
            <span className="flex shrink-0 items-baseline gap-1">
              <span
                className={`num font-mono text-label font-semibold ${
                  TONE[r.tone ?? "hi"]
                }`}
              >
                {r.value}
              </span>
              {r.unit && <span className="text-micro text-dim">{r.unit}</span>}
              {r.ref && (
                <span className="ml-1 text-micro text-dim">({r.ref})</span>
              )}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
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
  selected,
  starting,
  onStart,
}: {
  selected: ClinicalCase;
  starting: boolean;
  onStart: () => void;
}) {
  return (
    <footer className="flex shrink-0 items-center gap-3 border-t border-line px-5 py-3">
      <span className="mr-auto text-label text-lo">
        {selected.custom
          ? "Caso creado por ti. Los valores iniciales se aplican al motor y empieza la evolución."
          : "El paciente empieza en el estado del caso y se deteriora solo. Tú decides cuándo y cómo intervenir."}
      </span>

      <motion.button
        onClick={onStart}
        disabled={starting}
        whileHover={starting ? undefined : { y: -2 }}
        whileTap={starting ? undefined : { scale: 0.97 }}
        className="group relative flex items-center gap-2.5 overflow-hidden rounded-lg px-6 py-2.5 text-label font-semibold text-[#14100a] disabled:opacity-70"
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
        <span className="relative">
          {starting ? "Cargando caso…" : "Iniciar simulación"}
        </span>
        <ArrowRight className="relative h-[0.85rem] w-[0.85rem] transition-transform group-hover:translate-x-0.5" />
      </motion.button>
    </footer>
  );
}

/* --------------------------------------------------------- crear caso */

const PATHOLOGY_OPTIONS: {
  value: CustomCaseInput["pathology"];
  label: string;
  hint: string;
}[] = [
  { value: "cardiogenic", label: "Cardiogénico", hint: "Falla de bomba: cae contractilidad y gasto." },
  { value: "hypovolemic", label: "Hipovolémico", hint: "Pérdida de volumen: cae precarga." },
  { value: "septic", label: "Séptico", hint: "Vasodilatación: cae SVR." },
  { value: "tachyarrhythmia", label: "Taquiarritmia", hint: "FC alta persistente sin insulto de fondo." },
  { value: "none", label: "Sin insulto", hint: "Paciente estable, para validar el monitor." },
];

function CustomCaseModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: CustomCaseInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [age, setAge] = useState(60);
  const [sex, setSex] = useState<"M" | "F">("M");
  const [background, setBackground] = useState("");
  const [pathology, setPathology] =
    useState<CustomCaseInput["pathology"]>("cardiogenic");
  const [severity, setSeverity] = useState(1.5);
  const [initialHr, setInitialHr] = useState<string>("");
  const [initialContractility, setInitialContractility] = useState<string>("");
  const [initialLactate, setInitialLactate] = useState<string>("");
  const [goal, setGoal] = useState("");

  const active = PATHOLOGY_OPTIONS.find((o) => o.value === pathology)!;
  const canSave = title.trim().length > 0 && age > 0;

  const submit = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      age,
      sex,
      background: background.trim(),
      pathology,
      severity,
      initialHr: initialHr ? Number(initialHr) : undefined,
      initialContractility: initialContractility
        ? Number(initialContractility)
        : undefined,
      initialLactate: initialLactate ? Number(initialLactate) : undefined,
      goal: goal.trim() || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.25, ease }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[38rem] flex-col overflow-hidden rounded-[0.9rem] border border-line bg-shell"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-title font-medium text-hi">Crear caso</h2>
            <p className="mt-1 text-micro text-mid">
              Los vitales y paraclínicos se sintetizan a partir de esta
              configuración. El motor arranca en el estado que definas.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded border border-line px-2 py-0.5 text-label text-dim hover:border-line-strong hover:text-hi"
          >
            ×
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">
          <FieldLabel label="Título del caso">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Post-IAM anterior"
              className="w-full rounded-md border border-line bg-page px-3 py-2 text-label text-hi outline-none focus:border-line-gold"
            />
          </FieldLabel>

          <div className="grid grid-cols-[1fr_5rem_5rem] gap-3">
            <FieldLabel label="Antecedente">
              <input
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="IAM previo, HTA…"
                className="w-full rounded-md border border-line bg-page px-3 py-2 text-label text-hi outline-none focus:border-line-gold"
              />
            </FieldLabel>
            <FieldLabel label="Edad">
              <input
                type="number"
                min={0}
                max={110}
                value={age}
                onChange={(e) => setAge(Math.max(0, Math.min(110, Number(e.target.value) || 0)))}
                className="w-full rounded-md border border-line bg-page px-3 py-2 text-label text-hi outline-none focus:border-line-gold"
              />
            </FieldLabel>
            <FieldLabel label="Sexo">
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as "M" | "F")}
                className="w-full rounded-md border border-line bg-page px-3 py-2 text-label text-hi outline-none focus:border-line-gold"
              >
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </FieldLabel>
          </div>

          <FieldLabel label="Patología">
            <select
              value={pathology}
              onChange={(e) =>
                setPathology(e.target.value as CustomCaseInput["pathology"])
              }
              className="w-full rounded-md border border-line bg-page px-3 py-2 text-label text-hi outline-none focus:border-line-gold"
            >
              {PATHOLOGY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-micro text-dim">{active.hint}</p>
          </FieldLabel>

          <FieldLabel
            label={`Severidad: ${severity.toFixed(1)}`}
            hint="0 = leve, 3 = crítico"
          >
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full accent-[var(--gold)]"
            />
          </FieldLabel>

          <div className="rounded-md border border-line bg-card p-3">
            <div className="text-micro tracking-[0.1em] text-dim">
              PUNTO DE PARTIDA (opcional)
            </div>
            <p className="mt-1 text-micro text-mid">
              Si dejas vacío, el motor calcula el estado inicial desde patología
              y severidad.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <FieldLabel label="HR inicial (lpm)">
                <input
                  type="number"
                  placeholder="auto"
                  min={30}
                  max={220}
                  value={initialHr}
                  onChange={(e) => setInitialHr(e.target.value)}
                  className="w-full rounded-md border border-line bg-page px-3 py-2 text-label text-hi outline-none focus:border-line-gold"
                />
              </FieldLabel>
              <FieldLabel label="Contractilidad (0.1-1.5)">
                <input
                  type="number"
                  step={0.05}
                  placeholder="auto"
                  min={0.1}
                  max={1.5}
                  value={initialContractility}
                  onChange={(e) => setInitialContractility(e.target.value)}
                  className="w-full rounded-md border border-line bg-page px-3 py-2 text-label text-hi outline-none focus:border-line-gold"
                />
              </FieldLabel>
              <FieldLabel label="Lactato (mmol/L)">
                <input
                  type="number"
                  step={0.1}
                  placeholder="auto"
                  min={0.4}
                  max={20}
                  value={initialLactate}
                  onChange={(e) => setInitialLactate(e.target.value)}
                  className="w-full rounded-md border border-line bg-page px-3 py-2 text-label text-hi outline-none focus:border-line-gold"
                />
              </FieldLabel>
            </div>
          </div>

          <FieldLabel label="Objetivo (opcional)">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ej: recuperar CI > 2.2 sin caer MAP"
              className="w-full rounded-md border border-line bg-page px-3 py-2 text-label text-hi outline-none focus:border-line-gold"
            />
          </FieldLabel>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-line px-3.5 py-1.5 text-label text-mid hover:border-line-strong hover:text-hi"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!canSave}
            className="rounded-md px-4 py-1.5 text-label font-semibold text-[#14100a] disabled:opacity-50"
            style={{ background: "var(--gold)" }}
          >
            Guardar caso
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-micro tracking-[0.08em] text-mid">
        <span>{label}</span>
        {hint && <span className="text-dim">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

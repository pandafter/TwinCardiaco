"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Assessment, Vitals } from "@/lib/engine";
import type { AgentOutput } from "@/lib/agents";
import type { Branch } from "@/lib/whatif";
import type { Phase } from "./FlowGuide";
import { BeatingHeart } from "./BeatingHeart";
import { CausalChain } from "./CausalChain";
import { SERIES, TrendChart } from "./TrendChart";

/**
 * El escenario: la zona grande del centro.
 *
 * NO muestra todo a la vez. Cambia de protagonista según la fase del caso,
 * porque siete bloques compitiendo es exactamente por qué no se entendía
 * qué estaba pasando. En cada momento hay UNA cosa que mirar:
 *
 *   Observa / Se deteriora → el corazón y la cadena causal
 *   La IA analiza          → lo que están diciendo los agentes
 *   Decide                 → las trayectorias comparadas
 *   Consecuencia           → antes y después
 *
 * Las transiciones son parte del mensaje: el cambio de escena avisa de que
 * el caso avanzó.
 */

const ease = [0.22, 1, 0.36, 1] as const;

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.42, ease },
};

export type SceneKey = "body" | "agents" | "decide" | "result";

const TABS: { key: SceneKey; label: string }[] = [
  { key: "body", label: "El paciente" },
  { key: "agents", label: "Lo que dice la IA" },
  { key: "decide", label: "Las opciones" },
  { key: "result", label: "El resultado" },
];

export function Stage({
  phase,
  vitals,
  assess,
  history,
  agents,
  agentsSource,
  branches,
  projection,
  applied,
  pinned,
  onPin,
}: {
  phase: Phase;
  vitals: Vitals;
  assess: Assessment;
  history: Vitals[];
  agents: AgentOutput[];
  agentsSource: AgentsSource;
  branches: Branch[];
  projection: Branch | null;
  applied: string | null;
  /** escena fijada a mano; null = sigue al caso */
  pinned: SceneKey | null;
  onPin: (s: SceneKey | null) => void;
}) {
  // Prioridad: lo que el usuario fijó > lo que pidió ver (hover) > la fase.
  // Que las escenas cambiaran solas sin poder volver atrás era justo lo que
  // hacía imposible moverse por la pantalla.
  const auto: SceneKey = projection ? "decide" : SCENE[phase];
  const scene: SceneKey = pinned ?? auto;
  const tabsRef = useRef<HTMLDivElement>(null);

  // Flechas para moverse entre pestañas: es lo que espera cualquiera que
  // navegue con teclado, y no costaba nada.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.key === scene);
    const next =
      (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    onPin(TABS[next].key);
    tabsRef.current
      ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
      [next]?.focus();
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.7rem] border border-line bg-card">
      {/* navegación entre escenas: siempre disponible, no solo automática */}
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Escenas del caso"
        onKeyDown={onKeyDown}
        className="flex shrink-0 items-center gap-1 border-b border-line px-2"
      >
        {TABS.map((t) => {
          const on = scene === t.key;
          const next = auto === t.key && !pinned;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onPin(pinned === t.key ? null : t.key)}
              className="relative flex items-center gap-1.5 px-3.5 py-2.5 text-label transition-colors hover:text-mid"
              style={{ color: on ? "var(--gold)" : "var(--text-lo)" }}
            >
              {t.label}
              {next && !on && (
                <span
                  title="Es lo que el caso está mostrando ahora"
                  className="h-[0.3rem] w-[0.3rem] rounded-full bg-ok"
                  style={{ animation: "pulse-dot 1.8s ease-in-out infinite" }}
                />
              )}
              {on && (
                <motion.span
                  layoutId="scene-underline"
                  transition={{ duration: 0.35, ease }}
                  className="absolute right-2 bottom-0 left-2 h-[0.14rem] rounded-full bg-gold"
                />
              )}
            </button>
          );
        })}
        <AnimatePresence>
          {pinned && (
            <motion.button
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              onClick={() => onPin(null)}
              className="mr-2 ml-auto rounded-md border border-line px-2.5 py-1 text-micro text-lo transition-colors hover:border-line-strong hover:bg-card-hover hover:text-mid"
            >
              Seguir el caso automáticamente
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {scene === "body" && (
            <motion.div key="body" {...fade} className="absolute inset-0">
              <BodyScene vitals={vitals} assess={assess} history={history} />
            </motion.div>
          )}

          {scene === "agents" && (
            <motion.div key="agents" {...fade} className="absolute inset-0">
              <AgentsScene agents={agents} source={agentsSource} />
            </motion.div>
          )}

          {scene === "decide" && (
            <motion.div key="decide" {...fade} className="absolute inset-0">
              <DecideScene
                history={history}
                branches={branches}
                projection={projection}
              />
            </motion.div>
          )}

          {scene === "result" && (
            <motion.div key="result" {...fade} className="absolute inset-0">
              <ResultScene
                history={history}
                vitals={vitals}
                branches={branches}
                applied={applied}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const SCENE: Record<Phase, SceneKey> = {
  0: "body",
  1: "body",
  2: "agents",
  3: "decide",
  4: "result",
};

/* ------------------------------------------------------- escena: el cuerpo */

function BodyScene({
  vitals,
  assess,
  history,
}: {
  vitals: Vitals;
  assess: Assessment;
  history: Vitals[];
}) {
  return (
    <div className="flex h-full w-full flex-col">
      <SceneTitle
        title="QUÉ LE ESTÁ PASANDO"
        hint="Cada eslabón depende del anterior. Si el primero se rompe, caen todos."
      />
      <div className="relative flex min-h-0 flex-1 items-center">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 45% 65% at 20% 50%, rgba(30,90,140,0.2) 0%, transparent 70%)",
            animation: "breathe 5s ease-in-out infinite",
          }}
        />
        <div className="relative h-full w-[26%] shrink-0">
          <BeatingHeart
            hr={vitals.hr}
            rhythm={vitals.rhythm}
            strokeVolume={vitals.sv}
            perfusion={vitals.perfusion_index}
            className="absolute top-1/2 left-1/2 h-[86%] w-[80%] -translate-x-1/2 -translate-y-1/2"
          />
        </div>
        <div className="relative min-w-0 flex-1 pr-4">
          <CausalChain vitals={vitals} assess={assess} history={history} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ escena: los agentes */

export type AgentsSource = "llm" | "pending" | "local";

function AgentsScene({
  agents,
  source,
}: {
  agents: AgentOutput[];
  source: AgentsSource;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      <SceneTitle
        title="LA IA ESTÁ ANALIZANDO"
        hint={
          source === "llm"
            ? "Tres agentes con objetivos distintos leyeron este paciente. El desacuerdo es real."
            : source === "pending"
              ? "Consultando a los tres agentes…"
              : "Sin modelo disponible: reglas locales. Los números siguen siendo del motor."
        }
        badge={source}
      />
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 p-4">
        {agents.map((a, i) => (
          <motion.article
            key={a.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            // entran en cascada: se ve que van llegando, no que ya estaban
            transition={{ delay: i * 0.16, duration: 0.5, ease }}
            className="relative flex min-h-0 flex-col overflow-hidden rounded-[0.6rem] border p-4"
            style={{
              borderColor: `color-mix(in srgb, ${a.color} 30%, transparent)`,
              background: `color-mix(in srgb, ${a.color} 5%, transparent)`,
            }}
          >
            {/* mientras el agente "piensa", una luz recorre su borde superior */}
            {a.state !== "En espera" && (
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
                <span
                  className="block h-full w-1/3"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${a.color}, transparent)`,
                    animation: `sweep 2.8s ${i * 0.4}s ease-in-out infinite`,
                  }}
                />
              </span>
            )}

            <div className="flex items-center justify-between gap-2">
              <h3 className="text-body font-medium" style={{ color: a.color }}>
                {a.name}
              </h3>
              <span
                className="shrink-0 rounded border px-2 py-[0.1rem] text-micro"
                style={{
                  borderColor: `color-mix(in srgb, ${a.color} 30%, transparent)`,
                  color: a.color,
                }}
              >
                {a.state}
              </span>
            </div>
            <div className="mt-1 text-micro text-lo">{a.role}</div>

            {/* min-h-0 + overflow: sin esto, un titular largo empujaba la
                evidencia fuera de la tarjeta y quedaba cortada a media línea */}
            {/* line-clamp, no overflow-hidden: recortar por píxeles deja una
                línea partida por la mitad y parece un fallo de render. */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <p className="mt-3.5 line-clamp-5 text-lead leading-[1.5] text-hi">
                {a.headline}
              </p>
              {a.technical && (
                <p className="mt-2.5 line-clamp-3 text-label leading-[1.55] text-lo">
                  {a.technical}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap gap-1.5 pt-3">
              {a.evidence.slice(0, 3).map((e, k) => (
                <motion.span
                  key={e.label}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.16 + 0.3 + k * 0.06, duration: 0.3 }}
                  className="rounded border border-line px-2 py-[0.15rem] text-micro text-lo"
                >
                  {e.label}{" "}
                  <span className="num font-mono text-mid">{e.value}</span>
                </motion.span>
              ))}
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- escena: la decisión */

function DecideScene({
  history,
  branches,
  projection,
}: {
  history: Vitals[];
  branches: Branch[];
  projection: Branch | null;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      <SceneTitle
        title={
          projection
            ? `SI ELIGES: ${projection.human.toUpperCase()}`
            : "A DÓNDE LLEVA CADA DECISIÓN"
        }
        hint={
          projection
            ? projection.verdict
            : "Pasa el mouse por una opción de abajo. Lo punteado es futuro simulado, no medido."
        }
        accent={projection?.color}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2">
        {SERIES.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5 text-micro text-mid"
          >
            <span
              className="h-[0.16rem] w-[0.9rem] rounded-full"
              style={{ background: s.color }}
            />
            {s.human}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-micro text-dim">
          <span className="inline-block h-0 w-5 border-t border-dashed border-[var(--text-lo)]" />
          proyectado — no medido
        </span>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-2">
        <TrendChart history={history} projection={projection} />
      </div>

      {/* El resumen de las cuatro ramas vive en la barra de abajo, no aquí:
          estaba duplicado y era el mismo dato dos veces en la misma pantalla.
          Lo que sí falta arriba es la lectura de la rama en foco. */}
      <AnimatePresence>
        {projection && projection.key !== "none" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.28, ease }}
            className="mx-4 mb-3 flex shrink-0 items-center gap-5 rounded-lg border px-4 py-2.5"
            style={{
              borderColor: `color-mix(in srgb, ${projection.color} 32%, transparent)`,
              background: `color-mix(in srgb, ${projection.color} 7%, transparent)`,
            }}
          >
            <span className="text-micro tracking-[0.14em] text-dim">
              FRENTE A NO HACER NADA
            </span>
            <Swing label="Presión de bombeo" value={projection.vsNone.map} digits={1} unit=" mmHg" />
            <Swing label="Sangre bombeada" value={projection.vsNone.co} digits={2} unit=" L/min" />
            <Swing
              label="Falta de oxígeno"
              value={-projection.vsNone.lactate}
              digits={2}
              unit=" mmol/L menos"
            />
            {branches.length > 0 && (
              <span className="ml-auto text-micro text-lo">
                horizonte {Math.round(projection.points.length / 60)} min
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Swing({
  label,
  value,
  digits,
  unit = "",
}: {
  label: string;
  value: number;
  digits: number;
  unit?: string;
}) {
  const flat = Math.abs(value) < 10 ** -digits * 5;
  const color = flat ? "var(--text-lo)" : value > 0 ? "var(--ok)" : "var(--crit)";
  return (
    <span className="flex flex-col">
      <span className="text-micro text-lo">{label}</span>
      <span className="num font-mono text-num-sm leading-tight" style={{ color }}>
        {flat ? "sin cambio" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}${unit}`}
      </span>
    </span>
  );
}

/* ---------------------------------------------------- escena: la consecuencia */

function ResultScene({
  history,
  vitals,
  branches,
  applied,
}: {
  history: Vitals[];
  vitals: Vitals;
  branches: Branch[];
  applied: string | null;
}) {
  const chosen = branches.find((b) => b.key === applied);
  const none = branches.find((b) => b.key === "none");

  return (
    <div className="flex h-full w-full flex-col">
      <SceneTitle
        title="MISMO PACIENTE, DISTINTA DECISIÓN"
        hint={
          chosen
            ? `Elegiste "${chosen.human.toLowerCase()}". La línea punteada es lo que habría pasado sin hacer nada.`
            : "Observa cómo cambia la trayectoria."
        }
        accent={chosen?.color}
      />
      <div className="min-h-0 flex-1 px-2 pt-2">
        <TrendChart history={history} projection={none ?? null} />
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-3 px-4 py-3">
        <Metric label="Pulso" value={vitals.hr} digits={0} unit="lpm" />
        <Metric
          label="Presión de bombeo"
          value={vitals.map}
          digits={0}
          unit="mmHg"
        />
        <Metric
          label="Falta de oxígeno"
          value={vitals.lactate}
          digits={1}
          unit="mmol/L"
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  digits,
  unit,
}: {
  label: string;
  value: number;
  digits: number;
  unit: string;
}) {
  return (
    <div className="rounded-md border border-line bg-panel px-3 py-2">
      <div className="text-micro text-lo">{label}</div>
      <div className="num mt-1 font-mono text-num-sm leading-none text-hi">
        {value.toFixed(digits)}
        <span className="ml-1 text-micro text-dim">{unit}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function SceneTitle({
  title,
  hint,
  accent,
  badge,
}: {
  title: string;
  hint: string;
  accent?: string;
  /** de dónde salió lo que se está mostrando; se declara, no se supone */
  badge?: AgentsSource;
}) {
  return (
    <div className="flex shrink-0 items-baseline gap-3 border-b border-line px-4 py-2.5">
      <motion.h2
        key={title}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease }}
        className="shrink-0 text-label tracking-[0.14em]"
        style={{ color: accent ?? "var(--text-mid)" }}
      >
        {title}
      </motion.h2>
      <motion.p
        key={hint}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="min-w-0 flex-1 truncate text-micro text-lo"
      >
        {hint}
      </motion.p>
      {badge && (
        <span
          className="shrink-0 rounded border px-1.5 py-[0.1rem] text-micro"
          style={
            badge === "llm"
              ? { borderColor: "var(--line-gold)", color: "var(--gold)" }
              : { borderColor: "var(--line-strong)", color: "var(--text-lo)" }
          }
        >
          {badge === "llm"
            ? "modelo"
            : badge === "pending"
              ? "consultando…"
              : "reglas locales"}
        </span>
      )}
    </div>
  );
}

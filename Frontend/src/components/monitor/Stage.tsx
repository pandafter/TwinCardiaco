"use client";

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
  transition: { duration: 0.45, ease },
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.7rem] border border-line bg-card">
      {/* navegación entre escenas: siempre disponible, no solo automática */}
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2">
        {TABS.map((t) => {
          const on = scene === t.key;
          const next = auto === t.key && !pinned;
          return (
            <button
              key={t.key}
              onClick={() => onPin(pinned === t.key ? null : t.key)}
              className="relative px-3.5 py-2.5 text-[0.6875rem] transition-colors"
              style={{ color: on ? "var(--gold)" : "var(--text-lo)" }}
            >
              {t.label}
              {next && !on && (
                <span className="ml-1.5 text-[0.5rem] text-ok">•</span>
              )}
              {on && (
                <motion.span
                  layoutId="scene-underline"
                  className="absolute right-2 bottom-0 left-2 h-[0.125rem] rounded-full bg-gold"
                />
              )}
            </button>
          );
        })}
        {pinned && (
          <button
            onClick={() => onPin(null)}
            className="ml-auto mr-2 rounded border border-line px-2.5 py-1 text-[0.5625rem] text-lo transition-colors hover:text-mid"
          >
            Seguir el caso automáticamente
          </button>
        )}
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
            <AgentsScene agents={agents} />
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

const SCENE: Record<Phase, "body" | "agents" | "decide" | "result"> = {
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

function AgentsScene({ agents }: { agents: AgentOutput[] }) {
  return (
    <div className="flex h-full w-full flex-col">
      <SceneTitle
        title="LA IA ESTÁ ANALIZANDO"
        hint="Dos especialistas leen los mismos números y defienden cosas distintas."
      />
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 p-4">
        {agents.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            // entran en cascada: se ve que van llegando, no que ya estaban
            transition={{ delay: i * 0.18, duration: 0.5, ease }}
            className="flex min-h-0 flex-col rounded-[0.6rem] border p-4"
            style={{
              borderColor: `color-mix(in srgb, ${a.color} 30%, transparent)`,
              background: `color-mix(in srgb, ${a.color} 5%, transparent)`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[0.8125rem] font-medium"
                style={{ color: a.color }}
              >
                {a.name}
              </span>
              <span
                className="shrink-0 rounded border px-2 py-[0.1rem] text-[0.5625rem]"
                style={{
                  borderColor: `color-mix(in srgb, ${a.color} 30%, transparent)`,
                  color: a.color,
                }}
              >
                {a.state}
              </span>
            </div>
            <div className="mt-1 text-[0.625rem] text-lo">{a.role}</div>

            <p className="mt-4 text-[0.9375rem] leading-[1.6] text-hi">
              {a.headline}
            </p>
            {a.technical && (
              <p className="mt-3 text-[0.6875rem] leading-[1.6] text-dim">
                {a.technical}
              </p>
            )}

            <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
              {a.evidence.slice(0, 4).map((e) => (
                <span
                  key={e.label}
                  className="rounded border border-line px-2 py-[0.15rem] text-[0.625rem] text-lo"
                >
                  {e.label} <span className="font-mono text-mid">{e.value}</span>
                </span>
              ))}
            </div>
          </motion.div>
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

      <div className="flex shrink-0 items-center gap-4 px-4 pb-1">
        {SERIES.filter((s) => s.key === "map" || s.key === "lactate").map(
          (s) => (
            <span
              key={s.key}
              className="flex items-center gap-1.5 text-[0.625rem] text-mid"
            >
              <span
                className="h-[0.35rem] w-[0.35rem] rounded-full"
                style={{ background: s.color }}
              />
              {s.key === "map" ? "Presión de bombeo" : "Falta de oxígeno"}
            </span>
          ),
        )}
        <span className="flex items-center gap-1.5 text-[0.625rem] text-dim">
          <span className="inline-block h-0 w-5 border-t border-dashed border-[var(--text-lo)]" />
          proyectado
        </span>
      </div>

      <div className="min-h-0 flex-1 px-2">
        <TrendChart history={history} projection={projection} />
      </div>

      {/* la comparación en una línea: es el argumento del producto */}
      <div className="grid shrink-0 grid-cols-4 gap-2 px-4 pb-3">
        {branches.map((b) => (
          <div
            key={b.key}
            className="rounded-md border px-3 py-2 transition-colors"
            style={{
              borderColor:
                projection?.key === b.key
                  ? b.color
                  : "var(--line)",
              background:
                projection?.key === b.key
                  ? `color-mix(in srgb, ${b.color} 10%, transparent)`
                  : "transparent",
            }}
          >
            <div className="text-[0.6875rem]" style={{ color: b.color }}>
              {b.human}
            </div>
            <div className="mt-1 flex gap-3 font-mono text-[0.625rem] text-mid">
              <span>
                presión{" "}
                <span className="text-hi">
                  {b.key === "none"
                    ? "—"
                    : `${b.vsNone.map >= 0 ? "+" : ""}${b.vsNone.map.toFixed(0)}`}
                </span>
              </span>
              <span>
                oxígeno{" "}
                <span className="text-hi">
                  {b.key === "none"
                    ? "—"
                    : `${-b.vsNone.lactate >= 0 ? "+" : ""}${(-b.vsNone.lactate).toFixed(1)}`}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
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
      <div className="min-h-0 flex-1 px-2">
        <TrendChart history={history} projection={none ?? null} />
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-3 px-4 pb-3">
        <Metric label="Pulso" value={`${Math.round(vitals.hr)}`} unit="lpm" />
        <Metric
          label="Presión de bombeo"
          value={`${Math.round(vitals.map)}`}
          unit="mmHg"
        />
        <Metric
          label="Falta de oxígeno"
          value={vitals.lactate.toFixed(1)}
          unit="mmol/L"
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <div className="text-[0.625rem] text-lo">{label}</div>
      <div className="mt-1 font-mono text-[1.3rem] leading-none text-hi tabular-nums">
        {value}
        <span className="ml-1 text-[0.625rem] text-dim">{unit}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function SceneTitle({
  title,
  hint,
  accent,
}: {
  title: string;
  hint: string;
  accent?: string;
}) {
  return (
    <div className="flex shrink-0 items-baseline gap-3 border-b border-line px-4 py-2.5">
      <span
        className="text-[0.75rem] tracking-[0.14em]"
        style={{ color: accent ?? "var(--text-mid)" }}
      >
        {title}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-lo">
        {hint}
      </span>
    </div>
  );
}

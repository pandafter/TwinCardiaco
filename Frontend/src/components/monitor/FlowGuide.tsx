"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Assessment } from "@/lib/engine";

/**
 * Guía de flujo: dice en qué momento del caso estás y qué se espera de ti.
 *
 * Sin esto, alguien que abre la pantalla ve números moviéndose y no sabe si
 * tiene que hacer algo, esperar, o dónde mirar. No avanza con clicks: avanza
 * con el estado real del paciente, así que también funciona como narrador
 * durante la demo.
 */

export type Phase = 0 | 1 | 2 | 3 | 4;

const STEPS: { label: string; hint: string }[] = [
  { label: "Observa", hint: "El paciente está estable. Mira sus signos vitales." },
  { label: "Se deteriora", hint: "Algo cambió: el pulso sube y todo lo demás cae detrás." },
  { label: "La IA analiza", hint: "Tres agentes leen el mismo estado y no coinciden. Abre «Lo que dice la IA»." },
  { label: "Decide", hint: "Pasa el mouse por las opciones de abajo para ver a dónde lleva cada una." },
  { label: "Consecuencia", hint: "Intervención aplicada. Observa cómo cambia la trayectoria." },
];

export function phaseOf(
  assess: Assessment,
  hasAgentOpinion: boolean,
  applied: string | null,
): Phase {
  if (applied) return 4;
  if (assess.status === "stable") return 0;
  if (!hasAgentOpinion) return 1;
  // con opiniones sobre la mesa, la pelota está en el humano
  return assess.status === "critical" ? 3 : 2;
}

export function FlowGuide({ phase }: { phase: Phase }) {
  return (
    <nav
      aria-label="Progreso del caso"
      className="flex shrink-0 items-center gap-3 border-b border-line bg-shell px-4 py-1.5"
    >
      <ol className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const done = i < phase;
          const now = i === phase;
          return (
            <li key={s.label} className="flex items-center gap-1">
              <motion.span
                animate={{ scale: now ? 1 : 0.97 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex items-center gap-1.5 rounded-full border px-2.5 py-[0.2rem] text-micro transition-colors duration-500"
                style={{
                  borderColor: now
                    ? "var(--gold)"
                    : done
                      ? "rgba(63,191,127,0.3)"
                      : "var(--line)",
                  background: now ? "var(--gold-soft)" : "transparent",
                  color: now
                    ? "var(--gold)"
                    : done
                      ? "var(--ok)"
                      : "var(--text-dim)",
                }}
              >
                {now && (
                  <motion.span
                    layoutId="flow-halo"
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: "0 0 0 1px var(--gold)" }}
                  />
                )}
                <span className="num font-mono">{done ? "✓" : i + 1}</span>
                {s.label}
              </motion.span>
              {i < STEPS.length - 1 && (
                <span
                  className="text-micro transition-colors duration-500"
                  style={{ color: done ? "var(--ok)" : "var(--text-dim)" }}
                >
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* qué se espera de ti AHORA */}
      <AnimatePresence mode="wait">
        <motion.span
          key={phase}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.28 }}
          className="text-label text-mid"
        >
          {STEPS[phase].hint}
        </motion.span>
      </AnimatePresence>
    </nav>
  );
}

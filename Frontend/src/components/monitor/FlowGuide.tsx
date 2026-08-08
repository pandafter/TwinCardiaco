"use client";

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
  { label: "Se deteriora", hint: "Algo cambió. Sigue la cadena de arriba: el pulso sube y todo lo demás cae." },
  { label: "La IA analiza", hint: "Los agentes están leyendo el mismo estado. Mira la columna derecha." },
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
    <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-1.5">
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => {
          const done = i < phase;
          const now = i === phase;
          return (
            <span key={s.label} className="flex items-center gap-1.5">
              <span
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-[0.15rem] text-[0.5rem] transition-colors"
                style={{
                  borderColor: now
                    ? "var(--gold)"
                    : done
                      ? "rgba(63,191,127,0.3)"
                      : "var(--line)",
                  background: now ? "rgba(200,155,72,0.1)" : "transparent",
                  color: now
                    ? "var(--gold)"
                    : done
                      ? "var(--ok)"
                      : "var(--text-dim)",
                }}
              >
                <span className="font-mono text-[0.4375rem]">
                  {done ? "✓" : i + 1}
                </span>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="text-[0.5rem] text-dim">›</span>
              )}
            </span>
          );
        })}
      </div>

      {/* qué se espera de ti AHORA */}
      <span className="text-[0.5625rem] text-mid">{STEPS[phase].hint}</span>
    </div>
  );
}

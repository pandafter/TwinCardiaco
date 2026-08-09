"use client";

import type { Assessment, Vitals } from "@/lib/engine";

/**
 * La cadena causal en vivo:
 *
 *   PULSO ↑ → LLENADO ↓ → BOMBEO ↓ → PRESIÓN ↓ → OXÍGENO ↓
 *
 * Es el elemento que hace visible que hay un motor calculando de verdad, y
 * se entiende sin saber medicina: cada eslabón muestra la etiqueta humana
 * grande, el valor, y el dato técnico en pequeño. La flecha de cada eslabón
 * compara contra ~15 s atrás de la historia real, no contra un guion.
 */

type Link = {
  key: string;
  human: string;
  tech: string;
  value: (v: Vitals, a: Assessment) => string;
  unit: string;
  /** métrica cruda para calcular la dirección del cambio */
  raw: (v: Vitals) => number;
  /** true si subir es deterioro (pulso); false si bajar es deterioro */
  badWhenUp: boolean;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** mismo cálculo de llenado del motor, para poder evaluarlo sobre la historia */
const filling = (hr: number) => clamp01((60 / hr - 0.28) / 0.445);

const LINKS: Link[] = [
  {
    key: "hr",
    human: "PULSO",
    tech: "frecuencia cardiaca",
    value: (v) => `${Math.round(v.hr)}`,
    unit: "lpm",
    raw: (v) => v.hr,
    badWhenUp: true,
  },
  {
    key: "filling",
    human: "LLENADO",
    tech: "llenado diastólico",
    value: (v) => `${Math.round(filling(v.hr) * 100)}`,
    unit: "%",
    raw: (v) => filling(v.hr),
    badWhenUp: false,
  },
  {
    key: "co",
    human: "BOMBEO",
    tech: "gasto cardiaco",
    value: (v) => v.co.toFixed(1),
    unit: "L/min",
    raw: (v) => v.co,
    badWhenUp: false,
  },
  {
    key: "map",
    human: "PRESIÓN",
    tech: "presión arterial media",
    value: (v) => `${Math.round(v.map)}`,
    unit: "mmHg",
    raw: (v) => v.map,
    badWhenUp: false,
  },
  {
    key: "o2",
    human: "OXÍGENO",
    tech: "perfusión tisular",
    value: (v) => `${Math.round(v.perfusion_index * 100)}`,
    unit: "%",
    raw: (v) => v.perfusion_index,
    badWhenUp: false,
  },
];

export function CausalChain({
  vitals,
  assess,
  history,
  compact = false,
}: {
  vitals: Vitals;
  assess: Assessment;
  history: Vitals[];
  compact?: boolean;
}) {
  // referencia: ~15 s atrás (historia a 4 Hz)
  const ref = history.length > 60 ? history[history.length - 60] : history[0];

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center ${
        compact ? "gap-2 px-3" : "gap-5 px-6"
      }`}
    >
      <div className="flex w-full items-stretch justify-center gap-2">
        {LINKS.map((l, i) => {
          const now = l.raw(vitals);
          const before = ref ? l.raw(ref) : now;
          const delta = before !== 0 ? (now - before) / Math.abs(before) : 0;
          const moving = Math.abs(delta) > 0.015;
          const worsening = moving && (l.badWhenUp ? delta > 0 : delta < 0);
          const improving = moving && !worsening;
          const tone = worsening
            ? "var(--crit)"
            : improving
              ? "var(--ok)"
              : "var(--text-mid)";
          const glyph = !moving ? "→" : delta > 0 ? "↑" : "↓";

          return (
            <div
              key={l.key}
              className={`flex min-w-0 flex-1 items-center ${compact ? "gap-1" : "gap-2"}`}
            >
              <div
                className={`flex min-w-0 flex-1 flex-col items-center rounded-[0.6rem] border transition-colors duration-500 ${
                  compact ? "px-1 py-2" : "px-2 py-3"
                }`}
                style={{
                  borderColor: moving
                    ? `color-mix(in srgb, ${tone} 45%, transparent)`
                    : "var(--line)",
                  background: moving
                    ? `color-mix(in srgb, ${tone} 7%, transparent)`
                    : "var(--card)",
                  // la cascada: los eslabones se encienden con un pequeño
                  // retardo de izquierda a derecha
                  transitionDelay: `${i * 120}ms`,
                }}
              >
                <div
                  className={`font-medium text-hi ${
                    compact
                      ? "text-[0.48rem] tracking-[0.1em]"
                      : "text-[0.5625rem] tracking-[0.18em]"
                  }`}
                >
                  {l.human}{" "}
                  <span style={{ color: tone }}>{glyph}</span>
                </div>
                <div
                  className={`mt-2 font-mono leading-none font-semibold tabular-nums ${compact ? "text-[1.1rem]" : "text-[1.6rem]"}`}
                  style={{ color: tone }}
                >
                  {l.value(vitals, assess)}
                  <span className="ml-1 text-[0.55em] text-dim">{l.unit}</span>
                </div>
                <div
                  className={`text-center text-dim ${
                    compact
                      ? "mt-1 text-[0.4rem] tracking-[0.02em]"
                      : "mt-1.5 text-[0.4375rem] tracking-[0.06em]"
                  }`}
                >
                  {l.tech}
                </div>
              </div>
              {i < LINKS.length - 1 && (
                <span className="relative flex shrink-0 items-center">
                  <span
                    className={`${compact ? "text-[0.65rem]" : "text-[0.9rem]"} transition-colors duration-500`}
                    style={{
                      color: worsening
                        ? "var(--crit)"
                        : improving
                          ? "var(--ok)"
                          : "var(--text-dim)",
                      transitionDelay: `${i * 120 + 60}ms`,
                    }}
                  >
                    →
                  </span>
                  {/* Un pulso que viaja eslabón a eslabón. La cadena es el
                      argumento del producto: si solo cambia de color, se lee
                      como cinco cajas; con el pulso se lee como causa. */}
                  {moving && (
                    <span
                      className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      aria-hidden
                    >
                      <span
                        className="h-[0.25rem] w-[0.25rem] rounded-full"
                        style={{
                          background: tone,
                          animation: `chain-pulse 2.4s ${i * 0.28}s ease-in-out infinite`,
                        }}
                      />
                    </span>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!compact && (
        <p className="max-w-[34rem] text-center text-[0.5625rem] leading-[1.7] text-mid">
          {vitals.hr > 100 ? (
            <>
              El corazón late tan rápido que{" "}
              <span className="text-hi">
                no alcanza a llenarse entre latido y latido
              </span>
              : late más, pero bombea menos. La presión cae y el cuerpo empieza
              a quedarse sin oxígeno.
            </>
          ) : (
            <>
              La bomba mantiene el flujo: el llenado, el bombeo y la presión
              sostienen la entrega de oxígeno a los tejidos.
            </>
          )}
        </p>
      )}
    </div>
  );
}

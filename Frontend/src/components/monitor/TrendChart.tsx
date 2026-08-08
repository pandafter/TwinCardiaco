"use client";

import { useMemo } from "react";
import { caseClock, type Vitals } from "@/lib/engine";
import type { Branch } from "@/lib/whatif";

export const SERIES = [
  { key: "hr", label: "FC (bpm)", color: "var(--crit)" },
  { key: "map", label: "MAP (mmHg)", color: "var(--warn)" },
  { key: "spo2", label: "SpO₂ (%)", color: "var(--info)" },
  { key: "lactate", label: "Lactato (mmol/L)", color: "var(--violet)" },
] as const;

const W = 1000;
const H = 260;
const PAD_L = 46;
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 30;

/** Escala principal 0–180: FC, MAP y SpO₂ comparten rango clínico. */
const yMain = (v: number) =>
  PAD_T + (1 - Math.min(180, Math.max(0, v)) / 180) * (H - PAD_T - PAD_B);
/** El lactato tiene su propia escala (0–6) sobre el 78% inferior. */
const yLact = (v: number) =>
  H - PAD_B - (Math.min(6, Math.max(0, v)) / 6) * (H - PAD_T - PAD_B) * 0.78;

const TICKS = [180, 100, 70, 0];

export function TrendChart({
  history,
  /**
   * Rama what-if a superponer. Se dibuja PUNTEADA, tenue y rotulada
   * PROYECTADO, y el eje X reserva espacio a la derecha para el futuro.
   * Lo simulado no puede parecerse a lo medido: es la regla del proyecto.
   */
  projection,
}: {
  history: Vitals[];
  projection?: Branch | null;
}) {
  const { paths, xTicks, alertX, nowX, projPaths } = useMemo(() => {
    if (history.length < 2)
      return { paths: [], xTicks: [], alertX: null, nowX: null, projPaths: [] };

    const t0 = history[0].t;
    const tNow = history[history.length - 1].t;
    // con proyección el dominio se extiende al horizonte futuro
    const tEnd = projection
      ? tNow + projection.points.length
      : tNow;
    const span = Math.max(1, tEnd - t0);
    const x = (t: number) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);

    // una muestra cada ~2 s: 1250 puntos no aportan nada a 1000 px de ancho
    const stride = Math.max(1, Math.floor(history.length / 300));
    const pts = history.filter((_, i) => i % stride === 0);

    const paths = SERIES.map((s) => {
      const y = s.key === "lactate" ? yLact : yMain;
      const d = pts
        .map(
          (v, i) =>
            `${i === 0 ? "M" : "L"}${x(v.t).toFixed(1)} ${y(v[s.key]).toFixed(1)}`,
        )
        .join(" ");
      return { ...s, d };
    });

    // solo MAP y lactato en la proyección: son las dos que deciden el caso,
    // y cuatro líneas punteadas más serían ruido
    const projPaths = projection
      ? (
          [
            { key: "map", color: "var(--warn)", y: yMain, get: (p: Branch["points"][number]) => p.map },
            { key: "lactate", color: "var(--violet)", y: yLact, get: (p: Branch["points"][number]) => p.lactate },
          ] as const
        ).map((s) => ({
          key: s.key,
          color: s.color,
          d: projection.points
            .filter((_, i) => i % 3 === 0)
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"}${x(tNow + p.t).toFixed(1)} ${s.y(s.get(p)).toFixed(1)}`,
            )
            .join(" "),
        }))
      : [];

    const long = span >= 240;
    const xTicks = Array.from({ length: 6 }, (_, i) => {
      const t = t0 + (span * i) / 5;
      const c = caseClock(t);
      return { x: x(t), label: long ? c.hhmm : c.hhmmss.slice(3) };
    });

    const critical = history.find((v) => v.map < 60);
    const alertX = critical ? x(critical.t) : null;

    return { paths, xTicks, alertX, nowX: x(tNow), projPaths };
  }, [history, projection]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
    >
      {TICKS.map((t) => (
        <g key={t}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yMain(t)}
            y2={yMain(t)}
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
          <text
            x={PAD_L - 8}
            y={yMain(t) + 3.5}
            textAnchor="end"
            fontSize="10"
            fill="var(--text-lo)"
            className="font-mono"
          >
            {t}
          </text>
        </g>
      ))}

      {/* tramo de inestabilidad */}
      {alertX !== null && !projection && (
        <rect
          x={alertX}
          y={PAD_T}
          width={W - PAD_R - alertX}
          height={H - PAD_T - PAD_B}
          fill="var(--crit)"
          opacity="0.07"
        />
      )}

      {/* zona de futuro: todo lo que está a la derecha de AHORA es simulado */}
      {projection && nowX !== null && (
        <>
          <rect
            x={nowX}
            y={PAD_T}
            width={W - PAD_R - nowX}
            height={H - PAD_T - PAD_B}
            fill="var(--text-hi)"
            opacity="0.03"
          />
          <line
            x1={nowX}
            x2={nowX}
            y1={PAD_T}
            y2={H - PAD_B}
            stroke="var(--text-lo)"
            strokeWidth="1"
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={nowX + 6}
            y={PAD_T + 11}
            fontSize="10"
            fill="var(--text-lo)"
            letterSpacing="1.2"
          >
            AHORA
          </text>
          <text
            x={W - PAD_R - 6}
            y={PAD_T + 11}
            textAnchor="end"
            fontSize="10"
            fill="var(--text-dim)"
            letterSpacing="1.6"
          >
            PROYECTADO · {projection.human.toUpperCase()}
          </text>
        </>
      )}

      {/* series medidas */}
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.color}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* proyección: punteada y tenue. Nunca se confunde con lo medido. */}
      {projPaths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.color}
          strokeWidth="1.5"
          strokeDasharray="5 4"
          opacity="0.6"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {xTicks.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={H - 12}
          textAnchor="middle"
          fontSize="10"
          fill="var(--text-lo)"
          className="font-mono"
        >
          {t.label}
        </text>
      ))}
      <text
        x={(PAD_L + W - PAD_R) / 2}
        y={H - 1}
        textAnchor="middle"
        fontSize="9"
        fill="var(--text-dim)"
        letterSpacing="1.4"
      >
        HORA
      </text>
    </svg>
  );
}

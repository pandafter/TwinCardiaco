"use client";

import { useMemo } from "react";
import { caseClock, type Vitals } from "@/lib/engine";

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
  /** proyecciones what-if: van punteadas y más tenues, nunca como lo medido */
  projections,
}: {
  history: Vitals[];
  projections?: { key: string; color: string; points: [number, number][] }[];
}) {
  const { paths, xTicks, alertX } = useMemo(() => {
    if (history.length < 2) return { paths: [], xTicks: [], alertX: null };

    const t0 = history[0].t;
    const t1 = history[history.length - 1].t;
    const span = Math.max(1, t1 - t0);
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

    // con ventanas cortas hh:mm colapsa en el mismo minuto repetido
    const long = span >= 240;
    const xTicks = Array.from({ length: 6 }, (_, i) => {
      const t = t0 + (span * i) / 5;
      const c = caseClock(t);
      return { x: x(t), label: long ? c.hhmm : c.hhmmss.slice(3) };
    });

    // banda del tramo crítico, no de toda la inestabilidad
    const critical = history.find((v) => v.map < 60);
    const alertX = critical ? x(critical.t) : null;

    return { paths, xTicks, alertX };
  }, [history]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
    >
      {/* rejilla */}
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
      {alertX !== null && (
        <rect
          x={alertX}
          y={PAD_T}
          width={W - PAD_R - alertX}
          height={H - PAD_T - PAD_B}
          fill="var(--crit)"
          opacity="0.07"
        />
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

      {/* proyecciones: punteadas, tenues y rotuladas. Nunca como lo medido. */}
      {projections?.map((p) => (
        <path
          key={p.key}
          d={p.points
            .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px} ${py}`)
            .join(" ")}
          fill="none"
          stroke={p.color}
          strokeWidth="1.4"
          strokeDasharray="5 4"
          opacity="0.55"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* eje X */}
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

"use client";

import { SCENARIO_META, type ScenarioResult } from "@/lib/scenarios";

const W = 1180;
const H = 420;
const PAD_L = 74;
const PAD_R = 205;
const PAD_T = 22;
const PAD_B = 46;

const MIN_FROM = -10;
const MIN_TO = 30;

const x = (min: number) =>
  PAD_L + ((min - MIN_FROM) / (MIN_TO - MIN_FROM)) * (W - PAD_L - PAD_R);
const y = (index: number) =>
  PAD_T + ((3 - index) / 6) * (H - PAD_T - PAD_B);

const END_LABEL: Record<string, string> = {
  none: "CRÍTICO",
  inotrope: "ESTABILIZANDO",
  vasopressor: "RESPUESTA PARCIAL",
};

/**
 * Las tres decisiones sobre el mismo eje. Todas parten de 0 en el punto de
 * decisión: es lo que permite leer la diferencia de un vistazo.
 *
 * El tramo ya transcurrido va sólido y lo que queda por delante, punteado.
 */
export function ComparisonChart({ results }: { results: ScenarioResult[] }) {
  const path = (pts: { min: number; index: number }[]) =>
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.min).toFixed(1)} ${y(p.index).toFixed(1)}`)
      .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      {[3, 2, 1, 0, -1, -2, -3].map((v) => (
        <g key={v}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray={v === 0 ? undefined : "3 6"}
            opacity={v === 0 ? 0.9 : 0.6}
          />
          <text
            x={PAD_L - 12}
            y={y(v) + 5}
            textAnchor="end"
            fontSize="16"
            fill="var(--text-lo)"
            className="font-mono"
          >
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      <text
        x={22}
        y={H / 2}
        fontSize="14"
        fill="var(--text-dim)"
        letterSpacing="1.6"
        transform={`rotate(-90 22 ${H / 2})`}
        textAnchor="middle"
      >
        ÍNDICE FISIOLÓGICO
      </text>

      {/* punto de decisión */}
      <line x1={x(0)} y1={PAD_T} x2={x(0)} y2={H - PAD_B} stroke="var(--info)" strokeWidth="1.4" />
      <rect x={x(0) - 52} y={PAD_T - 4} width="104" height="26" rx="5" fill="var(--bg-card)" stroke="var(--line-strong)" />
      <text x={x(0)} y={PAD_T + 14} textAnchor="middle" fontSize="15" fill="var(--text-hi)" letterSpacing="1">
        DECISIÓN
      </text>
      <circle cx={x(0)} cy={y(0)} r="6" fill="var(--info)" />

      {/* lo ocurrido antes de decidir es el mismo para las tres ramas: se
          dibuja una sola vez y en neutro, para que no parezca que ya diverge */}
      {results.length > 0 && (
        <path
          d={path(results[0].points.filter((p) => p.min <= 0))}
          fill="none"
          stroke="var(--text-lo)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {results.map((r) => {
        const meta = SCENARIO_META[r.key];
        const solid = r.points.filter((p) => !p.projected && p.min >= 0);
        const dashed = r.points.filter((p) => p.projected);
        const bridge = solid.length ? [solid[solid.length - 1], ...dashed] : dashed;
        const end = r.points[r.points.length - 1];
        return (
          <g key={r.key}>
            <path d={path(solid)} fill="none" stroke={meta.color} strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path
              d={path(bridge)}
              fill="none"
              stroke={meta.color}
              strokeWidth="2.4"
              strokeDasharray="2 7"
              strokeLinecap="round"
              opacity="0.75"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={W - PAD_R + 30}
              y={y(end.index) + 5}
              fontSize="14"
              fill={meta.color}
              letterSpacing="0.4"
            >
              {END_LABEL[r.key]}
            </text>
          </g>
        );
      })}

      {[-10, -5, 0, 5, 10, 15, 20, 25, 30].map((m) => (
        <text
          key={m}
          x={x(m)}
          y={H - 18}
          textAnchor="middle"
          fontSize="16"
          fill="var(--text-lo)"
          className="font-mono"
        >
          {m === 0 ? "DECISIÓN" : `${m > 0 ? "+" : ""}${m} min`}
        </text>
      ))}
    </svg>
  );
}

"use client";

import { SCENARIOS } from "@/lib/agents";

const W = 260;
const H = 110;
const NOW = 72; // px donde termina lo medido y empieza la proyección

/**
 * Trayectorias proyectadas de cada escenario.
 *
 * Regla del proyecto: lo simulado nunca se ve como lo medido. El tramo pasado
 * va sólido; todo lo que está a la derecha de "Ahora" va punteado, más tenue
 * y rotulado PROYECTADO.
 */
export function ScenarioChart() {
  const mid = H / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      {/* tramo medido, común a los tres escenarios */}
      <path
        d={`M4 ${mid + 6} C24 ${mid + 4} 44 ${mid + 2} ${NOW} ${mid}`}
        fill="none"
        stroke="var(--text-lo)"
        strokeWidth="1.5"
      />

      {/* separador: aquí termina lo que se midió */}
      <line
        x1={NOW}
        y1="8"
        x2={NOW}
        y2={H - 20}
        stroke="var(--line-strong)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <text x={NOW + 4} y="15" fontSize="7" fill="var(--text-dim)" letterSpacing="0.8">
        PROYECTADO
      </text>

      {SCENARIOS.map((s) => {
        const end = mid - s.end;
        return (
          <g key={s.id}>
            <path
              d={`M${NOW} ${mid} C${NOW + 60} ${mid - s.end * 0.35} ${NOW + 110} ${end + s.end * 0.15} ${W - 42} ${end}`}
              fill="none"
              stroke={s.tone}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              opacity="0.75"
            />
            <text
              x={W - 38}
              y={end + 3}
              fontSize="7.5"
              fill={s.tone}
              opacity="0.9"
            >
              {s.end > 10 ? "Mejoría" : s.end < -10 ? "Deterioro" : "Estable"}
            </text>
          </g>
        );
      })}

      {["Ahora", "+5 min", "+10 min", "+15 min"].map((l, i) => (
        <text
          key={l}
          x={NOW + i * ((W - 42 - NOW) / 3)}
          y={H - 6}
          fontSize="7"
          fill="var(--text-dim)"
          textAnchor={i === 0 ? "start" : "middle"}
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

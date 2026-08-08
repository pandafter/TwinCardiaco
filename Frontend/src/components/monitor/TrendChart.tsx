"use client";

import { useMemo } from "react";
import type { Vitals } from "@/lib/engine";
import type { Branch } from "@/lib/whatif";

export const SERIES = [
  { key: "hr", label: "FC (bpm)", human: "Pulso", color: "var(--crit)" },
  { key: "map", label: "MAP (mmHg)", human: "Presión de bombeo", color: "var(--warn)" },
  { key: "spo2", label: "SpO₂ (%)", human: "Oxígeno en sangre", color: "var(--info)" },
  { key: "lactate", label: "Lactato (mmol/L)", human: "Falta de oxígeno", color: "var(--violet)" },
] as const;

const W = 1000;
const H = 260;
const PAD_L = 42;
const PAD_R = 40;
const PAD_T = 12;
const PAD_B = 26;

/** Escala principal 0–180: FC, MAP y SpO₂ comparten rango clínico. */
const yMain = (v: number) =>
  PAD_T + (1 - Math.min(180, Math.max(0, v)) / 180) * (H - PAD_T - PAD_B);
/** El lactato tiene su propia escala (0–6) sobre el 78% inferior. */
const yLact = (v: number) =>
  H - PAD_B - (Math.min(6, Math.max(0, v)) / 6) * (H - PAD_T - PAD_B) * 0.78;

const TICKS = [180, 100, 70, 0];
const LACT_TICKS = [0, 2, 4, 6];

/** mm:ss relativo a "ahora": −2:00, ahora, +1:30. */
function relLabel(dt: number) {
  if (Math.abs(dt) < 8) return "ahora";
  const s = Math.abs(Math.round(dt));
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${dt < 0 ? "−" : "+"}${m}:${r}`;
}

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
    const tEnd = projection ? tNow + projection.points.length : tNow;
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

    // Tiempo RELATIVO a ahora. Un eje que decía "58:26" obligaba a preguntarse
    // qué hora era esa; "−2:00" se entiende sin preguntar nada.
    const xTicks = Array.from({ length: 6 }, (_, i) => {
      const t = t0 + (span * i) / 5;
      return { x: x(t), label: relLabel(t - tNow) };
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
      role="img"
      aria-label="Tendencia de los signos vitales en el tiempo"
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

      {/* eje derecho: el lactato tiene su propia escala y antes no se decía.
          Una línea violeta a media altura no significa nada sin este eje. */}
      {LACT_TICKS.map((t) => (
        <text
          key={t}
          x={W - PAD_R + 8}
          y={yLact(t) + 3.5}
          fontSize="10"
          fill="color-mix(in srgb, var(--violet) 70%, transparent)"
          className="font-mono"
        >
          {t}
        </text>
      ))}
      <text
        x={W - PAD_R + 8}
        y={PAD_T + 4}
        fontSize="8"
        fill="var(--text-dim)"
        letterSpacing="0.6"
      >
        mmol/L
      </text>

      {/* tramo de inestabilidad */}
      {alertX !== null && !projection && (
        <rect
          x={alertX}
          y={PAD_T}
          width={W - PAD_R - alertX}
          height={H - PAD_T - PAD_B}
          fill="var(--crit)"
          opacity="0.06"
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
            opacity="0.035"
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

      {/* Proyección: punteada, tenue y TRAZADA de izquierda a derecha al
          aparecer. El trazo hace evidente que el futuro se está calculando
          ahora, no que estaba dibujado desde antes.

          Se anima una máscara, no el strokeDasharray: el trazo YA es punteado
          y animar su dashoffset movería el patrón en vez de revelarlo. */}
      {projection && nowX !== null && (
        <>
          <defs>
            <clipPath id={`reveal-${projection.key}`}>
              <rect x={nowX} y="0" width="0" height={H}>
                <animate
                  attributeName="width"
                  from="0"
                  to={W - PAD_R - nowX}
                  dur="0.6s"
                  fill="freeze"
                  calcMode="spline"
                  keySplines="0.22 1 0.36 1"
                  keyTimes="0;1"
                />
              </rect>
            </clipPath>
          </defs>
          <g clipPath={`url(#reveal-${projection.key})`}>
            {projPaths.map((p) => (
              <path
                key={p.key}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth="1.6"
                strokeDasharray="5 4"
                opacity="0.78"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </>
      )}

      {xTicks.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={H - 8}
          textAnchor="middle"
          fontSize="10"
          fill={t.label === "ahora" ? "var(--text-mid)" : "var(--text-lo)"}
          className="font-mono"
        >
          {t.label}
        </text>
      ))}
    </svg>
  );
}

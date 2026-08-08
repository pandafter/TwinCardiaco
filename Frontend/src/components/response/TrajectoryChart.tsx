"use client";

import { useMemo } from "react";
import type { Vitals } from "@/lib/engine";

const W = 1200;
const H = 300;
const PAD_L = 20;
const PAD_R = 90;
const PAD_T = 18;
const PAD_B = 34;

/** MAP → altura. 40 mmHg abajo, 100 arriba. */
const y = (map: number) =>
  PAD_T + (1 - (Math.min(100, Math.max(40, map)) - 40) / 60) * (H - PAD_T - PAD_B);

/**
 * Trayectoria del caso partida por la intervención: lo anterior en rojo, lo
 * posterior en verde y la continuación en punteado.
 *
 * Regla del proyecto: lo simulado nunca se ve como lo medido. El tramo
 * proyectado va discontinuo, más tenue y rotulado.
 */
export function TrajectoryChart({
  history,
  interventionAt,
}: {
  history: Vitals[];
  interventionAt: number | null;
}) {
  const { before, after, projected, ivX, ivY, ticks } = useMemo(() => {
    if (history.length < 4)
      return { before: "", after: "", projected: "", ivX: 0, ivY: 0, ticks: [] };

    const t0 = history[0].t;
    const tNow = history[history.length - 1].t;
    // la ventana llega hasta +20 min proyectados, como el eje de la referencia
    const tEnd = tNow + (tNow - (interventionAt ?? t0)) * 1.4 + 30;
    const span = Math.max(1, tEnd - t0);
    const x = (t: number) => PAD_L + ((t - t0) / span) * (W - PAD_L - PAD_R);

    const stride = Math.max(1, Math.floor(history.length / 260));
    const pts = history.filter((_, i) => i % stride === 0);
    const iv = interventionAt ?? tNow;

    const path = (list: Vitals[]) =>
      list
        .map((v, i) => `${i === 0 ? "M" : "L"}${x(v.t).toFixed(1)} ${y(v.map).toFixed(1)}`)
        .join(" ");

    const pre = pts.filter((v) => v.t <= iv);
    const post = pts.filter((v) => v.t >= iv);

    // proyección: mantiene la pendiente reciente y se aplana hacia la meseta
    const last = history[history.length - 1];
    const prev = history[Math.max(0, history.length - 40)];
    const slope = (last.map - prev.map) / Math.max(1, last.t - prev.t);
    const proj: string[] = [`M${x(last.t).toFixed(1)} ${y(last.map).toFixed(1)}`];
    for (let k = 1; k <= 12; k++) {
      const dt = ((tEnd - tNow) / 12) * k;
      const damp = 1 - k / 14; // la mejora se atenúa, no crece sin límite
      proj.push(`L${x(tNow + dt).toFixed(1)} ${y(last.map + slope * dt * damp).toFixed(1)}`);
    }

    const minutes = [-15, -10, -5, 0, 5, 10, 15, 20];
    const ticks = minutes
      .map((m) => ({ m, x: x(iv + m * 60) }))
      .filter((t) => t.x >= PAD_L - 4 && t.x <= W - PAD_R + 4);

    return {
      before: path(pre),
      after: path(post),
      projected: proj.join(" "),
      ivX: x(iv),
      ivY: y(history.find((v) => v.t >= iv)?.map ?? last.map),
      ticks,
    };
  }, [history, interventionAt]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      {/* bandas de estado */}
      <rect x={PAD_L} y={y(100)} width={W - PAD_L - PAD_R} height={y(70) - y(100)} fill="var(--ok)" opacity="0.05" />
      <rect x={PAD_L} y={y(70)} width={W - PAD_L - PAD_R} height={y(55) - y(70)} fill="var(--warn)" opacity="0.05" />
      <rect x={PAD_L} y={y(55)} width={W - PAD_L - PAD_R} height={y(40) - y(55)} fill="var(--crit)" opacity="0.05" />

      {[
        { v: 85, label: "ESTABLE", color: "var(--ok)" },
        { v: 62, label: "MARGEN", color: "var(--text-lo)" },
        { v: 47, label: "CRÍTICO", color: "var(--crit)" },
      ].map((b) => (
        <text key={b.label} x={W - PAD_R + 12} y={y(b.v) + 4} fontSize="16" fill={b.color} letterSpacing="0.8">
          {b.label}
        </text>
      ))}

      <path d={before} fill="none" stroke="var(--crit)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={after} fill="none" stroke="var(--ok)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={projected} fill="none" stroke="var(--ok)" strokeWidth="1.6" strokeDasharray="4 5" opacity="0.6" vectorEffect="non-scaling-stroke" />

      {/* marca de la intervención */}
      <line x1={ivX} y1={PAD_T} x2={ivX} y2={H - PAD_B} stroke="var(--text-lo)" strokeWidth="1" />
      <circle cx={ivX} cy={ivY} r="4.5" fill="var(--bg-page)" stroke="var(--text-hi)" strokeWidth="1.6" />

      {ticks.map((t) => (
        <text key={t.m} x={t.x} y={H - 14} textAnchor="middle" fontSize="17" fill="var(--text-lo)" className="font-mono">
          {t.m === 0 ? "0" : `${t.m > 0 ? "+" : ""}${t.m} min`}
        </text>
      ))}
      <text x={ivX} y={H - 1} textAnchor="middle" fontSize="13" fill="var(--text-dim)" letterSpacing="1.5">
        INTERVENCIÓN
      </text>
    </svg>
  );
}

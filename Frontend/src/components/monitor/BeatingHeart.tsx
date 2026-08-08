"use client";

import { useEffect, useId, useRef } from "react";
import { motion, useAnimationControls } from "motion/react";
import { ATRIA, BODY, CORONARIES, VESSELS } from "@/components/HeartVisual";
import type { Rhythm } from "@/lib/engine";

/** Jitter determinista por latido: en fibrilación los intervalos varían ±25%. */
function jitter(i: number) {
  const x = Math.sin(i * 91.317) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2;
}

/** Mezcla dos colores hex. t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)} ${c(g1, g2)} ${c(b1, b2)})`;
}

/**
 * El corazón del monitor. Late al ritmo real del motor:
 *
 * - el intervalo entre latidos es 60/hr, agendado latido a latido (no con
 *   animation-duration: una duración CSS no permite intervalos irregulares)
 * - cada latido son dos contracciones, una fuerte y una débil 150 ms después
 * - en fibrilación el intervalo varía ±25%
 * - la amplitud es proporcional al volumen sistólico: la bomba débil se
 *   contrae menos, y se ve
 * - el color va de rojo saturado a violáceo apagado según la perfusión
 */
export function BeatingHeart({
  hr,
  rhythm,
  strokeVolume,
  perfusion,
  className,
}: {
  hr: number;
  rhythm: Rhythm;
  strokeVolume: number;
  perfusion: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const controls = useAnimationControls();
  const halo = useAnimationControls();

  // el scheduler lee de refs: no queremos reiniciarlo en cada tick de 250 ms
  const hrRef = useRef(hr);
  const svRef = useRef(strokeVolume);
  const irregularRef = useRef(rhythm === "afib_rvr");
  hrRef.current = hr;
  svRef.current = strokeVolume;
  irregularRef.current = rhythm === "afib_rvr";

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let beat = 0;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      const amp = Math.min(1, Math.max(0.25, svRef.current / 95));
      const lub = 1 + 0.085 * amp;
      const dub = 1 + 0.038 * amp;

      controls.start({
        scale: [1, lub, 1.01, dub, 1],
        transition: { duration: 0.42, times: [0, 0.13, 0.3, 0.42, 1], ease: "easeOut" },
      });
      halo.start({
        scale: [1, 1.06 + 0.05 * amp, 1],
        opacity: [0.5, 0.85, 0.5],
        transition: { duration: 0.5, ease: "easeOut" },
      });

      const rr = 60 / Math.max(30, hrRef.current);
      const interval = irregularRef.current ? rr * (1 + jitter(beat) * 0.25) : rr;
      beat++;
      timer = setTimeout(tick, interval * 1000);
    };

    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [controls, halo]);

  // rojo saturado con buena perfusión → violáceo apagado cuando cae
  const p = Math.min(1, Math.max(0, perfusion));
  const core = mix("#7a2f5c", "#ff5a63", p);
  const deep = mix("#2a0f2e", "#8e1522", p);
  // el cuerpo tira a azul y las coronarias quedan como la red encendida
  const tissue = mix("#152a44", "#3a2436", p);

  return (
    <div className={`relative ${className ?? ""}`}>
      <motion.div
        animate={halo}
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 46%, ${core}55 0%, ${deep}22 42%, transparent 68%)`,
        }}
      />
      <motion.svg
        animate={controls}
        viewBox="0 0 200 224"
        fill="none"
        className="relative h-full w-full"
        style={{ transformOrigin: "50% 52%" }}
      >
        <defs>
          <radialGradient id={`${uid}-fill`} cx="40%" cy="34%" r="84%">
            <stop offset="0%" stopColor={core} stopOpacity="0.72" />
            <stop offset="30%" stopColor={mix("#3d2a4e", "#b8323f", p)} stopOpacity="0.6" />
            <stop offset="62%" stopColor={tissue} stopOpacity="0.72" />
            <stop offset="100%" stopColor="#0a1526" stopOpacity="0.8" />
          </radialGradient>
          <linearGradient id={`${uid}-rim`} x1="12%" y1="0%" x2="88%" y2="100%">
            <stop offset="0%" stopColor="#8ad4ff" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#4a9fd8" stopOpacity="0.16" />
            <stop offset="100%" stopColor={core} stopOpacity="0.5" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* grandes vasos */}
        <g stroke="#2f6f9e" strokeLinecap="round" opacity="0.75">
          {VESSELS.map(([d, w], i) => (
            <path key={i} d={d} strokeWidth={w} />
          ))}
        </g>
        <g stroke="#8ad4ff" strokeLinecap="round" opacity="0.3">
          {VESSELS.map(([d, w], i) => (
            <path key={i} d={d} strokeWidth={Math.max(1.4, w * 0.24)} />
          ))}
        </g>

        {/* masa cardíaca */}
        <g fill={`url(#${uid}-fill)`}>
          {ATRIA.map(([cx, cy, rx, ry, rot], i) => (
            <ellipse
              key={i}
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              transform={`rotate(${rot} ${cx} ${cy})`}
            />
          ))}
          <path d={BODY} />
        </g>
        <path d={BODY} stroke={`url(#${uid}-rim)`} strokeWidth="1.4" fill="none" />

        {/* coronarias encendidas: lo que se ve latir */}
        <g
          stroke={core}
          strokeWidth="1.9"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
          filter={`url(#${uid}-glow)`}
        >
          {CORONARIES.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </motion.svg>
    </div>
  );
}

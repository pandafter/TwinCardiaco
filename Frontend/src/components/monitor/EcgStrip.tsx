"use client";

import { useMemo } from "react";
import type { Rhythm } from "@/lib/engine";

const PX_PER_SEC = 72; // equivale a los 25 mm/s del papel
const H = 100;
const BASE = 62;

/** Un complejo PQRST dibujado sobre `w` px. Sin onda P en fibrilación. */
function beatPath(x: number, w: number, amp: number, withP: boolean) {
  const k = w / 100;
  const p = (n: number) => x + n * k;
  const y = (v: number) => BASE - v * amp;

  const pWave = withP ? `L${p(10)} ${BASE} Q${p(16)} ${y(9)} ${p(22)} ${BASE}` : "";
  return [
    `L${p(6)} ${BASE}`,
    pWave,
    `L${p(31)} ${BASE}`,
    `L${p(34)} ${y(-7)}`, // Q
    `L${p(39)} ${y(46)}`, // R
    `L${p(44)} ${y(-16)}`, // S
    `L${p(48)} ${BASE}`,
    `L${p(58)} ${BASE}`,
    `Q${p(69)} ${y(15)} ${p(80)} ${BASE}`, // T
    `L${p(100)} ${BASE}`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Jitter determinista: los intervalos de la fibrilación son irregulares. */
function jitter(i: number) {
  let x = Math.imul(i + 1, 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  return (x / 0xffffffff - 0.5) * 2;
}

export function EcgStrip({
  hr,
  rhythm,
  amplitude = 1,
  className,
}: {
  hr: number;
  rhythm: Rhythm;
  amplitude?: number;
  className?: string;
}) {
  // regenerar en cada tick haría saltar el trazado: se cuantiza el HR
  const hrQ = Math.round(hr / 5) * 5;
  const irregular = rhythm === "afib_rvr";

  const { d, width, seconds } = useMemo(() => {
    const beats = 14;
    const rr = 60 / Math.max(30, hrQ);
    let x = 0;
    let total = 0;
    let path = `M0 ${BASE}`;
    for (let i = 0; i < beats; i++) {
      const interval = irregular ? rr * (1 + jitter(i) * 0.25) : rr;
      const w = interval * PX_PER_SEC;
      path += " " + beatPath(x, w, amplitude, !irregular);
      x += w;
      total += interval;
    }
    return { d: path, width: x, seconds: total };
  }, [hrQ, irregular, amplitude]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div
        className="flex h-full will-change-transform"
        style={{
          width: width * 2,
          animation: `ecg-scroll ${seconds}s linear infinite`,
        }}
      >
        {[0, 1].map((i) => (
          <svg
            key={i}
            width={width}
            height="100%"
            viewBox={`0 0 ${width} ${H}`}
            preserveAspectRatio="none"
            className="shrink-0"
          >
            <path
              d={d}
              fill="none"
              stroke="var(--crit)"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ))}
      </div>
      {/* desvanecido en los bordes, como la tira de un monitor real */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[var(--bg-card)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--bg-card)] to-transparent" />
    </div>
  );
}

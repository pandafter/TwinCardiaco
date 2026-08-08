"use client";

import { useId } from "react";

/**
 * Silueta con el corazón encendido. El brillo y el tono siguen la perfusión:
 * rojo vivo con buena perfusión, apagado y violáceo cuando cae.
 */
export function BodyDiagram({
  perfusion,
  className,
}: {
  perfusion: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const p = Math.min(1, Math.max(0, perfusion));
  const heart = `hsl(${350 - (1 - p) * 40} ${60 + p * 30}% ${44 + p * 14}%)`;

  return (
    <svg viewBox="0 0 200 150" className={className} fill="none">
      <defs>
        <radialGradient id={`${uid}-h`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={heart} stopOpacity="0.9" />
          <stop offset="55%" stopColor={heart} stopOpacity="0.28" />
          <stop offset="100%" stopColor={heart} stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-b`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <g stroke="#2f6f9e" strokeWidth="1.1" opacity="0.65" strokeLinecap="round">
        {/* cabeza y tronco */}
        <circle cx="72" cy="24" r="11" />
        <path d="M72 35v52M72 42 47 60M72 42l25 18M60 87l-5 44M84 87l5 44" />
        <path d="M47 60l-6 30M97 60l6 30" />
        {/* árbol vascular */}
        <path d="M72 48v34M72 54 60 62M72 54l12 8M66 82l-4 34M78 82l4 34" opacity="0.5" />
      </g>

      {/* halo del corazón */}
      <ellipse
        cx="78"
        cy="55"
        rx="26"
        ry="24"
        fill={`url(#${uid}-h)`}
        filter={`url(#${uid}-b)`}
      />
      <path
        d="M78 48c-3-4-9-3.6-10.4 1-1.2 4 2.6 7.6 6 10.4 1.6 1.4 3 2.6 4.4 4 1.4-1.4 2.8-2.6 4.4-4 3.4-2.8 7.2-6.4 6-10.4-1.4-4.6-7.4-5-10.4-1Z"
        fill={heart}
      />

      {/* trazo de ECG al costado */}
      <path
        d="M118 66h12l4-12 6 26 5-16 4 8h14"
        stroke="var(--crit)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

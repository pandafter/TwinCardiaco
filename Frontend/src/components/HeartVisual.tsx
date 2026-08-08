"use client";

import { useId } from "react";

/** Masa ventricular: ancha arriba, ápex abajo-derecha. Más alta que ancha. */
const BODY =
  "M58 84 C42 100 40 130 52 156 C64 182 86 204 102 214 C110 219 118 215 123 206 C141 180 154 148 156 116 C158 90 144 72 122 68 C98 64 74 70 58 84 Z";

/** Aurículas y orejuela, fusionadas con el cuerpo. */
const ATRIA: [number, number, number, number, number][] = [
  // cx, cy, rx, ry, rot
  [64, 86, 22, 20, -12],
  [134, 80, 20, 18, 10],
  [100, 74, 30, 18, 0],
];

/** Grandes vasos: aorta, tronco pulmonar, cava, ramas. */
const VESSELS: [string, number][] = [
  ["M102 68 C98 40 106 18 124 14 C143 10 154 26 149 44", 9],
  ["M84 68 C77 46 63 32 46 36", 7.5],
  ["M124 64 C130 44 142 32 158 34", 6],
  ["M68 72 C57 54 44 48 30 54", 5.5],
  ["M114 62 C116 46 121 34 131 28", 4.5],
  ["M92 64 C88 48 81 38 71 32", 4],
];

/** Surco interventricular + coronarias. */
const CORONARIES = [
  "M100 74 C106 108 99 150 93 182 C90 196 91 204 95 212",
  "M66 96 C88 110 118 110 142 96",
  "M92 122 C108 134 128 136 146 126",
  "M88 156 C101 167 116 169 128 162",
  "M60 112 C57 132 60 154 69 170",
  "M120 84 C131 96 138 110 141 124",
  "M82 134 C75 146 69 160 67 174",
  "M110 106 C118 122 121 140 121 158",
];

/**
 * Corazón anatómico en SVG. Un único componente para el thumbnail de las
 * tarjetas y para el render grande del panel de detalle: cambia la escala,
 * la intensidad del glow y el detalle de las coronarias.
 */
export function HeartVisual({
  className,
  variant = "thumb",
}: {
  className?: string;
  variant?: "thumb" | "hero";
}) {
  const uid = useId().replace(/:/g, "");
  const hero = variant === "hero";

  return (
    <svg
      className={className}
      viewBox="0 0 200 224"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${uid}-fill`} cx="38%" cy="34%" r="80%">
          <stop offset="0%" stopColor="#ff8386" stopOpacity="0.95" />
          <stop offset="30%" stopColor="#e33a45" stopOpacity="0.86" />
          <stop offset="64%" stopColor="#921622" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#320b13" stopOpacity="0.6" />
        </radialGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff3b4d" stopOpacity={hero ? 0.45 : 0.55} />
          <stop offset="55%" stopColor="#b41c2c" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-rim`} x1="14%" y1="4%" x2="88%" y2="100%">
          <stop offset="0%" stopColor="#ffa8ad" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#e5484d" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ff5a68" stopOpacity="0.4" />
        </linearGradient>
        <filter id={`${uid}-blur`} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation={hero ? 15 : 10} />
        </filter>
        <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>

      {/* halo */}
      <ellipse
        cx="100"
        cy="126"
        rx="88"
        ry="96"
        fill={`url(#${uid}-glow)`}
        filter={`url(#${uid}-blur)`}
      />

      {/* grandes vasos, detrás del cuerpo */}
      <g stroke="#bb3441" strokeLinecap="round" opacity="0.88">
        {VESSELS.map(([d, w], i) => (
          <path key={i} d={d} strokeWidth={w} />
        ))}
      </g>
      <g stroke="#ff9198" strokeLinecap="round" opacity="0.22">
        {VESSELS.map(([d, w], i) => (
          <path key={i} d={d} strokeWidth={Math.max(1.6, w * 0.26)} />
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
      <path
        d={BODY}
        stroke={`url(#${uid}-rim)`}
        strokeWidth={hero ? 1.4 : 1.7}
        fill="none"
      />

      {/* coronarias */}
      <g
        stroke="#ff8f97"
        strokeWidth={hero ? 1.5 : 1.3}
        strokeLinecap="round"
        fill="none"
        opacity={hero ? 0.52 : 0.3}
        filter={hero ? undefined : `url(#${uid}-soft)`}
      >
        {(hero ? CORONARIES : CORONARIES.slice(0, 6)).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* brillo especular sobre el ventrículo izquierdo */}
      <ellipse
        cx="78"
        cy="112"
        rx="26"
        ry="34"
        fill="#ffb0b5"
        opacity={hero ? 0.15 : 0.18}
        filter={`url(#${uid}-blur)`}
        transform="rotate(-16 78 112)"
      />
    </svg>
  );
}

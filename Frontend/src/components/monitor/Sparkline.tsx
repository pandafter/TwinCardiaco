"use client";

/**
 * Serie corta sobre una escala fija, como en la tira de un monitor.
 *
 * La versión anterior era decorativa: una línea sin referencia no dice si el
 * valor está bien o mal, solo que se mueve. Ahora dibuja la **banda normal**
 * detrás, así que de un vistazo se ve si la curva está dentro o fuera —
 * que es la única pregunta que ese gráfico tiene que contestar.
 */
export function Sparkline({
  values,
  min,
  max,
  color,
  width = 88,
  height = 34,
  /** rango fisiológico normal, en unidades del dato */
  band,
}: {
  values: number[];
  min: number;
  max: number;
  color: string;
  width?: number;
  height?: number;
  band?: { lo: number; hi: number };
}) {
  if (values.length < 2) return <svg width={width} height={height} />;

  const span = Math.max(0.0001, max - min);
  const step = width / (values.length - 1);
  const y = (v: number) =>
    height - Math.min(height, Math.max(0, ((v - min) / span) * height));

  const line = values
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${y(v).toFixed(1)}`,
    )
    .join(" ");

  // relleno bajo la curva: da peso visual sin competir con el número
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const id = `spark-${color.replace(/[^a-z]/gi, "")}`;
  const last = y(values[values.length - 1]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {band && (
        <rect
          x="0"
          y={y(band.hi)}
          width={width}
          height={Math.max(1, y(band.lo) - y(band.hi))}
          fill="var(--text-hi)"
          opacity="0.05"
        />
      )}

      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* el punto de "ahora", con un halo que respira */}
      <circle cx={width} cy={last} r="3.2" fill={color} opacity="0.25">
        <animate
          attributeName="r"
          values="2.6;5;2.6"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={width} cy={last} r="1.9" fill={color} />
    </svg>
  );
}

"use client";

/** Serie corta sobre una escala fija, como en la tira de un monitor. */
export function Sparkline({
  values,
  min,
  max,
  color,
  width = 88,
  height = 34,
}: {
  values: number[];
  min: number;
  max: number;
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <svg width={width} height={height} />;

  const span = Math.max(0.0001, max - min);
  const step = width / (values.length - 1);
  const y = (v: number) => height - ((v - min) / span) * height;

  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={y(values[values.length - 1])}
        r="1.8"
        fill={color}
      />
    </svg>
  );
}

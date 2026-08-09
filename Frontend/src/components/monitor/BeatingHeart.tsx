"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useSpring,
} from "motion/react";
import { ATRIA, BODY, CORONARIES, VESSELS } from "@/components/HeartVisual";
import { rhythmLabel, type Rhythm } from "@/lib/engine";
import {
  beatInterval,
  CARDIAC_PATTERN_BEATS,
  cardiacCycle,
  isIrregular,
  QRS_NORMAL_MS,
} from "@/lib/cardiacCycle";

type Transport = "portal" | "sse" | "local" | null;
type MetricKey = "rate" | "stroke" | "flow" | "pressure";
type Phase = "sístole" | "diástole" | "asistolia";

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** Mezcla dos colores hex. t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)} ${c(g1, g2)} ${c(b1, b2)})`;
}

function TelemetryChip({
  label,
  value,
  unit,
  tone,
  selected,
  side,
  position,
  onSelect,
}: {
  label: string;
  value: string;
  unit: string;
  tone: string;
  selected: boolean;
  side: "left" | "right";
  position: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onPointerEnter={onSelect}
      onFocus={onSelect}
      onClick={onSelect}
      className={`group absolute z-20 w-[5.35rem] rounded-lg border px-2 py-1.5 text-left backdrop-blur-md transition-all duration-300 ${position}`}
      style={{
        borderColor: selected
          ? `color-mix(in srgb, ${tone} 62%, transparent)`
          : "var(--line)",
        background: selected
          ? `color-mix(in srgb, ${tone} 12%, rgba(7,12,21,0.88))`
          : "rgba(7,12,21,0.74)",
        boxShadow: selected ? `0 0 22px color-mix(in srgb, ${tone} 16%, transparent)` : "none",
        transform: selected ? "translateY(-1px)" : "none",
      }}
    >
      <span className="block text-[0.48rem] tracking-[0.16em] text-lo">
        {label}
      </span>
      <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.95rem] leading-none font-semibold tabular-nums" style={{ color: tone }}>
        {value}
        <span className="ml-1 text-[0.48rem] font-normal text-dim">{unit}</span>
      </span>
      <span
        aria-hidden
        className={`pointer-events-none absolute top-1/2 h-px w-7 -translate-y-1/2 ${
          side === "left"
            ? "-right-7 bg-gradient-to-r from-line-strong to-transparent"
            : "-left-7 bg-gradient-to-l from-line-strong to-transparent"
        }`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${
          side === "left" ? "-right-[1.9rem]" : "-left-[1.9rem]"
        }`}
        style={{ background: tone, boxShadow: `0 0 9px ${tone}` }}
      />
    </button>
  );
}

/**
 * Gemelo visual conectado a las mismas vitales que llegan por Portal/SSE.
 *
 * - FC y ritmo fijan cada RR y su irregularidad.
 * - el QRS inicia la contracción; la sístole del mismo ciclo la termina.
 * - el volumen sistólico decide cuánto se contrae.
 * - gasto cardiaco decide la velocidad de las partículas en los vasos.
 * - MAP llena el anillo de presión.
 * - SpO₂/perfusión cambian sangre, tejido, brillo y halo.
 */
export function BeatingHeart({
  hr,
  rhythm,
  strokeVolume,
  perfusion,
  map,
  cardiacOutput,
  spo2,
  lactate,
  transport,
  className,
}: {
  hr: number;
  rhythm: Rhythm;
  strokeVolume: number;
  perfusion: number;
  map: number;
  cardiacOutput: number;
  spo2: number;
  lactate: number;
  transport: Transport;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const controls = useAnimationControls();
  const halo = useAnimationControls();
  const [phase, setPhase] = useState<Phase>(
    rhythm === "asystole" ? "asistolia" : "diástole",
  );
  const [activeMetric, setActiveMetric] = useState<MetricKey>("flow");

  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const smoothX = useSpring(tiltX, { stiffness: 170, damping: 22 });
  const smoothY = useSpring(tiltY, { stiffness: 170, damping: 22 });

  // El scheduler lee refs para no reiniciarse con cada frame de datos.
  const hrRef = useRef(hr);
  const svRef = useRef(strokeVolume);
  const rhythmRef = useRef(rhythm);
  useEffect(() => {
    hrRef.current = hr;
    svRef.current = strokeVolume;
    rhythmRef.current = rhythm;
  }, [hr, strokeVolume, rhythm]);

  useEffect(() => {
    let beatTimer: ReturnType<typeof setTimeout>;
    let phaseTimer: ReturnType<typeof setTimeout>;
    let beat = 0;
    let alive = true;
    let cycleStart = performance.now();

    const schedule = () => {
      if (!alive) return;
      const currentRhythm = rhythmRef.current;
      if (currentRhythm === "asystole") {
        controls.set({ scale: 1 });
        halo.set({ scale: 1, opacity: 0.1 });
        setPhase("asistolia");
        cycleStart = performance.now();
        beatTimer = setTimeout(schedule, 200);
        return;
      }

      const hrQ = Math.round(hrRef.current / 5) * 5;
      const interval = beatInterval(
        hrQ,
        beat % CARDIAC_PATTERN_BEATS,
        isIrregular(currentRhythm),
      );
      const cycle = cardiacCycle(
        hrQ,
        currentRhythm,
        0,
        QRS_NORMAL_MS,
        interval,
      );
      let target = cycleStart + cycle.qrsStartMs;
      const now = performance.now();
      if (target < now - 50) {
        cycleStart = now - cycle.qrsStartMs;
        target = now;
      }

      beatTimer = setTimeout(() => {
        if (!alive) return;
        const amp = clamp(svRef.current / 95, 0.25, 1);
        const lub = 1 + 0.095 * amp;
        const dub = 1 + 0.042 * amp;
        const duration = cycle.systoleMs / 1000;

        setPhase("sístole");
        clearTimeout(phaseTimer);
        phaseTimer = setTimeout(() => {
          if (alive) setPhase("diástole");
        }, cycle.systoleMs);

        controls.start({
          scale: [1, lub, 1.008, dub, 1],
          transition: {
            duration,
            times: [0, 0.18, 0.48, 0.7, 1],
            ease: "easeOut",
          },
        });
        halo.start({
          scale: [1, 1.08 + 0.06 * amp, 1],
          opacity: [0.32, 0.82, 0.32],
          transition: { duration, ease: "easeOut" },
        });

        cycleStart += interval * 1000;
        beat += 1;
        schedule();
      }, Math.max(0, target - now));
    };

    schedule();
    return () => {
      alive = false;
      clearTimeout(beatTimer);
      clearTimeout(phaseTimer);
    };
  }, [controls, halo]);

  const p = clamp(perfusion, 0, 1);
  const oxygenation = clamp((spo2 - 82) / 18, 0, 1);
  const core = mix("#77305d", "#ff5a63", p);
  const deep = mix("#25102f", "#8e1522", p);
  const tissue = mix("#13233d", "#462736", p);
  const blood = mix("#6550a8", "#ff5864", oxygenation);
  const pressureTone = map < 65 ? "var(--crit)" : map < 75 ? "var(--warn)" : "var(--ok)";
  const flowTone = cardiacOutput < 3.5 ? "var(--crit)" : cardiacOutput < 4.5 ? "var(--warn)" : "var(--info)";
  const rateTone = hr > 120 ? "var(--crit)" : hr > 100 ? "var(--warn)" : "var(--ok)";
  const strokeTone = strokeVolume < 45 ? "var(--crit)" : strokeVolume < 60 ? "var(--warn)" : "var(--ok)";
  const pressureProgress = clamp(map / 110, 0, 1);
  const circumference = 2 * Math.PI * 91;
  const flat = rhythm === "asystole";
  const flowDuration = clamp((60 / Math.max(35, hr)) * (5.2 / Math.max(2, cardiacOutput)), 0.32, 1.6);

  const metrics: Array<{
    key: MetricKey;
    label: string;
    value: string;
    unit: string;
    tone: string;
    side: "left" | "right";
    position: string;
    description: string;
  }> = [
    {
      key: "rate",
      label: "FRECUENCIA",
      value: `${Math.round(hr)}`,
      unit: "lpm",
      tone: rateTone,
      side: "left",
      position: "top-[18%] left-1",
      description: `FC ${Math.round(hr)}: define el intervalo RR y el ritmo visible.`,
    },
    {
      key: "stroke",
      label: "CONTRACCIÓN",
      value: `${Math.round(strokeVolume)}`,
      unit: "mL",
      tone: strokeTone,
      side: "right",
      position: "top-[18%] right-1",
      description: `VS ${Math.round(strokeVolume)} mL: controla la amplitud de cada contracción.`,
    },
    {
      key: "flow",
      label: "FLUJO",
      value: cardiacOutput.toFixed(1),
      unit: "L/min",
      tone: flowTone,
      side: "left",
      position: "bottom-[22%] left-1",
      description: `GC ${cardiacOutput.toFixed(1)} L/min: acelera las partículas por los grandes vasos.`,
    },
    {
      key: "pressure",
      label: "PRESIÓN",
      value: `${Math.round(map)}`,
      unit: "mmHg",
      tone: pressureTone,
      side: "right",
      position: "right-1 bottom-[22%]",
      description: `MAP ${Math.round(map)} mmHg: llena el anillo de presión alrededor del corazón.`,
    },
  ];
  const selected = metrics.find((metric) => metric.key === activeMetric) ?? metrics[2];
  const transportLabel =
    transport === "portal"
      ? "PORTAL · SINCRONIZADO"
      : transport === "sse"
        ? "SSE · RESPALDO"
        : "MOTOR LOCAL";
  const transportTone =
    transport === "portal" ? "var(--ok)" : transport === "sse" ? "var(--warn)" : "var(--text-lo)";

  return (
    <div
      className={`group relative isolate overflow-hidden rounded-xl ${className ?? ""}`}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        tiltY.set(((event.clientX - rect.left) / rect.width - 0.5) * 8);
        tiltX.set(-((event.clientY - rect.top) / rect.height - 0.5) * 7);
      }}
      onPointerLeave={() => {
        tiltX.set(0);
        tiltY.set(0);
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 44%, ${core}24 0%, ${deep}14 34%, transparent 68%), linear-gradient(180deg, rgba(12,23,39,0.2), rgba(4,8,15,0.5))`,
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
        <span
          className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[0.47rem] tracking-[0.13em] backdrop-blur-md"
          style={{ borderColor: `color-mix(in srgb, ${transportTone} 38%, transparent)`, color: transportTone }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: transportTone, boxShadow: `0 0 9px ${transportTone}` }} />
          {transportLabel}
        </span>
      </div>

      {metrics.map((metric) => (
        <TelemetryChip
          key={metric.key}
          label={metric.label}
          value={metric.value}
          unit={metric.unit}
          tone={metric.tone}
          side={metric.side}
          position={metric.position}
          selected={activeMetric === metric.key}
          onSelect={() => setActiveMetric(metric.key)}
        />
      ))}

      <motion.div
        className="absolute inset-x-[12%] top-[9%] bottom-[14%] z-10"
        style={{ rotateX: smoothX, rotateY: smoothY, transformPerspective: 720 }}
      >
        <motion.div
          animate={halo}
          className="absolute inset-[6%] rounded-full"
          style={{ background: `radial-gradient(circle at 50% 48%, ${core}58 0%, ${deep}24 44%, transparent 70%)` }}
        />
        <motion.svg
          animate={controls}
          viewBox="0 0 200 224"
          fill="none"
          className="relative h-full w-full drop-shadow-[0_18px_28px_rgba(0,0,0,0.42)]"
          style={{ transformOrigin: "50% 52%" }}
        >
          <defs>
            <radialGradient id={`${uid}-fill`} cx="40%" cy="34%" r="84%">
              <stop offset="0%" stopColor={core} stopOpacity="0.82" />
              <stop offset="30%" stopColor={mix("#3d2a4e", "#c43543", p)} stopOpacity="0.72" />
              <stop offset="62%" stopColor={tissue} stopOpacity="0.78" />
              <stop offset="100%" stopColor="#071323" stopOpacity="0.9" />
            </radialGradient>
            <linearGradient id={`${uid}-rim`} x1="12%" y1="0%" x2="88%" y2="100%">
              <stop offset="0%" stopColor="#a5ddff" stopOpacity="0.62" />
              <stop offset="55%" stopColor="#4a9fd8" stopOpacity="0.2" />
              <stop offset="100%" stopColor={core} stopOpacity="0.68" />
            </linearGradient>
            <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* MAP: anillo periférico llenado por el dato vivo. */}
          <circle cx="100" cy="112" r="91" stroke="rgba(255,255,255,0.055)" strokeWidth="1.5" />
          <motion.circle
            cx="100"
            cy="112"
            r="91"
            fill="none"
            stroke={pressureTone}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: circumference * (1 - pressureProgress) }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            transform="rotate(-90 100 112)"
            opacity="0.7"
          />

          {/* Grandes vasos y partículas cuya velocidad sale del gasto. */}
          <g stroke="#2f6f9e" strokeLinecap="round" opacity="0.82">
            {VESSELS.map(([d, width], index) => (
              <path key={index} d={d} strokeWidth={width} />
            ))}
          </g>
          <g stroke={blood} strokeLinecap="round" fill="none" filter={`url(#${uid}-glow)`}>
            {VESSELS.map(([d, width], index) => (
              <motion.path
                key={index}
                d={d}
                strokeWidth={Math.max(1.2, width * 0.22)}
                strokeDasharray="2 8"
                animate={flat ? { opacity: 0.12 } : { strokeDashoffset: [0, -20], opacity: [0.35, 0.95, 0.35] }}
                transition={{ duration: flowDuration, repeat: Infinity, ease: "linear", delay: index * 0.06 }}
              />
            ))}
          </g>

          <g fill={`url(#${uid}-fill)`}>
            {ATRIA.map(([cx, cy, rx, ry, rotation], index) => (
              <ellipse key={index} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rotation} ${cx} ${cy})`} />
            ))}
            <path d={BODY} />
          </g>
          <path d={BODY} stroke={`url(#${uid}-rim)`} strokeWidth="1.65" fill="none" />

          {/* Coronarias: su brillo representa perfusión, no decoración. */}
          <g stroke={core} strokeWidth="2" strokeLinecap="round" fill="none" filter={`url(#${uid}-glow)`}>
            {CORONARIES.map((d, index) => (
              <motion.path
                key={index}
                d={d}
                strokeDasharray="3 5"
                animate={flat ? { opacity: 0.1 } : { strokeDashoffset: [0, -16], opacity: [0.48 + p * 0.2, 0.72 + p * 0.25, 0.48 + p * 0.2] }}
                transition={{ duration: Math.max(0.45, flowDuration * 1.25), repeat: Infinity, ease: "linear", delay: index * 0.05 }}
              />
            ))}
          </g>
        </motion.svg>
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[13%] z-20 flex justify-center">
        <span
          className="rounded-full border px-2.5 py-1 text-[0.5rem] font-medium tracking-[0.14em] backdrop-blur-md"
          style={{
            borderColor: flat ? "color-mix(in srgb, var(--crit) 50%, transparent)" : "var(--line-strong)",
            color: flat ? "var(--crit)" : phase === "sístole" ? core : "var(--text-mid)",
            background: "rgba(6,11,20,0.74)",
          }}
        >
          {phase.toUpperCase()} · {rhythmLabel(rhythm).toUpperCase()}
        </span>
      </div>

      <div className="absolute inset-x-3 bottom-2 z-20 flex items-center justify-center">
        <motion.div
          key={activeMetric}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[15rem] rounded-md border border-line bg-[rgba(7,12,21,0.78)] px-2.5 py-1 text-center text-[0.48rem] leading-[1.45] text-lo backdrop-blur-md"
        >
          {selected.description}
          <span className="ml-1 text-dim">Perfusión {Math.round(p * 100)}% · lactato {lactate.toFixed(1)}</span>
        </motion.div>
      </div>
    </div>
  );
}

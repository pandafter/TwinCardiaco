"use client";

import { useMemo } from "react";
import type { Rhythm } from "@/lib/engine";

/**
 * Velocidad de barrido. A 72 px/s cabían 14 latidos y a 155 lpm cada
 * complejo medía 28 px: la depresión del ST y la T invertida existían en el
 * path pero no se veían. Una morfología que no se lee es una morfología que
 * no está. A 128 px/s se ven ~7 latidos, con sitio para distinguirlos.
 */
const PX_PER_SEC = 128;
const BEATS = 10;
const H = 100;
const BASE = 62;

/**
 * Un complejo PQRST dibujado sobre `w` px.
 *
 * MORFOLOGÍA PROGRESIVA
 * ---------------------
 * Antes el trazado solo cambiaba de velocidad: el ECG de un paciente en
 * shock se veía idéntico al de uno sano, solo más rápido. Eso es justo lo
 * que un médico mira primero y lo que delataba que detrás no había nada.
 *
 * `ischemia` (0→1) recorre los hallazgos que aparecen de verdad cuando el
 * corazón trabaja sin el oxígeno que necesita, y en el orden en que
 * aparecen:
 *
 *   - depresión del segmento ST — isquemia subendocárdica por demanda:
 *     el músculo que peor se irriga es la capa interna, y el ST desciende
 *     por debajo de la línea de base;
 *   - onda T que se aplana y luego se invierte — repolarización alterada;
 *   - bajo voltaje del QRS — la despolarización pierde amplitud;
 *   - QT alargado — la repolarización tarda más en completarse.
 *
 * Es morfología de libro, no una animación decorativa. Y sigue siendo
 * PRESENTACIÓN: el valor de isquemia viene de la perfusión que calcula el
 * motor, aquí solo se dibuja.
 */
function beatPath(
  x: number,
  w: number,
  amp: number,
  withP: boolean,
  ischemia: number,
) {
  const k = w / 100;
  const p = (n: number) => x + n * k;
  const y = (v: number) => BASE - v * amp;

  // El ST se hunde progresivamente. 9 unidades a isquemia plena es una
  // depresión marcada pero legible a este tamaño.
  const st = -9 * ischemia;
  // La T se aplana (isquemia 0.45) y a partir de ahí se invierte.
  const tPeak = 15 - 30 * ischemia;
  // Bajo voltaje: el QRS pierde hasta un 35% de amplitud.
  const r = 46 * (1 - 0.35 * ischemia);
  const s = -16 * (1 - 0.3 * ischemia);
  // QT largo: la T se desplaza hacia la derecha y se ensancha.
  const tStart = 58 + 6 * ischemia;
  const tMid = 69 + 8 * ischemia;
  const tEnd = 80 + 10 * ischemia;

  const pWave = withP ? `L${p(10)} ${BASE} Q${p(16)} ${y(9)} ${p(22)} ${BASE}` : "";

  return [
    `L${p(6)} ${BASE}`,
    pWave,
    `L${p(31)} ${BASE}`,
    `L${p(34)} ${y(-7)}`, // Q
    `L${p(39)} ${y(r)}`, // R
    `L${p(44)} ${y(s)}`, // S
    `L${p(48)} ${y(st)}`, // punto J — aquí empieza la depresión del ST
    `L${p(tStart)} ${y(st)}`, // segmento ST deprimido
    `Q${p(tMid)} ${y(st + tPeak)} ${p(tEnd)} ${BASE}`, // onda T
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

/** Los hallazgos presentes ahora mismo, para rotularlos junto al trazado. */
export function ecgFindings(ischemia: number, rhythm: Rhythm): string[] {
  if (rhythm === "asystole") return ["Asistolia"];
  const out: string[] = [];
  if (rhythm === "sinus_tach") out.push("Taquicardia sinusal");
  if (rhythm === "afib_rvr") out.push("FA con respuesta rápida");
  if (ischemia > 0.25) out.push("Descenso del ST");
  if (ischemia > 0.45) out.push("Onda T invertida");
  if (ischemia > 0.6) out.push("Bajo voltaje");
  return out.length ? out : ["Sin alteraciones"];
}

export function EcgStrip({
  hr,
  rhythm,
  amplitude = 1,
  /** 0 = trazado normal, 1 = isquemia marcada. Viene de la perfusión. */
  ischemia = 0,
  className,
}: {
  hr: number;
  rhythm: Rhythm;
  amplitude?: number;
  ischemia?: number;
  className?: string;
}) {
  // regenerar en cada tick haría saltar el trazado: se cuantiza el HR y
  // también la isquemia, en pasos del 5%
  const hrQ = Math.round(hr / 5) * 5;
  const ischQ = Math.round(Math.min(1, Math.max(0, ischemia)) * 20) / 20;
  const irregular = rhythm === "afib_rvr";
  const flat = rhythm === "asystole";

  const { d, width, seconds } = useMemo(() => {
    const beats = BEATS;
    const rr = 60 / Math.max(30, hrQ);
    let x = 0;
    let total = 0;
    let path = `M0 ${BASE}`;
    for (let i = 0; i < beats; i++) {
      const interval = irregular ? rr * (1 + jitter(i) * 0.25) : rr;
      const w = interval * PX_PER_SEC;
      path += " " + beatPath(x, w, amplitude, !irregular, ischQ);
      x += w;
      total += interval;
    }
    return { d: path, width: x, seconds: total };
  }, [hrQ, irregular, amplitude, ischQ]);

  // Asistolia: la línea plana. No hay nada que trazar y el silencio del
  // monitor dice más que cualquier número de la pantalla.
  if (flat)
    return (
      <div className={`relative overflow-hidden ${className ?? ""}`}>
        <svg
          viewBox={`0 0 400 ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <line
            x1="0"
            x2="400"
            y1={BASE}
            y2={BASE}
            stroke="var(--crit)"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
            opacity="0.55"
          />
        </svg>
      </div>
    );

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {/* Línea isoeléctrica de referencia: sin ella, un ST deprimido no se
          distingue de un trazado dibujado más abajo. */}
      <svg
        viewBox={`0 0 400 ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <line
          x1="0"
          x2="400"
          y1={BASE}
          y2={BASE}
          stroke="var(--text-hi)"
          strokeWidth="1"
          strokeDasharray="2 6"
          vectorEffect="non-scaling-stroke"
          opacity={ischQ > 0.25 ? 0.18 : 0}
        />
      </svg>

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

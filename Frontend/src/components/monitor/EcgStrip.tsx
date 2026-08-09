"use client";

import { useMemo } from "react";
import type { Rhythm } from "@/lib/engine";
import {
  beatInterval,
  CARDIAC_PATTERN_BEATS,
  cardiacCycle,
  isIrregular,
  QRS_NORMAL_MS,
} from "@/lib/cardiacCycle";
import ecgTemplates from "@/data/ecgTemplates.json";

/**
 * Velocidad de barrido. A 72 px/s cabían 14 latidos y a 155 lpm cada
 * complejo medía 28 px: la depresión del ST y la T invertida existían en el
 * path pero no se veían. Una morfología que no se lee es una morfología que
 * no está. A 128 px/s se ven ~7 latidos, con sitio para distinguirlos.
 */
const PX_PER_SEC = 128;
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
  interval: number,
  hr: number,
  rhythm: Rhythm,
  amp: number,
  ischemia: number,
  qrsMs: number,
) {
  const cycle = cardiacCycle(
    hr,
    rhythm,
    ischemia,
    qrsMs,
    interval,
  );
  const p = (milliseconds: number) =>
    x + (milliseconds / 1000) * PX_PER_SEC;
  const y = (v: number) => BASE - v * amp;

  // El ST se hunde progresivamente. 9 unidades a isquemia plena es una
  // depresión marcada pero legible a este tamaño.
  const st = -9 * ischemia;
  // La T se aplana (isquemia 0.45) y a partir de ahí se invierte.
  const tPeak = 15 - 30 * ischemia;
  // Bajo voltaje: el QRS pierde hasta un 35% de amplitud.
  const r = 46 * (1 - 0.35 * ischemia);
  const qrsStart = cycle.qrsStartMs;
  const qrsEnd = qrsStart + cycle.qrsMs;
  const repolarization = Math.max(60, cycle.qtMs - cycle.qrsMs);
  const tStart = qrsEnd + repolarization * 0.18;
  const tMid = qrsEnd + repolarization * 0.58;
  const tEnd = cycle.tEndMs;
  const pStart = Math.max(8, qrsStart - cycle.prMs + 12);
  const pEnd = Math.min(qrsStart - 12, pStart + cycle.pDurationMs);
  const pPeak = (pStart + pEnd) / 2;
  const pWave = rhythm !== "afib_rvr"
    ? `M${p(pStart)} ${BASE} Q${p(pPeak)} ${y(9)} ${p(pEnd)} ${BASE}`
    : "";

  // Morfología derivada de 180 complejos medianos del MIT-BIH. Se elimina
  // la deriva entre los extremos para que cada QRS vuelva exactamente a la
  // línea isoeléctrica; el motor sigue decidiendo duración y amplitud.
  const template = rhythm === "afib_rvr"
    ? ecgTemplates.templates.afib.points
    : ecgTemplates.templates.normal.points;
  const first = template[0];
  const last = template[template.length - 1];
  const qrsPath = template
    .map((value, index) => {
      const fraction = index / (template.length - 1);
      const baseline = first + (last - first) * fraction;
      const command = index === 0 ? "M" : "L";
      return `${command}${p(qrsStart + cycle.qrsMs * fraction)} ${y((value - baseline) * r)}`;
    })
    .join(" ");

  return [
    `M${x} ${BASE} L${p(cycle.rrMs)} ${BASE}`,
    pWave,
    `M${p(qrsStart - 8)} ${BASE} L${p(qrsStart)} ${BASE}`,
    qrsPath,
    `L${p(qrsEnd)} ${y(st)}`, // J
    `L${p(tStart)} ${y(st)}`, // ST
    `Q${p(tMid)} ${y(st + tPeak)} ${p(tEnd)} ${BASE}`, // onda T
  ]
    .filter(Boolean)
    .join(" ");
}

/** Los hallazgos presentes ahora mismo, para rotularlos junto al trazado. */
export function ecgFindings(
  ischemia: number,
  rhythm: Rhythm,
  qrsMs = QRS_NORMAL_MS,
): string[] {
  if (rhythm === "asystole") return ["Asistolia"];
  const out: string[] = [];
  if (rhythm === "sinus_tach") out.push("Taquicardia sinusal");
  if (rhythm === "afib_rvr") out.push("FA con respuesta rápida");
  if (qrsMs >= 120) out.push(`QRS ancho · ${Math.round(qrsMs)} ms`);
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
  const irregular = isIrregular(rhythm);
  const flat = rhythm === "asystole";

  const { d, width, seconds } = useMemo(() => {
    const beats = CARDIAC_PATTERN_BEATS;
    let x = 0;
    let total = 0;
    let path = `M0 ${BASE}`;
    for (let i = 0; i < beats; i++) {
      const interval = beatInterval(hrQ, i, irregular);
      const w = interval * PX_PER_SEC;
      path += " " + beatPath(
        x,
        interval,
        hrQ,
        rhythm,
        amplitude,
        ischQ,
        QRS_NORMAL_MS,
      );
      x += w;
      total += interval;
    }
    return { d: path, width: x, seconds: total };
  }, [hrQ, rhythm, irregular, amplitude, ischQ]);

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

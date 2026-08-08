import { Engine, type Status } from "./engine";

/**
 * Motor de escenarios "¿qué pasa si...?".
 *
 * Precalcula las ramas ANTES de que el usuario elija: cuando pasa el mouse
 * sobre una intervención, la trayectoria ya está lista y aparece al instante.
 * Ese es el punto — ver el futuro antes de decidirlo, sin esperar a nadie.
 *
 * Todo lo que sale de aquí es PROYECCIÓN, nunca medición. La UI lo dibuja
 * punteado y lo rotula. Y no hay IA en este archivo: el motor calcula el
 * cómo, la IA solo elige el qué y lo explica.
 */

export type BranchKey = "none" | "inotrope" | "vasopressor" | "fluid";

export type Branch = {
  key: BranchKey;
  /** etiqueta en lenguaje humano, la que se lee primero */
  human: string;
  /** nombre técnico, en pequeño */
  tech: string;
  color: string;
  /** puntos proyectados desde el instante de decisión */
  points: { t: number; map: number; lactate: number; co: number; hr: number }[];
  /** estado al final del horizonte */
  finalStatus: Status;
  /** segundos hasta cruzar a crítico dentro del horizonte; null si no cruza */
  timeToCritical: number | null;
  /** variación al final respecto al momento de decidir */
  deltas: { map: number; co: number; lactate: number; hr: number };
  /** lo mismo pero CONTRA no hacer nada: es lo que de verdad se compara */
  vsNone: { map: number; co: number; lactate: number; hr: number };
  /** una frase, sin jerga, de qué pasa en esta rama */
  verdict: string;
  /** efecto escalado (1 = dosis estándar); lo mueven las preguntas */
  efficacy: number;
};

export const BRANCH_META: Record<
  BranchKey,
  { human: string; tech: string; color: string }
> = {
  none: {
    human: "No hacer nada",
    tech: "Solo observar",
    color: "var(--text-lo)",
  },
  inotrope: {
    human: "Reforzar la bomba",
    tech: "Dobutamina · inotrópico",
    color: "var(--ok)",
  },
  vasopressor: {
    human: "Subir la presión",
    tech: "Noradrenalina · vasopresor",
    color: "var(--info)",
  },
  fluid: {
    human: "Dar volumen",
    tech: "Bolo de 500 mL",
    color: "var(--violet)",
  },
};

/** Horizonte de proyección, en segundos de simulación. */
export const HORIZON = 150;

/**
 * Proyecta una rama desde `decisionAt`. Reconstruye el motor hasta ese
 * instante (determinista) y le aplica la intervención.
 *
 * Son ~3000 pasos por las cuatro ramas: milisegundos en JS. Por eso se puede
 * recalcular cada pocos segundos sin que el monitor lo note.
 */
export function projectBranch(
  decisionAt: number,
  key: BranchKey,
  {
    efficacy = 1,
    delay = 0,
    horizon = HORIZON,
    baseline,
  }: {
    efficacy?: number;
    delay?: number;
    horizon?: number;
    /** rama "no hacer nada", contra la que se juzga esta */
    baseline?: Branch["deltas"];
  } = {},
): Branch {
  const meta = BRANCH_META[key];
  // El motor se lleva hasta el instante de decidir SIN intervenir, y la
  // intervención se aplica aquí dentro del bucle. Pasarla al constructor no
  // sirve: su bucle termina en decisionAt - dt, así que la condición
  // `t >= at` nunca se cumple y las cuatro ramas salían idénticas.
  const engine = new Engine(decisionAt);

  // estado en el momento de decidir, para medir las variaciones
  const base = engine.step(0.01).vitals;

  const points: Branch["points"] = [];
  let timeToCritical: number | null = null;
  let finalStatus: Status = "unstable";
  let last = base;

  for (let s = 0; s < horizon; s += 1) {
    if (key !== "none" && engine.interventionAt === null && s >= delay)
      engine.applyIntervention(key, efficacy);
    const frame = engine.step(1);
    const v = frame.vitals;
    last = v;
    finalStatus = frame.assess.status;
    if (timeToCritical === null && frame.assess.status === "critical")
      timeToCritical = s;
    points.push({ t: s, map: v.map, lactate: v.lactate, co: v.co, hr: v.hr });
  }

  const deltas = {
    map: last.map - base.map,
    co: last.co - base.co,
    lactate: last.lactate - base.lactate,
    hr: last.hr - base.hr,
  };

  // Lo que importa no es el cambio absoluto —en un paciente que se deteriora
  // TODAS las ramas empeoran—, sino la diferencia contra no hacer nada. Esa
  // es literalmente la pregunta del producto: mismo paciente, distinta
  // decisión, distinta trayectoria.
  const vs: Branch["deltas"] = baseline
    ? {
        map: deltas.map - baseline.map,
        co: deltas.co - baseline.co,
        lactate: deltas.lactate - baseline.lactate,
        hr: deltas.hr - baseline.hr,
      }
    : { map: 0, co: 0, lactate: 0, hr: 0 };

  return {
    key,
    ...meta,
    points,
    finalStatus,
    timeToCritical,
    deltas,
    vsNone: vs,
    verdict: verdictFor(key, vs, finalStatus, efficacy),
    efficacy,
  };
}

/**
 * El veredicto en una frase, sin jerga. Es lo que un jurado no médico lee
 * para entender la diferencia entre ramas.
 *
 * `d` es la diferencia CONTRA no hacer nada, no contra el estado inicial.
 *
 * La trampa que la demo debe exponer: subir la presión sin mejorar el flujo
 * deja al cuerpo igual de mal. Por eso el veredicto se decide con el lactato
 * —el oxígeno que le llega al cuerpo— y no con la presión, que es el número
 * que todo el mundo mira.
 */
function verdictFor(
  key: BranchKey,
  d: Branch["deltas"],
  status: Status,
  efficacy: number,
): string {
  if (key === "none")
    return status === "critical"
      ? "El paciente llega a estado crítico."
      : "El deterioro continúa sin frenarse.";
  if (efficacy === 0)
    return "Sin efecto: termina igual que si no se hiciera nada.";

  const mejorFlujo = d.co > 0.15;
  const masOxigeno = d.lactate < -0.15;
  const menosOxigeno = d.lactate > 0.15;
  const masPresion = d.map > 2;

  // el caso que hace memorable la demo
  if (masPresion && !mejorFlujo)
    return "Sube la presión, pero no llega más sangre: el número mejora, el paciente no.";
  if (mejorFlujo && masOxigeno)
    return "Llega más sangre y el cuerpo recupera oxígeno.";
  if (mejorFlujo && !menosOxigeno)
    return "Llega más sangre, pero el oxígeno todavía no repunta.";
  if (menosOxigeno)
    return "Empeora: el cuerpo queda con menos oxígeno que sin hacer nada.";
  return "Cambia poco frente a no hacer nada.";
}

/**
 * Las cuatro ramas desde el mismo instante.
 *
 * "No hacer nada" se calcula primero porque es la vara con la que se miden
 * las demás.
 */
export function projectAll(decisionAt: number): Branch[] {
  const none = projectBranch(decisionAt, "none");
  return [
    none,
    ...(["inotrope", "vasopressor", "fluid"] as BranchKey[]).map((k) =>
      projectBranch(decisionAt, k, { baseline: none.deltas }),
    ),
  ];
}

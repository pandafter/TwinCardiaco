import type { BranchKey } from "./whatif";

/**
 * Traduce una pregunta en lenguaje natural a PARÁMETROS DEL MOTOR.
 *
 * Esta es la pieza que justifica la IA en el proyecto: sin ella hay cuatro
 * botones; con ella, cualquier escenario que se le ocurra a quien pregunta.
 *
 *   "¿y si le doy volumen y espero 2 minutos?"
 *   "¿qué pasa si el medicamento no le hace efecto?"
 *   "¿y si le pongo media dosis?"
 *
 * REPARTO DE RESPONSABILIDADES
 * ----------------------------
 * La IA NUNCA calcula fisiología. Solo produce este objeto:
 *
 *   { intervention, efficacy, delay }
 *
 * y el motor determinista hace el resto. Por eso no puede alucinar un
 * número: el espacio de salida es cerrado y está validado aquí.
 *
 * ESTADO ACTUAL
 * -------------
 * Implementado como reglas locales: funciona sin red, sin API key y sin
 * latencia, que es lo que hace falta para ensayar la demo. Cuando el backend
 * esté conectado, `parseQuestion` se reemplaza por una llamada al LLM con
 * structured output del MISMO tipo `Parsed`. Nada más cambia.
 *
 * Si la pregunta se sale del modelo, se dice explícitamente. Reconocer los
 * límites es una ventaja frente a un jurado, no un bache.
 */

export type Parsed =
  | {
      supported: true;
      intervention: BranchKey;
      /** 0 = no hace efecto, 1 = dosis estándar, 1.5 = dosis alta */
      efficacy: number;
      /** segundos de espera antes de aplicar */
      delay: number;
      /** cómo interpretó la pregunta, para mostrárselo al usuario */
      echo: string;
    }
  | { supported: false; reason: string };

/** Sinónimos por rama, incluyendo el lenguaje llano que usaría un no médico. */
const MATCHERS: { key: BranchKey; words: string[] }[] = [
  {
    key: "inotrope",
    words: [
      "dobutamina", "inotropic", "inotrópic", "inotropo", "inotrópo",
      "reforzar", "refuerzo", "fuerza", "contractilidad", "bomba",
    ],
  },
  {
    key: "vasopressor",
    words: [
      "noradrenalina", "norepinefrina", "vasopresor", "presor",
      "subir la presion", "subir la presión", "subo la presion",
      "subo la presión", "vasoconstric",
    ],
  },
  {
    key: "fluid",
    words: [
      "volumen", "liquido", "líquido", "liquidos", "líquidos", "fluido",
      "suero", "bolo", "cristaloide", "hidrat",
    ],
  },
  {
    key: "none",
    words: [
      "nada", "no hago", "no hacer", "no intervengo", "no intervenir",
      "observar", "esperar", "espero", "aguantar",
    ],
  },
];

/** Cosas que la gente pregunta y que este modelo NO simula. */
const OUT_OF_SCOPE: { words: string[]; what: string }[] = [
  { words: ["trombolit", "trombolít", "fibrinolit"], what: "los trombolíticos" },
  { words: ["cateterismo", "angioplast", "stent", "revasculariz"], what: "la revascularización" },
  { words: ["balon", "balón", "ecmo", "asistencia ventricular"], what: "el soporte circulatorio mecánico" },
  { words: ["intubar", "intubacion", "intubación", "ventilacion", "ventilación"], what: "la ventilación mecánica" },
  { words: ["desfibril", "cardiovers", "descarga"], what: "la cardioversión" },
  { words: ["antibiotic", "antibiót"], what: "los antibióticos" },
  { words: ["transfus", "sangre"], what: "la transfusión" },
];

const strip = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function parseQuestion(raw: string): Parsed {
  const q = strip(raw);
  if (q.trim().length < 3)
    return { supported: false, reason: "Escribe una pregunta más completa." };

  // 1) ¿Pide algo que el modelo no simula? Se dice antes de intentar nada.
  for (const o of OUT_OF_SCOPE) {
    if (o.words.some((w) => q.includes(strip(w))))
      return {
        supported: false,
        reason: `Este gemelo no simula ${o.what}. Modela cuatro intervenciones sobre un corazón que falla como bomba: reforzar la bomba, subir la presión, dar volumen o no hacer nada.`,
      };
  }

  // 2) ¿Qué intervención?
  let intervention: BranchKey | null = null;
  for (const m of MATCHERS) {
    if (m.words.some((w) => q.includes(strip(w)))) {
      intervention = m.key;
      break;
    }
  }
  if (!intervention)
    return {
      supported: false,
      reason:
        "No identifiqué qué intervención quieres probar. Prueba con: reforzar la bomba, subir la presión, dar volumen, o no hacer nada.",
    };

  // 3) ¿Con qué eficacia? "no hace efecto" ya está dentro del espacio de
  //    parámetros: es efficacy = 0. No hay que inventar nada.
  let efficacy = 1;
  let doseNote = "";
  if (/no (le )?(hace|hiciera|hizo) efecto|no funciona|no responde|no sirve/.test(q)) {
    efficacy = 0;
    doseNote = ", suponiendo que no le hace efecto";
  } else if (/media dosis|mitad de (la )?dosis|dosis baja|poquito|poca dosis/.test(q)) {
    efficacy = 0.5;
    doseNote = ", a media dosis";
  } else if (/doble dosis|dosis alta|el doble|mas dosis|más dosis/.test(q)) {
    efficacy = 1.5;
    doseNote = ", a dosis alta";
  }

  // 4) ¿Con qué retraso? "en 2 minutos", "dentro de 90 segundos", "espero 3 min"
  let delay = 0;
  const min = q.match(/(\d+)\s*(min|minuto)/);
  const sec = q.match(/(\d+)\s*(seg|segundo)/);
  if (min) delay = parseInt(min[1], 10) * 60;
  else if (sec) delay = parseInt(sec[1], 10);
  delay = Math.min(delay, 120); // más allá del horizonte no aporta nada

  const HUMAN: Record<BranchKey, string> = {
    none: "no hacer nada",
    inotrope: "reforzar la bomba",
    vasopressor: "subir la presión",
    fluid: "dar volumen",
  };

  const delayNote =
    delay > 0
      ? `, esperando ${delay >= 60 ? `${Math.round(delay / 60)} min` : `${delay} s`}`
      : "";

  return {
    supported: true,
    intervention,
    efficacy,
    delay,
    echo: `${HUMAN[intervention]}${doseNote}${delayNote}`,
  };
}

/** Ejemplos que se muestran bajo la caja, para que se sepa qué se puede pedir. */
export const EXAMPLE_QUESTIONS = [
  "¿y si le doy volumen y espero 2 minutos?",
  "¿qué pasa si el medicamento no le hace efecto?",
  "¿y si refuerzo la bomba a media dosis?",
  "¿y si no hago nada?",
];

/**
 * El contrato entre la IA y el motor.
 *
 * LA REGLA QUE HACE QUE ESTO SEA DEFENDIBLE
 * -----------------------------------------
 * El LLM NUNCA emite un número de fisiología. Su espacio de salida es cerrado
 * y está validado por un JSON Schema: elige QUÉ intervención, con qué dosis
 * relativa y con qué retraso. El motor determinista calcula el CÓMO.
 *
 * Por eso el sistema no puede alucinar una presión arterial: no hay ningún
 * campo donde escribirla. Lo único libre que produce el modelo es texto
 * explicativo, y ese texto se muestra como lo que es.
 *
 * `reading` es lo que el modelo lee del estado ACTUAL del paciente. Es la
 * parte que hace que preguntar valga la pena: no traduce la pregunta a
 * parámetros y ya, primero dice qué está pasando ahora mismo.
 */

/** El estado que se le manda al modelo. Solo lo que sale del motor. */
export type PatientSnapshot = {
  t: number;
  hr: number;
  sbp: number;
  dbp: number;
  map: number;
  co: number;
  spo2: number;
  lactate: number;
  perfusion_pct: number;
  filling_pct: number;
  status: string;
  label: string;
  time_to_critical_s: number | null;
  deterioration_risk: number;
  /** intervenciones ya aplicadas, en orden */
  applied: string[];
};

export const INTERVENTIONS = [
  "none",
  "inotrope",
  "vasopressor",
  "fluid",
] as const;

export type AskResult =
  | {
      supported: true;
      intervention: (typeof INTERVENTIONS)[number];
      /** 0 = sin efecto, 1 = dosis estándar, 1.5 = dosis alta */
      efficacy: number;
      /** segundos de espera antes de aplicar */
      delay_s: number;
      /** cómo entendió la pregunta */
      echo: string;
      /** qué le está pasando al paciente AHORA, en lenguaje humano */
      reading: string;
      source: "llm" | "local";
    }
  | {
      supported: false;
      reason: string;
      reading: string;
      source: "llm" | "local";
    };

/**
 * El esquema que la API obliga a cumplir. `supported: false` se expresa con
 * `intervention: "out_of_scope"` para que el espacio siga siendo un enum
 * cerrado — un booleano suelto invita al modelo a rellenar los demás campos
 * con basura.
 */
export const ASK_SCHEMA = {
  type: "object",
  properties: {
    reading: {
      type: "string",
      description:
        "Qué le está pasando al paciente AHORA MISMO, en 1-2 frases, para alguien que no es médico. Usa los números que te dieron y nómbralos en lenguaje llano ('el corazón late a 143 y solo alcanza a llenarse al 31%'). No inventes ningún número que no esté en el estado.",
    },
    intervention: {
      type: "string",
      enum: [...INTERVENTIONS, "out_of_scope"],
      description:
        "Qué intervención quiere probar la pregunta. 'none' si pregunta qué pasa sin hacer nada. 'out_of_scope' si pide algo que este modelo no simula (trombolíticos, cateterismo, ECMO, ventilación, cardioversión, antibióticos, transfusión).",
    },
    efficacy: {
      type: "number",
      description:
        "Efecto relativo: 0 si la pregunta supone que el fármaco no hace efecto, 0.5 a media dosis, 1 a dosis estándar, 1.5 a dosis alta. Usa 1 si no se menciona la dosis.",
    },
    delay_s: {
      type: "integer",
      description:
        "Segundos de espera antes de aplicar, si la pregunta menciona esperar. 0 si no. Máximo 120.",
    },
    echo: {
      type: "string",
      description:
        "Cómo entendiste la pregunta, en pocas palabras y en español: 'reforzar la bomba, a media dosis, esperando 2 min'.",
    },
    reason: {
      type: "string",
      description:
        "Solo si intervention es 'out_of_scope': por qué este modelo no puede simularlo y qué sí puede simular. Cadena vacía en cualquier otro caso.",
    },
  },
  required: ["reading", "intervention", "efficacy", "delay_s", "echo", "reason"],
  additionalProperties: false,
};

/* -------------------------------------------------------------- agentes */

export type AgentKey = "cardiologia" | "fisiologia" | "orchestrator";

export type AgentOpinion = {
  /** el hallazgo en lenguaje humano — esto es lo que se lee primero */
  headline: string;
  /** el mismo hallazgo en términos clínicos */
  technical: string;
  /** a favor / en contra / con reparos */
  stance: string;
  /** qué intervención defiende, si defiende alguna */
  intervention: (typeof INTERVENTIONS)[number] | null;
};

export const AGENT_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description:
        "Tu hallazgo en 2-3 frases, para alguien que NO es médico. Cita los números que te dieron. Nunca inventes una cifra que no esté en el estado.",
    },
    technical: {
      type: "string",
      description:
        "El mismo hallazgo en términos clínicos, una o dos frases, para que un médico vea que está bien hecho.",
    },
    stance: {
      type: "string",
      enum: ["A favor", "En contra", "Con reparos"],
      description: "Tu postura sobre la intervención que defiendes o rechazas.",
    },
    intervention: {
      type: "string",
      enum: [...INTERVENTIONS],
      description:
        "Qué intervención defiendes según tu objetivo. 'none' si tu postura es no intervenir todavía.",
    },
  },
  required: ["headline", "technical", "stance", "intervention"],
  additionalProperties: false,
};

/**
 * El orquestador ve las opiniones de los otros dos y las proyecciones del
 * motor. No promedia: nombra el conflicto y declara con qué criterio decide.
 */
export const ORCHESTRATOR_SCHEMA = {
  type: "object",
  properties: {
    conflict: {
      type: "boolean",
      description:
        "true si los dos especialistas defienden intervenciones distintas, o si la que más sube la presión no es la que más oxígeno devuelve.",
    },
    headline: {
      type: "string",
      description:
        "Si hay conflicto: nómbralo explícitamente (quién defiende qué y por qué se oponen) y declara qué priorizas. Si no lo hay, di hacia dónde apunta todo. 2-4 frases, sin jerga.",
    },
    tiebreak_rule: {
      type: "string",
      description:
        "El criterio con el que desempataste, dicho de forma que se pueda discutir. Cadena vacía si no hubo conflicto.",
    },
    recommendation: {
      type: "string",
      enum: [...INTERVENTIONS],
      description: "La intervención que recomiendas.",
    },
  },
  required: ["conflict", "headline", "tiebreak_rule", "recommendation"],
  additionalProperties: false,
};

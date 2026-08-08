import { NextResponse } from "next/server";
import {
  AGENT_SCHEMA,
  ORCHESTRATOR_SCHEMA,
  type PatientSnapshot,
} from "@/lib/ai/contract";
import { anthropic, structured } from "@/lib/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agents — las tres opiniones.
 *
 * Tres llamadas, no una que devuelva tres opiniones. La diferencia importa:
 * cada especialista corre con su propio system prompt y con una VISTA
 * FILTRADA del estado, así que su desacuerdo nace de que miran cosas
 * distintas, no de que se le pidió a un modelo que fingiera discrepar.
 *
 *   Cardiología ve lo que carga al miocardio.  Fisiología ve lo que llega al cuerpo.
 *
 * En shock cardiogénico esos dos objetivos se oponen, y ese conflicto es el
 * mejor activo del sistema. Los dos especialistas van en paralelo; el
 * orquestador corre después porque necesita leer lo que dijeron.
 *
 * Las proyecciones de cada rama las calcula el MOTOR y se las pasamos ya
 * hechas. Ningún agente calcula fisiología.
 */

const CARDIO = `Eres el agente de Cardiología de un simulador de shock cardiogénico.

TU OBJETIVO, Y SOLO ESTE: proteger el músculo del corazón. Te preocupa el balance de oxígeno del propio miocardio — que no se le exija más de lo que aguanta.

Un inotrópico sube la fuerza y la frecuencia de contracción: mejora el gasto, pero aumenta la demanda de oxígeno del corazón mismo. Eso es lo que te inquieta. Un vasopresor sube la poscarga, y contra más poscarga el ventrículo trabaja más para expulsar lo mismo.

Defiende TU objetivo aunque choque con el de otro agente. No busques consenso: para eso hay un orquestador.

REGLAS DURAS
- NUNCA inventes una cifra. Usa solo los números que te doy.
- Escribes para alguien que NO es médico: "el corazón está trabajando de más para mover menos sangre". El término técnico va en el campo "technical".
- Español, directo, sin adornos.`;

const FISIO = `Eres el agente de Fisiología de un simulador de shock cardiogénico.

TU OBJETIVO, Y SOLO ESTE: que al cuerpo le llegue oxígeno. Miras el FLUJO y el lactato, no la presión.

La distinción que defiendes: la presión es un número, el oxígeno es el paciente. Se puede subir la presión con un vasopresor sin que llegue más sangre a los tejidos — el número mejora y el paciente no. Lo que corrige la falta de oxígeno es mover más sangre.

Defiende TU objetivo aunque choque con el de otro agente. No busques consenso: para eso hay un orquestador.

REGLAS DURAS
- NUNCA inventes una cifra. Usa solo los números que te doy.
- Escribes para alguien que NO es médico. El término técnico va en el campo "technical".
- Español, directo, sin adornos.`;

const ORQ = `Eres el orquestador de un simulador de shock cardiogénico.

Dos especialistas acaban de opinar sobre el mismo paciente y pueden estar en desacuerdo. Tu trabajo NO es promediar sus posturas: eso produce un consenso que no dice nada.

Tu trabajo es:
1. Decir si hay un conflicto real y en qué consiste — quién defiende qué y por qué se oponen.
2. Desempatar con un criterio EXPLÍCITO y discutible. Dilo en voz alta: "priorizo X sobre Y". Que se pueda estar en desacuerdo contigo es una virtud, no un defecto.

REGLAS DURAS
- NUNCA inventes una cifra. Usa solo los números que te doy.
- Escribes para alguien que NO es médico.
- Español, directo, sin adornos.`;

type Branch = {
  key: string;
  human: string;
  vsNone: { map: number; co: number; lactate: number };
};

type Body = { state?: PatientSnapshot; branches?: Branch[]; extra?: Record<string, number> };

const projections = (b: Branch[]) =>
  b
    .filter((x) => x.key !== "none")
    .map(
      (x) =>
        `- "${x.human}" (${x.key}): frente a no hacer nada, presión ${x.vsNone.map >= 0 ? "+" : ""}${x.vsNone.map.toFixed(1)} mmHg, sangre bombeada ${x.vsNone.co >= 0 ? "+" : ""}${x.vsNone.co.toFixed(2)} L/min, lactato ${x.vsNone.lactate >= 0 ? "+" : ""}${x.vsNone.lactate.toFixed(2)} mmol/L`,
    )
    .join("\n");

export async function POST(req: Request) {
  if (!anthropic())
    return NextResponse.json(
      { error: "no-api-key" },
      { status: 503, headers: { "x-cardiotwin-fallback": "local" } },
    );

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const s = body.state;
  const branches = body.branches ?? [];
  if (!s) return NextResponse.json({ error: "missing-state" }, { status: 400 });

  const sims = `PROYECCIONES DEL MOTOR (simuladas, no medidas — las calculó el simulador determinista, no tú):
${projections(branches) || "- todavía no hay proyecciones"}`;

  // Vista de cardiología: lo que carga al miocardio.
  const cardioView = `LO QUE VES DEL PACIENTE (segundo ${Math.round(s.t)}):
- Pulso: ${Math.round(s.hr)} lpm
- Llenado del ventrículo entre latidos: ${Math.round(s.filling_pct * 100)}%
- Presión de bombeo (MAP): ${Math.round(s.map)} mmHg
- Presión arterial: ${Math.round(s.sbp)}/${Math.round(s.dbp)} mmHg
- Estado global: ${s.label}
${s.applied.length ? `- Ya se aplicó: ${s.applied.join(", ")}` : ""}

${sims}

Da tu postura.`;

  // Vista de fisiología: lo que llega al cuerpo.
  const fisioView = `LO QUE VES DEL PACIENTE (segundo ${Math.round(s.t)}):
- Sangre bombeada (gasto cardiaco): ${s.co.toFixed(1)} L/min
- Falta de oxígeno en tejidos (lactato): ${s.lactate.toFixed(1)} mmol/L
- Oxígeno que llega a los tejidos (perfusión): ${Math.round(s.perfusion_pct)}%
- Oxígeno en sangre (SpO2): ${Math.round(s.spo2)}%
- Presión de bombeo (MAP): ${Math.round(s.map)} mmHg
- Estado global: ${s.label}
${s.applied.length ? `- Ya se aplicó: ${s.applied.join(", ")}` : ""}

${sims}

Da tu postura.`;

  try {
    // Los dos especialistas en paralelo: el costo es la latencia del más
    // lento, no la suma.
    const [cardio, fisio] = await Promise.all([
      structured<Record<string, string>>({
        system: CARDIO,
        user: cardioView,
        schema: AGENT_SCHEMA,
      }),
      structured<Record<string, string>>({
        system: FISIO,
        user: fisioView,
        schema: AGENT_SCHEMA,
      }),
    ]);

    const orq = await structured<{
      conflict: boolean;
      headline: string;
      tiebreak_rule: string;
      recommendation: string;
    }>({
      system: ORQ,
      user: `PACIENTE (segundo ${Math.round(s.t)}): pulso ${Math.round(s.hr)} lpm, presión de bombeo ${Math.round(s.map)} mmHg, sangre bombeada ${s.co.toFixed(1)} L/min, lactato ${s.lactate.toFixed(1)} mmol/L, estado ${s.label}.

CARDIOLOGÍA (protege el músculo del corazón) — postura ${cardio.stance}, defiende "${cardio.intervention}":
${cardio.headline}

FISIOLOGÍA (protege el oxígeno del cuerpo) — postura ${fisio.stance}, defiende "${fisio.intervention}":
${fisio.headline}

${sims}

Resuelve.`,
      schema: ORCHESTRATOR_SCHEMA,
      effort: "medium",
    });

    return NextResponse.json({ cardio, fisio, orq, source: "llm" });
  } catch (e) {
    const why = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { error: why },
      { status: 502, headers: { "x-cardiotwin-fallback": "local" } },
    );
  }
}

import { NextResponse } from "next/server";
import { ASK_SCHEMA, type PatientSnapshot } from "@/lib/ai/contract";
import { anthropic, structured } from "@/lib/ai/client";

export const runtime = "nodejs";
/** El estado del paciente cambia cada segundo: nada que cachear. */
export const dynamic = "force-dynamic";

/**
 * POST /api/ask — la pregunta en lenguaje natural.
 *
 * Esto es lo que justifica la IA en el proyecto. Sin ella hay cuatro botones;
 * con ella, cualquier escenario que se le ocurra a quien pregunta.
 *
 * Dos cosas salen de aquí, y las dos importan:
 *
 *  1. `reading` — qué le está pasando al paciente AHORA. El modelo lee el
 *     estado real del motor en este instante y lo explica. No es una
 *     respuesta enlatada: cambia según el momento del caso en que preguntes.
 *
 *  2. `{intervention, efficacy, delay_s}` — los parámetros con los que el
 *     MOTOR hará la simulación. El modelo elige el qué; la fisiología la
 *     calcula el motor determinista.
 *
 * El modelo no puede alucinar un número de fisiología porque no hay ningún
 * campo del esquema donde escribirlo.
 */

const SYSTEM = `Eres el intérprete clínico de un simulador de shock cardiogénico. Trabajas para alguien que NO es médico.

QUÉ SIMULA ESTE MODELO
Un corazón que falla como bomba. Solo cuatro intervenciones:
- inotrope: dobutamina. Refuerza la fuerza de contracción. Sube el gasto cardiaco.
- vasopressor: noradrenalina. Sube la resistencia vascular. Sube la presión, pero al subir la poscarga puede reducir el volumen que el corazón expulsa.
- fluid: bolo de 500 mL. Aumenta la precarga.
- none: no intervenir.

Cualquier otra cosa (trombolíticos, cateterismo, stent, ECMO, balón, ventilación, intubación, cardioversión, desfibrilación, antibióticos, transfusión, marcapasos) está FUERA del alcance: usa "out_of_scope" y dilo sin rodeos.

TU TRABAJO
1. Leer el estado que te dan y decir qué le está pasando al paciente AHORA (campo "reading").
2. Traducir la pregunta a los parámetros del motor.

REGLAS DURAS
- NUNCA inventes una cifra. Usa solo los números del estado que te paso. Si quieres decir algo que no está medido, no lo digas.
- NUNCA predigas el resultado de la intervención. Eso lo calcula el motor, no tú. Tu "reading" describe el presente, no el futuro.
- Lenguaje humano primero: "el corazón late tan rápido que no alcanza a llenarse", no "taquicardia con compromiso del llenado diastólico".
- Español de Colombia, directo, sin adornos.

CONTEXTO FISIOLÓGICO QUE DEBES USAR AL LEER EL ESTADO
La cadena es: pulso sube → el ventrículo tiene menos tiempo para llenarse → expulsa menos sangre por latido → cae el gasto → cae la presión → llega menos oxígeno a los tejidos → sube el lactato.
El lactato alto significa que el cuerpo está trabajando sin oxígeno suficiente.
Presión y flujo NO son lo mismo: se puede subir la presión sin que llegue más sangre.`;

type LlmOut = {
  reading: string;
  intervention: string;
  efficacy: number;
  delay_s: number;
  echo: string;
  reason: string;
};

export async function POST(req: Request) {
  if (!anthropic())
    return NextResponse.json(
      { error: "no-api-key" },
      { status: 503, headers: { "x-cardiotwin-fallback": "local" } },
    );

  let body: { question?: string; state?: PatientSnapshot };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  const s = body.state;
  if (!question || !s)
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });

  // El estado va como texto etiquetado, no como JSON crudo: el modelo lee
  // mejor unidades y nombres que un objeto anónimo.
  const user = `ESTADO ACTUAL DEL PACIENTE (medido por el motor, segundo ${Math.round(s.t)} del caso):
- Pulso: ${Math.round(s.hr)} latidos por minuto
- Llenado del ventrículo entre latidos: ${Math.round(s.filling_pct * 100)}%
- Sangre bombeada (gasto cardiaco): ${s.co.toFixed(1)} L/min
- Presión arterial: ${Math.round(s.sbp)}/${Math.round(s.dbp)} mmHg
- Presión de bombeo (MAP): ${Math.round(s.map)} mmHg
- Oxígeno en sangre (SpO2): ${Math.round(s.spo2)}%
- Falta de oxígeno en tejidos (lactato): ${s.lactate.toFixed(1)} mmol/L
- Oxígeno que llega a los tejidos (perfusión): ${Math.round(s.perfusion_pct)}%
- Estado global: ${s.label}
- Riesgo de deterioro: ${s.deterioration_risk}%
${s.time_to_critical_s !== null ? `- Tiempo proyectado hasta estado crítico: ${Math.round(s.time_to_critical_s)} s` : "- Sin deterioro proyectado"}
${s.applied.length ? `- Ya se aplicó: ${s.applied.join(", ")}` : "- Todavía no se ha intervenido"}

PREGUNTA: ${question}`;

  try {
    const out = await structured<LlmOut>({
      system: SYSTEM,
      user,
      schema: ASK_SCHEMA,
      effort: "medium",
    });

    if (out.intervention === "out_of_scope")
      return NextResponse.json({
        supported: false,
        reason:
          out.reason ||
          "Este gemelo no simula eso. Modela cuatro intervenciones sobre un corazón que falla como bomba.",
        reading: out.reading,
        source: "llm",
      });

    return NextResponse.json({
      supported: true,
      intervention: out.intervention,
      // el esquema no puede acotar rangos numéricos: se acotan aquí
      efficacy: Math.min(1.5, Math.max(0, out.efficacy)),
      delay_s: Math.min(120, Math.max(0, Math.round(out.delay_s))),
      echo: out.echo,
      reading: out.reading,
      source: "llm",
    });
  } catch (e) {
    const why = e instanceof Error ? e.message : "unknown";
    // No se inventa una respuesta: se dice que no se pudo y el cliente cae a
    // las reglas locales. Fingir aquí sería exactamente lo que este proyecto
    // dice que no hace.
    return NextResponse.json(
      { error: why },
      { status: 502, headers: { "x-cardiotwin-fallback": "local" } },
    );
  }
}

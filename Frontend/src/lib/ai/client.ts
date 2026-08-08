import Anthropic from "@anthropic-ai/sdk";

/**
 * Cliente compartido de las rutas de IA.
 *
 * La key vive SOLO en el servidor (`ANTHROPIC_API_KEY` en `.env.local`).
 * Nunca se expone al navegador: por eso esto son route handlers y no una
 * llamada desde el componente.
 *
 * Si no hay key, `client` es null y las rutas devuelven 503. El frontend lo
 * interpreta como "usa las reglas locales" y la demo sigue en pie — no se
 * cae, se degrada, igual que con el SSE.
 */

export const MODEL = "claude-opus-5";

let cached: Anthropic | null | undefined;

export function anthropic(): Anthropic | null {
  if (cached !== undefined) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  cached = key ? new Anthropic({ apiKey: key }) : null;
  return cached;
}

/**
 * Una llamada con salida estructurada.
 *
 * `output_config.format` obliga a que la respuesta cumpla el esquema, así que
 * no hace falta parsear texto libre ni reintentar cuando el modelo se
 * despista. El espacio de salida es cerrado: es lo que impide que la IA
 * invente una cifra de fisiología.
 */
export async function structured<T>({
  system,
  user,
  schema,
  effort = "low",
  maxTokens = 3000,
}: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<T> {
  const client = anthropic();
  if (!client) throw new Error("no-api-key");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: {
      effort,
      format: { type: "json_schema", schema },
    },
    messages: [{ role: "user", content: user }],
  });

  // Los clasificadores pueden declinar; hay que mirarlo antes de leer content.
  if (res.stop_reason === "refusal")
    throw new Error("refusal");

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("empty-response");
  return JSON.parse(block.text) as T;
}

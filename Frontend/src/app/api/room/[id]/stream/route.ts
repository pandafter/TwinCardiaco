import { room, type RoomEvent } from "@/lib/session/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/room/{id}/stream — los eventos de la sala, por SSE.
 *
 * Mismo transporte que el stream del paciente: si el navegador ya sabe
 * mantener uno abierto, no hace falta un WebSocket para el otro. La sala
 * manda un latido cada 5 s, que también sirve para que los proxies no
 * corten la conexión por inactividad.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const r = room(id);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (e: RoomEvent) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));

      // Quien llega tarde recibe el estado actual, no solo lo que pase a
      // partir de ahora: si no, entrar a mitad de una propuesta pendiente
      // significaría no verla nunca.
      for (const e of r.snapshot()) send(e);

      const off = r.subscribe(send);
      const beat = setInterval(() => {
        r.prune();
        try {
          controller.enqueue(enc.encode(`: beat\n\n`));
        } catch {
          /* cerrado */
        }
      }, 5000);

      // El cliente cerró la pestaña.
      _req.signal.addEventListener("abort", () => {
        clearInterval(beat);
        off();
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // sin esto, nginx y Vercel bufean el stream y no llega nada
      "x-accel-buffering": "no",
    },
  });
}

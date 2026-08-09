import { MonitorScreen } from "@/components/monitor/MonitorScreen";

/**
 * Sin query params el monitor usa el PACIENTE COMPARTIDO de la sesión:
 * navegar entre pantallas no reinicia el caso, y una intervención aplicada
 * en /interventions se ve aquí.
 *
 * `?t=130` arranca un caso local ya deteriorado y `?freeze=1` detiene el
 * reloj: así el screenshot de diseño sale siempre en el mismo estado.
 *
 * `?sala=uci-3` abre la sesión compartida. Dos personas en la misma sala:
 * una propone la intervención, la otra aprueba o veta, y solo entonces se
 * aplica — en las dos pantallas. Sin el parámetro, nada de eso existe.
 */
export default async function MonitorPage({
  searchParams,
}: PageProps<"/monitor">) {
  const sp = await searchParams;
  const tRaw = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const t = Number(tRaw ?? 0);
  const freeze = (Array.isArray(sp.freeze) ? sp.freeze[0] : sp.freeze) === "1";
  const live = tRaw === undefined && !freeze;
  const salaRaw = Array.isArray(sp.sala) ? sp.sala[0] : sp.sala;
  // El id viaja en la URL y acaba en una clave de servidor: se acota a lo
  // que puede ser un nombre de sala y nada más.
  const sala = salaRaw?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || null;

  return (
    <MonitorScreen
      startAt={Number.isFinite(t) ? t : 0}
      frozen={freeze}
      live={live}
      roomId={sala}
    />
  );
}

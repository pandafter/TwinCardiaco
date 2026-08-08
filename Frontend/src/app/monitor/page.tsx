import { MonitorScreen } from "@/components/monitor/MonitorScreen";

/**
 * Sin query params el monitor usa el PACIENTE COMPARTIDO de la sesión:
 * navegar entre pantallas no reinicia el caso, y una intervención aplicada
 * en /interventions se ve aquí.
 *
 * `?t=130` arranca un caso local ya deteriorado y `?freeze=1` detiene el
 * reloj: así el screenshot de diseño sale siempre en el mismo estado.
 */
export default async function MonitorPage({
  searchParams,
}: PageProps<"/monitor">) {
  const sp = await searchParams;
  const tRaw = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const t = Number(tRaw ?? 0);
  const freeze = (Array.isArray(sp.freeze) ? sp.freeze[0] : sp.freeze) === "1";
  const live = tRaw === undefined && !freeze;

  return (
    <MonitorScreen
      startAt={Number.isFinite(t) ? t : 0}
      frozen={freeze}
      live={live}
    />
  );
}

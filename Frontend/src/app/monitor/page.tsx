import { MonitorScreen } from "@/components/monitor/MonitorScreen";

/**
 * `?t=130` arranca el caso ya deteriorado y `?freeze=1` detiene el reloj:
 * así el screenshot de diseño sale siempre en el mismo estado.
 */
export default async function MonitorPage({
  searchParams,
}: PageProps<"/monitor">) {
  const sp = await searchParams;
  const t = Number(Array.isArray(sp.t) ? sp.t[0] : (sp.t ?? 0));
  const freeze = (Array.isArray(sp.freeze) ? sp.freeze[0] : sp.freeze) === "1";

  return (
    <MonitorScreen
      startAt={Number.isFinite(t) ? t : 0}
      frozen={freeze}
    />
  );
}

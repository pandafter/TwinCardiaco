import { AgentsScreen } from "@/components/agents/AgentsScreen";

/**
 * Sin query params usa el paciente compartido de la sesión.
 * `?t=100&freeze=1` congela un caso local para las capturas de diseño.
 */
export default async function AgentsPage({ searchParams }: PageProps<"/agents">) {
  const sp = await searchParams;
  const tRaw = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const t = Number(tRaw ?? 0);
  const freeze = (Array.isArray(sp.freeze) ? sp.freeze[0] : sp.freeze) === "1";
  const live = tRaw === undefined && !freeze;

  return (
    <AgentsScreen
      startAt={Number.isFinite(t) ? t : 0}
      frozen={freeze}
      live={live}
    />
  );
}

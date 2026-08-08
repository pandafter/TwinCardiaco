import { AgentsScreen } from "@/components/agents/AgentsScreen";

/** `?t=100&freeze=1` congela el caso para las capturas de diseño. */
export default async function AgentsPage({ searchParams }: PageProps<"/agents">) {
  const sp = await searchParams;
  const t = Number(Array.isArray(sp.t) ? sp.t[0] : (sp.t ?? 0));
  const freeze = (Array.isArray(sp.freeze) ? sp.freeze[0] : sp.freeze) === "1";

  return <AgentsScreen startAt={Number.isFinite(t) ? t : 0} frozen={freeze} />;
}

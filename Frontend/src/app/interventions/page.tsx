import { InterventionsScreen } from "@/components/interventions/InterventionsScreen";

/** `?t=100&freeze=1` congela el caso para las capturas de diseño. */
export default async function InterventionsPage({
  searchParams,
}: PageProps<"/interventions">) {
  const sp = await searchParams;
  const t = Number(Array.isArray(sp.t) ? sp.t[0] : (sp.t ?? 0));
  const freeze = (Array.isArray(sp.freeze) ? sp.freeze[0] : sp.freeze) === "1";

  return (
    <InterventionsScreen startAt={Number.isFinite(t) ? t : 0} frozen={freeze} />
  );
}

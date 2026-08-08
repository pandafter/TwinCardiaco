import { CompareScreen } from "@/components/compare/CompareScreen";

/** Mismo paciente, distinta decisión: las tres ramas del punto de decisión. */
export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined, d: string) =>
    (Array.isArray(v) ? v[0] : v) ?? d;

  return (
    <CompareScreen
      decisionAt={Number(one(sp.at, "100"))}
      startAt={Number(one(sp.t, "160"))}
      frozen={one(sp.freeze, "0") === "1"}
    />
  );
}

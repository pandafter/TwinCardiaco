import { ResponseScreen } from "@/components/response/ResponseScreen";

/**
 * Respuesta del paciente a una intervención ya aplicada.
 * `?iv=inotrope&at=100&t=160` elige el fármaco, cuándo se aplicó y hasta
 * dónde avanzar. `freeze=1` congela el reloj para las capturas.
 */
export default async function ResponsePage({ searchParams }: PageProps<"/response">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined, d: string) =>
    (Array.isArray(v) ? v[0] : v) ?? d;

  return (
    <ResponseScreen
      startAt={Number(one(sp.t, "160"))}
      interventionAt={Number(one(sp.at, "100"))}
      interventionKey={one(sp.iv, "inotrope")}
      frozen={one(sp.freeze, "0") === "1"}
    />
  );
}

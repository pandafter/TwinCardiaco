"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { Rhythm } from "@/lib/engine";
import { BeatingHeart } from "./BeatingHeart";

/**
 * El corazón de la VISTA 3D.
 *
 * Reemplazo directo de `BeatingHeart`: mismas props, mismo hueco en el layout.
 * Quien lo use no necesita saber si detrás hay SVG o WebGL.
 *
 * DEGRADACIÓN
 * -----------
 * Si el equipo no tiene WebGL2 —o el contexto se pierde en mitad de la demo,
 * que pasa— cae al corazón 2D en vez de dejar un hueco negro. Perder la demo
 * por un driver de vídeo ajeno sería una forma tonta de perderla.
 */

const HeartCanvas = dynamic(() => import("./heart3d/Canvas"), {
  ssr: false,
  loading: () => <Skeleton />,
});

function Skeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-2/5 w-2/5 animate-pulse rounded-full bg-[#3a1620] opacity-40" />
    </div>
  );
}

/**
 * Soporte de WebGL2, resuelto una sola vez por sesión.
 *
 * Cacheado a propósito: `useSyncExternalStore` llama a `getSnapshot` en cada
 * render y exige que devuelva un valor estable. Crear un `<canvas>` cada vez
 * sería además tirar memoria de GPU por render.
 */
let webglCache: boolean | undefined;

function webglSupported() {
  if (webglCache === undefined) {
    try {
      webglCache = !!document.createElement("canvas").getContext("webgl2");
    } catch {
      webglCache = false;
    }
  }
  return webglCache;
}

/** En el servidor aún no se sabe: `null` mantiene idénticos SSR e hidratación. */
const serverSnapshot = () => null;
const subscribe = () => () => {};

export function Heart3DView({
  hr,
  rhythm,
  strokeVolume,
  perfusion,
  ischemia = 0,
  className,
  hint = true,
}: {
  hr: number;
  rhythm: Rhythm;
  strokeVolume: number;
  perfusion: number;
  ischemia?: number;
  className?: string;
  /** Muestra la pista de "arrastra para girar". */
  hint?: boolean;
}) {
  // null = aún no comprobado (SSR); evita un parpadeo del 2D antes del 3D
  const webgl = useSyncExternalStore(subscribe, webglSupported, serverSnapshot);

  if (webgl === false) {
    return (
      <BeatingHeart
        hr={hr}
        rhythm={rhythm}
        strokeVolume={strokeVolume}
        perfusion={perfusion}
        className={className}
      />
    );
  }

  // `relative` solo si quien nos usa no trajo ya su propio posicionamiento:
  // dos clases de `position` en el mismo elemento se pisan, y la que pierde
  // deja el contenedor sin altura — el Canvas se queda entonces en nada.
  const positioned = /\b(absolute|fixed|sticky|relative)\b/.test(className ?? "");

  return (
    <div className={`${positioned ? "" : "relative"} ${className ?? ""}`}>
      {webgl === null ? (
        <Skeleton />
      ) : (
        <HeartCanvas
          hr={hr}
          rhythm={rhythm}
          strokeVolume={strokeVolume}
          perfusion={perfusion}
          ischemia={ischemia}
        />
      )}

      {hint && webgl && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[0.5rem] tracking-[0.14em] text-dim uppercase opacity-70">
          Arrastra para girar · rueda para acercar
        </div>
      )}
    </div>
  );
}

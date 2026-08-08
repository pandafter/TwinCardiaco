"use client";

import type { ReactNode } from "react";
import { PortalProvider } from "@portalsdk/react";
import { portal, fetchPortalToken } from "@/lib/portal";
import { PortalBridge } from "./PortalBridge";

/**
 * Envuelve la app con el cliente de Portal.
 *
 * Sin `NEXT_PUBLIC_PORTAL_PK` no hay cliente y esto es un passthrough: la
 * pantalla arranca igual y se queda con el SSE. Portal se añade encima del
 * respaldo, no lo sustituye, así que su ausencia no puede tumbar la demo —
 * y en desarrollo se trabaja sin credenciales de Portal, que es como el
 * proyecto pide empezar.
 */
export function Providers({ children }: { children: ReactNode }) {
  if (!portal) return <>{children}</>;

  return (
    <PortalProvider client={portal} token={fetchPortalToken}>
      <PortalBridge />
      {children}
    </PortalProvider>
  );
}

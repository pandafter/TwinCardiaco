"use client";

import type { ReactNode } from "react";
import { PortalProvider } from "@portalsdk/react";
import { fetchPortalToken, portal } from "@/lib/portal";
import { PortalBridge } from "./PortalBridge";

export function Providers({ children }: { children: ReactNode }) {
  if (!portal) return <>{children}</>;
  return (
    <PortalProvider client={portal} token={fetchPortalToken}>
      <PortalBridge />
      {children}
    </PortalProvider>
  );
}


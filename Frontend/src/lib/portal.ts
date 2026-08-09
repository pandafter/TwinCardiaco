"use client";

import { Portal } from "@portalsdk/core";
import { API } from "./live";

export const PORTAL_PK = process.env.NEXT_PUBLIC_PORTAL_PK ?? "";
export const portalEnabled = PORTAL_PK.length > 0;

const SIM_ID = process.env.NEXT_PUBLIC_CARDIOTWIN_SIM_ID ?? "demo";
export const CHANNELS = {
  vitals: `sim:${SIM_ID}:vitals`,
  events: `sim:${SIM_ID}:events`,
  agents: `sim:${SIM_ID}:agents`,
  actions: `sim:${SIM_ID}:actions`,
} as const;

function stableUserId() {
  if (typeof window === "undefined") return "ssr";
  // Identidad de la instancia de página. Algunos navegadores copian
  // sessionStorage al abrir una pestaña con `opener`, lo que fusionaría dos
  // médicos en una sola presencia. El valor de módulo permanece estable
  // durante todas las reconexiones de esta página y cambia al recargar.
  return `medico-${crypto.randomUUID().slice(0, 8)}`;
}

export const userId = stableUserId();
export const displayName =
  process.env.NEXT_PUBLIC_CARDIOTWIN_USER ?? "Equipo de guardia";

const RETRY_COOLDOWN_MS = 15_000;
const REFRESH_MARGIN_MS = 60_000;
const ASSUMED_TTL_MS = 50 * 60_000;

let cached: { token: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;
let cooldownUntil = 0;

async function mintToken() {
  const response = await fetch(`${API}/api/portal/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, display_name: displayName }),
  });
  if (!response.ok) {
    throw new Error(`No se pudo acuñar el token (HTTP ${response.status})`);
  }
  const data = (await response.json()) as {
    token?: string;
    expires_at?: string;
  };
  if (!data.token) throw new Error("El backend no devolvió token de Portal");
  const parsed = data.expires_at ? Date.parse(data.expires_at) : NaN;
  cached = {
    token: data.token,
    expiresAt: Number.isNaN(parsed) ? Date.now() + ASSUMED_TTL_MS : parsed,
  };
  return data.token;
}

export async function fetchPortalToken() {
  if (cached && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) {
    return cached.token;
  }
  if (Date.now() < cooldownUntil) {
    throw new Error("Portal en espera tras un fallo reciente del token");
  }
  if (inFlight) return inFlight;
  inFlight = mintToken()
    .catch((error) => {
      cooldownUntil = Date.now() + RETRY_COOLDOWN_MS;
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export const portal = portalEnabled
  ? new Portal({ apiKey: PORTAL_PK, token: fetchPortalToken })
  : null;

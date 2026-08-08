"use client";

import { Portal } from "@portalsdk/core";
import { API } from "./live";

/**
 * Cliente de Portal.
 *
 * POR QUÉ EL NAVEGADOR NO PUEDE HABLAR SOLO CON PORTAL
 * ----------------------------------------------------
 * Portal tiene tres credenciales y solo una vive aquí:
 *
 *   sk_...  secret key      SOLO servidor. `api.useportal.co` rechaza cualquier
 *                           petición que traiga header `Origin`, así que el
 *                           navegador físicamente no puede usarla.
 *   pk_...  publishable     esta. Segura en el bundle.
 *   JWT     token de usuario acuñado por NUESTRO backend con la sk_.
 *
 * De ahí sale que el servidor sea el único que publica el estado del paciente.
 * Si el navegador pudiera escribir en el canal de vitales, cualquiera
 * falsificaría al paciente y la demo dejaría de ser defendible.
 *
 * El `token` va como CALLBACK, no como string: el SDK lo vuelve a invocar en
 * cada connect, reconnect y expiración. Un string estático no se puede
 * refrescar, y al expirar el canal pasa a `status: "blocked"` sin explicar por
 * qué — de los síntomas más caros de depurar en vivo.
 */

/** Sin pk_ no hay Portal. El front degrada a SSE y se ve en pantalla. */
export const PORTAL_PK = process.env.NEXT_PUBLIC_PORTAL_PK ?? "";
export const portalEnabled = PORTAL_PK.length > 0;

/** Debe coincidir con CARDIOTWIN_SIM_ID del backend. */
const SIM_ID = process.env.NEXT_PUBLIC_CARDIOTWIN_SIM_ID ?? "demo";

/**
 * Los cuatro canales, con la misma convención que `PortalSync.channel()`.
 *
 * Se derivan aquí en vez de esperar la respuesta del token porque `useChannel`
 * los necesita antes de conectar. Si alguna vez dejaran de coincidir con el
 * backend, Portal rechaza el connect —el id no está en la ACL del JWT— y el
 * canal queda en "blocked": se ve, no se corrompe nada.
 */
export const CHANNELS = {
  vitals: `sim:${SIM_ID}:vitals`,
  events: `sim:${SIM_ID}:events`,
  agents: `sim:${SIM_ID}:agents`,
  actions: `sim:${SIM_ID}:actions`,
} as const;

/**
 * Identidad estable por navegador.
 *
 * Persistida para que recargar la página no cuente como un usuario nuevo en la
 * presencia: el requisito de "usuarios conectados" se vuelve mentira si cada
 * F5 infla el contador.
 */
const ID_KEY = "cardiactwin.userId";

function stableUserId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const saved = window.localStorage.getItem(ID_KEY);
    if (saved) return saved;
    const fresh = `medico-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(ID_KEY, fresh);
    return fresh;
  } catch {
    // Modo privado o storage bloqueado: identidad de sesión, no de navegador.
    return `medico-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const userId = stableUserId();

/** Nombre visible. Viaja en `claims.username` del JWT, no en el bundle. */
export const displayName =
  process.env.NEXT_PUBLIC_CARDIOTWIN_USER ?? "Equipo de guardia";

/**
 * Caché del token y freno de reintentos.
 *
 * El SDK re-invoca el callback en cada connect, reconnect y expiración, y los
 * tres canales conectan a la vez. Sin nada de esto, medido con el backend
 * apagado, salían 26 peticiones al endpoint de token en 8 segundos: al lanzar
 * en el fallo el SDK reintenta sin freno. Y en el camino feliz se acuñaban tres
 * JWT para lo que necesita uno.
 *
 * Tres piezas:
 *   - promesa compartida: las llamadas concurrentes esperan la misma petición
 *   - caché hasta la expiración: no se vuelve a acuñar mientras el JWT sirva
 *   - enfriamiento: tras un fallo se rechaza sin tocar la red
 */
const RETRY_COOLDOWN_MS = 15_000;
/** Margen antes de la expiración. Un token que caduca a mitad de sesión deja
 *  el canal en "blocked" sin decir por qué. */
const REFRESH_MARGIN_MS = 60_000;
/** Si el backend no manda expires_at, el TTL por defecto de Portal es 1 h. */
const ASSUMED_TTL_MS = 50 * 60_000;

let cached: { token: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;
let cooldownUntil = 0;

async function mintToken(): Promise<string> {
  const r = await fetch(`${API}/api/portal/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, display_name: displayName }),
  });
  if (!r.ok) {
    throw new Error(`No se pudo acuñar el token de Portal (HTTP ${r.status})`);
  }
  const data: { token?: string; expires_at?: string } = await r.json();
  if (!data.token) throw new Error("El backend no devolvió token de Portal");

  const parsed = data.expires_at ? Date.parse(data.expires_at) : NaN;
  cached = {
    token: data.token,
    expiresAt: Number.isNaN(parsed) ? Date.now() + ASSUMED_TTL_MS : parsed,
  };
  return data.token;
}

/**
 * Pide el JWT a nuestro backend.
 *
 * Lanza si no lo consigue: el SDK trata el rechazo como fallo de autenticación
 * y no deja el canal a medias. Devolver "" haría que Portal intentara conectar
 * con un token vacío, y el error saldría más tarde y peor.
 */
export async function fetchPortalToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) {
    return cached.token;
  }
  if (Date.now() < cooldownUntil) {
    throw new Error("Portal en espera tras un fallo reciente del token");
  }
  if (inFlight) return inFlight;

  inFlight = mintToken()
    .catch((e) => {
      cooldownUntil = Date.now() + RETRY_COOLDOWN_MS;
      throw e;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Instancia única a nivel de módulo.
 *
 * `portal.channel(id)` es lookup-or-create por id, así que dos componentes que
 * miran el mismo canal comparten un solo socket. Crear un cliente por
 * componente abriría un socket por componente.
 */
export const portal = portalEnabled
  ? new Portal({ apiKey: PORTAL_PK, token: fetchPortalToken })
  : null;

# CardiacTwin — Gemelo digital cardíaco en tiempo real

> The Realtime Hackathon by Portal · 7–9 agosto 2026 · Equipo de 3
> Cierre de entregas: **domingo 9 de agosto, 10:00 UTC−5**

Documento maestro del proyecto. Léelo antes de tocar código.
El brief original del hackathon y los TYC están íntegros en [`docs/brief-hackathon.md`](docs/brief-hackathon.md).

---

## 1 · Qué construimos

Un paciente virtual cuyo estado fisiológico cambia en vivo. Se deteriora, varios
agentes de IA lo analizan mientras cambia, discrepan entre ellos, y el usuario
puede simular intervenciones antes de decidir. Cuando decide, el gemelo cambia y
todos los conectados lo ven al instante.

**El pitch en una frase:** *es un simulador de vuelo, pero para decisiones médicas.*

Los pilotos entrenan en simuladores donde se les apaga un motor y practican sin que
muera nadie. En medicina eso no existe: un médico aprende a manejar un paciente que
se está muriendo, manejando pacientes que se están muriendo.

**La frase que tiene que quedar al final de la demo:** *mismo paciente, distinta
decisión, distinta trayectoria.*

**La cadena causal que todo el producto hace visible:**

```
PULSO ↑ → LLENADO ↓ → BOMBEO ↓ → PRESIÓN ↓ → OXÍGENO ↓
```

### Qué hace la IA y qué no

**La IA nunca calcula fisiología.** No decide cuánto baja la presión un medicamento:
eso está en la tabla de `interventions.py`, escrita a mano y validada. Si el modelo
tuviera que producir los números, no corre en tiempo real. La IA hace tres cosas:

1. **Traduce texto a parámetros del motor.** «67 años, hipertenso, cardiopatía
   previa» → estado inicial del paciente (pantalla 2 del wizard).
2. **Interpreta y explica en streaming**, en español de a pie, lo que está pasando.
3. **Responde preguntas en lenguaje natural sobre escenarios.** «¿Y si le doy
   líquidos primero y lo cardiovierto dos minutos después?» → la IA traduce la frase
   a parámetros, corre la simulación y dibuja esa trayectoria.

**El punto 3 es la justificación entera de la IA en el proyecto.** Sin él tenemos
cuatro botones y una simulación bonita, y el jurado dirá que es un chatbot pegado
encima. Con él tenemos escenarios infinitos que no se pueden construir sin un modelo
de lenguaje. **Si hay que sacrificar algo, se sacrifica lo visual antes que esto.**

Cuando la pregunta está fuera del modelo, el sistema lo dice: *«Fuera del alcance.
Este gemelo simula 4 intervenciones sobre este caso.»* Reconocer los límites es una
ventaja ante el jurado, no un bache.

Prototipo de investigación y educación. No diagnostica, no recomienda tratamientos,
no está validado clínicamente. Eso debe verse en pantalla, no en un README.

---

## 2 · Reglas no negociables

Estas siete reglas son lo que califica el jurado y lo que impide que la demo se
caiga. Si una decisión de diseño choca con una de ellas, gana la regla.

1. **El servidor Python es el único dueño de la fisiología.** Los clientes nunca
   simulan. Dos navegadores tienen que ver el mismo paciente al mismo tiempo, y
   eso es imposible si cada uno corre su propio motor.
2. **La fisiología nunca espera a un agente.** Tres loops independientes. Un LLM
   que tarda 6 s publica tarde; el monitor no se congela jamás.
3. **Lo simulado nunca se ve como lo medido.** Toda proyección va punteada, más
   tenue y etiquetada `PROYECTADO`. Ver §8.
4. **Ningún agente emite una cifra que no vino de una tool.** Cada opinión lleva
   su `evidence[]` con métrica, valor y fuente. Es el activo más fuerte ante el jurado.
5. **Toda acción de un cliente es una PROPUESTA.** El backend valida, aplica al
   motor y republica el resultado autoritativo. Nunca se lee un mensaje de cliente
   como si fuera estado.
6. **Portal es el eje, no un adorno.** Pero el `EventBus` es en proceso y Portal es
   un suscriptor más: si Portal cae, la simulación sigue y el front degrada a SSE.
7. **El jurado no es médico.** Todo número técnico lleva su traducción humana al
   lado. Lo grande se lee en español de a pie; lo técnico va pequeño, al lado.

---

## 3 · Equipo y fronteras de archivos

Somos 3 y trabajamos sobre el mismo repo. Cada quien es dueño de sus rutas: si
necesitas tocar las de otro, avisa antes. Así evitamos conflictos de merge en las
últimas horas, que es cuando duelen.

| Rol | Persona | Rutas propias |
|---|---|---|
| **Backend · Portal · Agentes** | *(por asignar)* | `Backend/**`, `portal.config.ts`, despliegue |
| **Frontend · Monitor y wizard** | *(por asignar)* | `Frontend/src/app/**`, `Frontend/src/components/**` (excepto `Heart*`), `Frontend/src/lib/portal.ts` |
| **Frontend · Corazón 3D** | **Juan David** | `Frontend/src/components/Heart*`, `Frontend/public/heart3d/**`, `Backend/cardiotwin-bridge.js`, endpoint `/api/heart3d` (consumo) |

**Backend · Portal · Agentes** es dueño de: `physiology.py`, `interventions.py`,
`agents.py`, `runtime.py`, `sync.py`, `server.py`, la integración con Portal
(acuñar tokens, publicar, `portal.config.ts`) y el despliegue del backend.

**Frontend · Monitor** es dueño de: wizard (pantallas 1–4), monitor en vivo,
panel de agentes, gráfico de trayectorias, overlay de comparación, campo de
lenguaje natural, y el cliente de Portal en React (`PortalProvider`, `useChannel`).

**Frontend · Corazón 3D** es dueño de: la visualización anatómica, su sincronía
con la FC real, el coloreado por perfusión/isquemia y el bridge con el backend.

### Contrato entre front y back

El front **no inventa nombres de campo**. Toda la superficie está en §6 (endpoints)
y §7 (eventos). Si falta un dato, se pide al backend; no se calcula en el cliente.

---

## 4 · Arquitectura

```
                       ┌──────────────────────────────────────┐
                       │        SERVIDOR (FastAPI)            │
                       │                                      │
  LOOP 1  20 Hz  ───►  │  engine.step(0.05)  determinista     │
                       │        │                             │
  LOOP 2   1 Hz  ───►  │   EventBus  ──►  PortalSync (sk_)    │──► api.useportal.co
                       │        │    └─►  SSE /api/stream     │──► fallback
  LOOP 3 x evento ──►  │   Agentes (LLM, async, no bloquean)  │
                       └──────────────────────────────────────┘
                                        │
                          Portal realtime (JWT de usuario)
                                        │
              ┌─────────────────────────┴─────────────────────┐
              │                                               │
      Navegador A (Next.js)                          Navegador B (Next.js)
      useChannel(vitals/events/agents)               mismo paciente, mismo instante
```

**Por qué tres loops:** cinco agentes LLM por tick es imposible. Un tick de
fisiología corre a 20 Hz; una llamada a Claude tarda 2–8 s. Acoplarlos congela el
monitor cada vez que un agente piensa, y el jurado lo ve.

**Qué dispara a los agentes** (no cada tick, con debounce de 2 s):

| Disparador | Agentes que despiertan |
|---|---|
| `state.transition` | todos |
| `threshold.crossed` | el especialista relevante |
| `human.intervention` | farmacología + simulación |
| Cambio >15 % en variable clave | fisiología |
| Cada 30 s con inestabilidad | orquestador (re-consenso) |

### Mapa del repo

```
TwinCardiaco/
├─ CLAUDE.md                    ← este documento
├─ docs/brief-hackathon.md      ← brief original + TYC, íntegro
├─ Backend/
│  ├─ server.py                 FastAPI: endpoints + SSE + lifespan
│  ├─ ARQUITECTURA.md           razonamiento de diseño (leer una vez)
│  ├─ PASOS.md                  puesta en marcha paso a paso
│  ├─ cardiotwin-bridge.js      puente hacia el corazón 3D
│  └─ cardiotwin/
│     ├─ physiology.py          motor 0D. VALIDADO
│     ├─ interventions.py       tabla de intervenciones + what-if. VALIDADO
│     ├─ runtime.py             los tres loops
│     ├─ agents.py              agentes + orquestador (modo offline sin LLM)
│     └─ sync.py                EventBus + PortalSync
└─ Frontend/                    Next.js 16 · React 19 · Tailwind 4
   ├─ cardiac-twin-proyecto.md  mapa de pantallas y sistema de diseño
   ├─ cardiac-twin-context.md   detalle del monitor en vivo
   ├─ design/                   referencias visuales
   └─ src/
      ├─ app/page.tsx
      ├─ components/  HeartVisual.tsx · SelectPatientScreen.tsx · icons.tsx
      └─ lib/         cases.ts · engine.ts
```

---

## 5 · Portal — cómo se usa de verdad

Todo lo de esta sección está verificado contra `docs.useportal.co` (agosto 2026).
Donde la doc no dice nada, está marcado explícitamente.

### 5.1 Instalación

```bash
npm install @portalsdk/core @portalsdk/react   # front
npm install -D @portalsdk/config               # portal.config.ts
```

`@portalsdk/react` exige `react >=18 <20`. Tenemos React 19.2.8 → compatible.
`@portalsdk/core` pesa ~14 kB min+gzip.

### 5.2 Las tres credenciales (esto define toda la arquitectura)

| Credencial | Quién la usa | Host | Regla dura |
|---|---|---|---|
| `sk_...` secret key | **solo servidor** | `api.useportal.co` | **rechaza cualquier request con header `Origin`** — el navegador físicamente no puede usarla |
| `pk_...` publishable | navegador | `api.useportal.co` | aceptada **solo** en `/v1/tokens/anonymous`. Segura en el bundle |
| JWT de usuario | navegador | `realtime.useportal.co` | emitido por tu backend vía `/v1/tokens` |

De aquí sale, sin margen de interpretación, que el servidor es el único que puede
publicar el estado del paciente. Si el navegador pudiera escribir en el canal de
vitales, cualquiera falsifica al paciente y la demo deja de ser defendible.

### 5.3 Acuñar el JWT del usuario (backend)

```http
POST https://api.useportal.co/v1/tokens
Authorization: Bearer sk_...
Content-Type: application/json

{
  "userId": "medico-1",
  "channels": {
    "sim:demo:vitals":  ["connect"],
    "sim:demo:events":  ["connect"],
    "sim:demo:agents":  ["connect"],
    "sim:demo:actions": ["connect", "publish"]
  },
  "claims": { "username": "Dra. Ruiz" },
  "ttl": "1h"
}
```

→ `200 { "token": "eyJ...", "expiresAt": "2026-08-08T03:00:00.000Z" }`

**Esto resuelve el TODO que quedó abierto en `sync.py`: Portal SÍ tiene ACL de
escritura por canal.** Se declara en `channels` al acuñar el token. Un cliente con
solo `connect` en `vitals` no puede publicar ahí aunque lo intente.

`ttl` acepta `1h`, `30m`, `45s`, `2d` o segundos. Por defecto 1 hora.
`claims` es una bolsa opaca que viaja en el token y es visible para `authz` en
`portal.config.ts`.

### 5.4 Publicar desde el servidor

```http
POST https://api.useportal.co/v1/channels/{channelId}/messages
Authorization: Bearer sk_...

{
  "senderId": "server",
  "type": "vitals.tick",
  "kind": "text",
  "content": { "hr": 128, "map": 62, "spo2": 91, ... }
}
```

→ `200 { "id": "m_1752912000_42", "seq": 42, "timestamp": 1752912000000 }`

- `senderId` es **obligatorio** en publicación de servidor.
- `content` es opaco y va **limitado a 2 KB**. Ver §5.8.
- `kind` en v1 solo admite `"text"`. `type` es nuestro discriminador de aplicación.
- `to` entrega solo a un miembro; `mentions` es una lista de `{userId}`.

### 5.5 Cliente React

```tsx
// src/lib/portal.ts — módulo scope, una sola instancia
import { Portal } from "@portalsdk/core";
export const portal = new Portal({ apiKey: process.env.NEXT_PUBLIC_PORTAL_PK! });

export async function fetchPortalToken(): Promise<string> {
  const r = await fetch(`${API}/api/portal/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, display_name: name }),
  });
  const { token } = await r.json();
  return token;
}
```

```tsx
// app/layout.tsx o un wrapper cliente
"use client";
import { PortalProvider } from "@portalsdk/react";
import { portal, fetchPortalToken } from "@/lib/portal";

export function Providers({ children }) {
  return (
    <PortalProvider client={portal} token={fetchPortalToken}>
      {children}
    </PortalProvider>
  );
}
```

```tsx
// Monitor de vitales
"use client";
import { useChannel } from "@portalsdk/react";

export function VitalsMonitor({ simId }: { simId: string }) {
  const { messages, presence, status } = useChannel<VitalsTick>({
    channelId: `sim:${simId}:vitals`,
    history: "none",        // los vitales viejos no sirven; el snapshot va por /api/state
  });
  const last = messages[messages.length - 1]?.content;
  // ...
}
```

`token` como **callback** y no como string: se re-invoca en connect, reconnect y
expiración. Un string estático no se puede refrescar y al expirar el canal pasa a
`status: "blocked"`.

**Next.js:** los hooks son *SSR-inert*, no lanzan. Durante el prerender del servidor
devuelven un snapshot idle estable. **No hace falta `dynamic(..., { ssr: false })`.**
Basta con `"use client"` en el componente hoja que llama al hook.

`useChannel` devuelve: `messages`, `send`, `loadPrevious`, `hasPrevious`,
`isLoadingPrevious`, `channel`, `me`, `ext`, `presence`, `activity`, `sendActivity`,
`typing`, `sendTyping`, `unread`, `markAsRead`, `setMetadata`, `status`.

`portal.channel(id)` es lookup-or-create por id: dos componentes viendo el mismo
canal comparten un solo socket. `channelId: undefined` deja el hook inerte, que es
como se cambia de canal sin desmontar el layout.

### 5.6 Nuestra partición de canales

| Canal | Escribe | Contenido | `history` en el front |
|---|---|---|---|
| `sim:{id}:vitals` | solo servidor | 1 Hz, estado fisiológico | `"none"` |
| `sim:{id}:events` | solo servidor | transiciones, umbrales, simulaciones | `50` |
| `sim:{id}:agents` | solo servidor | ciclo de vida y opiniones | `50` |
| `sim:{id}:actions` | clientes | propuestas de intervención | `50` |

Los eventos y las opiniones van con historial porque un usuario que llega tarde
tiene que poder reconstruir la línea de tiempo. Los vitales no: el snapshot inicial
se pide a `GET /api/state` y a partir de ahí se sigue el stream.

**Presencia** (requisito «usuarios conectados»): sale de `useChannel(...).presence`
del canal `events`. Portal la entrega en dos formas según el tamaño de la sala:
`{ kind: "detailed", joined, left, count }` o `{ kind: "aggregate", count, recent }`.
Hay que manejar las dos.

### 5.7 Qué NO mandar por Portal

- **La onda del ECG.** A 250 Hz son 75 000 mensajes en 5 minutos: límites de tasa y
  coste sin ganar nada. Publica FC y ritmo a 1 Hz y **sintetiza la onda en el cliente**.
- **Las trayectorias completas del what-if.** Cuatro ramas × N puntos revientan el
  límite de 2 KB. Publica un `simulation.result` ligero (`{runId, ramas: [{key,
  label, deltaMap15, deltaCo15, timeToCritical}]}`) y que el front pida las series
  completas por HTTP.
- **Interpolación de curvas.** El front suaviza entre ticks; no pidas más resolución.

### 5.8 Límites duros de la plataforma

| Límite | Valor |
|---|---|
| `content` de un mensaje | **≤ 2 KB** |
| `metadata` de presencia (`meta`) | ≤ 1 KB decodificado |
| Paginación de historial | **solo hacia atrás** (`loadPrevious`); `loadNext` no existe en v1 |
| Filtrado server-side (`where`) | **no soportado**; solo `channel.view()` en cliente |
| Mensajes efímeros | `seq: null`, **sin garantía de orden** |
| `activity`/`typing` | throttle ~3 s cliente, expira ~5 s sin refresco |
| Adjuntos / media | **rechazados en v1** (`NotYetSupportedError`) |
| Keepalive | ping/pong ~25 s, interno del SDK |

La publicación desde servidor (HTTP) es **siempre persistente**: `ServerPublishRequest`
no tiene flag `ephemeral`. Solo los clientes pueden mandar efímeros, por el socket.

### 5.9 Errores

El código va en el cuerpo `{ code, reason? }` **y** en el header `x-portal-error`.
**No ramifiques por status HTTP**: varios códigos comparten status.

| HTTP | `code` |
|---|---|
| 401 | `invalid_token`, `token_expired` |
| 403 | `invalid_api_key`, `not_member`, `banned`, `anonymous_not_allowed` |
| 404 | `unknown_channel` |
| 426 | `unsupported_version` |
| 429 | `channel_at_capacity` (el cuerpo trae `retryAfter` en segundos) |

### 5.10 `portal.config.ts` (opcional, pero suma puntos)

Permite autorización y middleware ejecutados **en la infraestructura de Portal**:

```ts
import { defineConfig, allow, block, defineMiddleware } from "@portalsdk/config";

const soloPropuestas = defineMiddleware("publish", (ctx) => {
  if (!ctx.capabilities.publish) return block("No puedes actuar sobre este paciente.");
  return allow();
});

export default defineConfig({
  channels: {
    "sim:*:vitals": { anonymous: true, authz: () => allow({ publish: false }) },
    "sim:*:events": { anonymous: true, authz: () => allow({ publish: false }) },
    "sim:*:agents": { anonymous: true, authz: () => allow({ publish: false }) },
    "sim:*:actions": { anonymous: false, onPublish: [soloPropuestas] },
  },
});
```

Gana el id exacto; si no, la plantilla con el prefijo fijo más largo. Se despliega
con la CLI de Portal (`portal deploy`, `portal secrets set NAME`).

Nota: si `authz` lanza o expira, la conexión **siempre** se rechaza.

### 5.11 Wire protocol (solo si hay que depurar a nivel de frame)

Socket de canal:
```
GET wss://realtime.useportal.co/v1/channels/{channelId}?v=1&token={jwt}&leaf={hint?}&meta={base64json?}
```
Primer frame siempre `ready` (info del canal, `me` verificado, seq inicial, `leaf`,
snapshot de presencia, watermark, `bindings`). El historial **no** viene en `ready`:
el SDK hace `GET /v1/channels/{id}/history` en paralelo.

Frames servidor→cliente: `batch`, `retract`, `presence`, `activity`, `direct`,
`reassign`, `error`.
Cliente→servidor: `ephemeral`, `activity`, `watermark`, `meta`, `ping`.
Reconexión: misma URL con `last={seq}`; el servidor replica lo perdido.

Normalmente no tocamos esto — lo hace `@portalsdk/core`.

### 5.12 Correcciones pendientes en nuestro código (verificadas contra la doc)

Tareas concretas para **Backend · Portal · Agentes**:

1. **`sync.py:194` — body de publicación equivocado.** Manda
   `{type, payload, id, ts, sim_time}`. El contrato real es
   `{senderId, type, kind, content, to?, mentions?}`. Nuestro `payload` debe ir
   dentro de `content`, y falta `senderId` (obligatorio). Meter `id`/`ts`/`sim_time`
   dentro de `content`.
2. **`sync.py:220` — `mint_user_token` no pide grants.** Manda
   `{userId, displayName}`; el contrato es `{userId, channels, claims, ttl}`.
   `displayName` debería ir en `claims.username`. Sin `channels`, los permisos
   quedan a merced de los defaults.
3. **`server.py:190` — token anidado.** Devuelve `{"token": tok}` donde `tok` ya es
   `{token, expiresAt}`, así que al front le llega `token.token`. Debe ser
   `{"token": tok["token"], "expires_at": tok["expiresAt"], ...}`.
4. **Vigilar el límite de 2 KB** en `vitals.tick` y sobre todo en `simulation.result`.
5. **`PUBLISH_PATH` y `TOKEN_PATH` sí son correctos** (`/v1/channels/{channel}/messages`
   y `/v1/tokens`). Se pueden quitar los TODO.

---

## 6 · API del backend

Documentación interactiva en `/docs` cuando el servidor corre.

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/api/health` | estado de portal, llm, agentes |
| GET | `/api/state` | snapshot (plan B si cae el stream) |
| GET | `/api/stream` | **SSE con todos los eventos** |
| GET | `/api/events?since=` | replay del log |
| GET | `/api/interventions` | construir los botones dinámicamente |
| GET | `/api/agents` | qué ve y qué optimiza cada agente |
| GET | `/api/heart3d` | colores derivados para la malla |
| POST | `/api/scenario/shock` | disparar el deterioro |
| POST | `/api/scenario/reset` | reiniciar para ensayar |
| POST | `/api/intervention` | aplicar (valida y republica) |
| POST | `/api/whatif` | proyectar las ramas |
| POST | `/api/deliberate` | forzar ronda de agentes |
| POST | `/api/portal/token` | acuñar JWT del navegador |

**El front no construye los botones a mano:** los pide a `/api/interventions`.

---

## 7 · Contrato de eventos

Todo lo que ocurre es un evento. Portal sincroniza **el log**, no el estado: el
estado se deriva del log. Así un usuario que llega tarde reconstruye todo y dos
usuarios ven la misma línea de tiempo aunque uno tenga lag.

| `type` | Canal | Cuándo |
|---|---|---|
| `vitals.tick` | vitals | 1 Hz |
| `state.transition` | events | estable → inestable → crítico |
| `threshold.crossed` | events | una variable cruzó un umbral |
| `agent.started` | agents | arranca la llamada al LLM — **spinner real** |
| `agent.progress` | agents | llega un chunk del stream |
| `agent.opinion` | agents | postura + confianza + evidencia |
| `agent.conflict` | agents | dos agentes en desacuerdo |
| `orchestrator.consensus` | agents | resolución |
| `simulation.started` | events | what-if corriendo |
| `simulation.result` | events | resumen de trayectorias (series por HTTP) |
| `human.intervention` | actions | propuesta del cliente |
| `intervention.applied` | events | confirmación autoritativa del servidor |
| `presence.update` | events | presencia |

**Los mensajes de actividad de los agentes vienen del ciclo de vida real, nunca de
un `setTimeout`.** Un jurado técnico distingue un spinner real de uno decorativo, y
esa es exactamente la diferencia entre «IA central» e «IA de adorno».

Forma obligatoria de `agent.opinion`:

```json
{
  "agent": "cardiologia",
  "stance": "oponerse | apoyar | condicionar",
  "intervention": "inotrope",
  "confidence": 0.72,
  "evidence": [
    { "metric": "myocardial_o2_balance", "value": -0.08, "source": "vitals.tick" },
    { "metric": "delta_co_15min",        "value":  0.04, "source": "simulation.result" }
  ],
  "reasoning": "..."
}
```

El front muestra `evidence` junto a la postura. Es la prueba de que el número no se
inventó.

---

## 8 · Procedencia del dato: OBSERVADO · INFERIDO · SIMULADO

Regla de la premisa del producto. Cada valor en pantalla lleva su procedencia:

| Etiqueta | Qué es | Cómo se ve |
|---|---|---|
| **OBSERVADO** | viene del dataset/stream (ECG MIT-BIH, MIMIC-III de-identificado) | línea sólida, color pleno |
| **INFERIDO** | calculado por el motor a partir de lo observado | línea sólida, tono más suave |
| **SIMULADO** | proyección tras una intervención hipotética | **punteado, tenue, etiquetado `PROYECTADO`** |

Nunca se presenta una simulación como si fuera un dato real. Si alguien confunde
una proyección con una medición, el proyecto falla en su premisa.

Fuentes declaradas en `Frontend/src/lib/cases.ts` → `DATA_SOURCES`. Deben ser
visibles en pantalla.

---

## 9 · Los agentes

Tres con voz propia. Simulación y Farmacología son **tools del orquestador**, no
opinadores — si el simulador opina, duplica a Fisiología y el consenso se vuelve una
votación 2-1 amañada.

| Agente | Optimiza | Ve | Ignora deliberadamente |
|---|---|---|---|
| **Cardiología** | balance de O₂ miocárdico, estabilidad del ritmo | FC, ritmo, `mvo2`, `myocardial_o2_balance`, PCWP | lactato, DO₂ sistémico |
| **Fisiología** | DO₂ y perfusión tisular | CO, DO₂, O2ER, lactato, índice de perfusión | coste miocárdico |
| **Orquestador** | resolver el conflicto explícitamente | todas las posturas + los números del simulador | — |
| *Farmacología* (tool) | seguridad del fármaco | dosis, contraindicaciones, `risks` | urgencia hemodinámica |
| *Simulación* (tool) | nada — no opina | corre `project_scenario()` | — |

### El desacuerdo es real, no guionizado

Si le das los mismos datos y el mismo prompt a tres Claudes, coinciden. Pedirle a un
agente que «sea escéptico» es teatro y se nota. **El desacuerdo sale de darles
funciones objetivo distintas y vistas distintas de los datos.**

El conflicto que el modelo produce solo: el inotrópico sube el gasto y el DO₂ →
Fisiología lo pide. Pero induce taquicardia que empeora el balance de O₂ miocárdico
→ el miocardio pierde contractilidad → Cardiología se opone porque extiende el
infarto. Los dos tienen razón en su propia función objetivo. El orquestador decide
con los números de `project_scenario()`, no con retórica.

Está **verificado en la física del modelo**: al agregar el balance de O₂ miocárdico,
el beneficio de la dobutamina a 15 min cayó de +0.86 L/min de gasto a +0.04.

### Modo offline

`Orchestrator(bus, client=None)` da posturas deterministas con las mismas funciones
objetivo escritas en código. **Desarrolla el front así**: sin quemar cuota, sin
depender de la red y con la demo reproducible. La `ANTHROPIC_API_KEY` solo entra
cuando se ensaya el guion completo.

---

## 10 · Los cuatro casos clínicos

Definidos en `Frontend/src/lib/cases.ts`. El backend tiene que soportar los cuatro.

| id | Caso | Severidad | Ritmo inicial | Estado de soporte en backend |
|---|---|---|---|---|
| `ic-descompensada` | Insuficiencia cardíaca descompensada (67 M) | Moderada | Sinusal | mapear a `cardiogenic` severidad baja |
| `tsv` | Taquiarritmia supraventricular (58 F) | Moderada | **FA con RVR** | **falta**: añadir ritmo AFIB_RVR a `physiology.py` |
| `sca` | Síndrome coronario agudo (62 M) | Alta | Sinusal | mapear a isquemia coronaria |
| `choque` | Choque cardiogénico (71 F) | Crítica | Sinusal | `cardiogenic` severidad 1.0 — ya soportado |

`POST /api/scenario/shock` acepta hoy `none | cardiogenic | hypovolemic | septic`.
**Tarea de backend:** aceptar el `id` del caso y mapearlo internamente, para que el
front mande `{"case": "tsv"}` y no tenga que conocer la taxonomía del motor.

El caso recomendado para la demo es el que produzca el conflicto más nítido entre
agentes. Decidirlo tras el primer ensayo completo, no antes.

---

## 11 · Guion de la demo

| t | Qué pasa |
|---|---|
| 0:00 | Paciente estable. Monitor vivo, vitales fluctuando, corazón latiendo. |
| 0:30 | Se dispara el insulto. Nada visible aún. |
| 1:00 | **Fase compensada.** FC sube, SVR sube, MAP casi normal. «El paciente se ve bien.» |
| 1:30 | `threshold.crossed`. Banner **INESTABILIDAD HEMODINÁMICA**. Los agentes despiertan en pantalla. |
| 2:00 | **Tiempo estimado a estado crítico: 6 min.** Rotulado como proyección del modelo. |
| 2:30 | Fisiología pide inotrópico. Cardiología se opone. `agent.conflict` en pantalla. |
| 3:00 | El usuario pide **what-if**. Cuatro trayectorias en paralelo. |
| 3:30 | **El momento clave:** el vasopresor sube la MAP más que no hacer nada, **y hunde el gasto más que no hacer nada**. El número que todos miran mejora mientras el que importa empeora. |
| 4:00 | El orquestador resuelve con los números del simulador. El usuario decide. |
| 4:30 | Se aplica. El monitor reacciona. Los agentes re-evalúan sobre el estado nuevo. Y en la segunda pantalla, todo aparece a la vez. |

El minuto 3:30 es lo que se van a acordar. Ensáyalo.

**El demo grabado es de 1:30 máximo.** Ese guion de 4:30 es el ensayo completo; para
la grabación hay que comprimirlo. Priorizar: deterioro → conflicto de agentes con
evidencia → what-if → decisión → sincronía entre dos pantallas.

---

## 12 · Puesta en marcha

### Backend

```bash
cd Backend
pip install -r requirements.txt
export CARDIOTWIN_TIME_SCALE=8          # 8×: un deterioro de 40 min en 5
uvicorn server:app --host 0.0.0.0 --port 8000
curl localhost:8000/api/health
```

En PowerShell: `$env:CARDIOTWIN_TIME_SCALE = "8"`.

| Variable | Si falta |
|---|---|
| `ANTHROPIC_API_KEY` | agentes en **modo offline** (deterministas). Empieza así |
| `PORTAL_SECRET_KEY` | Portal desactivado, queda SSE. **Empieza así** |
| `CARDIOTWIN_TIME_SCALE` | 8 por defecto |
| `CARDIOTWIN_SIM_ID` | `demo` por defecto |

### Frontend

```bash
cd Frontend
npm install
npm run dev        # http://localhost:3210
```

### Orden de trabajo

| # | Tarea | ¿Demostrable al terminar? |
|---|---|---|
| 1 | Servidor + `curl` al guion completo | no |
| 2 | Monitor de vitales por SSE | **sí — demo mínima** |
| 3 | Banner de inestabilidad + tiempo a crítico | sí |
| 4 | Panel de agentes con evidencia | **sí — demo fuerte** |
| 5 | What-if con las cuatro trayectorias | **sí — demo completa** |
| 6 | **Portal encima del SSE** | sí — **obligatorio para elegibilidad** |
| 7 | ~~Corazón 3D~~ · **hecho** (§13) | sí |

Del 5 en adelante todo es opcional **salvo el 6**: sin Portal el proyecto no es
elegible. Congela el 2 antes de seguir: con eso ya hay algo que enseñar.

---

## 13 · El corazón 3D (Juan David) — CONSTRUIDO

Stack: `three` + `@react-three/fiber` + `@react-three/drei`, nativo en React. Sin
iframe, sin `postMessage`, sin mallas descargadas.

```
src/lib/cardiacCycle.ts                    reloj del ciclo, funciones puras
src/components/monitor/
  Heart3DView.tsx                          punto de entrada · fallback 2D
  heart3d/Canvas.tsx                       lienzo WebGL (dynamic, ssr:false)
  heart3d/Scene.tsx                        escena, uniforms, OrbitControls
  heart3d/geometry.ts                      geometría procedural
  heart3d/shaders.ts                       deformación + material del miocardio
```

**Interfaz:** reemplazo directo de `BeatingHeart`. Mismas props
(`hr`, `rhythm`, `strokeVolume`, `perfusion`) más `ischemia?` y `hint?`.
Montado en `MonitorScreen.tsx`, pestaña VISTA 3D.

### Por qué geometría procedural y no BodyParts3D

La decisión original era clonar `Interactive-3D-Human-Heart-Visualization`. Se
descartó al construirlo: esas mallas pesan decenas de MB, traen nomenclatura opaca
que hay que adivinar, exigen iframe + `postMessage`, y **no se pueden deformar** —
que es justamente lo único que importa aquí. Generando la geometría nosotros, cada
vértice trae su altura normalizada (`aH`) y el vertex shader sabe qué es ápex y qué
es base. Pesa ~200 kB y no hay que atribuir nada.

### Lo que hace que se vea vivo

Esto no es decoración: cada punto es la fisiología hecha visible.

| Rasgo | Por qué |
|---|---|
| **El ápex está anclado**; lo que desciende es la base | Si escalas desde el centro el ápex sube, y el ojo lo lee como falso al instante |
| **Torsión opuesta** entre ápex y base | El corazón se retuerce como quien escurre un trapo. Es lo que delata que alguien miró un ecocardiograma |
| **La sístole dura ~0.30 s y no se acorta** | Lo que se acorta es la diástole. A 78 lpm el corazón está contraído el 39 % del ciclo; a 160 lpm, el 75 %. **El corazón ES la explicación de `PULSO ↑ → LLENADO ↓`** — no hay que rotularlo |
| **Patada auricular 0.16 s antes** del ventrículo | Y en fibrilación **desaparece**: las aurículas tiemblan a ~400/min sin mover sangre. Ahí está el 20-30 % de llenado que pierde el paciente |
| **Intervalos irregulares ±25 %** en FA | Es lo que hace una FA reconocible a simple vista |
| **Amplitud ∝ volumen sistólico** | La bomba débil se contrae menos, y se ve sin leer un número |
| **Las coronarias brillan en DIÁSTOLE** | Al contraerse, el miocardio comprime sus propias arterias. Por eso la taquicardia es doblemente mala |
| **Color por perfusión**, tramo 0.35–0.95 estirado | Vira de verdad cuando importa, en vez de quedarse rojo hasta que ya no hay nada que decidir |
| **Relieve por perturbación de normal** | Sin él el músculo se ve de plástico |

### Pendiente

- `ischemia` se deriva provisionalmente en el front con `myocardialStress()`.
  **Cuando el backend esté conectado, borrar esa función** y pasar
  `myocardium_ischemia` de `GET /api/heart3d`, que ya lo calcula de verdad.
- El corazón y `EcgStrip` llevan relojes de latido separados (el ECG cuantiza la FC
  a múltiplos de 5 para no saltar). Sincronizarlos exige unificar el reloj en
  `cardiacCycle.ts` — hablarlo antes de tocar `EcgStrip.tsx`.

### Degradación

Sin WebGL2 cae a `BeatingHeart` (SVG 2D) automáticamente. Perder la demo por el
driver de vídeo del portátil sería una forma tonta de perderla.

**Honestidad:** esto NO es simulación 3D. No hay propagación espacial ni
electromecánica. Es el estado del modelo 0D pintado sobre una forma anatómica.
Decirlo así da credibilidad; venderlo como simulación 3D no sobrevive la primera
pregunta.

---

## 14 · Sistema de diseño

Referencia mental: un monitor de cuidados intensivos diseñado por alguien que sabe
de tipografía. Oscuro, denso, con aire. No un dashboard corporativo.

- Fondo casi negro con tinte frío, superficies apenas más claras
- Dorado como color de acento y de acción
- Verde normal · ámbar advertencia · rojo crítico
- Números en monoespaciada, grandes, con peso
- Etiquetas humanas en sans, más pequeñas, gris medio
- Separación por espacio y contraste, no por bordes gruesos ni sombras
- Todo se mueve con suavidad. Nada aparece de golpe, nada salta

Resolución objetivo **1840×1230** (la de la demo). No se invierte en móvil.
Valores exactos en `Frontend/design/` y `Frontend/cardiac-twin-proyecto.md`.

**Traducción obligatoria:** MAP 65 → *«presión de bombeo»*. Lactato 3.1 → *«el
cuerpo sin oxígeno»*. Botones que dicen **«Frenar el pulso»** con «Metoprolol IV»
pequeño debajo.

---

## 15 · Qué NO construir

Historia clínica completa · catálogo de medicamentos · múltiples patologías fuera de
los 4 casos · diagnóstico · integración hospitalaria · login o cuentas · panel de
administración · responsive móvil · modo claro · modelo celular de electrofisiología.

Una patología por caso, pocas variables, pocas intervenciones, y un tiempo real
impecable. La calidad de la experiencia vale más que la cantidad de features.

---

## 16 · Entregables del hackathon

Checklist de elegibilidad. Sin uno solo de estos, el proyecto no compite.

- [ ] Capacidad de IA en el producto
- [ ] **Portal como parte estructural**, con interacción real entre usuarios, agentes
      y fuentes de datos en vivo — no basta con mencionarlo
- [ ] Producto funcional que el jurado pueda probar
- [ ] **Repositorio público en GitHub** → `github.com/pandafter/TwinCardiaco`
- [ ] **Versión desplegada** con URL pública
- [ ] Demo grabada, **máximo 1:30**, en URL accesible
- [ ] Pitch de **280 caracteres o menos**
- [ ] Explicación de cómo se usó Portal
- [ ] Nombre del equipo + integrantes + usuario de Discord de contacto

**Ventana de commits válidos: viernes 7 agosto 19:00 → domingo 9 agosto 10:00, UTC−5.**
Los commits fuera de esa ventana no se evalúan. Como el repo ya tenía trabajo previo,
hay que crear el tag **`the-realtime-hackathon`** agrupando los commits del periodo
oficial — sin ese tag, solo se evalúa lo que quede dentro de la ventana.

---

## 17 · Decisiones tomadas

Resuelven contradicciones que había entre `Backend/ARQUITECTURA.md` y
`Frontend/cardiac-twin-proyecto.md`. Están cerradas: no se reabren sin acuerdo del
equipo.

| Decisión | Resolución |
|---|---|
| **Motor fisiológico** | **Solo el servidor Python.** `Frontend/src/lib/engine.ts` deja de calcular fisiología: se queda como tipos (`PatientState`, `Sample`), umbrales de alarma (`hrLevel`, `mapLevel`…), etiquetas (`rhythmLabel`, `statusLabel`) e interpolación entre ticks. La clase `Engine` pasa a modo mock solo para desarrollo sin backend |
| **Escenario clínico** | **Los cuatro casos de `cases.ts`.** No es uno solo. El backend debe soportarlos todos (§10) |
| **Corazón** | **3D procedural** (three.js + R3F, geometría generada). Se descartó BodyParts3D: no se puede deformar, que es lo único que importaba. `BeatingHeart` 2D queda como fallback sin WebGL (§13) |
| **Reparto** | Backend+Portal+Agentes / Front monitor / Front corazón 3D (§3) |
| **Portal ACL** | **Sí existe**, vía grants `channels` al acuñar el token (§5.3). El TODO de `sync.py` queda resuelto |
| **Agentes** | Tres con voz (Cardiología, Fisiología, Orquestador). Farmacología y Simulación son tools (§9) |

---

## 18 · Advertencias

Modelo de parámetros agrupados, **no validado contra pacientes**. El «tiempo a estado
crítico» es la trayectoria del propio modelo, no una predicción clínica: si el jurado
pregunta contra qué está validado, la respuesta honesta es «contra nada». Rotularlo
así da credibilidad; presentarlo como predicción la destruye.

No se usan datos de pacientes reales sin IRB. Todos los perfiles son sintéticos o
provienen de datasets públicos de-identificados.

---

## 19 · Referencias

| Documento | Qué contiene |
|---|---|
| [`docs/brief-hackathon.md`](docs/brief-hackathon.md) | brief original, bases y TYC del hackathon, íntegros |
| [`Backend/ARQUITECTURA.md`](Backend/ARQUITECTURA.md) | razonamiento de diseño: por qué tres loops, cómo se logra el conflicto real |
| [`Backend/PASOS.md`](Backend/PASOS.md) | puesta en marcha paso a paso con curl |
| [`Frontend/cardiac-twin-proyecto.md`](Frontend/cardiac-twin-proyecto.md) | mapa de las 8 pantallas y sistema de diseño |
| [`Frontend/cardiac-twin-context.md`](Frontend/cardiac-twin-context.md) | detalle técnico del monitor en vivo |
| `docs.useportal.co` | documentación de Portal. Empezar por `/wire-protocol` y `/api-reference` |
| Discord `#soporte-portal` | dudas técnicas de Portal durante el evento |

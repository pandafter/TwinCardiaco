"""
Bus de eventos y capa de sincronizacion con Portal.

MODELO DE CONFIANZA (esto no es opcional)
-----------------------------------------
Portal expone dos superficies con credenciales distintas:

  api.useportal.co        secret key  sk_...   SOLO servidor.
                                               Rechaza requests con header
                                               Origin, asi que el browser
                                               fisicamente no puede usarla.
  realtime.useportal.co   JWT de usuario       El browser, acuñado por tu
                                               backend via /v1/tokens.

De ahi se deriva la particion de canales. El servidor es el UNICO que puede
publicar estado del paciente y conclusiones de agentes. Si el browser pudiera
publicar en el canal de vitales, cualquiera falsifica el estado del paciente
y la demo deja de ser defendible.

  sim:{id}:vitals    <- SOLO servidor.  1 Hz, estado fisiologico
  sim:{id}:events    <- SOLO servidor.  transiciones, umbrales, simulaciones
  sim:{id}:agents    <- SOLO servidor.  ciclo de vida y opiniones de agentes
  sim:{id}:actions   <- clientes.       intervenciones humanas

Toda accion publicada por un cliente se trata como PROPUESTA, nunca como
verdad. El backend la valida, la aplica al motor y republica el resultado
autoritativo en sim:{id}:events. Nunca leas un evento publicado por cliente
como si fuera estado.

QUE *NO* MANDAR POR PORTAL
--------------------------
La onda del ECG. A 250 Hz son 75.000 mensajes en una demo de 5 minutos:
te comes limites de tasa y el costo sin ganar nada. Publica FC y ritmo a
1 Hz y sintetiza la onda EN EL CLIENTE. Lo mismo con la interpolacion de
las curvas: el front suaviza entre ticks.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any, Awaitable, Callable, Dict, List, Optional

# ==========================================================================
EVENT_TYPES = (
    "vitals.tick",             # 1 Hz, estado fisiologico
    "state.transition",        # estable -> inestable -> critico
    "threshold.crossed",       # una variable cruzo un umbral
    "agent.started",           # el agente arranco (spinner REAL)
    "agent.progress",          # chunk del stream
    "agent.opinion",           # postura + confianza + evidencia
    "agent.conflict",          # dos agentes en desacuerdo
    "orchestrator.consensus",  # resolucion
    "simulation.started",
    "simulation.result",
    "human.intervention",      # propuesta del cliente
    "intervention.applied",    # confirmacion autoritativa del servidor
    "presence.update",
)


@dataclass
class Event:
    type: str
    payload: Dict[str, Any]
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    ts: float = field(default_factory=time.time)
    sim_time: float = 0.0
    source: str = "server"

    def as_dict(self) -> dict:
        return asdict(self)


# ==========================================================================
class EventBus:
    """
    Bus en proceso. Portal es un suscriptor mas, no el bus.

    Esto importa: si Portal se cae en medio de la demo, la simulacion y los
    agentes siguen funcionando y el frontend puede degradarse a polling
    local. Acoplar la logica al transporte es como se pierde una demo por
    un problema de red ajeno.
    """

    def __init__(self, keep_log: int = 2000):
        self._subs: Dict[str, List[Callable[[Event], Awaitable[None]]]] = {}
        self.log: List[Event] = []
        self._keep = keep_log

    def on(self, event_type: str, handler) -> None:
        self._subs.setdefault(event_type, []).append(handler)

    def on_any(self, handler) -> None:
        self._subs.setdefault("*", []).append(handler)

    async def emit(self, event_type: str, payload: dict,
                   sim_time: float = 0.0, source: str = "server") -> Event:
        ev = Event(type=event_type, payload=payload,
                   sim_time=sim_time, source=source)
        self.log.append(ev)
        if len(self.log) > self._keep:
            self.log = self.log[-self._keep:]

        handlers = self._subs.get(event_type, []) + self._subs.get("*", [])
        if handlers:
            # Los handlers NUNCA bloquean al emisor: si un agente tarda 6 s,
            # la fisiologia debe seguir corriendo a 20 Hz.
            await asyncio.gather(*(h(ev) for h in handlers),
                                 return_exceptions=True)
        return ev

    def replay(self, since_ts: float = 0.0) -> List[dict]:
        """Un cliente que se conecta tarde reconstruye desde el log."""
        return [e.as_dict() for e in self.log if e.ts >= since_ts]


# ==========================================================================
class PortalSync:
    """
    Adaptador de Portal.

    VERIFICADO CONTRA LA DOCUMENTACION (agosto 2026)
    ------------------------------------------------
      - hosts y modelo de credenciales
      - publicacion de servidor: POST /v1/channels/{id}/messages con
        {senderId, type, kind, content}. `senderId` obligatorio, `kind`
        solo admite "text", `content` limitado a 2 KB
      - /v1/tokens acuña el JWT de usuario y SI acepta ACL por canal via
        el mapa `channels` (ver mint_user_token)
      - los errores traen {code, reason} y el header x-portal-error

    La ACL por canal no nos exime de validar: toda accion de cliente se
    valida en el backend y se republica la version autoritativa. La ACL
    evita que un cliente escriba donde no debe; la validacion evita que
    escriba basura donde si puede.
    """

    API_HOST = "https://api.useportal.co"
    REALTIME_HOST = "https://realtime.useportal.co"

    # Verificado contra la doc de Portal (agosto 2026).
    PUBLISH_PATH = "/v1/channels/{channel}/messages"
    TOKEN_PATH = "/v1/tokens"

    # Portal rechaza un `content` de mas de 2 KB. No es una recomendacion:
    # el mensaje se pierde entero, y perderlo en silencio es peor que
    # publicar una version recortada.
    MAX_CONTENT_BYTES = 2048

    def __init__(self, sim_id: str,
                 secret_key: Optional[str] = None,
                 enabled: bool = True,
                 session: Any = None):
        self.sim_id = sim_id
        self.secret_key = secret_key or os.environ.get("PORTAL_SECRET_KEY")
        self.session = session          # aiohttp.ClientSession
        self.enabled = enabled and bool(self.secret_key)
        self.failures = 0
        self._warned = False

    # --- canales -----------------------------------------------------
    def channel(self, kind: str) -> str:
        return f"sim:{self.sim_id}:{kind}"

    SERVER_ONLY = ("vitals", "events", "agents")
    CLIENT_WRITABLE = ("actions",)

    @staticmethod
    def route(event_type: str) -> str:
        if event_type == "vitals.tick":
            return "vitals"
        if event_type.startswith("agent.") or event_type.startswith("orchestrator."):
            return "agents"
        return "events"

    # --- publicacion -------------------------------------------------
    @staticmethod
    def _slim(event_type: str, payload: dict) -> dict:
        """
        Recorta lo que no cabe en 2 KB.

        `simulation.result` trae 4 ramas x ~30 muestras de 20 campos: son
        decenas de KB. Por el canal va el RESUMEN con el que la UI decide,
        y las series completas se piden por HTTP. Publicar la trayectoria
        entera no solo revienta el limite: no aporta nada que el front no
        pueda pedir cuando de verdad la necesita.
        """
        if event_type != "simulation.result":
            return payload

        origin = payload.get("from_state") or {}
        return {
            "from_state": {k: origin.get(k)
                           for k in ("map", "co", "spo2", "lactate", "hr")},
            "branches": [
                {
                    "key": sc.get("intervention"),
                    "label": sc.get("name"),
                    "final_status": sc.get("final_status"),
                    "time_to_critical_s": sc.get("time_to_critical_s"),
                    "deltas": {k: (sc.get("deltas") or {}).get(k)
                               for k in ("map", "co", "lactate",
                                         "myocardial_o2_balance")},
                }
                for sc in payload.get("scenarios", []) if sc.get("deltas")
            ],
            "best_by_metric": payload.get("best_by_metric"),
            # Donde estan las series completas, para que el front no las adivine
            "series_at": "/api/whatif",
        }

    async def publish(self, ev: Event) -> None:
        """
        Publica un evento del servidor. Los fallos se tragan a proposito:
        que Portal falle NO puede tumbar la simulacion. Se cuentan y se
        exponen en /health para que sepas que estas degradado.
        """
        if not self.enabled:
            return
        ch = self.channel(self.route(ev.type))

        # El envelope es EL MISMO que viaja por SSE, a proposito: el front
        # parsea igual venga de Portal o del respaldo, y cambiar de
        # transporte no obliga a tocar una linea de la UI.
        content = {"payload": self._slim(ev.type, ev.payload),
                   "id": ev.id, "ts": ev.ts,
                   "sim_time": ev.sim_time, "source": ev.source}

        size = len(json.dumps(content, ensure_ascii=False).encode("utf-8"))
        if size > self.MAX_CONTENT_BYTES:
            # Mejor no mandarlo y que se vea en /health que mandarlo y que
            # Portal lo rechace en silencio.
            self._note_failure(f"{ev.type} excede 2 KB ({size} B)")
            return

        try:
            url = self.API_HOST + self.PUBLISH_PATH.format(channel=ch)
            async with self.session.post(
                url,
                headers={"Authorization": f"Bearer {self.secret_key}",
                         "Content-Type": "application/json"},
                # senderId es OBLIGATORIO en publicacion de servidor, y
                # `kind` solo admite "text" en v1: `type` es nuestro
                # discriminador de aplicacion, no el de Portal.
                json={"senderId": "server", "type": ev.type,
                      "kind": "text", "content": content},
                timeout=3,
            ) as r:
                if r.status >= 400:
                    # El codigo va en el cuerpo Y en x-portal-error. Ramificar
                    # por status HTTP no sirve: varios codigos comparten status.
                    code = r.headers.get("x-portal-error", "unknown")
                    self._note_failure(f"portal {code}")
        except Exception as e:                        # noqa: BLE001
            self._note_failure(f"{type(e).__name__}")

    def grants(self) -> Dict[str, List[str]]:
        """
        La ACL que se graba en el JWT del usuario.

        Se deriva de SERVER_ONLY / CLIENT_WRITABLE a proposito: la particion
        de canales se declara UNA vez. Si alguien mueve "actions" de sitio,
        los permisos lo siguen solos en vez de quedar desincronizados, que
        es como se abre un agujero sin enterarse.
        """
        acl = {self.channel(k): ["connect"] for k in self.SERVER_ONLY}
        acl.update({self.channel(k): ["connect", "publish"]
                    for k in self.CLIENT_WRITABLE})
        return acl

    async def mint_user_token(self, user_id: str,
                              display_name: str = "",
                              ttl: str = "1h") -> Optional[dict]:
        """
        Acuña el JWT que el browser usa contra realtime.useportal.co.
        Esta llamada usa la secret key, asi que SOLO puede vivir aqui:
        el browser nunca ve sk_.

        Sin el mapa `channels` los permisos quedan a merced de los defaults
        de Portal, y un cliente podria acabar con publish en el canal de
        vitales. Con el, un cliente que solo tiene "connect" en vitals no
        puede publicar ahi aunque lo intente: el paciente no se falsifica
        desde el navegador.
        """
        if not self.enabled:
            return None
        try:
            async with self.session.post(
                self.API_HOST + self.TOKEN_PATH,
                headers={"Authorization": f"Bearer {self.secret_key}",
                         "Content-Type": "application/json"},
                # displayName no es un campo del contrato: el nombre visible
                # viaja en `claims`, que es la bolsa opaca que Portal expone
                # a authz en portal.config.ts.
                json={"userId": user_id,
                      "channels": self.grants(),
                      "claims": {"username": display_name or user_id},
                      "ttl": ttl},
                timeout=5,
            ) as r:
                if r.status >= 400:
                    return {"error": r.headers.get("x-portal-error", "unknown")}
                return await r.json()
        except Exception as e:                        # noqa: BLE001
            return {"error": str(e)}

    def _note_failure(self, reason: str) -> None:
        self.failures += 1
        if not self._warned:
            self._warned = True
            print(f"[portal] degradado ({reason}). La simulacion sigue; "
                  f"el frontend debe caer a polling de /api/state.")

    def health(self) -> dict:
        return {"enabled": self.enabled, "failures": self.failures,
                "sim_id": self.sim_id}

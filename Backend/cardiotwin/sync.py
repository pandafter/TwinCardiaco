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
from contextlib import suppress
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
    "debate.started",
    "debate.round.started",
    "debate.turn.started",
    "debate.turn.delta",
    "debate.turn.done",
    "debate.verdict",
    "debate.error",
    "simulation.started",
    "simulation.result",
    "human.intervention",      # propuesta del cliente
    "intervention.applied",    # confirmacion autoritativa del servidor
    "intervention.futile",     # intento rechazado tras asistolia
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

    def off(self, event_type: str, handler) -> bool:
        """Desuscribe exactamente el handler registrado y limpia la clave."""
        handlers = self._subs.get(event_type)
        if not handlers:
            return False
        try:
            handlers.remove(handler)
        except ValueError:
            return False
        if not handlers:
            self._subs.pop(event_type, None)
        return True

    def off_any(self, handler) -> bool:
        return self.off("*", handler)

    def subscriber_count(self, event_type: str = "*") -> int:
        """Contador observable para smoke tests y /api/health."""
        return len(self._subs.get(event_type, ()))

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
    """Adaptador ordenado y no bloqueante para Portal."""

    API_HOST = "https://api.useportal.co"
    REALTIME_HOST = "https://realtime.useportal.co"

    PUBLISH_PATH = "/v1/channels/{channel}/messages"
    TOKEN_PATH = "/v1/tokens"
    MAX_CONTENT_BYTES = 2048
    MAX_QUEUE = 800

    def __init__(self, sim_id: str,
                 secret_key: Optional[str] = None,
                 enabled: bool = True,
                 session: Any = None):
        self.sim_id = sim_id
        self.secret_key = secret_key or os.environ.get("PORTAL_SECRET_KEY")
        self.session = session          # aiohttp.ClientSession
        self.enabled = enabled and bool(self.secret_key)
        self.failures = 0
        self.published = 0
        self.dropped = 0
        self._warned = False
        self._queue: asyncio.Queue[Event] = asyncio.Queue(
            maxsize=self.MAX_QUEUE)
        self._worker: Optional[asyncio.Task] = None

    # --- canales -----------------------------------------------------
    def channel(self, kind: str) -> str:
        return f"sim:{self.sim_id}:{kind}"

    SERVER_ONLY = ("vitals", "events", "agents")
    CLIENT_WRITABLE = ("actions",)

    @staticmethod
    def route(event_type: str) -> str:
        if event_type == "vitals.tick":
            return "vitals"
        if (event_type.startswith("agent.") or
                event_type.startswith("orchestrator.") or
                event_type.startswith("debate.")):
            return "agents"
        return "events"

    # --- publicacion -------------------------------------------------
    def start(self) -> None:
        if self.enabled and self._worker is None:
            self._worker = asyncio.create_task(self._run(),
                                               name="portal-publisher")

    async def close(self) -> None:
        if self._worker is None:
            return
        self._worker.cancel()
        with suppress(asyncio.CancelledError):
            await self._worker
        self._worker = None

    @staticmethod
    def _slim(event_type: str, payload: dict) -> dict:
        if event_type in ("debate.verdict", "orchestrator.consensus"):
            conflict = payload.get("conflict") or {}
            return {
                "debate_id": payload.get("debate_id"),
                "trigger": payload.get("trigger"),
                "state": payload.get("state"),
                "recommendation": payload.get("recommendation"),
                "tiebreak_rule": payload.get("tiebreak_rule"),
                "conflict": ({
                    "intervention": conflict.get("intervention"),
                    "note": conflict.get("note"),
                } if conflict else None),
                "source": payload.get("source"),
                "disclaimer": payload.get("disclaimer"),
            }
        if event_type != "simulation.result":
            return payload
        origin = payload.get("from_state") or {}
        return {
            "from_state": {k: origin.get(k)
                           for k in ("map", "co", "spo2", "lactate", "hr")},
            "branches": [
                {
                    "key": scenario.get("intervention"),
                    "label": scenario.get("name"),
                    "final_status": scenario.get("final_status"),
                    "time_to_critical_s": scenario.get("time_to_critical_s"),
                    "deltas": {
                        key: (scenario.get("deltas") or {}).get(key)
                        for key in ("map", "co", "lactate",
                                    "myocardial_o2_balance")
                    },
                }
                for scenario in payload.get("scenarios", [])
                if scenario.get("deltas")
            ],
            "best_by_metric": payload.get("best_by_metric"),
            "series_at": "/api/whatif",
        }

    async def publish(self, ev: Event) -> None:
        if not self.enabled:
            return
        if self._worker is None:
            self.start()
        if self._queue.full():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
                self.dropped += 1
            except asyncio.QueueEmpty:
                pass
        self._queue.put_nowait(ev)

    async def _run(self) -> None:
        while True:
            ev = await self._queue.get()
            try:
                await self._send(ev)
            finally:
                self._queue.task_done()

    async def _send(self, ev: Event) -> None:
        ch = self.channel(self.route(ev.type))
        content = {
            "payload": self._slim(ev.type, ev.payload),
            "id": ev.id, "ts": ev.ts, "sim_time": ev.sim_time,
            "source": ev.source,
        }
        size = len(json.dumps(content, ensure_ascii=False).encode("utf-8"))
        if size > self.MAX_CONTENT_BYTES:
            self._note_failure(f"{ev.type} excede 2 KB ({size} B)")
            self.dropped += 1
            return
        try:
            url = self.API_HOST + self.PUBLISH_PATH.format(channel=ch)
            async with self.session.post(
                url,
                headers={"Authorization": f"Bearer {self.secret_key}",
                         "Content-Type": "application/json"},
                json={"senderId": "server", "type": ev.type,
                      "kind": "text", "content": content},
                timeout=3,
            ) as r:
                if r.status >= 400:
                    body = await self._error_body(r)
                    self._note_failure(
                        f"portal {body.get('code') or body.get('reason') or 'unknown'}")
                else:
                    self.published += 1
        except Exception as e:                        # noqa: BLE001
            self._note_failure(f"{type(e).__name__}")

    @staticmethod
    async def _error_body(response) -> dict:
        try:
            body = await response.json()
            if isinstance(body, dict):
                return body
        except Exception:                              # noqa: BLE001
            pass
        return {"code": response.headers.get("x-portal-error", "unknown")}

    def grants(self) -> Dict[str, List[str]]:
        acl = {self.channel(kind): ["connect"] for kind in self.SERVER_ONLY}
        acl.update({self.channel(kind): ["connect", "publish"]
                    for kind in self.CLIENT_WRITABLE})
        return acl

    async def mint_user_token(self, user_id: str,
                              display_name: str = "",
                              ttl: str = "1h") -> Optional[dict]:
        """
        Acuña el JWT que el browser usa contra realtime.useportal.co.
        Esta llamada usa la secret key, asi que SOLO puede vivir aqui:
        el browser nunca ve sk_.
        """
        if not self.enabled:
            return None
        try:
            async with self.session.post(
                self.API_HOST + self.TOKEN_PATH,
                headers={"Authorization": f"Bearer {self.secret_key}",
                         "Content-Type": "application/json"},
                json={"userId": user_id, "channels": self.grants(),
                      "claims": {"username": display_name or user_id},
                      "ttl": ttl},
                timeout=5,
            ) as r:
                if r.status >= 400:
                    body = await self._error_body(r)
                    return {"error": body.get("code") or
                                     body.get("reason") or "unknown"}
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
        return {
            "enabled": self.enabled,
            "published": self.published,
            "dropped": self.dropped,
            "failures": self.failures,
            "queued": self._queue.qsize(),
            "sim_id": self.sim_id,
        }

"""
Runtime del gemelo: tres loops desacoplados.

  LOOP 1  Fisiologia      20 Hz         deterministico, SIN IA
  LOOP 2  Publicacion      1 Hz         vitales -> bus -> Portal
  LOOP 3  Agentes      por evento       async, no bloquea a nadie

La fisiologia NUNCA espera a un agente. Un agente que tarda 6 s publica su
conclusion 6 s tarde sobre un estado que ya avanzo, y eso esta bien: es lo
que pasa en una UCI real. Lo que no puede pasar es que el monitor se congele
mientras un LLM piensa, porque eso se ve en pantalla y delata que la IA esta
en el camino critico.

DISPARO DE AGENTES
------------------
No cada tick. Solo ante transicion de estado, cruce de umbral, intervencion
humana, cambio >15% en una variable clave, o cada 30 s si hay inestabilidad.
Con debounce: dos umbrales cruzados en 2 s son un solo despertar.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional

from cardiotwin.physiology import PhysiologyEngine
from cardiotwin.interventions import (
    INTERVENTIONS, assess_state, time_to_critical, compare_scenarios,
)
from cardiotwin.sync import EventBus, PortalSync

# Variables cuyo cambio brusco despierta agentes, y su umbral relativo
WATCHED = {"map": 0.12, "co": 0.15, "lactate": 0.20,
           "spo2": 0.04, "hr": 0.15, "do2": 0.15}

AGENT_DEBOUNCE_S = 3.0
IDLE_RECONSENSUS_S = 30.0

# Segundos de tiempo FISIOLOGICO que el paciente puede pasar en estado
# critico sin intervencion antes de entrar en asistolia. Con time_scale=8
# esto son unos 15 s de reloj de pared: suficiente para dar susto sin que
# la demo se pierda si el ponente se queda callado 5 s.
DEFAULT_ASYSTOLE_GRACE_S = 120.0


class SimulationRuntime:
    """Dueño unico del motor de fisiologia. Los clientes nunca simulan local."""

    def __init__(self, bus: EventBus, portal: Optional[PortalSync] = None,
                 physics_hz: float = 20.0, publish_hz: float = 1.0,
                 time_scale: float = 1.0,
                 asystole_grace_s: float = DEFAULT_ASYSTOLE_GRACE_S):
        self.engine = PhysiologyEngine()
        self.bus = bus
        self.portal = portal
        self.physics_dt = 1.0 / physics_hz
        self.publish_period = 1.0 / publish_hz
        self.time_scale = time_scale
        self.asystole_grace_s = asystole_grace_s

        self.running = False
        self._last_status = "stable"
        self._last_published: Dict[str, float] = {}
        self._last_agent_wake = 0.0
        self._agent_task: Optional[asyncio.Task] = None
        self.orchestrator = None          # se inyecta desde agents.py

        # Marca de cuando el paciente entro por ultima vez en estado critico
        # SIN intervencion posterior. Se pone en la transicion a critical y
        # se limpia al salir de critical o al aplicar cualquier intervencion.
        self._critical_since: Optional[float] = None

        if portal:
            self.bus.on_any(portal.publish)

    # ------------------------------------------------------------------
    async def run(self) -> None:
        """Loop 1 + Loop 2. Corre hasta stop()."""
        self.running = True
        last_publish = 0.0
        wall = time.perf_counter()

        while self.running:
            now = time.perf_counter()
            elapsed = now - wall
            wall = now

            # --- Loop 1: fisiologia. time_scale acelera el tiempo
            #     fisiologico respecto al de pared, para que un deterioro
            #     de 40 min quepa en una demo de 5.
            steps = max(1, int(elapsed / self.physics_dt))
            for _ in range(min(steps, 40)):
                self.engine.step(self.physics_dt * self.time_scale)

            await self._check_transitions()

            # --- Loop 2: publicacion
            if self.engine.s.t - last_publish >= self.publish_period * self.time_scale:
                last_publish = self.engine.s.t
                await self.bus.emit("vitals.tick", self.engine.s.vitals(),
                                    sim_time=self.engine.s.t)

            await asyncio.sleep(self.physics_dt)

    def stop(self) -> None:
        self.running = False

    # ------------------------------------------------------------------
    async def _check_transitions(self) -> None:
        a = assess_state(self.engine.s)
        v = a["vitals"]
        wake_reason = None

        # Transicion de estado
        if a["status"] != self._last_status:
            prev, self._last_status = self._last_status, a["status"]
            ttc = time_to_critical(self.engine)
            await self.bus.emit("state.transition", {
                "from": prev, "to": a["status"], "label": a["label"],
                "criteria": a["critical_criteria"] + a["instability_criteria"],
                "phenotype": a["hemodynamic_phenotype"],
                # Es la trayectoria del MODELO sin intervenir, no una
                # prediccion clinica validada. Rotularlo asi en la UI.
                "time_to_critical_s": ttc,
                "projection_disclaimer": (
                    "Proyeccion del modelo sin intervencion. "
                    "No es una prediccion clinica validada."),
                "vitals": v,
            }, sim_time=self.engine.s.t)
            wake_reason = f"transicion {prev} -> {a['status']}"

            # Timer de gracia hacia asistolia: arranca al entrar en critical,
            # se limpia al salir por cualquier razon distinta (incluso a
            # asystole, para que no doble-dispare).
            if a["status"] == "critical":
                self._critical_since = self.engine.s.t
            else:
                self._critical_since = None

        # Asistolia por hipoperfusion prolongada. Si el paciente lleva
        # `asystole_grace_s` en critical sin que nadie intervenga, colapsa.
        # Es LA razon por la que el demo tiene tension: no actuar es una
        # decision con consecuencia.
        if (self._critical_since is not None
                and not self.engine.s.asystole
                and self.engine.s.t - self._critical_since >= self.asystole_grace_s):
            grace = round(self.engine.s.t - self._critical_since, 1)
            self._critical_since = None
            self.engine.enter_asystole()
            prev = self._last_status
            self._last_status = "asystole"
            await self.bus.emit("state.transition", {
                "from": prev, "to": "asystole", "label": "ASISTOLIA",
                "criteria": [f"Sin intervencion durante {grace:.0f}s en estado critico."],
                "phenotype": "asistolia",
                "time_to_critical_s": 0.0,
                "projection_disclaimer": (
                    "Colapso electrico por hipoperfusion prolongada. "
                    "Trayectoria del modelo, no prediccion clinica."),
                "vitals": self.engine.s.vitals(),
            }, sim_time=self.engine.s.t)
            wake_reason = "asistolia"

        # Cruce brusco de variable vigilada
        for k, thr in WATCHED.items():
            cur = v.get(k)
            prev = self._last_published.get(k)
            if cur is None:
                continue
            if prev is not None and prev != 0:
                if abs(cur - prev) / abs(prev) >= thr:
                    await self.bus.emit("threshold.crossed", {
                        "metric": k, "from": prev, "to": cur,
                        "relative_change": round((cur - prev) / abs(prev), 3),
                    }, sim_time=self.engine.s.t)
                    wake_reason = wake_reason or f"cambio brusco en {k}"
            self._last_published[k] = cur

        # Re-consenso periodico si sigue inestable
        if (not wake_reason and a["status"] != "stable"
                and time.time() - self._last_agent_wake > IDLE_RECONSENSUS_S):
            wake_reason = "re-evaluacion periodica"

        if wake_reason:
            self._wake_agents(wake_reason)

    # ------------------------------------------------------------------
    def _wake_agents(self, reason: str) -> None:
        """
        Loop 3. Dispara y OLVIDA: no se espera el resultado aqui, porque
        eso congelaria la fisiologia.
        """
        now = time.time()
        if now - self._last_agent_wake < AGENT_DEBOUNCE_S:
            return                              # debounce
        if self._agent_task and not self._agent_task.done():
            return                              # ya hay una ronda corriendo
        if not self.orchestrator:
            return
        self._last_agent_wake = now
        self._agent_task = asyncio.create_task(
            self.orchestrator.deliberate(self.engine, reason))

    # ------------------------------------------------------------------
    async def apply_intervention(self, key: str, dose: Optional[float] = None,
                                 actor: str = "usuario") -> dict:
        """
        Aplica una intervencion propuesta por un cliente.

        La propuesta llega por el canal sim:{id}:actions, que SI es escribible
        por clientes. Por eso se valida aqui y se republica el resultado
        autoritativo: un evento publicado por cliente es una propuesta, jamas
        estado.
        """
        if key not in INTERVENTIONS:
            return {"error": f"Intervencion desconocida: {key}"}

        # Un corazon en asistolia no responde a farmacos ni volumen. En vez
        # de aplicar en silencio y confundir al usuario, se anuncia la
        # futilidad como evento y se rechaza. El reset del caso es la salida.
        if self.engine.s.asystole:
            await self.bus.emit("intervention.futile", {
                "intervention": key,
                "actor": actor,
                "reason": "Paciente en asistolia. Reset del caso para intentar de nuevo.",
            }, sim_time=self.engine.s.t)
            return {"error": "El paciente esta en asistolia. Aplicar intervenciones ya no cambia el desenlace."}

        # Cualquier intervencion cuenta como "actuar": reinicia el reloj de
        # gracia hacia asistolia. Aplicar dobutamina reactiva la ventana
        # aunque siga critical porque el usuario esta enganchado con el caso.
        self._critical_since = None

        before = assess_state(self.engine.s)["vitals"]
        INTERVENTIONS[key].apply(self.engine, dose)
        # Recalcular derivadas AHORA: las intervenciones solo tocan estados
        # (drug_svr, drug_contractility, v_venous). Sin este recompute, el
        # `after` sale identico al `before` y en la UI el medico aprieta el
        # boton y no pasa nada visible hasta el siguiente tick.
        self.engine._recompute()
        after = assess_state(self.engine.s)["vitals"]

        await self.bus.emit("intervention.applied", {
            "intervention": key,
            "name": INTERVENTIONS[key].name,
            "dose": dose if dose is not None else INTERVENTIONS[key].default_dose,
            "actor": actor,
            "before": before, "after": after,
        }, sim_time=self.engine.s.t)

        self._wake_agents(f"intervencion aplicada: {key}")
        return {"ok": True, "before": before, "after": after}

    async def run_whatif(self, keys: Optional[List[str]] = None,
                         horizon_s: float = 900.0) -> dict:
        """
        Ramas what-if. Corre en un hilo aparte: son ~7000 pasos de ODE por
        rama y bloquearian el event loop, congelando el monitor.
        """
        await self.bus.emit("simulation.started",
                            {"interventions": keys or "todas",
                             "horizon_s": horizon_s},
                            sim_time=self.engine.s.t)
        result = await asyncio.to_thread(
            compare_scenarios, self.engine, keys, horizon_s)
        await self.bus.emit("simulation.result", result,
                            sim_time=self.engine.s.t)
        return result

    def state(self) -> dict:
        """Snapshot para clientes que caen a polling si Portal falla."""
        a = assess_state(self.engine.s)
        return {"vitals": a["vitals"], "status": a["status"],
                "label": a["label"], "phenotype": a["hemodynamic_phenotype"],
                "sim_time": self.engine.s.t}
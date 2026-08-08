"""
Agentes especializados y orquestador.

DE DONDE SALE EL DESACUERDO REAL
--------------------------------
Si le das los mismos datos y el mismo prompt a cinco Claudes, coinciden.
Pedirle a uno que "sea esceptico" produce desacuerdo fabricado, y se nota.

El desacuerdo genuino sale de dar a cada agente una FUNCION OBJETIVO
distinta y una VISTA distinta de los datos. Aqui cada agente ve un
subconjunto de las vitales y optimiza una cosa diferente:

  Cardiologia   optimiza el balance de O2 MIOCARDICO. No ve el lactato.
  Fisiologia    optimiza el DO2 SISTEMICO. No ve el costo miocardico.
  Farmacologia  optimiza seguridad del farmaco. No ve la urgencia.
  Simulacion    NO OPINA. Corre proyecciones y reporta.
  Orquestador   ve todo y tiene que resolver el conflicto explicitamente.

El conflicto que esto produce esta en la FISICA del modelo, no guionizado:
en shock cardiogenico el inotropico sube el gasto y el DO2 (Fisiologia lo
pide) pero induce taquicardia que empeora myocardial_o2_balance, el
miocardio pierde contractilidad y se extiende el infarto (Cardiologia se
opone). Verificado: al agregar el balance de O2 miocardico al motor, el
beneficio de la dobutamina a 15 min cayo de +0.86 a +0.04 L/min de gasto.

POR QUE SIMULACION NO OPINA
---------------------------
Si opinara, duplicaria a Fisiologia y el consenso seria una votacion 2-1
amañada. Es una tool, no una voz.

REGLA DURA
----------
Ningun agente emite una cifra que no vino de una tool o de las vitales que
recibio. Cada opinion trae `evidence` con metrica, valor y fuente. El front
muestra la evidencia junto a la postura: es la prueba de que no se invento
el numero, y es el activo mas fuerte frente a un jurado.
"""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from cardiotwin.interventions import INTERVENTIONS, assess_state, compare_scenarios

MODEL = os.environ.get("CARDIOTWIN_AGENT_MODEL", "claude-sonnet-4-6")


# ==========================================================================
@dataclass
class AgentSpec:
    key: str
    name: str
    objective: str                       # que optimiza (una linea)
    sees: List[str]                      # claves de vitals que recibe
    blind_to: List[str]                  # lo que NO ve, a proposito
    system: str
    status_messages: List[str]           # para el spinner, con texto real


AGENTS: Dict[str, AgentSpec] = {
    "cardiologia": AgentSpec(
        key="cardiologia", name="Agente de Cardiologia",
        objective="Preservar el miocardio: balance de O2 miocardico y "
                  "estabilidad del ritmo.",
        sees=["hr", "rhythm", "sbp", "dbp", "map", "mvo2",
              "myocardial_o2_balance", "pcwp", "sv"],
        blind_to=["lactate", "do2", "perfusion_index"],
        status_messages=["Analizando ritmo y frecuencia",
                         "Evaluando balance de O2 miocardico",
                         "Revisando presiones de llenado"],
        system="""Eres el agente de Cardiologia de un gemelo cardiaco.

TU FUNCION OBJETIVO: preservar el miocardio. Te importa el balance entre
demanda (doble producto, contractilidad) y aporte (perfusion coronaria, que
ocurre en diastole y depende de la presion diastolica). Te importa que el
ritmo no se desestabilice.

NO ves el lactato ni el DO2 sistemico, y eso es deliberado. No los pidas ni
los inventes. Otro agente cubre la perfusion tisular; tu trabajo es que no
se extienda el infarto.

Cuando myocardial_o2_balance es negativo, el miocardio esta isquemico y
pierde contractilidad: cualquier cosa que suba FC o contractilidad empeora
esa deuda. Dilo con esa mecanica, no con generalidades.

CRITICO: el balance ACTUAL suele ser positivo aunque el paciente este en
shock, porque el corazon fallido trabaja menos y la demanda cae con todo lo
demas. Razona sobre el balance PROYECTADO en proyecciones_15min, que es
donde cada intervencion cobra su precio. Juzgar por el valor actual produce
un agente que nunca se opone a nada.

Responde SOLO con JSON:
{"stance":"apoyar|oponerse|condicionar","intervention":"<clave>",
 "confidence":0.0-1.0,
 "evidence":[{"metric":"...","value":...,"source":"vitals|simulation"}],
 "reasoning":"2 frases maximo, mecanicista"}
Nunca cites una cifra que no este en los datos que recibiste."""),

    "fisiologia": AgentSpec(
        key="fisiologia", name="Agente de Fisiologia",
        objective="Maximizar el aporte de oxigeno a los tejidos.",
        sees=["co", "ci", "do2", "o2er", "lactate", "map", "spo2",
              "perfusion_index", "cvp", "svr"],
        blind_to=["mvo2", "myocardial_o2_balance"],
        status_messages=["Interpretando relaciones entre variables",
                         "Detectando deterioro de perfusion",
                         "Calculando deuda de oxigeno"],
        system="""Eres el agente de Fisiologia de un gemelo cardiaco.

TU FUNCION OBJETIVO: que los tejidos reciban oxigeno. Te importa el DO2, la
tasa de extraccion, el lactato como marcador de metabolismo anaerobio y el
indice de perfusion.

NO ves el costo miocardico de las intervenciones, y es deliberado. No lo
pidas ni lo inventes. Otro agente cubre eso.

Razona por la cadena causal: que variable esta cayendo, que la causa, y que
palanca la corrige. Un DO2 por debajo de ~330 mL/min es el umbral donde
arranca el metabolismo anaerobio.

Responde SOLO con JSON, mismo esquema que los demas agentes.
Nunca cites una cifra que no este en los datos que recibiste."""),

    "farmacologia": AgentSpec(
        key="farmacologia", name="Agente de Farmacologia",
        objective="Seguridad del farmaco: dosis, contraindicaciones, efectos "
                  "adversos previsibles.",
        sees=["hr", "map", "rhythm", "spo2", "pcwp"],
        blind_to=["time_to_critical"],
        status_messages=["Evaluando intervencion",
                         "Revisando contraindicaciones",
                         "Proyectando efectos adversos"],
        system="""Eres el agente de Farmacologia de un gemelo cardiaco.

TU FUNCION OBJETIVO: que el farmaco no dañe. Evaluas el mecanismo declarado
de cada intervencion y sus riesgos conocidos contra el estado actual.

NO ves cuanto tiempo queda hasta el estado critico, y es deliberado: tu
trabajo es señalar el riesgo farmacologico, no ponderar la urgencia. El
orquestador hace esa ponderacion.

Te dan la lista de intervenciones con su `mechanism` y sus `risks`. Usa
esos, no tu memoria.

Responde SOLO con JSON, mismo esquema que los demas agentes."""),
}


# ==========================================================================
def _filtered_vitals(vitals: dict, spec: AgentSpec) -> dict:
    """
    Entrega SOLO lo que el agente debe ver. La ceguera parcial es lo que
    hace que las posturas diverjan por razones reales y no por prompt.
    """
    return {k: v for k, v in vitals.items() if k in spec.sees}


class Orchestrator:
    """
    Coordina la deliberacion y resuelve el conflicto.

    El orquestador NO promedia posturas. Cuando dos agentes chocan, nombra el
    conflicto, va a los numeros del simulador y decide con un criterio
    explicito. Promediar opiniones es como se produce un consenso que no
    dice nada.
    """

    def __init__(self, bus, client: Any = None, model: str = MODEL,
                 agents: Optional[List[str]] = None):
        self.bus = bus
        self.client = client            # anthropic.AsyncAnthropic
        self.model = model
        self.agent_keys = agents or ["cardiologia", "fisiologia", "farmacologia"]

    # ------------------------------------------------------------------
    async def deliberate(self, engine, reason: str) -> dict:
        a = assess_state(engine.s)
        vitals = a["vitals"]

        # 1) El agente de Simulacion corre PRIMERO: los demas necesitan sus
        #    numeros para tener evidencia en vez de intuicion.
        await self.bus.emit("agent.started",
                            {"agent": "simulacion",
                             "message": "Ejecutando simulaciones"},
                            sim_time=engine.s.t)
        sims = await asyncio.to_thread(compare_scenarios, engine, None, 900.0)
        await self.bus.emit("simulation.result", sims, sim_time=engine.s.t)

        sim_summary = {
            s["intervention"]: s["deltas"] for s in sims["scenarios"]
        }

        # 2) Especialistas en PARALELO. Cinco llamadas concurrentes son
        #    triviales para asyncio; el costo es la latencia de la mas lenta,
        #    no la suma.
        opinions = await asyncio.gather(*(
            self._ask(self.agent_keys[i], vitals, sim_summary, a, engine.s.t)
            for i in range(len(self.agent_keys))
        ), return_exceptions=True)
        opinions = [o for o in opinions if isinstance(o, dict)]

        # 3) Deteccion de conflicto
        conflict = self._find_conflict(opinions)
        if conflict:
            await self.bus.emit("agent.conflict", conflict, sim_time=engine.s.t)

        # 4) Consenso
        consensus = await self._resolve(opinions, conflict, sim_summary,
                                        a, reason)
        await self.bus.emit("orchestrator.consensus", consensus,
                            sim_time=engine.s.t)
        return consensus

    # ------------------------------------------------------------------
    async def _ask(self, key: str, vitals: dict, sims: dict,
                   assessment: dict, sim_time: float) -> Optional[dict]:
        spec = AGENTS[key]
        await self.bus.emit("agent.started", {
            "agent": key, "name": spec.name,
            "message": spec.status_messages[0],
            "objective": spec.objective,
        }, sim_time=sim_time)

        payload = {
            "estado": assessment["label"],
            "fenotipo": assessment["hemodynamic_phenotype"],
            "vitales_visibles": _filtered_vitals(vitals, spec),
            "proyecciones_15min": sims,
            "intervenciones": {
                k: {"nombre": iv.name, "mechanism": iv.mechanism,
                    "risks": iv.risks}
                for k, iv in INTERVENTIONS.items()
            },
        }

        if self.client is None:
            out = self._offline_stub(key, vitals, sims)
            # El evento de opinion se emite TAMBIEN en modo offline: si no,
            # el front muestra un spinner que nunca cierra.
            await self.bus.emit("agent.opinion", out, sim_time=sim_time)
            return out

        try:
            r = await self.client.messages.create(
                model=self.model, max_tokens=700, system=spec.system,
                messages=[{"role": "user",
                           "content": json.dumps(payload, ensure_ascii=False)}],
            )
            text = "".join(b.text for b in r.content if b.type == "text")
            out = json.loads(text.strip().strip("`").replace("json\n", "", 1))
        except Exception as e:                        # noqa: BLE001
            out = {"stance": "condicionar", "intervention": None,
                   "confidence": 0.0, "evidence": [],
                   "reasoning": f"Sin conclusion ({type(e).__name__})."}

        out["agent"] = key
        out["name"] = spec.name
        out["objective"] = spec.objective
        await self.bus.emit("agent.opinion", out, sim_time=sim_time)
        return out

    def _offline_stub(self, key: str, vitals: dict, sims: dict) -> dict:
        """
        Postura deterministica sin LLM. Permite desarrollar el front y
        ensayar la demo sin quemar cuota ni depender de la red.
        Las reglas son las MISMAS funciones objetivo, en codigo.

        Devuelve el MISMO contrato que la ruta con LLM (incluye `objective`):
        si el stub omite un campo, el front se rompe solo en modo offline,
        que es justo cuando estas ensayando la demo.
        """
        obj = AGENTS[key].objective
        if key == "cardiologia":
            # El balance ACTUAL suele ser positivo aunque el paciente este
            # en shock: el corazon fallido trabaja menos, asi que la demanda
            # cae junto con todo lo demas. Lo que importa es el balance
            # PROYECTADO bajo la intervencion, que es donde el inotropico
            # cobra su precio. Mirar el valor actual es el error de diseño
            # obvio y produce un agente que nunca se opone a nada.
            now = vitals.get("myocardial_o2_balance", 0.0)
            proj = sims.get("inotrope", {}).get("myocardial_o2_balance", 0.0)
            stance = "oponerse" if proj < -0.02 else "condicionar"
            return {"agent": key, "name": AGENTS[key].name, "objective": obj,
                    "stance": stance, "intervention": "inotrope", "confidence": 0.75,
                    "evidence": [
                        {"metric": "myocardial_o2_balance",
                         "value": now, "source": "vitals"},
                        {"metric": "delta_myocardial_o2_balance_inotrope",
                         "value": proj, "source": "simulation"}],
                    "reasoning": "La taquicardia y la contractilidad que induce "
                                 "el inotropico empeoran el balance de O2 "
                                 "miocardico: riesgo de extender el infarto."}
        if key == "fisiologia":
            return {"agent": key, "name": AGENTS[key].name, "objective": obj,
                    "stance": "apoyar", "intervention": "inotrope", "confidence": 0.8,
                    "evidence": [{"metric": "do2", "value": vitals.get("do2"),
                                  "source": "vitals"},
                                 {"metric": "delta_do2_inotrope",
                                  "value": sims.get("inotrope", {}).get("do2"),
                                  "source": "simulation"}],
                    "reasoning": "Es la unica rama que no hunde el DO2."}
        return {"agent": key, "name": AGENTS[key].name, "objective": obj,
                "stance": "condicionar", "intervention": "vasopressor", "confidence": 0.6,
                "evidence": [{"metric": "map", "value": vitals.get("map"),
                              "source": "vitals"}],
                "reasoning": "El vasopresor sube poscarga: vigilar el gasto."}

    # ------------------------------------------------------------------
    @staticmethod
    def _find_conflict(opinions: List[dict]) -> Optional[dict]:
        """Conflicto = dos agentes con posturas opuestas sobre lo mismo."""
        by_iv: Dict[str, List[dict]] = {}
        for o in opinions:
            if o.get("intervention"):
                by_iv.setdefault(o["intervention"], []).append(o)
        for iv, group in by_iv.items():
            pro = [o for o in group if o["stance"] == "apoyar"]
            con = [o for o in group if o["stance"] == "oponerse"]
            if pro and con:
                return {
                    "intervention": iv,
                    "supporting": [{"agent": o["agent"],
                                    "objective": o.get("objective"),
                                    "reasoning": o["reasoning"],
                                    "evidence": o.get("evidence", [])}
                                   for o in pro],
                    "opposing": [{"agent": o["agent"],
                                  "objective": o.get("objective"),
                                  "reasoning": o["reasoning"],
                                  "evidence": o.get("evidence", [])}
                                 for o in con],
                    "note": ("Conflicto real de funciones objetivo, no ruido. "
                             "Ambos tienen razon en su propia metrica."),
                }
        return None

    async def _resolve(self, opinions: List[dict], conflict: Optional[dict],
                       sims: dict, assessment: dict, reason: str) -> dict:
        """
        Resuelve. Sin LLM aplica una regla explicita y auditable; con LLM,
        el orquestador argumenta pero SOBRE los mismos numeros.
        """
        # Regla de desempate declarada: con inestabilidad establecida, el
        # aporte sistemico de O2 manda sobre el costo miocardico, porque la
        # hipoperfusion mata antes. Es una decision DISCUTIBLE y por eso se
        # publica explicita en vez de esconderse en un promedio.
        tiebreak = ("Con inestabilidad establecida se prioriza el DO2 "
                    "sistemico sobre el costo miocardico: la hipoperfusion "
                    "tiene un horizonte mas corto. Criterio discutible y "
                    "declarado a proposito.")

        best_do2 = sims and max(sims.items(), key=lambda kv: kv[1].get("do2", -9e9))
        recommended = best_do2[0] if best_do2 else "none"

        return {
            "trigger": reason,
            "state": assessment["label"],
            "opinions": opinions,
            "conflict": conflict,
            "recommendation": recommended,
            "tiebreak_rule": tiebreak if conflict else None,
            "supporting_numbers": sims.get(recommended, {}),
            "disclaimer": ("Salida de un modelo de simulacion no validado. "
                           "No es una recomendacion clinica."),
        }

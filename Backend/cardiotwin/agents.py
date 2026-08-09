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
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from cardiotwin.interventions import INTERVENTIONS, assess_state, compare_scenarios

MODEL = os.environ.get("CARDIOTWIN_AGENT_MODEL", "claude-opus-5")
DELTA_S = max(0.0, float(os.environ.get("CARDIOTWIN_DELTA_MS", "150")) / 1000)
DELTA_CHARS = 24
MAX_TURN_TEXT = 600
JSON_MARKER = "\n---JSON---\n"


def _load_json_object(raw: str) -> dict:
    """Acepta JSON puro o cercado por Markdown y rechaza otros contratos."""
    candidate = raw.strip()
    if candidate.startswith("```"):
        lines = candidate.splitlines()
        candidate = "\n".join(lines[1:])
        if candidate.rstrip().endswith("```"):
            candidate = candidate.rstrip()[:-3].rstrip()
    start = candidate.find("{")
    if start < 0:
        raise ValueError("missing-json-object")
    value, _ = json.JSONDecoder().raw_decode(candidate[start:])
    if not isinstance(value, dict):
        raise ValueError("turn-json-not-object")
    return value


# ==========================================================================
@dataclass
class AgentSpec:
    key: str
    name: str
    objective: str                       # que optimiza (una linea)
    sees: List[str]                      # claves de vitals que recibe
    blind_to: List[str]                  # lo que NO ve, a proposito
    voice: bool                          # False = tool, no participante
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
        voice=True,
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

El formato exacto de cada turno viene en el mensaje del usuario. El bloque
JSON final debe usar stance, intervention, confidence, evidence y reasoning.
Nunca cites una cifra que no este en los datos que recibiste."""),

    "fisiologia": AgentSpec(
        key="fisiologia", name="Agente de Fisiologia",
        objective="Maximizar el aporte de oxigeno a los tejidos.",
        sees=["co", "ci", "do2", "o2er", "lactate", "map", "spo2",
              "perfusion_index", "cvp", "svr"],
        blind_to=["mvo2", "myocardial_o2_balance"],
        voice=True,
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

El formato exacto de cada turno viene en el mensaje del usuario. El bloque
JSON final debe usar stance, intervention, confidence, evidence y reasoning.
Nunca cites una cifra que no este en los datos que recibiste."""),

    "farmacologia": AgentSpec(
        key="farmacologia", name="Agente de Farmacologia",
        objective="Seguridad del farmaco: dosis, contraindicaciones, efectos "
                  "adversos previsibles.",
        sees=["hr", "map", "rhythm", "spo2", "pcwp"],
        blind_to=["time_to_critical"],
        voice=False,
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

VOICES = [key for key, spec in AGENTS.items() if spec.voice]


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
        self.agent_keys = agents or VOICES

    # ------------------------------------------------------------------
    async def deliberate(self, engine, reason: str) -> dict:
        a = assess_state(engine.s)
        vitals = a["vitals"]
        sim_time = engine.s.t
        debate_id = uuid.uuid4().hex[:12]

        await self.bus.emit("debate.started", {
            "debate_id": debate_id, "trigger": reason,
            "state": a["label"], "voices": self.agent_keys,
        }, sim_time=sim_time)

        try:
            # Simulacion corre primero: las voces discuten numeros del motor.
            await self.bus.emit("agent.started", {
                "agent": "simulacion", "role": "tool",
                "message": "Ejecutando simulaciones",
            }, sim_time=sim_time)
            sims = await asyncio.to_thread(
                compare_scenarios, engine, None, 900.0)
            await self.bus.emit("simulation.result", sims, sim_time=sim_time)
            sim_summary = {
                s["intervention"]: s["deltas"]
                for s in sims["scenarios"]
            }

            await self._round_started(debate_id, 1, "propuesta", sim_time)
            proposals = await asyncio.gather(*(
                self._proposal(key, vitals, sim_summary, a, debate_id,
                               sim_time)
                for key in self.agent_keys
            ), return_exceptions=True)
            proposals = [p for p in proposals if isinstance(p, dict)]

            await self._round_started(debate_id, 2, "replica", sim_time)
            rebuttals = []
            if len(proposals) >= 2:
                by_agent = {p["agent"]: p for p in proposals}
                tasks = []
                for key in self.agent_keys:
                    rival = next((p for agent, p in by_agent.items()
                                  if agent != key), None)
                    if rival:
                        tasks.append(self._rebut(
                            key, rival, vitals, sim_summary, a,
                            debate_id, sim_time))
                raw_rebuttals = await asyncio.gather(
                    *tasks, return_exceptions=True)
                rebuttals = [r for r in raw_rebuttals
                             if isinstance(r, dict)]

            conflict = self._find_conflict(proposals)
            if conflict:
                await self.bus.emit("agent.conflict", conflict,
                                    sim_time=sim_time)

            await self._round_started(debate_id, 3, "veredicto", sim_time)
            consensus = await self._resolve(
                proposals, conflict, sim_summary, a, reason)
            turn_sources = {
                turn.get("source") for turn in proposals + rebuttals
            }
            debate_source = (
                "llm" if turn_sources == {"llm"} else
                "reglas" if turn_sources == {"reglas"} else "mixto"
            )
            consensus.update({
                "debate_id": debate_id,
                "rebuttals": rebuttals,
                "source": debate_source,
            })
            await self.bus.emit("debate.verdict", consensus,
                                sim_time=sim_time)
            # Contrato legado: el monitor actual sigue funcionando mientras
            # DebateThread se construye encima de los eventos nuevos.
            await self.bus.emit("orchestrator.consensus", consensus,
                                sim_time=sim_time)
            return consensus
        except Exception as exc:                                  # noqa: BLE001
            await self.bus.emit("debate.error", {
                "debate_id": debate_id, "error": type(exc).__name__,
            }, sim_time=sim_time)
            raise

    # ------------------------------------------------------------------
    async def _proposal(self, key: str, vitals: dict, sims: dict,
                        assessment: dict, debate_id: str,
                        sim_time: float) -> dict:
        spec = AGENTS[key]
        turn = await self._turn_started(
            debate_id, 1, key, None, spec.status_messages[0], sim_time)
        payload = self._payload(spec, vitals, sims, assessment)
        fallback = self._offline_stub(key, vitals, sims)

        if self.client is None:
            out = fallback
            prose = out["reasoning"]
            await self._offline_deltas(turn, prose, sim_time)
        else:
            prompt = (
                "RONDA 1 - PROPUESTA. Expón tu postura en dos frases. La "
                "segunda debe citar una métrica literal de los datos y su "
                "valor literal. Después escribe una línea ---JSON--- y un "
                "objeto con stance, intervention, confidence, evidence y "
                "reasoning. evidence DEBE ser una lista de objetos con "
                "{metric, value, source}; source solo puede ser vitals o "
                "simulation. No escribas nada después del JSON.\n\nDATOS:\n" +
                json.dumps(payload, ensure_ascii=False))
            prose, out = await self._model_turn(
                spec, prompt, turn, sim_time, fallback)

        return await self._finish_turn(
            turn, spec, prose, out, payload, sim_time)

    async def _rebut(self, key: str, rival: dict, vitals: dict, sims: dict,
                      assessment: dict, debate_id: str,
                      sim_time: float) -> dict:
        spec = AGENTS[key]
        rival_key = rival["agent"]
        turn = await self._turn_started(
            debate_id, 2, key, rival_key,
            f"Respondiendo a {AGENTS[rival_key].name}", sim_time)
        payload = self._payload(spec, vitals, sims, assessment)
        fallback = self._offline_rebut(key, rival, vitals, sims)

        if self.client is None:
            out = fallback
            prose = out["reasoning"]
            await self._offline_deltas(turn, prose, sim_time)
        else:
            prompt = (
                "RONDA 2 - RÉPLICA OBLIGATORIA. Responde al texto literal "
                "del rival usando un número de tus datos que el rival no "
                "podía ver. Debes empezar exactamente por 'No: ' si su "
                "propuesta empeora tu objetivo, o por 'Sí, pero: ' si es "
                "correcta en su métrica pero tiene un costo. Después escribe "
                "una línea ---JSON--- y el mismo objeto JSON de la ronda 1. "
                "evidence DEBE ser una lista de objetos con metric, value y "
                "source (vitals o simulation). "
                "No escribas nada después del JSON.\n\n"
                f"RIVAL ({rival_key}): {rival.get('reasoning', '')}\n\n"
                "TUS DATOS:\n" + json.dumps(payload, ensure_ascii=False))
            prose, out = await self._model_turn(
                spec, prompt, turn, sim_time, fallback)

        return await self._finish_turn(
            turn, spec, prose, out, payload, sim_time)

    @staticmethod
    def _payload(spec: AgentSpec, vitals: dict, sims: dict,
                 assessment: dict) -> dict:
        return {
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

    async def _round_started(self, debate_id: str, number: int,
                             kind: str, sim_time: float) -> None:
        await self.bus.emit("debate.round.started", {
            "debate_id": debate_id, "round": number, "kind": kind,
        }, sim_time=sim_time)

    async def _turn_started(self, debate_id: str, round_no: int,
                            agent: str, reply_to: Optional[str],
                            message: str, sim_time: float) -> dict:
        turn_id = f"{debate_id}:{round_no}:{agent}"
        turn = {
            "debate_id": debate_id, "turn_id": turn_id,
            "round": round_no, "agent": agent, "reply_to": reply_to,
            "next_seq": 0,
        }
        await self.bus.emit("debate.turn.started", {
            k: v for k, v in turn.items() if k != "next_seq"
        }, sim_time=sim_time)
        await self.bus.emit("agent.started", {
            "agent": agent, "name": AGENTS[agent].name,
            "message": message, "objective": AGENTS[agent].objective,
        }, sim_time=sim_time)
        return turn

    async def _delta(self, turn: dict, text: str,
                     sim_time: float) -> None:
        if not text:
            return
        seq = turn["next_seq"]
        turn["next_seq"] += 1
        await self.bus.emit("debate.turn.delta", {
            "debate_id": turn["debate_id"],
            "turn_id": turn["turn_id"], "round": turn["round"],
            "agent": turn["agent"], "seq": seq, "delta": text,
        }, sim_time=sim_time)

    async def _offline_deltas(self, turn: dict, prose: str,
                              sim_time: float) -> None:
        for start in range(0, len(prose), DELTA_CHARS):
            await self._delta(
                turn, prose[start:start + DELTA_CHARS], sim_time)
            if DELTA_S:
                await asyncio.sleep(DELTA_S)

    async def _model_turn(self, spec: AgentSpec, prompt: str, turn: dict,
                          sim_time: float,
                          fallback_out: dict) -> tuple[str, dict]:
        """Streamea solo la prosa; el JSON finaliza el contrato del turno."""
        raw = ""
        sent = 0
        marker_at = -1
        last_flush = asyncio.get_running_loop().time()
        system = (
            spec.system +
            "\nNo incluyas etiquetas XML internas o de sistema en tu "
            "respuesta. Los únicos números permitidos son los que aparecen "
            "literalmente en los datos recibidos."
        )

        try:
            async with self.client.messages.stream(
                model=self.model, max_tokens=850,
                thinking={"type": "disabled"},
                output_config={"effort": "low"},
                system=system,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for piece in stream.text_stream:
                    raw += piece
                    marker_at = raw.find(JSON_MARKER)
                    visible_end = (marker_at if marker_at >= 0 else
                                   max(sent, len(raw) - len(JSON_MARKER) + 1))
                    now = asyncio.get_running_loop().time()
                    available = visible_end - sent
                    if available >= DELTA_CHARS or (
                            available > 0 and now - last_flush >= DELTA_S):
                        take = min(available, DELTA_CHARS)
                        await self._delta(
                            turn, raw[sent:sent + take], sim_time)
                        sent += take
                        last_flush = now

            marker_at = raw.find(JSON_MARKER)
            visible_end = marker_at if marker_at >= 0 else len(raw)
            if visible_end > sent:
                await self._delta(turn, raw[sent:visible_end], sim_time)

            if marker_at >= 0:
                prose = raw[:marker_at].strip()
                json_text = raw[marker_at + len(JSON_MARKER):].strip()
            else:
                prose = ""
                json_text = raw.strip().strip("`")
                if json_text.startswith("json"):
                    json_text = json_text[4:].lstrip()
            out = _load_json_object(json_text)
            if out.get("stance") not in {
                    "apoyar", "oponerse", "condicionar"}:
                out["stance"] = fallback_out.get("stance", "condicionar")
            if out.get("intervention") not in {
                    "none", *INTERVENTIONS.keys()}:
                out["intervention"] = fallback_out.get(
                    "intervention", "none")
            try:
                out["confidence"] = max(
                    0.0, min(1.0, float(out.get("confidence", 0.5))))
            except (TypeError, ValueError):
                out["confidence"] = fallback_out.get("confidence", 0.5)
            prose = prose or str(out.get("reasoning") or "").strip()
            if not prose:
                raise ValueError("empty-turn")
            return prose, out
        except Exception as exc:                                 # noqa: BLE001
            # La red o el formato nunca dejan un turno a medias: se completa
            # con el mismo motor determinista y se declara la procedencia.
            print(f"[agents] turno degradado a reglas ({type(exc).__name__})")
            fallback = dict(fallback_out)
            fallback["_source"] = "reglas"
            fallback["reasoning"] = (
                fallback.get("reasoning") or
                f"Sin conclusión del modelo ({type(exc).__name__}).")
            prose = fallback["reasoning"]
            if sent == 0:
                await self._offline_deltas(turn, prose, sim_time)
            return prose, fallback

    async def _finish_turn(self, turn: dict, spec: AgentSpec, prose: str,
                           out: dict, payload: dict,
                           sim_time: float) -> dict:
        out = dict(out)
        source = out.pop(
            "_source", "llm" if self.client else "reglas")
        out.update({
            "agent": spec.key, "name": spec.name,
            "objective": spec.objective, "reasoning": prose,
            "source": source,
            "round": turn["round"], "reply_to": turn["reply_to"],
        })
        self._verify_cites(out, payload)
        done = {
            "debate_id": turn["debate_id"],
            "turn_id": turn["turn_id"], "round": turn["round"],
            "agent": spec.key, "reply_to": turn["reply_to"],
            "text": prose[:MAX_TURN_TEXT],
            "stance": out.get("stance"),
            "intervention": out.get("intervention"),
            "confidence": out.get("confidence"),
            "evidence": out.get("evidence", [])[:3],
            "citations_verified": out["citations_verified"],
            "source": out["source"],
            "next_seq": turn["next_seq"],
        }
        await self.bus.emit("debate.turn.done", done, sim_time=sim_time)
        await self.bus.emit("agent.opinion", out, sim_time=sim_time)
        return out

    @staticmethod
    def _verify_cites(out: dict, payload: dict) -> None:
        allowed: Dict[tuple[str, str], float] = {}
        for metric, value in payload.get("vitales_visibles", {}).items():
            if isinstance(value, (int, float)):
                allowed[("vitals", metric)] = float(value)
        for intervention, deltas in payload.get(
                "proyecciones_15min", {}).items():
            for metric, value in deltas.items():
                if isinstance(value, (int, float)):
                    allowed[("simulation", f"{intervention}.{metric}")] = float(value)

        received = out.get("evidence") or []
        if not isinstance(received, list):
            received = []
        verified = []
        for cite in received:
            if not isinstance(cite, dict):
                continue
            source = cite.get("source")
            metric = cite.get("metric")
            value = cite.get("value")
            expected = allowed.get((source, metric))
            try:
                matches = expected is not None and abs(
                    float(value) - expected) <= 1e-6
            except (TypeError, ValueError):
                matches = False
            if matches:
                verified.append({
                    "metric": metric, "value": value, "source": source,
                })
        out["evidence"] = verified
        out["citations_verified"] = (
            bool(received) and len(verified) == len(received))

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
                        {"metric": "inotrope.myocardial_o2_balance",
                         "value": proj, "source": "simulation"}],
                    "reasoning": ("Propongo condicionar la dobutamina: puede "
                                  "aumentar el trabajo de un corazón ya exigido. "
                                  f"Su balance de O2 miocárdico proyectado cambia "
                                  f"{proj:.2f}.")}
        if key == "fisiologia":
            projected = sims.get("inotrope", {}).get("do2", 0.0)
            return {"agent": key, "name": AGENTS[key].name, "objective": obj,
                    "stance": "apoyar", "intervention": "inotrope", "confidence": 0.8,
                    "evidence": [{"metric": "do2", "value": vitals.get("do2"),
                                  "source": "vitals"},
                                 {"metric": "inotrope.do2",
                                  "value": projected,
                                  "source": "simulation"}],
                    "reasoning": ("Propongo dobutamina para recuperar el flujo "
                                  "que lleva oxígeno al cuerpo. La proyección "
                                  f"cambia el DO2 en {projected:.2f} mL/min.")}
        return {"agent": key, "name": AGENTS[key].name, "objective": obj,
                "stance": "condicionar", "intervention": "vasopressor", "confidence": 0.6,
                "evidence": [{"metric": "map", "value": vitals.get("map"),
                              "source": "vitals"}],
                "reasoning": "El vasopresor sube poscarga: vigilar el gasto."}

    def _offline_rebut(self, key: str, rival: dict,
                        vitals: dict, sims: dict) -> dict:
        """Réplica calculada con la columna que la otra voz no podía ver."""
        obj = AGENTS[key].objective
        if key == "cardiologia":
            projected = sims.get("inotrope", {}).get(
                "myocardial_o2_balance", 0.0)
            prefix = "No: " if projected < -0.02 else "Sí, pero: "
            return {
                "agent": key, "name": AGENTS[key].name, "objective": obj,
                "stance": "oponerse" if prefix == "No: " else "condicionar",
                "intervention": "inotrope", "confidence": 0.78,
                "evidence": [{
                    "metric": "inotrope.myocardial_o2_balance",
                    "value": projected, "source": "simulation",
                }],
                "reasoning": (
                    f"{prefix}mejorar el flujo sistémico cobra un precio en "
                    "el propio músculo cardíaco. El balance de O2 miocárdico "
                    f"proyectado cambia {projected:.2f}."),
            }

        projected = sims.get("inotrope", {}).get("do2", 0.0)
        return {
            "agent": key, "name": AGENTS[key].name, "objective": obj,
            "stance": "apoyar", "intervention": "inotrope",
            "confidence": 0.82,
            "evidence": [{
                "metric": "inotrope.do2", "value": projected,
                "source": "simulation",
            }],
            "reasoning": (
                "Sí, pero: proteger el corazón sin restaurar el flujo deja "
                "a los tejidos acumulando deuda de oxígeno. La dobutamina "
                f"cambia el DO2 proyectado en {projected:.2f} mL/min."),
        }

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
        stable = assessment.get("status") == "stable"
        if stable:
            tiebreak = (
                "Sin inestabilidad no se expone al paciente a una intervención "
                "solo por mejorar una proyección. Se prioriza observar y "
                "detectar deterioro antes de tratar.")
            recommended = "none"
        else:
            tiebreak = ("Con inestabilidad establecida se prioriza el DO2 "
                        "sistemico sobre el costo miocardico: la hipoperfusion "
                        "tiene un horizonte mas corto. Criterio discutible y "
                        "declarado a proposito.")
            best_do2 = sims and max(
                sims.items(), key=lambda kv: kv[1].get("do2", -9e9))
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

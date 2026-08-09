"""
Servidor del gemelo cardiaco.

POR QUE FastAPI Y NO EL app.py DE FLASK
---------------------------------------
El runtime son tres loops asyncio. Flask es sincrono: meter un loop asyncio
en background exige un hilo aparte, un event loop propio, y coordinar estado
entre hilos. Es fragil justo donde no puedes permitirte fragilidad.

FastAPI corre el runtime como una asyncio.Task en el MISMO loop que atiende
las requests. Cero hilos, cero locks. Y te da SSE gratis, que es el plan B
si Portal falla en medio de la demo.

    uvicorn server:app --host 0.0.0.0 --port 8000

Variables de entorno:
    ANTHROPIC_API_KEY      si falta, los agentes corren en modo offline
    PORTAL_SECRET_KEY      si falta, Portal se desactiva y queda SSE
    CARDIOTWIN_TIME_SCALE  acelera el tiempo fisiologico (default 8)
"""

from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from cardiotwin.sync import EventBus, PortalSync
from cardiotwin.runtime import SimulationRuntime
from cardiotwin.agents import Orchestrator, AGENTS
from cardiotwin.interventions import INTERVENTIONS, assess_state
from cardiotwin.physiology import PhysiologyEngine

SIM_ID = os.environ.get("CARDIOTWIN_SIM_ID", "demo")
TIME_SCALE = float(os.environ.get("CARDIOTWIN_TIME_SCALE", "8"))
ASYSTOLE_GRACE_S = float(os.environ.get("CARDIOTWIN_ASYSTOLE_S", "120"))
ASK_MODEL = os.environ.get("CARDIOTWIN_ASK_MODEL", "claude-sonnet-4-6")

ctx: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    import aiohttp

    bus = EventBus()
    session = aiohttp.ClientSession()
    portal = PortalSync(SIM_ID, session=session)

    runtime = SimulationRuntime(bus, portal=portal, time_scale=TIME_SCALE,
                                asystole_grace_s=ASYSTOLE_GRACE_S)

    client = None
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic()
        except ImportError:
            pass
    runtime.orchestrator = Orchestrator(bus, client=client)

    # El cliente se guarda en ctx para que /api/ask pueda reutilizarlo sin
    # crear una conexion por request.
    ctx.update(bus=bus, portal=portal, runtime=runtime, session=session,
               llm=bool(client), client=client)

    task = asyncio.create_task(runtime.run())
    print(f"[cardiotwin] runtime activo | portal={portal.enabled} "
          f"| llm={bool(client)} | time_scale={TIME_SCALE}")
    try:
        yield
    finally:
        runtime.stop()
        task.cancel()
        await session.close()


app = FastAPI(title="CardioTwin", lifespan=lifespan)

# En hackathon el front suele estar en otro puerto. En produccion esto se
# restringe: allow_origins=["*"] con credenciales es un agujero.
app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)


# ==========================================================================
# Estado y descubrimiento
# ==========================================================================
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "portal": ctx["portal"].health(),
        "llm": ctx["llm"],
        "agents": list(AGENTS.keys()),
        "time_scale": TIME_SCALE,
        "asystole_grace_s": ASYSTOLE_GRACE_S,
        "asystole": ctx["runtime"].engine.s.asystole,
        "disclaimer": ("Modelo de simulacion no validado. No es una "
                       "herramienta clinica."),
    }


@app.get("/api/state")
async def state():
    """Snapshot. Es el plan B si el front pierde el stream."""
    return ctx["runtime"].state()


@app.get("/api/interventions")
async def interventions():
    """El front construye los botones desde aqui, no hardcodeado."""
    return {"interventions": [iv.as_dict() for iv in INTERVENTIONS.values()]}


@app.get("/api/agents")
async def agents():
    return {"agents": [
        {"key": a.key, "name": a.name, "objective": a.objective,
         "sees": a.sees, "blind_to": a.blind_to}
        for a in AGENTS.values()
    ]}


@app.get("/api/events")
async def events(since: float = 0.0):
    """Replay del log. Un cliente que llega tarde reconstruye desde aqui."""
    return {"events": ctx["bus"].replay(since)}


# ==========================================================================
# Stream local (respaldo de Portal)
# ==========================================================================
@app.get("/api/stream")
async def stream():
    """
    SSE con todos los eventos.

    Existe para que la demo NO dependa de que Portal este arriba. Si Portal
    responde, el front usa Portal y esto queda de reserva. Si Portal falla,
    cambias una linea en el front y sigues. Es barato y te salva de perder
    la presentacion por una caida de red ajena.
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=500)

    async def handler(ev):
        try:
            queue.put_nowait(ev.as_dict())
        except asyncio.QueueFull:
            pass          # el cliente lento se pierde eventos, no bloquea

    ctx["bus"].on_any(handler)

    async def gen():
        yield f": conectado\n\n"
        while True:
            ev = await queue.get()
            yield f"event: {ev['type']}\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})


# ==========================================================================
# Portal
# ==========================================================================
class TokenReq(BaseModel):
    user_id: str
    display_name: str = ""


@app.post("/api/portal/token")
async def portal_token(req: TokenReq):
    """
    Acuña el JWT del browser. Esta ruta existe porque la secret key NO puede
    salir del servidor: api.useportal.co rechaza cualquier request que traiga
    header Origin. El browser pide aqui, recibe un JWT, y con ese JWT habla
    con realtime.useportal.co.
    """
    tok = await ctx["portal"].mint_user_token(req.user_id, req.display_name)
    if tok is None:
        raise HTTPException(503, "Portal no configurado (falta PORTAL_SECRET_KEY)")
    if "error" in tok:
        raise HTTPException(502, tok["error"])
    return {
        "token": tok,
        "realtime_host": PortalSync.REALTIME_HOST,
        "channels": {
            "vitals": ctx["portal"].channel("vitals"),
            "events": ctx["portal"].channel("events"),
            "agents": ctx["portal"].channel("agents"),
            "actions": ctx["portal"].channel("actions"),
        },
    }


# ==========================================================================
# Control del escenario
# ==========================================================================
class ShockReq(BaseModel):
    type: str = "cardiogenic"
    severity: float = 1.0


@app.post("/api/scenario/shock")
async def shock(req: ShockReq):
    if req.type not in ("none", "cardiogenic", "hypovolemic", "septic"):
        raise HTTPException(400, f"Tipo desconocido: {req.type}")
    ctx["runtime"].engine.trigger_shock(req.type, req.severity)
    return {"ok": True, "shock": req.type, "severity": req.severity}


@app.post("/api/scenario/reset")
async def reset():
    """Reinicia el paciente. Esencial para ensayar el demo N veces."""
    rt = ctx["runtime"]
    rt.engine = PhysiologyEngine()
    rt._last_status = "stable"
    rt._last_published.clear()
    rt._critical_since = None
    ctx["bus"].log.clear()
    return {"ok": True, "state": rt.state()}


class PresetReq(BaseModel):
    """
    Configuracion inicial de un caso. Todos los campos son opcionales: solo
    lo que venga se aplica sobre el estado por defecto tras el reset. Sirve
    para arrancar la simulacion en el punto donde empieza el caso clinico
    (post-IAM, TSV, choque establecido, etc.) en vez de siempre en un
    paciente sano.
    """
    shock_type: Optional[str] = None       # none|cardiogenic|hypovolemic|septic
    severity: float = 0.0
    heart_rate: Optional[float] = None     # FC de arranque
    hr_baseline: Optional[float] = None    # setpoint del barorreflejo (para TSV)
    contractility: Optional[float] = None  # fraccion de lo normal (0.1-1.5)
    hemoglobin: Optional[float] = None     # g/dL (5-18)
    lactate: Optional[float] = None        # mmol/L de arranque


@app.post("/api/scenario/preset")
async def preset(req: PresetReq):
    """
    Resetea el paciente y aplica una configuracion inicial coherente con
    un caso clinico. Es lo que llama la pantalla de seleccion de paciente
    cuando el usuario da "Iniciar simulacion".
    """
    rt = ctx["runtime"]
    rt.engine = PhysiologyEngine()
    rt._last_status = "stable"
    rt._last_published.clear()
    rt._critical_since = None
    ctx["bus"].log.clear()

    s = rt.engine.s
    if req.heart_rate is not None:
        s.heart_rate = max(20.0, min(220.0, float(req.heart_rate)))
    if req.hr_baseline is not None:
        # El baseline del barorreflejo: sin esto, cualquier HR inicial alta
        # decae en segundos porque el barostato la corrige. Levantar el
        # baseline es como aproximamos taquiarritmia sin remodelar el motor.
        rt.engine._hr_base = max(30.0, min(200.0, float(req.hr_baseline)))
    if req.contractility is not None:
        s.contractility = max(0.10, min(1.50, float(req.contractility)))
    if req.hemoglobin is not None:
        s.hemoglobin = max(5.0, min(18.0, float(req.hemoglobin)))
    if req.lactate is not None:
        s.lactate = max(0.4, min(20.0, float(req.lactate)))
    if req.shock_type and req.shock_type != "none":
        if req.shock_type not in ("cardiogenic", "hypovolemic", "septic"):
            raise HTTPException(400, f"Shock desconocido: {req.shock_type}")
        rt.engine.trigger_shock(req.shock_type, req.severity)

    rt.engine._recompute()
    return {"ok": True, "state": rt.state()}


class InterventionReq(BaseModel):
    key: str
    dose: Optional[float] = None
    actor: str = "usuario"


@app.post("/api/intervention")
async def intervention(req: InterventionReq):
    """
    Aplica una intervencion.

    Si la propuesta llega por el canal sim:{id}:actions de Portal, el
    listener del backend debe terminar llamando AQUI. Nunca aplicar una
    accion directamente desde el mensaje del cliente: se valida y se
    republica el resultado autoritativo.
    """
    out = await ctx["runtime"].apply_intervention(req.key, req.dose, req.actor)
    if "error" in out:
        raise HTTPException(400, out["error"])
    return out


class WhatIfReq(BaseModel):
    interventions: Optional[list[str]] = None
    horizon_s: float = 900.0


@app.post("/api/whatif")
async def whatif(req: WhatIfReq):
    """Ramas what-if. Corre en thread aparte: no congela el monitor."""
    return await ctx["runtime"].run_whatif(req.interventions, req.horizon_s)


class AskReq(BaseModel):
    question: str
    # El front puede mandar su propio snapshot (mismo shape que PatientSnapshot
    # del Next route) o dejarlo vacio y usamos el estado autoritativo del
    # motor. Con state vacio la respuesta habla del "ahora" del servidor,
    # que es lo correcto cuando la pregunta viene fuera del monitor.
    state: Optional[dict] = None


ASK_SYSTEM = """Eres el interprete clinico de un simulador de shock cardiogenico. Trabajas para alguien que NO es medico.

QUE SIMULA ESTE MODELO
Un corazon que falla como bomba. Solo cuatro intervenciones:
- inotrope: dobutamina. Refuerza la fuerza de contraccion. Sube el gasto cardiaco.
- vasopressor: noradrenalina. Sube la resistencia vascular. Sube la presion, pero al subir la poscarga puede reducir el volumen que el corazon expulsa.
- fluid: bolo de 500 mL. Aumenta la precarga.
- none: no intervenir.

Cualquier otra cosa (tromboliticos, cateterismo, stent, ECMO, balon, ventilacion, intubacion, cardioversion, desfibrilacion, antibioticos, transfusion, marcapasos) esta FUERA del alcance: usa "out_of_scope" y dilo sin rodeos.

TU TRABAJO
1. Leer el estado que te dan y decir que le esta pasando al paciente AHORA (campo "reading").
2. Traducir la pregunta a los parametros del motor.

REGLAS DURAS
- NUNCA inventes una cifra. Usa solo los numeros del estado que te paso.
- NUNCA prediscas el resultado de la intervencion. Eso lo calcula el motor, no tu.
- Lenguaje humano primero, sin jerga medica innecesaria.
- Espanol de Colombia, directo, sin adornos.

RESPUESTA (JSON estricto, sin markdown, sin explicaciones fuera del JSON):
{"reading": "1-2 frases sobre lo que le esta pasando al paciente ahora",
 "intervention": "inotrope|vasopressor|fluid|none|out_of_scope",
 "efficacy": 0.0-1.5,
 "delay_s": 0-120,
 "echo": "1 frase confirmando que entendiste la pregunta",
 "reason": "solo si out_of_scope: por que no aplica"}"""


def _snapshot_for_ask(state_dict: dict) -> str:
    """
    Convierte el snapshot (venga del front o del propio motor) al texto
    etiquetado que el modelo lee mejor que un JSON crudo.
    """
    s = state_dict
    ttc = s.get("time_to_critical_s")
    applied = s.get("applied") or []
    return (
        f"ESTADO ACTUAL DEL PACIENTE (medido por el motor, segundo "
        f"{round(s.get('t', 0))} del caso):\n"
        f"- Pulso: {round(s.get('hr', 0))} lpm\n"
        f"- Sangre bombeada (gasto cardiaco): {float(s.get('co', 0)):.1f} L/min\n"
        f"- Presion arterial: {round(s.get('sbp', 0))}/{round(s.get('dbp', 0))} mmHg\n"
        f"- Presion de bombeo (MAP): {round(s.get('map', 0))} mmHg\n"
        f"- Oxigeno en sangre (SpO2): {round(s.get('spo2', 0))}%\n"
        f"- Lactato: {float(s.get('lactate', 0)):.1f} mmol/L\n"
        f"- Perfusion tisular: {round(s.get('perfusion_pct') or s.get('perfusion_index', 1) * 100)}%\n"
        f"- Estado global: {s.get('label') or s.get('status') or 'sin clasificar'}\n"
        + (f"- Tiempo proyectado hasta estado critico: {round(ttc)} s\n" if ttc else "")
        + (f"- Ya se aplico: {', '.join(applied)}\n" if applied else "- Todavia no se ha intervenido\n")
    )


def _snapshot_from_engine() -> dict:
    """Fallback si el front no manda state: usamos el estado autoritativo."""
    st = ctx["runtime"].state()
    v = st["vitals"]
    return {
        "t": v["t"], "hr": v["hr"], "sbp": v["sbp"], "dbp": v["dbp"],
        "map": v["map"], "co": v["co"], "spo2": v["spo2"],
        "lactate": v["lactate"],
        "perfusion_pct": v["perfusion_index"] * 100,
        "status": st["status"], "label": st["label"],
        "applied": [],
    }


@app.post("/api/ask")
async def ask(req: AskReq):
    """
    Traduce una pregunta en lenguaje natural a parametros del motor.

    Este endpoint espeja el contrato de la ruta Next `/api/ask` para que el
    front pueda apuntar a cualquiera de los dos: el Next route llama a
    Claude desde el edge, este lo hace desde el mismo proceso que corre la
    fisiologia. Ventaja de esta ruta: el modelo lee el estado autoritativo
    del motor, no una foto que pudo quedar desfasada en el viaje al browser.
    """
    client = ctx.get("client")
    if client is None:
        raise HTTPException(
            503, "IA no disponible en el backend (falta ANTHROPIC_API_KEY)")

    question = (req.question or "").strip()
    if not question:
        raise HTTPException(400, "missing-question")

    snap = req.state or _snapshot_from_engine()
    user = f"{_snapshot_for_ask(snap)}\nPREGUNTA: {question}"

    try:
        r = await client.messages.create(
            model=ASK_MODEL, max_tokens=600,
            system=ASK_SYSTEM,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in r.content if b.type == "text").strip()
        # Anthropic a veces envuelve el JSON en ```json ... ``` a pesar de
        # pedir "sin markdown": lo pelamos antes de parsear.
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:]
        out = json.loads(text.strip())
    except Exception as e:                                     # noqa: BLE001
        raise HTTPException(502, f"IA fallo: {type(e).__name__}")

    if out.get("intervention") == "out_of_scope":
        return {
            "supported": False,
            "reason": out.get("reason") or (
                "Este gemelo no simula eso. Modela cuatro intervenciones "
                "sobre un corazon que falla como bomba."),
            "reading": out.get("reading", ""),
            "source": "llm",
        }

    return {
        "supported": True,
        "intervention": out.get("intervention", "none"),
        # El schema no puede acotar rangos: se acotan aqui, igual que en Next.
        "efficacy": max(0.0, min(1.5, float(out.get("efficacy", 1.0)))),
        "delay_s": max(0, min(120, int(out.get("delay_s", 30)))),
        "echo": out.get("echo", ""),
        "reading": out.get("reading", ""),
        "source": "llm",
    }


@app.post("/api/deliberate")
async def deliberate():
    """Fuerza una ronda de agentes. Util para ensayar el guion."""
    rt = ctx["runtime"]
    if not rt.orchestrator:
        raise HTTPException(503, "Orquestador no configurado")
    return await rt.orchestrator.deliberate(rt.engine, "solicitud manual")


# ==========================================================================
# Vista 3D: estado fisiologico -> colores de estructuras anatomicas
# ==========================================================================
@app.get("/api/heart3d")
async def heart3d():
    """
    Traduce el estado 0D a instrucciones de coloreado para la malla.

    HONESTIDAD: esto NO es simulacion 3D. No hay propagacion espacial ni
    electromecanica. Es el estado del modelo 0D pintado sobre anatomia.
    Decirlo asi da credibilidad; venderlo como simulacion 3D no sobrevive
    la primera pregunta.
    """
    s = ctx["runtime"].engine.s
    v = s.vitals()

    def norm(x, lo, hi):
        return max(0.0, min(1.0, (x - lo) / (hi - lo)))

    return {
        "sim_time": round(s.t, 1),
        "bpm": v["hr"],
        # Miocardio: se oscurece cuando el balance de O2 se vuelve negativo
        "myocardium_ischemia": round(1.0 - norm(v["myocardial_o2_balance"],
                                                -0.30, 0.20), 3),
        # Arterias coronarias: brillo proporcional al aporte coronario
        "coronary_supply": round(norm(s.coronary_supply, 0.2, 1.1), 3),
        # Vasos pulmonares: congestion por PCWP
        "pulmonary_congestion": round(norm(v["pcwp"], 12.0, 32.0), 3),
        # Tinte global
        "perfusion_index": v["perfusion_index"],
        "spo2": v["spo2"],
        "status": assess_state(s)["status"],
        "attribution": ("Modelo anatomico: BodyParts3D, Database Center for "
                        "Life Science, CC BY-SA 2.1 JP"),
    }


# Sirve el repo del corazon 3D si esta clonado en ./heart3d
if os.path.isdir("heart3d"):
    app.mount("/heart3d", StaticFiles(directory="heart3d", html=True),
              name="heart3d")

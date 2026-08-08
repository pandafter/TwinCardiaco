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
from cardiotwin.ask import translate, to_dose
from cardiotwin.interventions import INTERVENTIONS, assess_state, project_scenario
from cardiotwin.physiology import PhysiologyEngine

SIM_ID = os.environ.get("CARDIOTWIN_SIM_ID", "demo")
TIME_SCALE = float(os.environ.get("CARDIOTWIN_TIME_SCALE", "8"))

ctx: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    import aiohttp

    bus = EventBus()
    session = aiohttp.ClientSession()
    portal = PortalSync(SIM_ID, session=session)

    runtime = SimulationRuntime(bus, portal=portal, time_scale=TIME_SCALE)

    client = None
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic()
        except ImportError:
            pass
    runtime.orchestrator = Orchestrator(bus, client=client)

    # `client` se guarda, no solo el booleano: /api/ask lo necesita para
    # traducir preguntas. Si es None, ask.py cae a sus reglas deterministas.
    ctx.update(bus=bus, portal=portal, runtime=runtime, session=session,
               client=client, llm=bool(client))

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
        # `tok` ES {token, expiresAt}: devolverlo tal cual le dejaba al front
        # un token.token que no es un JWT, y el canal se queda en "blocked"
        # sin decir por que.
        "token": tok["token"],
        "expires_at": tok.get("expiresAt"),
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
    ctx["bus"].log.clear()
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


@app.post("/api/ask")
async def ask(req: AskReq):
    """
    Pregunta en lenguaje natural -> parametros -> simulacion.

    Es el punto 3 del proyecto: sin esto hay cuatro botones, con esto hay
    escenarios infinitos que no se pueden construir sin un modelo de lenguaje.

    La IA solo traduce a {intervention, efficacy, delay_s}. El motor
    determinista calcula la trayectoria. Por eso no puede alucinar una cifra
    clinica: el espacio de salida es cerrado y se valida en ask.py.
    """
    parsed = await translate(req.question, ctx.get("client"))

    if not parsed["supported"]:
        # Fuera de alcance NO es un error: es una respuesta legitima y se
        # devuelve 200. Un 4xx aqui haria que el front lo pintara como fallo.
        return parsed

    rt = ctx["runtime"]
    await ctx["bus"].emit("simulation.started", {
        "question": req.question,
        "intervention": parsed["intervention"],
        "echo": parsed["echo"],
        "source": parsed.get("source", "rules"),
    }, sim_time=rt.engine.s.t)

    # En un hilo aparte: son ~1800 pasos de ODE y bloquearian el event loop,
    # congelando el monitor de todos los conectados mientras se responde a uno.
    sim = await asyncio.to_thread(
        project_scenario, rt.engine, parsed["intervention"],
        to_dose(parsed["intervention"], parsed["efficacy"]),
        900.0, 30.0, 0.5, parsed["delay_s"],
    )
    return {**parsed, "simulation": sim}


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

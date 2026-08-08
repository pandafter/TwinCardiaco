"""
Traduccion de lenguaje natural a PARAMETROS DEL MOTOR.

POR QUE ESTO JUSTIFICA LA IA EN EL PROYECTO
-------------------------------------------
Sin esto hay cuatro botones. Con esto, cualquier escenario que se le ocurra
a quien pregunta:

    "y si le doy volumen y espero 2 minutos?"
    "que pasa si el medicamento no le hace efecto?"
    "y si le pongo media dosis?"

REPARTO DE RESPONSABILIDADES (la regla dura)
--------------------------------------------
La IA NUNCA calcula fisiologia. Solo produce este objeto:

    {intervention, efficacy, delay_s}

y el motor determinista hace el resto. Por eso el modelo no puede alucinar
un numero clinico: el espacio de salida es CERRADO —cuatro intervenciones y
dos escalares acotados— y se valida aqui antes de tocar el motor. Un LLM que
devolviera "la MAP baja a 48" seria imposible de defender; uno que devuelve
{"intervention": "fluid", "efficacy": 1.0} es solo un traductor.

DOS CAMINOS, UN CONTRATO
------------------------
Con ANTHROPIC_API_KEY se traduce con Claude via structured output. Sin ella,
las mismas reglas deterministas que ya usa el front. El contrato de salida es
identico, asi que la demo se ensaya sin quemar cuota y sin depender de la red,
y el fallo del LLM degrada a reglas en vez de tumbar el endpoint.
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
from typing import Any, Optional

from cardiotwin.interventions import INTERVENTIONS

# Las cuatro ramas del modelo. El enum del tool se genera de aqui, asi que el
# espacio de salida del LLM no puede desincronizarse del motor.
BRANCHES = ("none", "fluid", "vasopressor", "inotrope")

# Lenguaje llano -> rama. Un no medico no escribe "inotropico".
MATCHERS: list[tuple[str, tuple[str, ...]]] = [
    ("inotrope", ("dobutamina", "inotropic", "inotrop", "reforzar", "refuerzo",
                  "fuerza", "contractilidad", "bomba")),
    ("vasopressor", ("noradrenalina", "norepinefrina", "vasopresor", "presor",
                     "subir la presion", "subo la presion", "vasoconstric")),
    ("fluid", ("volumen", "liquido", "liquidos", "fluido", "suero", "bolo",
               "cristaloide", "hidrat")),
    ("none", ("nada", "no hago", "no hacer", "no intervengo", "no intervenir",
              "observar", "esperar", "espero", "aguantar")),
]

# Lo que la gente pregunta y este modelo NO simula. Decirlo explicitamente es
# una ventaja ante el jurado: reconocer el limite es mas creible que inventar.
#
# El primer campo se muestra en pantalla y va acentuado; las palabras de
# busqueda van sin tildes porque se comparan contra la entrada normalizada.
OUT_OF_SCOPE: list[tuple[str, tuple[str, ...]]] = [
    ("los trombolíticos", ("trombolit", "fibrinolit")),
    ("la revascularización", ("cateterismo", "angioplast", "stent", "revasculariz")),
    ("el soporte circulatorio mecánico", ("balon", "ecmo", "asistencia ventricular")),
    ("la ventilación mecánica", ("intubar", "intubacion", "ventilacion")),
    # "cardiovierto" no comparte raiz con "cardioversion": hacen falta las tres
    # formas o la conjugacion en primera persona se cuela sin reconocerse.
    ("la cardioversión", ("desfibril", "cardiovers", "cardiovert", "cardiovier",
                          "descarga")),
    ("los antibióticos", ("antibiotic",)),
    ("la transfusión", ("transfus", "sangre")),
]

HUMAN = {
    "none": "no hacer nada",
    "inotrope": "reforzar la bomba",
    "vasopressor": "subir la presión",
    "fluid": "dar volumen",
}

FUERA_DE_ALCANCE = (
    "Este gemelo no simula {what}. Modela cuatro intervenciones sobre un "
    "corazón que falla como bomba: reforzar la bomba, subir la presión, dar "
    "volumen o no hacer nada."
)

# Techos del espacio de parametros. El LLM no elige el rango, lo elige el motor.
MAX_EFFICACY = 2.0
MAX_DELAY_S = 120.0


def _strip(s: str) -> str:
    """Minusculas sin tildes: 'Líquidos' y 'liquidos' son la misma palabra."""
    n = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in n if unicodedata.category(c) != "Mn")


# ==========================================================================
# Validacion: la frontera entre "lo que dijo el modelo" y "lo que toca el motor"
# ==========================================================================
def sanitize(intervention: str, efficacy: float, delay_s: float) -> Optional[dict]:
    """
    Acota lo que venga del LLM al espacio de parametros real.

    Devuelve None si la intervencion no existe. Todo lo demas se recorta en
    vez de rechazarse: un modelo que pide efficacy=7 esta pidiendo "dosis
    alta", y 2.0 es lo mas alto que el motor sabe representar.
    """
    if intervention not in INTERVENTIONS:
        return None
    return {
        "intervention": intervention,
        "efficacy": round(max(0.0, min(float(efficacy), MAX_EFFICACY)), 3),
        "delay_s": round(max(0.0, min(float(delay_s), MAX_DELAY_S)), 1),
    }


def to_dose(intervention: str, efficacy: float) -> Optional[float]:
    """
    efficacy (0 = sin efecto, 1 = dosis estandar) -> dosis del motor.

    Se escala sobre `default_dose` de cada intervencion en vez de hardcodear
    numeros: el bolo son 500 mL y el vasopresor una fraccion de efecto, y esa
    diferencia ya esta declarada en interventions.py.
    """
    iv = INTERVENTIONS[intervention]
    if iv.apply_fn is None:          # "no intervenir" no tiene dosis
        return None
    return iv.default_dose * efficacy


def describe(intervention: str, efficacy: float, delay_s: float) -> str:
    """Como se interpreto la pregunta, para mostrarselo a quien pregunto."""
    dose_note = ""
    if efficacy == 0:
        dose_note = ", suponiendo que no le hace efecto"
    elif efficacy < 0.9:
        dose_note = ", a media dosis"
    elif efficacy > 1.1:
        dose_note = ", a dosis alta"

    delay_note = ""
    if delay_s > 0:
        delay_note = (f", esperando {round(delay_s / 60)} min" if delay_s >= 60
                      else f", esperando {int(delay_s)} s")

    return f"{HUMAN[intervention]}{dose_note}{delay_note}"


# ==========================================================================
# Camino 1: reglas deterministas (offline, y respaldo del LLM)
# ==========================================================================
def parse_rules(question: str) -> dict:
    """
    Mismo comportamiento que `ask.ts` en el front, para que la demo offline
    responda igual que la conectada.
    """
    q = _strip(question)
    if len(q.strip()) < 3:
        return {"supported": False, "reason": "Escribe una pregunta más completa."}

    # 1) Fuera de alcance se dice ANTES de intentar interpretar nada.
    for what, words in OUT_OF_SCOPE:
        if any(_strip(w) in q for w in words):
            return {"supported": False, "reason": FUERA_DE_ALCANCE.format(what=what)}

    # 2) Que intervencion
    intervention = None
    for key, words in MATCHERS:
        if any(_strip(w) in q for w in words):
            intervention = key
            break
    if intervention is None:
        return {"supported": False, "reason": (
            "No identifiqué qué intervención quieres probar. Prueba con: "
            "reforzar la bomba, subir la presión, dar volumen, o no hacer nada.")}

    # 3) Con que eficacia. "no le hace efecto" YA esta dentro del espacio de
    #    parametros: es efficacy = 0. No hay que inventar nada.
    efficacy = 1.0
    if re.search(r"no (le )?(hace|hiciera|hizo) efecto|no funciona|no responde|no sirve", q):
        efficacy = 0.0
    elif re.search(r"media dosis|mitad de (la )?dosis|dosis baja|poquito|poca dosis", q):
        efficacy = 0.5
    elif re.search(r"doble dosis|dosis alta|el doble|mas dosis", q):
        efficacy = 1.5

    # 4) Con que retraso
    delay_s = 0.0
    if m := re.search(r"(\d+)\s*(min|minuto)", q):
        delay_s = int(m.group(1)) * 60.0
    elif m := re.search(r"(\d+)\s*(seg|segundo)", q):
        delay_s = float(m.group(1))

    out = sanitize(intervention, efficacy, delay_s)
    return {"supported": True, **out,
            "echo": describe(out["intervention"], out["efficacy"], out["delay_s"]),
            "source": "rules"}


# ==========================================================================
# Camino 2: Claude con structured output
# ==========================================================================
MODEL = os.environ.get("CARDIOTWIN_ASK_MODEL", "claude-opus-5")

SYSTEM = (
    "Traduces preguntas clinicas en espanol a parametros de un simulador "
    "cardiovascular. NO calculas fisiologia y NO das cifras clinicas: el motor "
    "determinista lo hace. Tu unico trabajo es elegir la herramienta correcta y "
    "rellenar sus campos.\n\n"
    "El simulador modela EXACTAMENTE cuatro intervenciones sobre un corazon que "
    "falla como bomba:\n"
    "  none        no hacer nada, seguir observando\n"
    "  fluid       bolo de cristaloide (volumen, suero, liquidos)\n"
    "  vasopressor noradrenalina (subir la presion)\n"
    "  inotrope    dobutamina (reforzar la bomba, contractilidad)\n\n"
    "efficacy: 0 = el farmaco no hace efecto, 0.5 = media dosis, 1 = dosis "
    "estandar, 1.5 = dosis alta. 'y si no le hace efecto?' es efficacy 0, no "
    "esta fuera de alcance.\n"
    "delay_s: segundos que se espera ANTES de aplicar, 0 si se aplica ya.\n\n"
    "Si piden algo que no sea una de esas cuatro (cardioversion, trombolisis, "
    "cateterismo, intubacion, ECMO, antibioticos, transfusion), usa "
    "fuera_de_alcance. Reconocer el limite es correcto; forzar la pregunta "
    "dentro del modelo no lo es."
)

TOOLS: list[dict[str, Any]] = [
    {
        "name": "simular_escenario",
        "description": (
            "Traduce la pregunta a parametros del motor y corre la simulacion. "
            "Usala cuando la pregunta se pueda expresar como una de las cuatro "
            "intervenciones del modelo."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "intervention": {
                    "type": "string",
                    "enum": list(BRANCHES),
                    "description": "Que intervencion se prueba.",
                },
                "efficacy": {
                    "type": "number",
                    "description": "0 = sin efecto, 0.5 = media dosis, 1 = estandar, 1.5 = alta.",
                },
                "delay_s": {
                    "type": "number",
                    "description": "Segundos de espera antes de aplicar. 0 = ahora.",
                },
                "echo": {
                    "type": "string",
                    "description": (
                        "Como interpretaste la pregunta, en espanol llano y en "
                        "infinitivo. Ejemplo: 'dar volumen, esperando 2 min'."
                    ),
                },
            },
            "required": ["intervention", "efficacy", "delay_s", "echo"],
            "additionalProperties": False,
        },
    },
    {
        "name": "fuera_de_alcance",
        "description": (
            "Usala cuando la pregunta pida algo que este simulador no modela. "
            "Es la respuesta correcta, no un fallo."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": (
                        "Explicacion en espanol de que no se simula y que si. "
                        "Una o dos frases, sin jerga."
                    ),
                },
            },
            "required": ["reason"],
            "additionalProperties": False,
        },
    },
]


async def parse_llm(client: Any, question: str) -> Optional[dict]:
    """
    Traduce con Claude. Devuelve None si algo falla, para que el llamante
    caiga a reglas: preferimos una respuesta determinista a un error 502.

    `tool_choice: any` obliga a elegir una de las dos herramientas, asi que no
    hay camino en el que el modelo conteste prosa libre.

    El thinking se deja ACTIVO a proposito. Con thinking desactivado, Opus 5
    puede escribir la llamada a la herramienta como texto visible en vez de
    emitirla: el turno termina bien, la herramienta nunca corre y nadie se
    entera. `effort: low` da la latencia que necesitamos sin ese riesgo.
    """
    try:
        msg = await client.messages.create(
            model=MODEL,
            max_tokens=2048,          # cabe el thinking + la llamada
            system=SYSTEM,
            tools=TOOLS,
            tool_choice={"type": "any"},
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": question}],
        )
    except Exception as e:                             # noqa: BLE001
        print(f"[ask] LLM no disponible ({type(e).__name__}), uso reglas")
        return None

    call = next((b for b in msg.content if getattr(b, "type", None) == "tool_use"), None)
    if call is None:
        return None

    if call.name == "fuera_de_alcance":
        reason = (call.input or {}).get("reason", "").strip()
        return {"supported": False, "reason": reason} if reason else None

    data = call.input or {}
    out = sanitize(data.get("intervention", ""),
                   data.get("efficacy", 1.0),
                   data.get("delay_s", 0.0))
    if out is None:
        # El enum deberia impedirlo; si pasa, reglas antes que basura al motor.
        return None

    echo = (data.get("echo") or "").strip() or describe(
        out["intervention"], out["efficacy"], out["delay_s"])
    return {"supported": True, **out, "echo": echo, "source": "llm"}


async def translate(question: str, client: Any = None) -> dict:
    """
    Punto de entrada. Con cliente LLM traduce con Claude y cae a reglas si
    falla; sin cliente, reglas directamente. Misma forma de salida siempre.
    """
    if client is not None:
        if (out := await parse_llm(client, question)) is not None:
            return out
    return parse_rules(question)

"""
Intervenciones, proyecciones what-if y deteccion de inestabilidad.

POR QUE ESTAS TRES INTERVENCIONES
---------------------------------
Estan elegidas para que NO exista una respuesta obviamente correcta. Cada
una gana en una metrica y pierde en otra, lo que produce desacuerdo GENUINO
entre agentes con funciones objetivo distintas (ver agents.py). Si las tres
opciones fueran claramente ordenables, el consenso seria teatro.

  Volumen        -> sube precarga. En shock cardiogenico la curva de
                    Frank-Starling ya esta en meseta: casi no sube el gasto
                    y si empeora la congestion pulmonar. DANINA aqui,
                    salvadora en shock hipovolemico.

  Vasopresor     -> sube SVR. La MAP SUBE (el numero que todos miran)
                    mientras el gasto y el lactato EMPEORAN, porque el
                    ventriculo fallido es hipersensible a la poscarga.
                    Esta disociacion es el corazon del demo.

  Inotropico     -> sube contractilidad y baja SVR. El gasto y el DO2
                    SUBEN, el lactato baja. Pero la MAP puede caer aun mas
                    y la taquicardia aumenta el consumo miocardico de O2.

TIEMPO ESTIMADO HASTA ESTADO CRITICO
------------------------------------
Es una PROYECCION DEL PROPIO MODELO, no una prediccion clinica validada.
Se obtiene corriendo el motor hacia adelante sin intervenir hasta cruzar un
umbral. Hay que rotularlo asi en la interfaz: si un jurado pregunta contra
que esta validado, la respuesta honesta es "contra nada, es la trayectoria
del modelo". Presentarlo como prediccion seria mentir.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Callable, Dict, List, Optional

from cardiotwin.physiology import PhysiologyEngine, PhysioState

# ==========================================================================
# Umbrales de estado critico
# ==========================================================================
CRITICAL_THRESHOLDS = {
    "map_min": 60.0,          # hipoperfusion de organo
    "lactate_max": 4.0,       # hiperlactatemia severa
    "ci_min": 1.8,            # indice cardiaco critico
    "spo2_min": 0.88,
    "do2_min": 330.0,         # DO2 critico: bajo esto, metabolismo anaerobio
}

INSTABILITY_THRESHOLDS = {
    "map_min": 70.0,
    "lactate_max": 2.0,
    "ci_min": 2.2,            # criterio de shock cardiogenico
    "hr_max": 110.0,
    "spo2_min": 0.94,
}


# ==========================================================================
@dataclass
class Intervention:
    """Una accion terapeutica aplicable al motor."""
    key: str
    name: str
    category: str                         # "farmaco" | "volumen" | "procedimiento"
    description: str
    mechanism: str                        # explicacion mecanicista, para el agente
    risks: List[str] = field(default_factory=list)
    apply_fn: Optional[Callable[[PhysiologyEngine, float], None]] = None
    default_dose: float = 1.0
    onset_s: float = 30.0

    def apply(self, engine: PhysiologyEngine, dose: float = None) -> None:
        if self.apply_fn:
            self.apply_fn(engine, dose if dose is not None else self.default_dose)

    def as_dict(self) -> dict:
        d = asdict(self)
        d.pop("apply_fn", None)
        return d


# --- Implementaciones -----------------------------------------------------
def _fluid_bolus(e: PhysiologyEngine, dose: float) -> None:
    """dose = mL de cristaloide. Sube el volumen venoso -> precarga."""
    e.s.v_venous += dose


def _vasopressor(e: PhysiologyEngine, dose: float) -> None:
    """
    dose = fraccion de efecto (1.0 = dosis moderada de noradrenalina).
    Sube SVR fuerte, contractilidad leve (efecto beta-1 menor), HR leve.
    """
    e.s.drug_svr += 0.50 * dose
    e.s.drug_contractility += 0.12 * dose
    e.s.drug_hr += 5.0 * dose
    e.s.infusion_running = True


def _inotrope(e: PhysiologyEngine, dose: float) -> None:
    """
    dose = fraccion de efecto (1.0 = dobutamina a dosis media).
    Sube contractilidad, baja SVR (vasodilatacion beta-2), sube HR.
    """
    e.s.drug_contractility += 0.85 * dose
    e.s.drug_svr -= 0.22 * dose
    e.s.drug_hr += 14.0 * dose
    e.s.infusion_running = True


INTERVENTIONS: Dict[str, Intervention] = {
    "none": Intervention(
        key="none", name="No intervenir", category="observacion",
        description="Continuar monitorizando sin accion terapeutica.",
        mechanism="Deja que la trayectoria actual siga su curso.",
        risks=["Si el paciente esta descompensando, se pierde tiempo."],
        apply_fn=None,
    ),
    "fluid": Intervention(
        key="fluid", name="Bolo de cristaloide 500 mL", category="volumen",
        description="Carga de volumen intravenosa rapida.",
        mechanism="Sube el volumen venoso -> sube PVC -> sube precarga. "
                  "El efecto sobre el gasto depende de donde este el "
                  "paciente en su curva de Frank-Starling.",
        risks=["Si el ventriculo ya esta en meseta, no sube el gasto y si "
               "sube la PCWP: empeora el edema pulmonar y la SpO2.",
               "Efecto practicamente irreversible en el corto plazo."],
        apply_fn=_fluid_bolus, default_dose=500.0, onset_s=60.0,
    ),
    "vasopressor": Intervention(
        key="vasopressor", name="Noradrenalina", category="farmaco",
        description="Vasopresor alfa-adrenergico en infusion.",
        mechanism="Vasoconstriccion -> sube SVR -> sube MAP. Efecto beta-1 "
                  "menor sobre contractilidad.",
        risks=["Sube la poscarga. En un ventriculo fallido eso REDUCE el "
               "volumen sistolico: la MAP mejora mientras el gasto y el "
               "lactato empeoran.",
               "Vasoconstriccion esplacnica: puede empeorar la perfusion "
               "regional aunque la MAP se vea bien."],
        apply_fn=_vasopressor, default_dose=1.0, onset_s=30.0,
    ),
    "inotrope": Intervention(
        key="inotrope", name="Dobutamina", category="farmaco",
        description="Inotropico beta-adrenergico en infusion.",
        mechanism="Sube la contractilidad -> sube el volumen sistolico y el "
                  "gasto. Vasodilatacion beta-2 baja la SVR, lo que ademas "
                  "reduce la poscarga.",
        risks=["La vasodilatacion puede bajar aun mas la MAP.",
               "Taquicardia: aumenta el consumo miocardico de O2 y es "
               "arritmogenica.",
               "Si hay isquemia activa, el aumento de demanda puede "
               "extender el infarto."],
        apply_fn=_inotrope, default_dose=1.0, onset_s=45.0,
    ),
}


# ==========================================================================
# Deteccion de estado
# ==========================================================================
def assess_state(s: PhysioState) -> dict:
    """Clasifica el estado hemodinamico y lista los criterios cumplidos."""
    v = s.vitals()
    crit, unstable = [], []

    if v["map"] < CRITICAL_THRESHOLDS["map_min"]:
        crit.append(f"MAP {v['map']} < 60 mmHg")
    elif v["map"] < INSTABILITY_THRESHOLDS["map_min"]:
        unstable.append(f"MAP {v['map']} < 70 mmHg")

    if v["lactate"] > CRITICAL_THRESHOLDS["lactate_max"]:
        crit.append(f"Lactato {v['lactate']} > 4.0 mmol/L")
    elif v["lactate"] > INSTABILITY_THRESHOLDS["lactate_max"]:
        unstable.append(f"Lactato {v['lactate']} > 2.0 mmol/L")

    if v["ci"] < CRITICAL_THRESHOLDS["ci_min"]:
        crit.append(f"Indice cardiaco {v['ci']} < 1.8")
    elif v["ci"] < INSTABILITY_THRESHOLDS["ci_min"]:
        unstable.append(f"Indice cardiaco {v['ci']} < 2.2")

    if v["spo2"] < CRITICAL_THRESHOLDS["spo2_min"] * 100:
        crit.append(f"SpO2 {v['spo2']}% < 88%")
    elif v["spo2"] < INSTABILITY_THRESHOLDS["spo2_min"] * 100:
        unstable.append(f"SpO2 {v['spo2']}% < 94%")

    if v["do2"] < CRITICAL_THRESHOLDS["do2_min"]:
        crit.append(f"DO2 {v['do2']} < 330 mL/min (umbral anaerobio)")

    if v["hr"] > INSTABILITY_THRESHOLDS["hr_max"]:
        unstable.append(f"FC {v['hr']} > 110 lpm")

    if crit:
        status, label = "critical", "ESTADO CRITICO"
    elif unstable:
        status, label = "unstable", "INESTABILIDAD HEMODINAMICA"
    else:
        status, label = "stable", "ESTABLE"

    # Shock cardiogenico: CI < 2.2 con PCWP > 18 es la definicion hemodinamica
    phenotype = None
    if v["ci"] < 2.2 and v["pcwp"] > 18.0:
        phenotype = "patron cardiogenico (CI bajo con presiones de llenado altas)"
    elif v["ci"] < 2.2 and v["pcwp"] < 10.0:
        phenotype = "patron hipovolemico (CI bajo con presiones de llenado bajas)"
    elif v["ci"] > 3.5 and v["svr"] < 800:
        phenotype = "patron distributivo (gasto alto con resistencia baja)"

    return {
        "status": status,
        "label": label,
        "critical_criteria": crit,
        "instability_criteria": unstable,
        "hemodynamic_phenotype": phenotype,
        "perfusion_index": v["perfusion_index"],
        "vitals": v,
    }


def time_to_critical(engine: PhysiologyEngine, horizon_s: float = 3600.0,
                     dt: float = 0.5) -> Optional[float]:
    """
    Proyecta la trayectoria SIN intervenir y devuelve los segundos hasta
    cruzar el primer umbral critico. None si no lo cruza en el horizonte.

    ESTO NO ES UNA PREDICCION CLINICA. Es la trayectoria del modelo bajo el
    supuesto de que el insulto sigue igual. Rotulalo asi en la interfaz.
    """
    sim = engine.clone()
    # Si YA esta critico, el tiempo restante es cero. Sin esta guarda la
    # funcion devolvia None (= "no cruza") para un paciente ya critico,
    # que es el peor falso negativo posible en esta interfaz.
    if assess_state(sim.s)["status"] == "critical":
        return 0.0
    for i in range(int(horizon_s / dt)):
        sim.step(dt)
        if assess_state(sim.s)["status"] == "critical":
            return round((i + 1) * dt, 1)
    return None


# ==========================================================================
# Proyecciones what-if
# ==========================================================================
def project_scenario(engine: PhysiologyEngine,
                     intervention_key: str,
                     dose: Optional[float] = None,
                     horizon_s: float = 900.0,
                     sample_every_s: float = 30.0,
                     dt: float = 0.5,
                     delay_s: float = 0.0) -> dict:
    """
    Clona el estado ACTUAL, aplica una intervencion y proyecta.
    No toca el paciente real: es una rama del gemelo.

    `delay_s` espera antes de aplicar, con el paciente deteriorandose
    mientras tanto. No es un adorno: "dar volumen ahora" y "dar volumen en
    dos minutos" son decisiones distintas, y en un paciente que cae la
    diferencia es justo lo que hay que poder ver. El retraso se cuenta
    DENTRO del horizonte, para que las ramas sigan siendo comparables entre
    si: alargarlo seria comparar 15 min de una con 17 de otra.
    """
    if intervention_key not in INTERVENTIONS:
        return {"error": f"Intervencion desconocida: {intervention_key}"}

    iv = INTERVENTIONS[intervention_key]
    sim = engine.clone()

    traj = []
    n = int(horizon_s / dt)
    every = max(1, int(sample_every_s / dt))
    crossed_at = None
    applied_at = None
    delay_steps = int(max(0.0, min(delay_s, horizon_s)) / dt)

    for i in range(n):
        # Con delay_s = 0 esto aplica antes del primer step, que es
        # exactamente lo que hacia antes de existir el retraso.
        if applied_at is None and i >= delay_steps:
            iv.apply(sim, dose)
            applied_at = round(i * dt, 1)

        sim.step(dt)
        if crossed_at is None and assess_state(sim.s)["status"] == "critical":
            crossed_at = round(i * dt, 1)
        if i % every == 0:
            traj.append(sim.s.vitals())

    final = assess_state(sim.s)
    start = assess_state(engine.s)["vitals"]
    end = final["vitals"]

    return {
        "intervention": iv.key,
        "name": iv.name,
        "dose": dose if dose is not None else iv.default_dose,
        "horizon_s": horizon_s,
        "delay_s": round(delay_s, 1),
        # Cuando aterrizo de verdad, no cuando se pidio. La UI lo necesita
        # para marcar el instante en la curva.
        "applied_at_s": applied_at,
        "trajectory": traj,
        "final_status": final["status"],
        "final_label": final["label"],
        "time_to_critical_s": crossed_at,
        "deltas": {
            k: round(end[k] - start[k], 2)
            for k in ("map", "co", "ci", "spo2", "lactate", "do2", "hr",
                      "pcwp", "myocardial_o2_balance", "mvo2")
        },
        "mechanism": iv.mechanism,
        "risks": iv.risks,
    }


def compare_scenarios(engine: PhysiologyEngine,
                      intervention_keys: Optional[List[str]] = None,
                      horizon_s: float = 900.0) -> dict:
    """
    Corre varias ramas what-if desde el MISMO estado actual.

    Deliberadamente NO devuelve una recomendacion. Devuelve las trayectorias
    y sus compromisos. Rankear por una sola metrica es precisamente el error
    que este demo debe exponer: la rama que mas sube la MAP puede ser la que
    mas empeora el lactato.
    """
    keys = intervention_keys or ["none", "fluid", "vasopressor", "inotrope"]
    scenarios = [project_scenario(engine, k, horizon_s=horizon_s) for k in keys]

    def best_by(metric: str, higher_is_better: bool):
        vals = [(s["deltas"][metric], s["intervention"]) for s in scenarios
                if "deltas" in s]
        if not vals:
            return None
        return (max(vals) if higher_is_better else min(vals))[1]

    return {
        "from_state": assess_state(engine.s)["vitals"],
        "scenarios": scenarios,
        "best_by_metric": {
            "map": best_by("map", True),
            "cardiac_output": best_by("co", True),
            "lactate": best_by("lactate", False),
            "do2": best_by("do2", True),
            "spo2": best_by("spo2", True),
            "pcwp": best_by("pcwp", False),
            "myocardial_o2_balance": best_by("myocardial_o2_balance", True),
        },
        "note": ("Cuando 'map' y 'lactate' apuntan a intervenciones "
                 "distintas, hay un conflicto real de objetivos, no ruido. "
                 "Ese es el caso que el orquestador debe resolver "
                 "explicitamente."),
    }

"""
Motor fisiologico 0D del paciente virtual.

FILOSOFIA
---------
No modela todo el cuerpo. Modela una CADENA CAUSAL CERRADA donde cada flecha
es fisiologia real, de modo que mover una variable propague efectos
coherentes al resto.

Lo esencial es que la circulacion tenga DOS COMPARTIMENTOS (arterial y
venoso) con conservacion de volumen entre ellos. Con un solo compartimento
la PVC nunca sube, y sin PVC no hay congestion, no hay shunt pulmonar y la
SpO2 jamas cae: el shock cardiogenico se vuelve infisiologico.

    corazon:   venoso --CO--> arterial
    periferia: arterial --Q_sys--> venoso        Q_sys = (MAP - PVC)/R

    Si cae la contractilidad, CO < Q_sys transitoriamente. El volumen se
    acumula en el lado venoso -> PVC sube -> congestion.

CADENA CAUSAL (shock cardiogenico)
----------------------------------
    contractilidad v
      -> volumen sistolico v -> gasto cardiaco v
        -> MAP v -> BARORREFLEJO: HR ^ , SVR ^
             -> SVR ^ sube poscarga -> volumen sistolico v   [CICLO VICIOSO]
        -> el volumen se represa: PVC ^ -> shunt ^ -> SpO2 v
        -> DO2 v -> deficit de O2 -> lactato ^ -> FR ^

LA TRAMPA QUE EL DEMO DEBE EXPONER
----------------------------------
Un vasopresor SUBE la MAP (el numero que todos miran) mientras BAJA el
gasto cardiaco y EMPEORA el lactato (el numero que importa). Esa disociacion
es el argumento de por que hace falta un gemelo y no una tabla de rangos.

LIMITES
-------
Parametros agrupados. Sin circulacion pulmonar separada, sin autorregulacion
regional, sin farmacocinetica real. Valores fisiologicamente plausibles pero
NO validados contra pacientes. Motor de escenarios, no predictor.
"""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass, asdict
from typing import Literal, Optional

# ==========================================================================
# Referencia: adulto de 70 kg, BSA 1.73 m2
# ==========================================================================
V_ART_UNSTRESSED = 700.0     # mL
V_VEN_UNSTRESSED = 3350.0    # mL
C_ART = 1.7                  # mL/mmHg
C_VEN = 160.0                # mL/mmHg
V_BLOOD_NORMAL = 4900.0      # mL (700+3350 no tensionados + ~850 tensionados)

SV_MAX = 130.0               # mL, meseta de Frank-Starling
K_STARLING = 4.5             # mmHg

SVR_NORMAL = 1250.0          # dyn*s*cm^-5
HR_INTRINSIC = 70.0
MAP_SETPOINT = 88.0          # punto de ajuste del barorreflejo

HB_NORMAL = 15.0
VO2_DEMAND = 250.0           # mL O2/min
O2ER_MAX = 0.62

LACTATE_BASELINE = 1.0
RR_BASELINE = 14.0

TAU_HR = 8.0                 # s
TAU_SVR = 30.0
TAU_RR = 15.0

# Cinetica del lactato (por segundo)
K_LACTATE_PROD = 3.2e-5      # por (mL O2/min) de deficit
K_LACTATE_CLEAR = 1.1e-3     # depuracion de primer orden

ShockType = Literal["none", "cardiogenic", "hypovolemic", "septic"]


# ==========================================================================
@dataclass
class PhysioState:
    """Estado completo del paciente en un instante."""

    t: float = 0.0                        # s de tiempo fisiologico

    # --- Estados que se integran ---
    v_arterial: float = 853.0             # mL
    v_venous: float = 4147.0              # mL
    contractility: float = 1.0            # fraccion de lo normal
    svr: float = SVR_NORMAL
    heart_rate: float = 72.0
    lactate: float = LACTATE_BASELINE
    resp_rate: float = RR_BASELINE
    hemoglobin: float = HB_NORMAL
    venous_recruitment: float = 0.0       # mL reclutados por venoconstriccion
    infusion_running: bool = False        # hay una infusion activa

    # --- Efectos farmacologicos activos ---
    drug_contractility: float = 0.0       # delta multiplicativo
    drug_svr: float = 0.0                 # delta multiplicativo
    drug_hr: float = 0.0                  # delta absoluto (lpm)

    # --- Derivadas ---
    cvp: float = 5.0
    pcwp: float = 8.0                     # presion de enclavamiento pulmonar
    stroke_volume: float = 70.0
    cardiac_output: float = 5.0           # L/min
    cardiac_index: float = 2.9
    map: float = 90.0
    sbp: float = 120.0
    dbp: float = 78.0
    pulse_pressure: float = 42.0
    pulmonary_shunt: float = 0.03
    spo2: float = 0.98
    cao2: float = 19.7
    do2: float = 1000.0
    vo2: float = 250.0
    o2er: float = 0.25
    o2_deficit: float = 0.0
    rhythm: str = "sinusal"
    perfusion_index: float = 1.0
    mvo2: float = 0.87                    # demanda miocardica de O2 (relativa)
    coronary_supply: float = 1.0          # aporte coronario (relativo)
    myocardial_o2_balance: float = 0.13   # aporte - demanda; <0 = isquemia

    # --- Insulto ---
    shock_type: ShockType = "none"
    shock_severity: float = 0.0

    # --- Paro. Se dispara desde el runtime cuando el paciente lleva demasiado
    #     tiempo critico sin intervencion. Una vez True, el motor deja de
    #     bombear y ninguna intervencion revive: la demo pide un reset.
    asystole: bool = False

    def as_dict(self) -> dict:
        return {k: (round(v, 4) if isinstance(v, float) else v)
                for k, v in asdict(self).items()}

    def vitals(self) -> dict:
        """Subconjunto que va al monitor y al portal."""
        return {
            "t": round(self.t, 1),
            "hr": round(self.heart_rate + self.drug_hr),
            "sbp": round(self.sbp), "dbp": round(self.dbp),
            "map": round(self.map, 1),
            "spo2": round(self.spo2 * 100, 1),
            "rr": round(self.resp_rate),
            "lactate": round(self.lactate, 2),
            "co": round(self.cardiac_output, 2),
            "ci": round(self.cardiac_index, 2),
            "sv": round(self.stroke_volume),
            "cvp": round(self.cvp, 1),
            "pcwp": round(self.pcwp, 1),
            "svr": round(self.svr * (1.0 + self.drug_svr)),
            "do2": round(self.do2),
            "o2er": round(self.o2er, 3),
            "rhythm": self.rhythm,
            "perfusion_index": round(self.perfusion_index, 3),
            "mvo2": round(self.mvo2, 3),
            "myocardial_o2_balance": round(self.myocardial_o2_balance, 3),
        }


# ==========================================================================
class PhysiologyEngine:
    """
    Integrador. `step(dt)` avanza dt segundos de tiempo FISIOLOGICO.

    El loop de tiempo real llama step() a alta frecuencia (20 Hz) y publica
    a baja frecuencia (1 Hz). Separar ambas cosas evita que el barorreflejo
    se vea escalonado en pantalla.

    `time_scale` acelera el tiempo fisiologico respecto al tiempo de pared:
    con time_scale=8 un deterioro de 40 min ocurre en 5 min de demo.
    """

    def __init__(self, state: Optional[PhysioState] = None,
                 baroreflex: bool = True, bsa: float = 1.73):
        self.s = state or PhysioState()
        self.baroreflex = baroreflex
        self.bsa = bsa
        self._hr_base = HR_INTRINSIC
        self._svr_base = SVR_NORMAL
        self._recompute()

    # ------------------------------------------------------------------
    def _recompute(self) -> None:
        s = self.s

        # --- Presiones a partir de los volumenes tensionados ---
        s.cvp = max(0.0, (s.v_venous - V_VEN_UNSTRESSED
                          + s.venous_recruitment) / C_VEN)
        s.map = max(5.0, (s.v_arterial - V_ART_UNSTRESSED) / C_ART)

        # --- Frank-Starling con meseta ---
        eff_c = max(0.05, s.contractility * (1.0 + s.drug_contractility))
        sv = SV_MAX * eff_c * s.cvp / (K_STARLING + s.cvp)

        # --- Poscarga. Un corazon fallido es MUCHO mas sensible a ella:
        #     por eso el vasopresor hunde el gasto en shock cardiogenico.
        eff_svr = max(250.0, s.svr * (1.0 + s.drug_svr))
        sens = 0.20 + 0.60 * (1.0 - min(eff_c, 1.0))
        sv *= (SVR_NORMAL / eff_svr) ** sens

        # --- Taquicardia extrema acorta el llenado diastolico ---
        eff_hr = max(20.0, s.heart_rate + s.drug_hr)
        if eff_hr > 130.0:
            sv *= max(0.40, 1.0 - (eff_hr - 130.0) * 0.007)

        s.stroke_volume = max(1.0, sv)
        s.cardiac_output = eff_hr * s.stroke_volume / 1000.0
        s.cardiac_index = s.cardiac_output / self.bsa

        s.pulse_pressure = s.stroke_volume / C_ART
        s.sbp = s.map + (2.0 / 3.0) * s.pulse_pressure
        s.dbp = s.map - (1.0 / 3.0) * s.pulse_pressure

        # --- Congestion retrograda -> shunt pulmonar -> hipoxemia ---
        # El ventriculo fallido necesita MUCHA mas presion de llenado para
        # el mismo volumen sistolico: la sangre se represa hacia el pulmon.
        # PCWP > 18 mmHg con CI < 2.2 es la definicion hemodinamica de
        # shock cardiogenico, y es lo que produce el edema pulmonar.
        # PCWP se topa en 38: por encima de eso el pulmon ya esta inundado
        # y el modelo no tiene resolucion para distinguir grados.
        s.pcwp = min(38.0, (s.cvp + 3.0)
                     * (1.0 + 1.05 * (1.0 / max(eff_c, 0.12) - 1.0)))
        congestion = max(0.0, s.pcwp - 18.0)
        s.pulmonary_shunt = min(0.28, 0.03 + 0.010 * congestion)
        s.spo2 = max(0.55, 0.98 - 1.05 * (s.pulmonary_shunt - 0.03))

        # --- Transporte de oxigeno ---
        s.cao2 = 1.34 * s.hemoglobin * s.spo2 + 0.3
        s.do2 = s.cardiac_output * s.cao2 * 10.0
        s.vo2 = min(VO2_DEMAND, s.do2 * O2ER_MAX)
        s.o2_deficit = max(0.0, VO2_DEMAND - s.vo2)
        s.o2er = s.vo2 / s.do2 if s.do2 > 0 else 1.0

        # --- Indice compuesto de perfusion ---
        s.perfusion_index = round(
            0.30 * _clamp((s.map - 45.0) / 40.0)
            + 0.40 * _clamp((s.do2 - 350.0) / 500.0)
            + 0.30 * _clamp((5.0 - s.lactate) / 3.5), 4)

        # --- Balance de oxigeno MIOCARDICO ---
        # Demanda ~ doble producto (FC x presion sistolica) x contractilidad.
        # Aporte ~ perfusion coronaria, que ocurre en DIASTOLE y depende de
        # la presion diastolica.
        # Sin este balance un inotropico parece gratis y no hay conflicto
        # real entre agentes: sube el gasto sin ningun costo. Con el, la
        # taquicardia y la contractilidad que el inotropico induce cobran
        # su precio en isquemia.
        s.mvo2 = (eff_hr * s.sbp / 10000.0) * (0.55 + 0.45 * eff_c)
        s.coronary_supply = s.dbp * (1.0 - 0.0032 * max(0.0, eff_hr - 60.0)) / 78.0
        s.myocardial_o2_balance = s.coronary_supply - s.mvo2

        s.rhythm = self._rhythm(eff_hr)

        # --- Paro cardiaco. Se aplica AL FINAL para pisar todo lo demas: sin
        #     bombeo, `map` y `pcwp` seguiran cayendo por si solos en step()
        #     porque q_sys drena arterial->venoso mientras CO=0.
        if s.asystole:
            s.heart_rate = 0.0
            s.stroke_volume = 0.0
            s.cardiac_output = 0.0
            s.cardiac_index = 0.0
            s.pulse_pressure = 0.0
            s.sbp = s.map
            s.dbp = s.map
            s.rhythm = "asistolia"

    @staticmethod
    def _rhythm(hr: float) -> str:
        if hr > 150: return "taquicardia sinusal severa"
        if hr > 100: return "taquicardia sinusal"
        if hr < 50:  return "bradicardia sinusal"
        return "sinusal"

    # ------------------------------------------------------------------
    def step(self, dt: float) -> PhysioState:
        s = self.s
        s.t += dt

        self._progress_shock(dt)

        # --- Circulacion: conservacion de volumen entre compartimentos ---
        # R en mmHg/(mL/s). SVR/80 da mmHg/(L/min); *60/1000 -> mmHg/(mL/s)
        eff_svr = max(250.0, s.svr * (1.0 + s.drug_svr))
        R = (eff_svr / 80.0) * 0.06
        q_sys = max(0.0, (s.map - s.cvp) / R)        # mL/s, arterial -> venoso
        co_mL_s = s.cardiac_output * 1000.0 / 60.0   # mL/s, venoso -> arterial

        s.v_arterial += (co_mL_s - q_sys) * dt
        s.v_venous += (q_sys - co_mL_s) * dt
        s.v_arterial = max(V_ART_UNSTRESSED + 5.0, s.v_arterial)
        s.v_venous = max(V_VEN_UNSTRESSED - 400.0, s.v_venous)

        # --- Barorreflejo. Produce el shock COMPENSADO (MAP casi normal
        #     con lactato ya subiendo) y hace que el colapso parezca subito
        #     cuando la compensacion se agota.
        #     En asistolia no aplica: el simpatico no puede reactivar un
        #     corazon parado y dejarlo intentarlo haria "revivir" la FC.
        if self.baroreflex and not s.asystole:
            err = MAP_SETPOINT - s.map
            hr_t = _bound(self._hr_base + 1.30 * err, 45.0, 170.0)
            svr_t = _bound(self._svr_base + 18.0 * err, 450.0, 2400.0)
            s.heart_rate += (hr_t - s.heart_rate) * (dt / TAU_HR)
            s.svr += (svr_t - s.svr) * (dt / TAU_SVR)
            # Venoconstriccion: el simpatico convierte volumen no tensionado
            # en tensionado, lo que sostiene la precarga. Es la reserva que
            # se agota y hace que el colapso parezca subito.
            s.venous_recruitment += (
                _bound(9.0 * err, 0.0, 550.0) - s.venous_recruitment
            ) * (dt / 45.0)

        # --- Lactato: produccion por deficit, depuracion que a su vez se
        #     deteriora cuando el higado esta hipoperfundido.
        prod = K_LACTATE_PROD * s.o2_deficit
        clear = (K_LACTATE_CLEAR * _clamp(s.do2 / 700.0)
                 * max(0.0, s.lactate - LACTATE_BASELINE))
        s.lactate = _bound(s.lactate + (prod - clear) * dt, 0.4, 22.0)

        # --- Compensacion respiratoria de la acidosis ---
        rr_t = _bound(RR_BASELINE + 4.0 * (s.lactate - LACTATE_BASELINE), 8.0, 45.0)
        s.resp_rate += (rr_t - s.resp_rate) * (dt / TAU_RR)

        self._decay_drugs(dt)
        self._recompute()
        return s

    def _progress_shock(self, dt: float) -> None:
        s = self.s
        # Isquemia por desbalance de O2 miocardico: si la demanda supera al
        # aporte, el miocardio pierde contractilidad. Este es el CICLO
        # VICIOSO que castiga a los inotropicos y crea el conflicto real
        # entre "subir el gasto ahora" y "no extender el infarto".
        if s.myocardial_o2_balance < 0.0:
            s.contractility = max(
                0.10, s.contractility + 9.0e-4 * s.myocardial_o2_balance * dt)
        if s.shock_type == "none" or s.shock_severity <= 0:
            return
        k = s.shock_severity * dt
        if s.shock_type == "cardiogenic":
            # Isquemia en evolucion: ~40 min de 1.0 a 0.20 con severidad 1.0
            s.contractility = max(0.12, s.contractility - 3.3e-4 * k)
        elif s.shock_type == "hypovolemic":
            s.v_venous = max(V_VEN_UNSTRESSED - 400.0, s.v_venous - 0.55 * k)
        elif s.shock_type == "septic":
            self._svr_base = max(380.0, self._svr_base - 0.42 * k)
            s.v_venous = max(V_VEN_UNSTRESSED - 300.0, s.v_venous - 0.18 * k)

    def _decay_drugs(self, dt: float) -> None:
        """
        Las infusiones NO decaen mientras estan corriendo: noradrenalina y
        dobutamina se administran en infusion continua, no en bolo. Solo
        decaen tras stop_infusion(), con la vida media del farmaco
        (ambas son de minutos).
        """
        s = self.s
        if s.infusion_running:
            return
        for attr, tau in (("drug_contractility", 150.0),
                          ("drug_svr", 150.0), ("drug_hr", 150.0)):
            v = getattr(s, attr)
            setattr(s, attr, v * math.exp(-dt / tau) if abs(v) > 1e-4 else 0.0)

    def stop_infusion(self) -> None:
        self.s.infusion_running = False

    # ------------------------------------------------------------------
    def trigger_shock(self, shock_type: ShockType, severity: float = 1.0) -> None:
        self.s.shock_type = shock_type
        self.s.shock_severity = _bound(severity, 0.0, 5.0)

    def enter_asystole(self) -> None:
        """
        Colapso electrico. Se dispara desde el runtime cuando el paciente
        lleva demasiado tiempo critico sin intervencion.

        Fija FC y contractilidad a cero y deja que _recompute propague el
        colapso al resto de las variables. A partir de aqui las intervenciones
        no revierten el paro: la demo pide un reset.
        """
        self.s.asystole = True
        self.s.heart_rate = 0.0
        self.s.drug_hr = 0.0
        self.s.contractility = 0.0
        self.s.drug_contractility = 0.0
        self._recompute()

    def clone(self) -> "PhysiologyEngine":
        """Copia independiente. Base de las proyecciones what-if."""
        e = PhysiologyEngine(copy.deepcopy(self.s), self.baroreflex, self.bsa)
        e._hr_base = self._hr_base
        e._svr_base = self._svr_base
        return e


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def _bound(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))

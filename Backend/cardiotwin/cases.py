"""
Los cuatro casos clinicos, traducidos a parametros del motor.

POR QUE EXISTE ESTE ARCHIVO
---------------------------
El front manda {"case": "tsv"} y no tiene por que conocer la taxonomia interna
del motor (cardiogenic / hypovolemic / septic / atrial_kick). Esa traduccion
vive aqui, en un solo sitio, y es gemelo de `Frontend/src/lib/cases.ts`: los
ids son los mismos a proposito.

QUE NO HACE: adelantar el reloj
-------------------------------
Las tarjetas del wizard traen cifras concretas (ic-descompensada: FC 88, MAP
87, CO 4.2). Son la PRESENTACION del paciente, escritas a mano, y no
corresponden a ningun estado que este motor produzca desde cero: con MAP 87
-el punto de ajuste del barorreflejo es 88- no hay estimulo para una FC de 88.
Se penso en pre-rodar la simulacion hasta acercarse, y es mala idea por dos
razones:

  1. El guion de la demo arranca con el paciente ESTABLE y ensena como se
     deteriora (0:30 el insulto, 1:00 la fase compensada). Pre-rodar se salta
     justo la parte que hay que ensenar.
  2. Para llegar a FC 126 en el caso `choque` hay que rodar 40 min de tiempo
     fisiologico, y a esa altura la MAP ya esta en 46 y el gasto en 1.55: el
     paciente llegaria mucho peor de lo que dice su propia tarjeta.

Asi que un caso solo elige el insulto y el ritmo de partida. Los numeros del
monitor los produce el motor, y son los autoritativos en cuanto arranca.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from cardiotwin.physiology import PhysiologyEngine

# Severidad clinica -> severidad del motor. La etiqueta la fija el caso; el
# numero es lo que lee _progress_shock.
SEVERITY = {"Moderada": 0.30, "Alta": 0.65, "Crítica": 1.0}


@dataclass(frozen=True)
class ClinicalCase:
    id: str
    title: str
    severity: str                       # etiqueta que muestra el wizard
    shock_type: str                     # taxonomia del motor
    afib_rate: Optional[float] = None   # FC de la FA, si el caso llega en FA

    @property
    def shock_severity(self) -> float:
        return SEVERITY[self.severity]

    def apply(self, engine: PhysiologyEngine) -> None:
        """
        Deja el motor en el punto de partida del caso.

        El orden importa: la FA se aplica antes del shock porque trigger_afib
        recalcula, y queremos que el estado derivado ya refleje el ritmo.
        """
        if self.afib_rate is not None:
            engine.trigger_afib(self.afib_rate)
        else:
            engine.restore_sinus()
        engine.trigger_shock(self.shock_type, self.shock_severity)

    def as_dict(self) -> dict:
        return {"case": self.id, "title": self.title, "severity": self.severity,
                "shock": self.shock_type, "shock_severity": self.shock_severity,
                "rhythm": "afib_rvr" if self.afib_rate else "sinusal"}


CASES: dict[str, ClinicalCase] = {
    "ic-descompensada": ClinicalCase(
        id="ic-descompensada",
        title="Insuficiencia cardíaca descompensada",
        severity="Moderada",
        # Bomba que falla despacio. Es el mismo mecanismo que el shock
        # cardiogenico -perdida progresiva de contractilidad- con menos prisa.
        shock_type="cardiogenic",
    ),
    "tsv": ClinicalCase(
        id="tsv",
        title="Taquiarritmia supraventricular",
        severity="Moderada",
        # AQUI EL INSULTO ES EL RITMO, no un dano al musculo: shock_type none.
        # La FA sola basta para descompensarlo, y no hace falta empujarla: el
        # ciclo vicioso lo hace el motor -ritmo alto, menos llenado, menos
        # gasto, menos aporte coronario, isquemia, menos contractilidad-.
        # Medido: el gasto cae de 7.7 a 2.9 L/min en 15 min sin tocar nada mas.
        shock_type="none",
        afib_rate=168.0,
    ),
    "sca": ClinicalCase(
        id="sca",
        title="Síndrome coronario agudo",
        severity="Alta",
        # Isquemia coronaria en evolucion. El motor no tiene un tipo aparte
        # para esto porque `cardiogenic` YA es eso: _progress_shock lo
        # documenta como "isquemia en evolucion". La diferencia con el caso
        # `choque` es cuanto queda de miocardio, o sea la severidad.
        shock_type="cardiogenic",
    ),
    "choque": ClinicalCase(
        id="choque",
        title="Choque cardiogénico",
        severity="Crítica",
        shock_type="cardiogenic",
    ),
}


def resolve(case_id: str) -> Optional[ClinicalCase]:
    return CASES.get(case_id)

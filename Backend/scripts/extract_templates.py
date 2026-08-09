"""Extrae plantillas QRS pequeñas desde MIT-BIH y descarta la señal cruda."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import wfdb

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "Frontend" / "src" / "data" / "ecgTemplates.json"
POINTS = 25


def _afib_ranges(annotation) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    start: int | None = None
    for sample, note in zip(annotation.sample, annotation.aux_note):
        # WFDB conserva el terminador NUL de las notas MIT-BIH.
        note = (note or "").replace("\x00", "").strip()
        if note == "(AFIB":
            start = int(sample)
        elif note.startswith("(") and start is not None:
            ranges.append((start, int(sample)))
            start = None
    if start is not None:
        ranges.append((start, 2**63 - 1))
    return ranges


def _inside(sample: int, ranges: list[tuple[int, int]]) -> bool:
    return any(low <= sample < high for low, high in ranges)


def template(record_name: str, symbol: str, duration_ms: int,
             require_afib: bool = False) -> dict:
    record = wfdb.rdrecord(record_name, pn_dir="mitdb", channels=[0])
    annotation = wfdb.rdann(record_name, "atr", pn_dir="mitdb")
    fs = float(record.fs)
    signal = record.p_signal[:, 0]
    afib = _afib_ranges(annotation) if require_afib else []

    # La anotación cae cerca del pico R. QRS normal: ~35 ms antes y 55 ms
    # después. Para PVC usamos una ventana intrínsecamente más ancha.
    before_ms = 35 if duration_ms <= 100 else 60
    after_ms = duration_ms - before_ms
    before = round(before_ms * fs / 1000)
    after = round(after_ms * fs / 1000)
    beats = []
    for sample, beat_symbol in zip(annotation.sample, annotation.symbol):
        sample = int(sample)
        if beat_symbol != symbol or (require_afib and not _inside(sample, afib)):
            continue
        if sample - before < 0 or sample + after >= len(signal):
            continue
        segment = signal[sample - before:sample + after + 1].astype(float)
        baseline = (segment[0] + segment[-1]) / 2
        segment -= baseline
        x = np.linspace(0, 1, len(segment))
        resampled = np.interp(np.linspace(0, 1, POINTS), x, segment)
        beats.append(resampled)
        if len(beats) >= 180:
            break
    if not beats:
        raise RuntimeError(f"Sin latidos para {record_name}:{symbol}")

    median = np.median(np.stack(beats), axis=0)
    # Conserva R hacia arriba para que el SVG comparta orientación.
    if abs(float(median.min())) > abs(float(median.max())):
        median *= -1
    scale = max(1e-9, float(np.max(np.abs(median))))
    median /= scale
    return {
        "record": record_name,
        "annotation": symbol,
        "durationMs": duration_ms,
        "beatsAveraged": len(beats),
        "points": [round(float(value), 5) for value in median],
    }


def main() -> None:
    artifact = {
        "source": "MIT-BIH Arrhythmia Database v1.0.0, PhysioNet",
        "doi": "10.13026/C2F305",
        "license": "Open Data Commons Attribution License v1.0",
        "derived": "Median QRS templates only; no raw patient signal included.",
        "templates": {
            "normal": template("100", "N", 90),
            "pvc": template("200", "V", 150),
            "afib": template("201", "N", 90, require_afib=True),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    print(f"Escrito {OUT}")


if __name__ == "__main__":
    main()

"use client";

import { useEffect, useRef, useState } from "react";
import { Engine, type Frame, type Vitals } from "@/lib/engine";

/**
 * Única fuente de datos de la UI. Hoy devuelve el mock local; mañana devuelve
 * el stream del backend (`vitals.tick` del bus de eventos). Ningún componente
 * sabe de dónde vienen los datos.
 */
export function usePatientState({
  startAt = 0,
  frozen = false,
  hz = 4,
}: {
  startAt?: number;
  frozen?: boolean;
  hz?: number;
} = {}) {
  const engineRef = useRef<Engine | null>(null);
  if (engineRef.current === null) engineRef.current = new Engine(startAt);
  const engine = engineRef.current;

  const [frame, setFrame] = useState<Frame>(() => engine.step(0.25));
  const [history, setHistory] = useState<Vitals[]>(() => [...engine.getHistory()]);

  useEffect(() => {
    if (frozen) return;
    const dt = 1 / hz;
    const id = setInterval(() => {
      setFrame(engine.step(dt));
      setHistory([...engine.getHistory()]);
    }, dt * 1000);
    return () => clearInterval(id);
  }, [engine, frozen, hz]);

  return { ...frame, history };
}

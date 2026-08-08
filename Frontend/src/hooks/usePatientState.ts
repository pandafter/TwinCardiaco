"use client";

import { useEffect, useState } from "react";
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
  // El motor es mutable: cada step() avanza el reloj. Si se instancia en el
  // cuerpo del render, el doble render de StrictMode lo adelanta dos veces y
  // servidor y cliente dibujan estados distintos (mismatch de hidratación).
  // Creándolo dentro del initializer, cada invocación es independiente y
  // determinista, así que el primer frame siempre es el mismo.
  const [init] = useState(() => {
    const engine = new Engine(startAt);
    const frame = engine.step(0.25);
    return { engine, frame, history: [...engine.getHistory()] };
  });
  const engine = init.engine;

  const [frame, setFrame] = useState<Frame>(init.frame);
  const [history, setHistory] = useState<Vitals[]>(init.history);

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

"use client";

import { useEffect, useState } from "react";
import { Engine, type Frame, type Vitals } from "@/lib/engine";
import { patientStore } from "@/lib/patientStore";

export type PatientControls = {
  paused: boolean;
  togglePause: () => void;
  reset: () => void;
  /** propone una intervención; con backend la decide el servidor */
  apply: (key: string) => void;
  /** inicia las tres rondas y recibe el texto por el stream */
  convene: () => void;
  /** de dónde vienen los datos ahora mismo */
  source: "backend" | "local";
  transport: "portal" | "sse" | "local";
  connected: number;
};

/**
 * Única fuente de datos de la UI.
 *
 * Dos modos:
 *  - `live` (por defecto en las pantallas sin query params): todas las
 *    pantallas comparten EL MISMO paciente vía patientStore. Navegar no
 *    reinicia el caso, y una intervención aplicada en /interventions se ve
 *    en /monitor.
 *  - local (con `?t=...`, `?freeze=1` o `intervention`): motor propio y
 *    determinista, para capturas de diseño y para las ramas simuladas de
 *    capturas reproducibles del monitor.
 *
 * Cuando el backend esté conectado, cambia patientStore, no este hook ni
 * ningún componente.
 */
export function usePatientState({
  startAt = 0,
  frozen = false,
  hz = 4,
  intervention,
  live = false,
}: {
  startAt?: number;
  frozen?: boolean;
  hz?: number;
  /** intervención ya aplicada durante el arranque, para ver la respuesta */
  intervention?: { at: number; key: string };
  /** usar el paciente compartido de la sesión */
  live?: boolean;
} = {}) {
  // El motor es mutable: cada step() avanza el reloj. Si se instancia en el
  // cuerpo del render, el doble render de StrictMode lo adelanta dos veces y
  // servidor y cliente dibujan estados distintos (mismatch de hidratación).
  // Creándolo dentro del initializer, cada invocación es independiente y
  // determinista, así que el primer frame siempre es el mismo — también en
  // modo live: el primer paint es t≈0 y el efecto sincroniza con el store.
  const [init] = useState(() => {
    const engine = new Engine(startAt, intervention);
    const frame = engine.step(0.25);
    return { engine, frame, history: [...engine.getHistory()] };
  });

  const [frame, setFrame] = useState<Frame>(init.frame);
  const [history, setHistory] = useState<Vitals[]>(init.history);
  const [paused, setPaused] = useState(false);
  // fuerza el re-render cuando cambia algo del store que no es el frame
  // (opiniones de agentes, conflicto, ramas what-if)
  const [, setTick] = useState(0);

  useEffect(() => {
    if (live) {
      const sync = () => {
        setFrame(patientStore.frame);
        // el store es el dueño de la historia: con backend son los ticks
        // recibidos, con motor local los que produjo el Engine
        setHistory(
          patientStore.source === "backend"
            ? [...patientStore.history]
            : [...patientStore.engine.getHistory()],
        );
        setPaused(patientStore.paused);
        setTick((n) => n + 1);
      };
      sync();
      return patientStore.subscribe(sync);
    }
    if (frozen) return;
    const dt = 1 / hz;
    const id = setInterval(() => {
      setFrame(init.engine.step(dt));
      setHistory([...init.engine.getHistory()]);
    }, dt * 1000);
    return () => clearInterval(id);
  }, [init.engine, live, frozen, hz]);

  const controls: PatientControls | null = live
    ? {
        paused,
        togglePause: () => patientStore.setPaused(!patientStore.paused),
        reset: () => patientStore.reset(),
        apply: (key: string) => patientStore.applyInterventionKey(key),
        convene: () => patientStore.convene(),
        source: patientStore.source,
        transport: patientStore.transport,
        connected: patientStore.connected,
      }
    : null;

  return {
    ...frame,
    history,
    engine: live ? patientStore.engine : init.engine,
    controls,
    /** lo que mandó el backend; vacío mientras corra el motor local */
    backend: live
      ? {
          agents: patientStore.agents,
          conflict: patientStore.conflict,
          consensus: patientStore.consensus,
          simulation: patientStore.simulation,
          debate: patientStore.debate,
          applied: patientStore.applied,
        }
      : null,
  };
}

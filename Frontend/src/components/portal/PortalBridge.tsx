"use client";

import { useEffect, useRef } from "react";
import { useChannel } from "@portalsdk/react";
import { CHANNELS, portalEnabled } from "@/lib/portal";
import { patientStore } from "@/lib/patientStore";
import {
  toFrame,
  type BackendConflict,
  type BackendConsensus,
  type BackendOpinion,
  type BackendSimulation,
  type BackendTransition,
  type BackendVitals,
} from "@/lib/live";

/**
 * Portal -> patientStore. No dibuja nada.
 *
 * QUÉ HACE QUE ESTO SEA PORTAL DE VERDAD Y NO DECORACIÓN
 * -----------------------------------------------------
 * El estado del paciente lo publica el servidor en tres canales y todos los
 * navegadores conectados lo reciben a la vez. No es un navegador hablando con
 * su backend: es N navegadores viendo el MISMO paciente en el mismo instante,
 * y la presencia dice cuántos son. Esa es la interacción real que pide el
 * hackathon.
 *
 * Alimenta el mismo contrato de handlers que el SSE (`patientStore.portal`),
 * así que la pantalla no sabe por dónde le llegaron los datos. Cambiar de
 * transporte no cambia una línea de UI.
 *
 * SSR
 * ---
 * `useChannel` es inerte durante el prerender: devuelve el mismo snapshot que
 * `channelId: undefined`, sin crear handle, sin red y sin registrar efectos.
 * Por eso no hace falta `dynamic(..., { ssr: false })`; basta "use client".
 */

/** El envelope que publica el servidor, idéntico al que viaja por SSE. */
type Wire<P> = { payload: P; id: string; ts: number; sim_time: number };

export function PortalBridge() {
  // `state.transition` llega solo en los cambios, así que hay que conservar el
  // último conocido para poder armar el assessment de cada tick. Conservar no
  // es calcular: el front sigue sin derivar nada clínico.
  const lastTransition = useRef<BackendTransition | null>(null);

  const h = patientStore.portal;

  // --- vitales: 1 Hz, sin historial. Los ticks viejos no sirven de nada y
  //     el snapshot inicial se pide por HTTP a /api/state.
  const vitals = useChannel<Wire<BackendVitals>>({
    channelId: portalEnabled ? CHANNELS.vitals : undefined,
    history: "none",
    onMessage: (m) => {
      if (m.type !== "vitals.tick") return;
      const v = m.content?.payload;
      if (!v) return;
      h.onFrame(toFrame(v, lastTransition.current), v);
    },
  });

  // --- eventos: con historial, para que quien llegue tarde reconstruya la
  //     línea de tiempo en vez de aparecer en medio de la película.
  const events = useChannel<Wire<unknown>>({
    channelId: portalEnabled ? CHANNELS.events : undefined,
    history: 50,
    onMessage: (m) => {
      const p = m.content?.payload;
      if (!p) return;
      if (m.type === "state.transition") {
        lastTransition.current = p as BackendTransition;
        h.onTransition(p as BackendTransition);
      } else if (m.type === "simulation.result") {
        h.onSimulation(p as BackendSimulation);
      }
    },
  });

  // --- agentes: con historial por la misma razón.
  useChannel<Wire<unknown>>({
    channelId: portalEnabled ? CHANNELS.agents : undefined,
    history: 50,
    onMessage: (m) => {
      const p = m.content?.payload;
      if (!p) return;
      switch (m.type) {
        case "agent.started":
          h.onAgentStarted(p as BackendOpinion);
          break;
        case "agent.opinion":
          h.onAgentOpinion(p as BackendOpinion);
          break;
        case "agent.conflict":
          h.onConflict(p as BackendConflict);
          break;
        case "orchestrator.consensus":
          h.onConsensus(p as BackendConsensus);
          break;
      }
    },
  });

  // El canal de vitales es el que decide si Portal sirve: es el único que
  // llega a 1 Hz, así que su estado es el que se nota en pantalla.
  useEffect(() => {
    h.onStatus(vitals.status === "ready" ? "live" : "offline");
  }, [vitals.status, h]);

  // Presencia: el requisito de "usuarios conectados". Portal la entrega en dos
  // formas según el tamaño de la sala y hay que manejar las dos: `detailed`
  // con la lista, `aggregate` solo con el número.
  useEffect(() => {
    patientStore.setConnected(events.presence?.count ?? 0);
  }, [events.presence]);

  return null;
}

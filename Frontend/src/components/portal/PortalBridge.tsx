"use client";

import { useEffect, useRef } from "react";
import { useChannel } from "@portalsdk/react";
import { CHANNELS, portalEnabled } from "@/lib/portal";
import { patientStore } from "@/lib/patientStore";
import {
  toFrame,
  type BackendConflict,
  type BackendConsensus,
  type BackendDebateEvent,
  type BackendDebatePayload,
  type BackendEvent,
  type BackendOpinion,
  type BackendTransition,
  type BackendVitals,
} from "@/lib/live";

type Wire<P> = {
  payload: P;
  id: string;
  ts: number;
  sim_time: number;
  source?: string;
};

export function PortalBridge() {
  const lastTransition = useRef<BackendTransition | null>(null);
  const lastSimTime = useRef(-1);
  const handlers = patientStore.portal;

  const vitals = useChannel<Wire<BackendVitals>>({
    channelId: portalEnabled ? CHANNELS.vitals : undefined,
    history: "none",
    onMessage: (message) => {
      if (message.type !== "vitals.tick") return;
      const wire = message.content;
      if (!wire?.payload) return;
      if (lastSimTime.current >= 0 && wire.sim_time + 0.5 < lastSimTime.current) {
        // Un reset crea un motor nuevo en t=0. Ninguna transición de la
        // ejecución anterior puede colorear este nuevo paciente.
        lastTransition.current = null;
      }
      lastSimTime.current = wire.sim_time;
      handlers.onFrame(
        toFrame(wire.payload, lastTransition.current),
        wire.payload,
        wire.id,
      );
    },
  });

  const events = useChannel<Wire<unknown>>({
    channelId: portalEnabled ? CHANNELS.events : undefined,
    // El bus SSE reconstruye únicamente la sesión actual. Reproducir aquí el
    // historial persistente de Portal mezclaría resets o backends anteriores
    // que hayan usado el mismo SIM_ID de demo.
    history: "none",
    onMessage: (message) => {
      const payload = message.content?.payload;
      if (!payload) return;
      if (message.type === "state.transition") {
        lastTransition.current = payload as BackendTransition;
        handlers.onTransition();
      }
      // simulation.result va recortado por el límite de 2 KB. Las series
      // completas siguen llegando por SSE/HTTP y nunca se reconstruyen aquí.
    },
  });

  useChannel<Wire<unknown>>({
    channelId: portalEnabled ? CHANNELS.agents : undefined,
    history: "none",
    onMessage: (message) => {
      const payload = message.content?.payload;
      if (!payload) return;
      switch (message.type) {
        case "agent.started":
          handlers.onAgentStarted(payload as BackendOpinion);
          break;
        case "agent.opinion":
          handlers.onAgentOpinion(payload as BackendOpinion);
          break;
        case "agent.conflict":
          handlers.onConflict(payload as BackendConflict);
          break;
        case "orchestrator.consensus":
          handlers.onConsensus(payload as BackendConsensus);
          break;
        default:
          if (message.type.startsWith("debate.")) {
            handlers.onDebate({
              type: message.type as Extract<BackendEvent, `debate.${string}`>,
              payload: payload as BackendDebatePayload,
            } satisfies BackendDebateEvent);
          }
      }
    },
  });

  useEffect(() => {
    handlers.onStatus(vitals.status === "ready" ? "live" : "offline");
  }, [vitals.status, handlers]);

  useEffect(() => {
    patientStore.setConnected(events.presence?.count ?? 0);
  }, [events.presence]);

  return null;
}

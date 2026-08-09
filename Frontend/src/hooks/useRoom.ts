"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Member, Proposal, RoomEvent } from "@/lib/session/room";

/**
 * La sesión compartida, desde el navegador.
 *
 * Se activa sola en cuanto hay más de una persona: mientras estás solo, la
 * pantalla no cambia y no aparece nada. Trabajar en equipo no debería
 * costarle interfaz a quien trabaja solo.
 *
 * La identidad vive en sessionStorage y no en localStorage a propósito: dos
 * pestañas del mismo navegador son dos participantes distintos, que es
 * justo como se prueba esto sin buscar un segundo computador.
 */

const NAMES = [
  "Residente",
  "Adjunto",
  "Intensivista",
  "Enfermería",
  "Cardiología",
];

function identity() {
  const KEY = "cardiotwin.identity";
  const raw = sessionStorage.getItem(KEY);
  if (raw) return JSON.parse(raw) as { id: string; name: string };
  const id = Math.random().toString(36).slice(2, 10);
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const me = { id, name };
  sessionStorage.setItem(KEY, JSON.stringify(me));
  return me;
}

export type RoomState = {
  me: { id: string; name: string } | null;
  members: Member[];
  /** propuestas sin resolver, más reciente primero */
  pending: Proposal[];
  /** las últimas resueltas, para dejar constancia de quién decidió qué */
  history: Proposal[];
  /** true en cuanto hay alguien más: hasta entonces la UI no aparece */
  shared: boolean;
  propose: (intervention: string, human: string, note?: string) => void;
  resolve: (
    proposalId: string,
    verdict: "approved" | "vetoed",
    reason?: string,
  ) => void;
  rename: (name: string) => void;
};

export function useRoom(
  roomId: string | null,
  /** se llama cuando una propuesta se aprueba: ahí es donde se aplica */
  onApproved: (intervention: string, byName: string) => void,
): RoomState {
  // Inicialización perezosa, no un efecto: en el servidor no hay
  // sessionStorage, y en el cliente la identidad ya existe en el primer
  // render. No hay desajuste de hidratación porque nada de la sala se
  // dibuja hasta que llega el primer evento de presencia.
  const [me] = useState<{ id: string; name: string } | null>(() =>
    !roomId || typeof window === "undefined" ? null : identity(),
  );
  const [name, setName] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const applied = useRef(new Set<string>());
  const cb = useRef(onApproved);
  // Escribir una ref durante el render es un efecto secundario: va aquí.
  useEffect(() => {
    cb.current = onApproved;
  });

  // useMemo, no un objeto nuevo por render: `who` es dependencia de tres
  // callbacks y dos efectos, y sin memoizar reconectaría el stream en cada
  // latido del monitor — cuatro veces por segundo.
  const who = useMemo(
    () => (me ? { id: me.id, name: name ?? me.name } : null),
    [me, name],
  );

  const post = useCallback(
    (body: Record<string, unknown>) => {
      if (!roomId) return Promise.resolve(null);
      return fetch(`/api/room/${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => null);
    },
    [roomId],
  );

  // Presencia: un latido cada 5 s. El servidor expira a los 15 s, así que
  // se toleran dos perdidos antes de dar a alguien por ido.
  useEffect(() => {
    if (!roomId || !who) return;
    const beat = () => post({ kind: "hello", id: who.id, name: who.name });
    beat();
    const t = setInterval(beat, 5000);
    const bye = () => {
      navigator.sendBeacon?.(
        `/api/room/${encodeURIComponent(roomId)}`,
        new Blob([JSON.stringify({ kind: "bye", id: who.id })], {
          type: "application/json",
        }),
      );
    };
    window.addEventListener("pagehide", bye);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", bye);
      bye();
    };
  }, [roomId, who, post]);

  // El stream de la sala.
  useEffect(() => {
    if (!roomId || !who) return;
    const es = new EventSource(
      `/api/room/${encodeURIComponent(roomId)}/stream`,
    );
    es.onmessage = (ev) => {
      let e: RoomEvent;
      try {
        e = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (e.type === "presence") setMembers(e.members);
      else if (e.type === "proposal" || e.type === "resolved")
        setProposals((prev) => {
          const i = prev.findIndex((p) => p.id === e.proposal.id);
          if (i === -1) return [...prev, e.proposal];
          const next = [...prev];
          next[i] = e.proposal;
          return next;
        });
      else if (e.type === "applied") {
        // Idempotente: el stream puede reenviar lo mismo tras reconectar, y
        // aplicar dos veces la misma dobutamina no es un detalle menor.
        const key = `${e.intervention}:${e.byName}`;
        if (!applied.current.has(key)) {
          applied.current.add(key);
          cb.current(e.intervention, e.byName);
        }
      }
    };
    return () => es.close();
  }, [roomId, who?.id, who]);

  const propose = useCallback(
    (intervention: string, human: string, note?: string) => {
      if (!who) return;
      post({ kind: "propose", id: who.id, name: who.name, intervention, human, note });
    },
    [who, post],
  );

  const resolve = useCallback(
    (proposalId: string, verdict: "approved" | "vetoed", reason?: string) => {
      if (!who) return;
      post({ kind: "resolve", id: who.id, name: who.name, proposalId, verdict, reason });
    },
    [who, post],
  );

  const rename = useCallback(
    (n: string) => {
      if (!who) return;
      const clean = n.slice(0, 24);
      sessionStorage.setItem(
        "cardiotwin.identity",
        JSON.stringify({ id: who.id, name: clean }),
      );
      setName(clean);
      post({ kind: "hello", id: who.id, name: clean });
    },
    [who, post],
  );

  return {
    me: who,
    members,
    pending: proposals.filter((p) => p.status === "pending").reverse(),
    history: proposals.filter((p) => p.status !== "pending").slice(-4).reverse(),
    shared: members.length > 1,
    propose,
    resolve,
    rename,
  };
}

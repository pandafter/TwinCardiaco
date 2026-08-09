"use client";

import { AnimatePresence, motion } from "motion/react";
import type { RoomState } from "@/hooks/useRoom";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Quién más está mirando este paciente.
 *
 * Aparece solo cuando hay alguien más. Estando solo, no ocupa un píxel: la
 * versión anterior de esto era un "3 conectados" fijo que no correspondía a
 * nadie, y un dato inventado hace dudar de todos los demás.
 */
export function RoomPresence({ room }: { room: RoomState }) {
  if (!room.shared || !room.me) return null;
  const others = room.members.filter((m) => m.id !== room.me!.id);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease }}
      className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5"
      title={room.members.map((m) => m.name).join(", ")}
    >
      <span className="flex items-center">
        {room.members.slice(0, 4).map((m, i) => (
          <span
            key={m.id}
            className="flex h-[1.3rem] w-[1.3rem] items-center justify-center rounded-full border border-shell text-micro font-medium"
            style={{
              marginLeft: i ? "-0.35rem" : 0,
              background:
                m.id === room.me!.id
                  ? "color-mix(in srgb, var(--gold) 26%, transparent)"
                  : "color-mix(in srgb, var(--info) 22%, transparent)",
              color: m.id === room.me!.id ? "var(--gold)" : "var(--info)",
            }}
          >
            {m.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
      </span>
      <span className="text-micro text-lo">
        {others.length === 1
          ? `con ${others[0].name}`
          : `${room.members.length} en la sala`}
      </span>
    </motion.div>
  );
}

/**
 * Las propuestas pendientes.
 *
 * Aquí es donde el multiusuario deja de ser decorativo: una persona plantea
 * una intervención y OTRA la aprueba o la veta antes de que se aplique.
 * Nadie resuelve la suya — el servidor lo rechaza, y aquí ni se ofrece.
 */
export function ProposalDeck({ room }: { room: RoomState }) {
  if (!room.me) return null;
  const me = room.me;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full z-30 mb-2 flex flex-col items-center gap-2 px-3">
      <AnimatePresence mode="popLayout">
        {room.pending.map((p) => {
          const mine = p.byId === me.id;
          return (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.32, ease }}
              className="pointer-events-auto w-full max-w-[46rem] rounded-lg border px-4 py-3 shadow-[0_-0.5rem_2rem_-0.5rem_rgba(0,0,0,0.9)]"
              style={{
                borderColor: "var(--line-gold)",
                background:
                  "color-mix(in srgb, var(--gold) 9%, var(--bg-panel))",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="relative flex h-[0.4rem] w-[0.4rem] items-center justify-center"
                  aria-hidden
                >
                  <span
                    className="absolute inset-0 rounded-full bg-gold"
                    style={{ animation: "ping-ring 1.8s ease-out infinite" }}
                  />
                  <span className="h-full w-full rounded-full bg-gold" />
                </span>
                <span className="text-body text-hi">
                  <span className="font-semibold text-gold">{p.byName}</span>{" "}
                  propone{" "}
                  <span className="font-semibold">{p.human.toLowerCase()}</span>
                </span>
                <span className="ml-auto text-micro text-lo">
                  {mine ? "esperando a que alguien responda" : "decide tú"}
                </span>
              </div>

              {p.note && (
                <p className="mt-1.5 text-label leading-[1.5] text-mid">
                  «{p.note}»
                </p>
              )}

              {/* Quien propone no vota. Si votara, proponer sería un clic
                  de más antes de hacer lo mismo. */}
              {!mine && (
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={() => room.resolve(p.id, "approved")}
                    className="rounded-lg border px-3.5 py-1.5 text-label font-medium transition-colors"
                    style={{
                      borderColor: "rgba(63,191,127,0.45)",
                      background: "rgba(63,191,127,0.12)",
                      color: "var(--ok)",
                    }}
                  >
                    Aprobar y aplicar
                  </button>
                  <button
                    onClick={() => room.resolve(p.id, "vetoed")}
                    className="rounded-lg border px-3.5 py-1.5 text-label transition-colors"
                    style={{
                      borderColor: "rgba(229,72,77,0.45)",
                      color: "var(--crit)",
                    }}
                  >
                    Vetar
                  </button>
                  <span className="text-micro text-lo">
                    Se aplica en las dos pantallas.
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** El registro: quién decidió qué. Sin esto, aprobar no deja rastro. */
export function DecisionLog({ room }: { room: RoomState }) {
  if (!room.shared || room.history.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
      <span className="text-micro tracking-[0.14em] text-dim">REGISTRO</span>
      {room.history.map((p) => (
        <span key={p.id} className="text-micro text-lo">
          <span className="text-mid">{p.byName}</span> propuso{" "}
          {p.human.toLowerCase()} ·{" "}
          <span
            style={{
              color: p.status === "approved" ? "var(--ok)" : "var(--crit)",
            }}
          >
            {p.status === "approved" ? "aprobado" : "vetado"} por {p.byWhom}
          </span>
        </span>
      ))}
    </div>
  );
}

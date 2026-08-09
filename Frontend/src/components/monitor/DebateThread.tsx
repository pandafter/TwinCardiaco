"use client";

import { motion } from "motion/react";
import type {
  DebateEvidence,
  DebateState,
  DebateTurn,
} from "@/lib/patientStore";

const VOICE = {
  cardiologia: {
    name: "Cardiología",
    role: "Protege el músculo cardíaco",
    color: "var(--crit)",
  },
  fisiologia: {
    name: "Fisiología",
    role: "Protege el oxígeno sistémico",
    color: "var(--info)",
  },
} as const;

export function DebateThread({
  debate,
  onConvene,
}: {
  debate: DebateState;
  onConvene: () => void;
}) {
  const turns = [...debate.turns.values()].sort(
    (a, b) => a.round - b.round || a.agent.localeCompare(b.agent),
  );
  const proposals = turns.filter((turn) => turn.round === 1);
  const rebuttals = turns.filter((turn) => turn.round === 2);
  const source = turns.some((turn) => turn.source === "llm")
    ? "modelo"
    : "reglas locales";

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5">
        <div>
          <div className="text-label tracking-[0.14em] text-mid">
            JUNTA MÉDICA EN VIVO
          </div>
          <div className="mt-0.5 text-micro text-lo">
            Dos objetivos opuestos, una réplica obligatoria y un criterio de
            desempate visible.
          </div>
        </div>
        <span className="ml-auto rounded border border-line px-2 py-1 text-micro text-lo">
          RONDA {Math.max(1, debate.round)}/3 · {debate.roundKind.toUpperCase()}
        </span>
        <span
          className="rounded border px-2 py-1 text-micro"
          style={{
            borderColor:
              source === "modelo" ? "var(--line-gold)" : "var(--line-strong)",
            color: source === "modelo" ? "var(--gold)" : "var(--text-lo)",
          }}
        >
          {source}
        </span>
        <button
          onClick={onConvene}
          disabled={debate.active}
          className="rounded-md border border-line-gold px-3 py-1.5 text-micro font-medium text-gold transition-colors hover:bg-card-hover disabled:cursor-wait disabled:opacity-40"
        >
          {debate.active ? "Junta en curso…" : "Convocar otra"}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem] gap-3 p-3">
        <div className="grid min-h-0 grid-cols-2 gap-3">
          {(["cardiologia", "fisiologia"] as const).map((agent) => (
            <section
              key={agent}
              className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border border-line bg-panel p-2.5"
            >
              <div className="flex items-center gap-2 px-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: VOICE[agent].color }}
                />
                <div>
                  <h3
                    className="text-body font-medium"
                    style={{ color: VOICE[agent].color }}
                  >
                    {VOICE[agent].name}
                  </h3>
                  <p className="text-micro text-lo">{VOICE[agent].role}</p>
                </div>
              </div>
              {proposals
                .filter((turn) => turn.agent === agent)
                .map((turn) => (
                  <TurnCard key={turn.id} turn={turn} label="PROPUESTA" />
                ))}
              {rebuttals
                .filter((turn) => turn.agent === agent)
                .map((turn) => (
                  <TurnCard key={turn.id} turn={turn} label="RÉPLICA" />
                ))}
            </section>
          ))}
        </div>

        <aside className="flex min-h-0 flex-col rounded-lg border border-line-gold bg-card p-3">
          <div className="text-label tracking-[0.14em] text-gold">
            VEREDICTO DEL ORQUESTADOR
          </div>
          {debate.verdict ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex min-h-0 flex-1 flex-col"
            >
              <div className="text-micro text-lo">RECOMENDACIÓN DEL MODELO</div>
              <div className="mt-1 text-lead font-medium text-hi">
                {humanIntervention(debate.verdict.recommendation)}
              </div>
              {debate.verdict.tiebreak_rule && (
                <div className="mt-4 rounded-md border border-line bg-panel p-3">
                  <div className="text-micro text-lo">
                    REGLA DE DESEMPATE DECLARADA
                  </div>
                  <p className="mt-1.5 text-label leading-[1.55] text-mid">
                    {debate.verdict.tiebreak_rule}
                  </p>
                </div>
              )}
              <p className="mt-auto border-t border-line pt-3 text-micro leading-relaxed text-dim">
                Simulación educativa no validada. No es una recomendación
                clínica.
              </p>
            </motion.div>
          ) : debate.error ? (
            <p className="mt-3 text-label text-warn">
              La junta se detuvo: {debate.error}. El paciente sigue corriendo.
            </p>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-label text-lo">
              El orquestador espera las dos réplicas antes de declarar qué
              prioriza y por qué.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TurnCard({ turn, label }: { turn: DebateTurn; label: string }) {
  const voice = VOICE[turn.agent as keyof typeof VOICE];
  const rival = turn.replyTo
    ? VOICE[turn.replyTo as keyof typeof VOICE]
    : null;
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-md border border-line bg-card p-3"
      style={
        rival
          ? { borderLeftColor: rival.color, borderLeftWidth: "0.18rem" }
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-micro tracking-[0.12em] text-lo">{label}</span>
        {rival && (
          <span className="text-micro" style={{ color: rival.color }}>
            ↰ responde a {rival.name}
          </span>
        )}
        <span className="ml-auto text-micro text-dim">
          {turn.pending ? "escribiendo" : turn.stance ?? "cerrado"}
        </span>
      </div>

      <p className="mt-2 text-label leading-[1.55] text-hi">
        {turn.text || `${voice?.name ?? turn.agent} está escribiendo`}
        {turn.pending && (
          <span className="debate-caret ml-0.5 inline-block h-[0.9em] w-px bg-gold align-middle" />
        )}
        {turn.pending && !turn.text && <TypingDots />}
      </p>

      {!turn.pending && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {turn.evidence.slice(0, 3).map((evidence) => (
            <EvidenceChip
              key={`${evidence.source}:${evidence.metric}`}
              evidence={evidence}
            />
          ))}
          {turn.citationsVerified === false && (
            <span className="rounded border border-warn/40 px-2 py-1 text-micro text-warn">
              sin evidencia verificada
            </span>
          )}
        </div>
      )}
    </motion.article>
  );
}

function EvidenceChip({ evidence }: { evidence: DebateEvidence }) {
  const simulated = evidence.source === "simulation";
  const color = simulated ? "var(--violet)" : "var(--ok)";
  return (
    <span
      className="rounded border px-2 py-1 text-micro"
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        color,
      }}
    >
      <span className="mr-1">●</span>
      {metricLabel(evidence.metric)}{" "}
      <span className="num font-mono">{String(evidence.value)}</span>
    </span>
  );
}

function TypingDots() {
  return (
    <span className="ml-1 inline-flex gap-1 align-middle">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1 w-1 rounded-full bg-gold"
          style={{
            animation: "pulse-dot 1s ease-in-out infinite",
            animationDelay: `${index * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}

function metricLabel(metric: string) {
  return metric
    .replace("inotrope.", "dobutamina · ")
    .replaceAll("_", " ");
}

function humanIntervention(key?: string) {
  const labels: Record<string, string> = {
    inotrope: "Dobutamina · reforzar el bombeo",
    vasopressor: "Noradrenalina · sostener la presión",
    fluid: "Bolo de líquidos",
    none: "No intervenir todavía",
  };
  return key ? (labels[key] ?? key) : "Evaluando…";
}


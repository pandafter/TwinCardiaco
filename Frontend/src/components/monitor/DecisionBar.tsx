"use client";

import { useState } from "react";
import { EXAMPLE_QUESTIONS, parseQuestion } from "@/lib/ask";
import { projectBranch, type Branch, type BranchKey } from "@/lib/whatif";

/**
 * La barra de decisión: cuatro opciones en lenguaje humano y una caja para
 * preguntar cualquier otra cosa.
 *
 * Dos ideas, y las dos importan:
 *
 *  1. Al pasar el mouse por una opción se dibuja SU trayectoria sobre el
 *     gráfico, en fantasma, sin aplicar nada. Ver el futuro antes de elegirlo.
 *     Las ramas ya vienen calculadas: no hay espera.
 *
 *  2. La caja de preguntas es lo que justifica la IA. Sin ella son cuatro
 *     botones; con ella, cualquier escenario en lenguaje natural. La IA
 *     traduce la frase a parámetros y el motor determinista hace el resto.
 */
export function DecisionBar({
  branches,
  decisionAt,
  onHover,
  onApply,
  onAsk,
  applied,
}: {
  branches: Branch[];
  decisionAt: number;
  onHover: (b: Branch | null) => void;
  onApply: (key: BranchKey) => void;
  onAsk: (b: Branch | null) => void;
  applied: string | null;
}) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<
    | { ok: true; echo: string; branch: Branch }
    | { ok: false; reason: string }
    | null
  >(null);

  const ask = (text: string) => {
    const parsed = parseQuestion(text);
    if (!parsed.supported) {
      setAnswer({ ok: false, reason: parsed.reason });
      onAsk(null);
      return;
    }
    const none = branches.find((b) => b.key === "none");
    const branch = projectBranch(decisionAt, parsed.intervention, {
      efficacy: parsed.efficacy,
      delay: parsed.delay,
      baseline: none?.deltas,
    });
    setAnswer({ ok: true, echo: parsed.echo, branch });
    onAsk(branch);
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-line px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <div className="w-[7.5rem] shrink-0 pt-1">
          <div className="text-[0.5rem] tracking-[0.16em] text-dim">
            ¿QUÉ HACEMOS?
          </div>
          <div className="mt-1 text-[0.4375rem] leading-[1.5] text-lo">
            Pasa el mouse para ver a dónde lleva cada opción.
          </div>
        </div>

        <div className="grid flex-1 grid-cols-4 gap-2">
          {branches.map((b) => {
            const isApplied = applied === b.key;
            return (
              <button
                key={b.key}
                onMouseEnter={() => onHover(b)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onApply(b.key)}
                disabled={!!applied}
                className="group flex flex-col items-start rounded-[0.6rem] border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed"
                style={{
                  borderColor: isApplied
                    ? b.color
                    : `color-mix(in srgb, ${b.color} 28%, transparent)`,
                  background: isApplied
                    ? `color-mix(in srgb, ${b.color} 14%, transparent)`
                    : "var(--card)",
                  opacity: applied && !isApplied ? 0.4 : 1,
                }}
              >
                {/* lo humano grande, lo técnico en pequeño */}
                <span
                  className="text-[0.75rem] leading-tight font-medium"
                  style={{ color: b.color }}
                >
                  {b.human}
                </span>
                <span className="mt-0.5 text-[0.4375rem] text-dim">{b.tech}</span>
                <span className="mt-1.5 text-[0.5rem] leading-[1.45] text-mid">
                  {isApplied ? "Aplicada · en curso" : b.verdict}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------- preguntar lo que sea */}
      <div className="flex items-center gap-2.5">
        <div className="w-[7.5rem] shrink-0">
          <div className="text-[0.5rem] tracking-[0.16em] text-dim">
            PREGÚNTALE
          </div>
          <div className="mt-1 text-[0.4375rem] leading-[1.5] text-lo">
            Cualquier escenario, en español.
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(q)}
            placeholder="¿y si le doy volumen y espero 2 minutos?"
            className="min-w-0 flex-1 rounded-lg border border-line-strong bg-[#0a0e14] px-3 py-2 text-[0.625rem] text-hi placeholder:text-dim focus:border-cyan focus:outline-none"
          />
          <button
            onClick={() => ask(q)}
            className="shrink-0 rounded-lg border border-[rgba(56,189,248,0.4)] bg-[rgba(56,189,248,0.1)] px-4 py-2 text-[0.625rem] text-cyan transition-colors hover:bg-[rgba(56,189,248,0.18)]"
          >
            Simular
          </button>
        </div>
      </div>

      {!answer && (
        <div className="flex items-center gap-1.5 pl-[10rem]">
          {EXAMPLE_QUESTIONS.map((e) => (
            <button
              key={e}
              onClick={() => {
                setQ(e);
                ask(e);
              }}
              className="rounded-full border border-line px-2.5 py-[0.15rem] text-[0.4375rem] text-lo transition-colors hover:border-line-strong hover:text-mid"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {answer && (
        <div
          className="ml-[10rem] rounded-lg border px-3 py-2"
          style={{
            borderColor: answer.ok
              ? "rgba(56,189,248,0.32)"
              : "rgba(224,163,64,0.32)",
            background: answer.ok
              ? "rgba(56,189,248,0.05)"
              : "rgba(224,163,64,0.05)",
          }}
        >
          {answer.ok ? (
            <>
              <div className="text-[0.5rem] text-dim">
                Entendí: <span className="text-cyan">{answer.echo}</span> · lo
                simulé sobre el estado actual
              </div>
              <div className="mt-1 text-[0.625rem] text-hi">
                {answer.branch.verdict}
              </div>
              <div className="mt-1 flex gap-4 text-[0.5rem] text-mid">
                <span className="text-dim">frente a no hacer nada:</span>
                <span>
                  presión{" "}
                  <span className="font-mono text-hi">
                    {answer.branch.vsNone.map >= 0 ? "+" : ""}
                    {answer.branch.vsNone.map.toFixed(1)}
                  </span>
                </span>
                <span>
                  sangre bombeada{" "}
                  <span className="font-mono text-hi">
                    {answer.branch.vsNone.co >= 0 ? "+" : ""}
                    {answer.branch.vsNone.co.toFixed(2)} L/min
                  </span>
                </span>
                <span>
                  falta de oxígeno{" "}
                  <span className="font-mono text-hi">
                    {answer.branch.vsNone.lactate >= 0 ? "+" : ""}
                    {answer.branch.vsNone.lactate.toFixed(2)}
                  </span>
                </span>
                <span className="text-dim">
                  · trayectoria dibujada en el gráfico
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="text-[0.5rem] tracking-[0.14em] text-warn">
                FUERA DEL ALCANCE DEL MODELO
              </div>
              <div className="mt-1 text-[0.5625rem] leading-[1.6] text-mid">
                {answer.reason}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

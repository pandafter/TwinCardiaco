"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EXAMPLE_QUESTIONS } from "@/lib/ask";
import { ask as askAI } from "@/lib/ai/bridge";
import type { Assessment, Vitals } from "@/lib/engine";
import { projectBranch, type Branch, type BranchKey } from "@/lib/whatif";
import type { RoomState } from "@/hooks/useRoom";
import { DecisionLog, ProposalDeck } from "./RoomBar";

/**
 * La barra de decisión: cuatro opciones en lenguaje humano y una caja para
 * preguntar cualquier otra cosa.
 *
 * Tres ideas, y las tres importan:
 *
 *  1. Al pasar el mouse por una opción se dibuja SU trayectoria sobre el
 *     gráfico, en fantasma, sin aplicar nada. Ver el futuro antes de elegirlo.
 *     Las ramas ya vienen calculadas: no hay espera.
 *
 *  2. Cada tarjeta lleva su diferencia CONTRA no hacer nada. Ahí vive el
 *     dilema del producto: "subir la presión" marca +13 de presión y +0.0 de
 *     oxígeno, y eso se lee sin que nadie lo explique.
 *
 *  3. La caja de preguntas es lo que justifica la IA. Sin ella son cuatro
 *     botones; con ella, cualquier escenario en lenguaje natural. La IA
 *     traduce la frase a parámetros y el motor determinista hace el resto.
 *
 * Nada aquí baja de --fs-micro. La versión anterior usaba 0.4375rem — unos
 * 8px en un portátil — y por eso "no se entendían los botones".
 */

const ease = [0.22, 1, 0.36, 1] as const;

export function DecisionBar({
  branches,
  decisionAt,
  vitals,
  assess,
  onHover,
  onApply,
  onAsk,
  applied,
  arrested,
  room,
}: {
  branches: Branch[];
  decisionAt: number;
  vitals: Vitals;
  assess: Assessment;
  onHover: (b: Branch | null) => void;
  onApply: (key: BranchKey) => void;
  onAsk: (b: Branch | null) => void;
  applied: string[];
  arrested: boolean;
  room: RoomState;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<
    | { ok: true; echo: string; reading: string; source: string; branch: Branch }
    | { ok: false; reason: string; reading: string; source: string }
    | null
  >(null);

  /**
   * Preguntar es lo único que no cabe en cuatro botones.
   *
   * El modelo hace DOS cosas: lee el estado del paciente en este instante y
   * lo explica (`reading`), y traduce la pregunta a parámetros del motor. La
   * fisiología la calcula el motor, siempre. Si la IA no responde, se cae a
   * las reglas locales y la caja lo dice — no se finge que hubo modelo.
   */
  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await askAI(text, vitals, assess, applied);
      if (!res.supported) {
        setAnswer({
          ok: false,
          reason: res.reason,
          reading: res.reading,
          source: res.source,
        });
        onAsk(null);
        return;
      }
      const none = branches.find((b) => b.key === "none");
      const branch = projectBranch(decisionAt, res.intervention, {
        efficacy: res.efficacy,
        delay: res.delay_s,
        baseline: none?.deltas,
      });
      setAnswer({
        ok: true,
        echo: res.echo,
        reading: res.reading,
        source: res.source,
        branch,
      });
      onAsk(branch);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex shrink-0 flex-col gap-2.5 border-t border-line bg-shell px-3 py-3">
      {/* Las propuestas flotan sobre la barra, donde ya está mirando quien
          va a decidir. */}
      <ProposalDeck room={room} />

      <div className="flex items-baseline gap-3 px-0.5">
        <h2 className="text-micro tracking-[0.16em] text-mid">¿QUÉ HACEMOS?</h2>
        <span className="text-micro text-lo">
          {arrested
            ? "El corazón se detuvo. Ningún fármaco circula sin bomba."
            : room.shared
              ? `Sois ${room.members.length} en la sala: tu clic PROPONE, y otra persona aprueba o veta antes de aplicar.`
              : "Pasa el mouse para ver a dónde lleva cada opción · puedes intervenir las veces que haga falta"}
        </span>
        {applied.length > 0 && !arrested && (
          <span className="ml-auto text-micro text-lo">
            {applied.length} {applied.length === 1 ? "decisión" : "decisiones"}{" "}
            tomadas
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2.5" role="group">
        {branches.map((b, i) => (
          <OptionCard
            key={b.key}
            branch={b}
            index={i}
            applied={applied}
            arrested={arrested}
            onHover={onHover}
            onApply={onApply}
          />
        ))}
      </div>

      {/* ------------------------------------------- preguntar lo que sea */}
      <div className="flex items-center gap-2.5">
        <label
          htmlFor="ask"
          className="shrink-0 text-micro tracking-[0.16em] text-dim"
        >
          PREGÚNTALE
        </label>
        <div className="relative flex flex-1 items-center gap-2">
          <input
            id="ask"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(q)}
            placeholder="¿y si le doy volumen y espero 2 minutos?"
            className="min-w-0 flex-1 rounded-lg border border-line-strong bg-page px-3 py-2 text-label text-hi transition-colors placeholder:text-dim hover:border-lo focus:border-gold focus:outline-none"
          />
          <motion.button
            onClick={() => ask(q)}
            disabled={busy}
            whileTap={{ scale: 0.96 }}
            className="relative shrink-0 overflow-hidden rounded-lg border px-4 py-2 text-label font-medium transition-colors disabled:cursor-wait"
            style={{
              borderColor: "var(--line-gold)",
              background: "var(--gold-soft)",
              color: "var(--gold)",
            }}
          >
            {/* mientras el modelo piensa, una luz recorre el botón: la espera
                se ve, en vez de parecer que no pasó nada */}
            {busy && (
              <span
                className="pointer-events-none absolute inset-y-0 w-1/3"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, var(--gold-soft), transparent)",
                  animation: "sweep 1.1s ease-in-out infinite",
                }}
              />
            )}
            <span className="relative">{busy ? "Pensando…" : "Simular"}</span>
          </motion.button>
        </div>

        {!answer && (
          <div className="flex shrink-0 items-center gap-1.5">
            {EXAMPLE_QUESTIONS.slice(0, 3).map((e) => (
              <button
                key={e}
                onClick={() => {
                  setQ(e);
                  ask(e);
                }}
                className="rounded-full border border-line px-2.5 py-1 text-micro text-lo transition-colors hover:border-line-strong hover:bg-card-hover hover:text-mid"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* La respuesta FLOTA sobre la barra en vez de empujarla. Empujando, la
          columna de vitales perdía dos filas justo cuando el usuario acababa
          de preguntar algo: el layout saltaba y se perdía el contexto. */}
      <DecisionLog room={room} />

      <AnimatePresence mode="wait">
        {answer && (
          <motion.div
            key={answer.ok ? answer.echo : answer.reason}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease }}
            className="absolute right-3 bottom-full left-3 z-20 mb-2"
          >
            <div
              className="rounded-lg border px-3.5 py-2.5 shadow-[0_-0.5rem_2rem_-0.5rem_rgba(0,0,0,0.9)] backdrop-blur-sm"
              style={{
                borderColor: answer.ok
                  ? "var(--line-gold)"
                  : "rgba(224,163,64,0.32)",
                // opaco: flota sobre el gráfico y el punteado de detrás lo
                // haría ilegible
                background: answer.ok
                  ? "color-mix(in srgb, var(--gold) 8%, var(--bg-panel))"
                  : "color-mix(in srgb, var(--warn) 7%, var(--bg-panel))",
              }}
            >
              {/* De dónde salió la respuesta. Igual que la etiqueta
                  servidor/local de la cabecera: la fuente se declara. */}
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="rounded border px-1.5 py-[0.1rem] text-micro"
                  style={
                    answer.source === "llm"
                      ? { borderColor: "var(--line-gold)", color: "var(--gold)" }
                      : {
                          borderColor: "var(--line-strong)",
                          color: "var(--text-lo)",
                        }
                  }
                  title={
                    answer.source === "llm"
                      ? "Respondió el modelo leyendo el estado actual del paciente"
                      : "El modelo no respondió: esto salió de las reglas locales"
                  }
                >
                  {answer.source === "llm" ? "IA" : "reglas locales"}
                </span>
                {answer.reading && (
                  <span className="min-w-0 flex-1 text-label leading-[1.5] text-hi">
                    {answer.reading}
                  </span>
                )}
              </div>

              {answer.ok ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-micro text-dim">Entendí:</span>
                    <span className="text-label text-gold">{answer.echo}</span>
                    <button
                      onClick={() => {
                        setAnswer(null);
                        onAsk(null);
                      }}
                      className="ml-auto text-micro text-lo transition-colors hover:text-hi"
                    >
                      cerrar
                    </button>
                  </div>
                  <p className="mt-1 text-body text-hi">
                    {answer.branch.verdict}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-micro text-dim">
                      frente a no hacer nada:
                    </span>
                    <Delta
                      label="presión"
                      value={answer.branch.vsNone.map}
                      digits={1}
                      goodWhenUp
                    />
                    <Delta
                      label="sangre bombeada"
                      value={answer.branch.vsNone.co}
                      digits={2}
                      unit=" L/min"
                      goodWhenUp
                    />
                    <Delta
                      label="falta de oxígeno"
                      value={answer.branch.vsNone.lactate}
                      digits={2}
                      goodWhenUp={false}
                    />
                    <span className="text-micro text-dim">
                      · trayectoria dibujada en el gráfico
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-micro tracking-[0.14em] text-warn">
                    FUERA DEL ALCANCE DEL MODELO
                  </div>
                  <p className="mt-1 text-label leading-[1.6] text-mid">
                    {answer.reason}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ una opción */

function OptionCard({
  branch: b,
  index,
  applied,
  arrested,
  onHover,
  onApply,
}: {
  branch: Branch;
  index: number;
  applied: string[];
  arrested: boolean;
  onHover: (b: Branch | null) => void;
  onApply: (key: BranchKey) => void;
}) {
  // Cuántas veces se ha dado ya. Se puede volver a dar: el objetivo es
  // poder equivocarse y corregir, no acertar a la primera.
  const times = applied.filter((k) => k === b.key).length;
  const isApplied = times > 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: arrested ? 0.3 : 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease }}
      whileHover={arrested ? undefined : { y: -3 }}
      whileTap={arrested ? undefined : { scale: 0.985 }}
      onMouseEnter={() => onHover(b)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(b)}
      onBlur={() => onHover(null)}
      onClick={() => onApply(b.key)}
      // En asistolia los fármacos no hacen nada. Es lo único que bloquea.
      disabled={arrested}
      aria-pressed={isApplied}
      className="group relative flex flex-col items-start overflow-hidden rounded-[0.7rem] border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed"
      style={{
        borderColor: isApplied
          ? b.color
          : `color-mix(in srgb, ${b.color} 26%, transparent)`,
        background: isApplied
          ? `color-mix(in srgb, ${b.color} 12%, transparent)`
          : "var(--bg-card)",
      }}
    >
      {/* al aplicar, un barrido de luz recorre la tarjeta una sola vez */}
      {isApplied && (
        <motion.span
          initial={{ x: "-120%" }}
          animate={{ x: "220%" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="pointer-events-none absolute inset-y-0 w-1/3"
          style={{
            background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${b.color} 22%, transparent), transparent)`,
          }}
        />
      )}

      <div className="flex w-full items-baseline gap-2">
        <span
          className="text-body leading-tight font-semibold"
          style={{ color: b.color }}
        >
          {b.human}
        </span>
        {isApplied && (
          <span
            className="ml-auto shrink-0 rounded px-1.5 py-[0.1rem] text-micro"
            style={{
              background: `color-mix(in srgb, ${b.color} 20%, transparent)`,
              color: b.color,
            }}
          >
            {times > 1 ? `×${times}` : "aplicada"}
          </span>
        )}
      </div>
      <span className="mt-0.5 text-micro text-dim">{b.tech}</span>

      <p className="mt-1 line-clamp-2 text-label leading-[1.4] text-mid">
        {b.verdict}
      </p>

      {/* la comparación contra no intervenir, aquí y en un solo sitio */}
      {b.key !== "none" && (
        <div className="mt-auto flex w-full items-center gap-3 pt-1.5">
          <Delta
            label="presión"
            value={b.vsNone.map}
            digits={0}
            unit=" mmHg"
            goodWhenUp
          />
          <Delta
            label="falta de oxígeno"
            value={b.vsNone.lactate}
            digits={1}
            goodWhenUp={false}
          />
        </div>
      )}
    </motion.button>
  );
}

/**
 * Una diferencia contra no hacer nada, con el signo pintado según si es buena
 * noticia — no según si el número sube.
 */
function Delta({
  label,
  value,
  digits,
  unit = "",
  goodWhenUp,
}: {
  label: string;
  value: number;
  digits: number;
  unit?: string;
  goodWhenUp: boolean;
}) {
  const flat = Math.abs(value) < (digits === 0 ? 0.5 : 10 ** -digits * 5);
  const good = goodWhenUp ? value > 0 : value < 0;
  const color = flat
    ? "var(--text-lo)"
    : good
      ? "var(--ok)"
      : "var(--crit)";

  return (
    <span className="flex items-baseline gap-1 text-micro text-lo">
      {label}
      <span className="num font-mono text-label" style={{ color }}>
        {flat ? "≈0" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}`}
        {unit}
      </span>
    </span>
  );
}

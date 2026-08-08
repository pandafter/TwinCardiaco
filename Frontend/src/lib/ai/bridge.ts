"use client";

import type { Assessment, Vitals } from "@/lib/engine";
import type { Branch } from "@/lib/whatif";
import { parseQuestion } from "@/lib/ask";
import type { AskResult, PatientSnapshot } from "./contract";

/**
 * El puente entre la UI y las rutas de IA.
 *
 * Degrada igual que el SSE: si no hay API key, si la red falla o si el modelo
 * declina, se cae a las reglas locales y la pantalla lo DICE. Nunca se finge
 * que respondió un modelo cuando no lo hizo — es la misma regla que "lo
 * simulado nunca se ve como lo medido", aplicada a la IA.
 */

export function snapshot(
  v: Vitals,
  a: Assessment,
  applied: string[],
): PatientSnapshot {
  return {
    t: v.t,
    hr: v.hr,
    sbp: v.sbp,
    dbp: v.dbp,
    map: v.map,
    co: v.co,
    spo2: v.spo2,
    lactate: v.lactate,
    perfusion_pct: v.perfusion_index * 100,
    filling_pct: a.filling_pct,
    status: a.status,
    label: a.label,
    time_to_critical_s: a.time_to_critical_s,
    deterioration_risk: a.deterioration_risk,
    applied,
  };
}

/** Corta la espera: en una demo, 20 s mirando un spinner es una demo perdida. */
const TIMEOUT_MS = 20_000;

async function post<T>(url: string, body: unknown): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`http-${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ ask */

export async function ask(
  question: string,
  v: Vitals,
  a: Assessment,
  applied: string[],
): Promise<AskResult> {
  try {
    return await post<AskResult>("/api/ask", {
      question,
      state: snapshot(v, a, applied),
    });
  } catch {
    // Reglas locales: sin red, sin key, sin latencia. La UI marca la fuente.
    const p = parseQuestion(question);
    if (!p.supported)
      return { supported: false, reason: p.reason, reading: "", source: "local" };
    return {
      supported: true,
      intervention: p.intervention,
      efficacy: p.efficacy,
      delay_s: p.delay,
      echo: p.echo,
      reading: "",
      source: "local",
    };
  }
}

/* --------------------------------------------------------------- agentes */

export type LiveAgents = {
  cardio: { headline: string; technical: string; stance: string; intervention: string };
  fisio: { headline: string; technical: string; stance: string; intervention: string };
  orq: {
    conflict: boolean;
    headline: string;
    tiebreak_rule: string;
    recommendation: string;
  };
  source: "llm";
};

export async function deliberate(
  v: Vitals,
  a: Assessment,
  branches: Branch[],
  applied: string[],
): Promise<LiveAgents | null> {
  try {
    return await post<LiveAgents>("/api/agents", {
      state: snapshot(v, a, applied),
      branches: branches.map((b) => ({
        key: b.key,
        human: b.human,
        vsNone: b.vsNone,
      })),
    });
  } catch {
    return null; // el llamador usa runAgents() local
  }
}

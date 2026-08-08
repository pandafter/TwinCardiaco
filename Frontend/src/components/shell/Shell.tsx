"use client";

import { mmss, type Assessment, type Vitals } from "@/lib/engine";
import {
  AlertTriangle,
  Bell,
  Gear,
  HeartRate,
  LogoMark,
  NavAgents,
  NavHistory,
  NavResults,
  NavSimulations,
  Pause,
  Plus,
  CheckSquare,
} from "@/components/icons";

/** Cabecera común: identidad, caso, alarma, cuenta atrás y presencia. */
export function TopBar({
  vitals,
  assess,
  subtitle = "REAL-TIME CARDIAC DIGITAL TWIN",
  compact = false,
}: {
  vitals: Vitals;
  assess: Assessment;
  subtitle?: string;
  compact?: boolean;
}) {
  const ttc = assess.time_to_critical_s;

  return (
    <header
      data-shot="topbar"
      className="flex shrink-0 items-stretch gap-3 border-b border-line px-3 py-2.5"
    >
      <div className="flex items-center gap-2.5 pr-3">
        <div className="flex h-[2.5rem] w-[2.5rem] items-center justify-center rounded-[0.6rem] border border-line-strong bg-card text-crit">
          <LogoMark className="h-[1.4rem] w-[1.4rem]" />
        </div>
        <div className="leading-none">
          <div className="text-[1.05rem] font-semibold tracking-[0.06em] text-hi">
            CARDIAC <span className="font-light text-mid">TWIN</span>
          </div>
          <div className="mt-1.5 text-[0.4375rem] tracking-[0.2em] text-dim">
            {subtitle}
          </div>
        </div>
      </div>

      <Divider />

      <div className="flex flex-col justify-center px-1">
        <div className="text-[0.4375rem] tracking-[0.18em] text-dim">
          CASO ACTUAL
        </div>
        <div className="mt-1.5 text-[0.75rem] text-hi">
          Insuficiencia cardíaca descompensada
        </div>
        <div className="mt-1 text-[0.5625rem] text-lo">
          Paciente ID: CT-4782 · Masculino 67 años
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex w-[21.5rem] items-center gap-3 rounded-[0.6rem] border border-[rgba(229,72,77,0.35)] bg-[rgba(229,72,77,0.07)] px-4 py-2.5">
          <AlertTriangle className="h-[1.15rem] w-[1.15rem] shrink-0 text-crit" />
          <div>
            <div className="text-[0.8125rem] font-semibold tracking-[0.02em] text-crit">
              {assess.label}
            </div>
            <div className="mt-1 text-[0.5625rem] text-mid">
              Deterioro en curso. Requiere evaluación e intervención.
            </div>
          </div>
        </div>
      </div>

      <Divider />

      <div className="flex flex-col items-center justify-center px-2">
        <div className="text-center text-[0.4375rem] leading-[1.5] tracking-[0.16em] text-dim">
          TIEMPO ESTIMADO
          <br />
          HASTA ESTADO CRÍTICO
        </div>
        <div className="mt-1 font-mono text-[1.6rem] leading-none font-semibold tracking-[0.02em] text-crit tabular-nums">
          {ttc === null ? "--:--" : mmss(ttc)}
        </div>
        <div className="mt-1 text-[0.4375rem] tracking-[0.14em] text-dim">
          min : seg
        </div>
      </div>

      <Divider />

      <div className="flex flex-col justify-center gap-1.5 pl-1">
        <div className="text-[0.4375rem] tracking-[0.18em] text-dim">
          COLABORACIÓN EN VIVO
        </div>
        <div className="text-[0.625rem] text-ok">3 conectados</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[
              { i: "L", c: "var(--info)" },
              { i: "R", c: "var(--crit)" },
              { i: "A", c: "var(--ok)" },
            ].map((a, n) => (
              <span
                key={a.i}
                className="flex h-[1.35rem] w-[1.35rem] items-center justify-center rounded-full border border-shell text-[0.5rem] font-medium"
                style={{
                  marginLeft: n ? "-0.3rem" : 0,
                  background: `color-mix(in srgb, ${a.c} 22%, transparent)`,
                  color: a.c,
                }}
              >
                {a.i}
              </span>
            ))}
            <span className="ml-[-0.3rem] flex h-[1.35rem] w-[1.35rem] items-center justify-center rounded-full border border-line-strong bg-card text-lo">
              <Plus className="h-[0.6rem] w-[0.6rem]" />
            </span>
          </div>
          <button className="rounded-md border border-line-strong px-3 py-1.5 text-[0.5625rem] text-mid transition-colors hover:border-lo hover:text-hi">
            Invitar
          </button>
          {!compact && (
            <button className="flex h-[1.9rem] w-[1.9rem] items-center justify-center rounded-md border border-line-strong text-lo transition-colors hover:text-mid">
              <Gear className="h-[0.85rem] w-[0.85rem]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

const Divider = () => <div className="my-1 w-px shrink-0 bg-line" />;

/* ------------------------------------------------------------ nav inferior */

export const NAV_ITEMS = [
  { label: "Paciente", icon: HeartRate, href: "/monitor" },
  { label: "Agentes", icon: NavAgents, href: "/agents" },
  { label: "Intervenciones", icon: CheckSquare, href: "/interventions" },
  { label: "Simulaciones", icon: NavSimulations, href: "#" },
  { label: "Resultados", icon: NavResults, href: "#" },
  { label: "Historial", icon: NavHistory, href: "#" },
  { label: "Configuración", icon: Gear, href: "#" },
] as const;

export function BottomNav({
  active,
  accent = "var(--crit)",
  items = 6,
  underline = false,
  children,
}: {
  active: string;
  accent?: string;
  /** el monitor muestra 6 entradas; el command center añade Configuración */
  items?: number;
  underline?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <nav className="flex shrink-0 items-center justify-between border-t border-line px-3 py-2">
      <div className="flex items-center gap-1">
        {NAV_ITEMS.slice(0, items).map((n) => {
          const Icon = n.icon;
          const on = n.label === active;
          return (
            <a
              key={n.label}
              href={n.href}
              className="relative flex w-[5.2rem] flex-col items-center gap-1.5 rounded-lg px-2 py-2 transition-colors"
              style={{
                color: on ? accent : "var(--text-lo)",
                background:
                  on && !underline
                    ? `color-mix(in srgb, ${accent} 9%, transparent)`
                    : undefined,
              }}
            >
              <Icon className="h-[1.05rem] w-[1.05rem]" />
              <span className="text-[0.5rem]">{n.label}</span>
              {on && underline && (
                <span
                  className="absolute right-2 -bottom-1 left-2 h-[0.125rem] rounded-full"
                  style={{ background: accent }}
                />
              )}
            </a>
          );
        })}
      </div>
      <div className="flex items-center gap-2.5">{children}</div>
    </nav>
  );
}

export function MonitorActions() {
  return (
    <>
      <button className="flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2.5 text-[0.625rem] text-mid transition-colors hover:border-lo hover:text-hi">
        <Pause className="h-[0.75rem] w-[0.75rem]" />
        Pausar simulación
      </button>
      <button className="flex items-center gap-2 rounded-lg border border-[rgba(229,72,77,0.45)] bg-[rgba(229,72,77,0.1)] px-4 py-2.5 text-[0.625rem] font-medium text-crit transition-colors hover:bg-[rgba(229,72,77,0.16)]">
        <Bell className="h-[0.75rem] w-[0.75rem]" />
        Emergencia
      </button>
    </>
  );
}

import { useId } from "react";

type P = { className?: string; style?: React.CSSProperties };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * Marca: corazón con el latido recortado en negativo y las colas del trazo
 * saliendo a los lados.
 *
 * Silueta clásica y no anatómica a propósito: el logo se usa a 16 px en la
 * barra superior, y a ese tamaño un corazón anatómico es una mancha. La
 * forma tiene que reconocerse antes que el detalle.
 */
export function LogoMark({ className, style }: P) {
  const uid = useId().replace(/:/g, "");
  const beat = "M1 16.4h6.1l2-4.6 2.7 8.8 2.2-6 1.5 1.8H31";
  return (
    <svg className={className} style={style} viewBox="0 0 32 32" fill="none">
      <defs>
        <mask id={`${uid}-beat`}>
          <rect x="0" y="0" width="32" height="32" fill="white" />
          <path
            d={beat}
            stroke="black"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      <path
        d="M16 28C16 28 3.4 20.4 3.4 12.1c0-4 3.1-7.1 7-7.1 2.4 0 4.6 1.3 5.6 3.1 1-1.8 3.2-3.1 5.6-3.1 3.9 0 7 3.1 7 7.1C28.6 20.4 16 28 16 28Z"
        fill="currentColor"
        mask={`url(#${uid}-beat)`}
      />

      {/* las colas del latido salen del corazón: se lee "ritmo", no "grieta" */}
      <path
        d="M1 16.4h4.2M26.9 16.4H31"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const Users = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 19v-1.4a3.5 3.5 0 0 0-2.6-3.4M15.4 5.2a3.2 3.2 0 0 1 0 6" />
  </svg>
);

export const Gear = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="2.9" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.75 2.75l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.94 1.94 0 1 1-3.89 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06A1.94 1.94 0 1 1 4.7 16.4l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97h-.17a1.94 1.94 0 1 1 0-3.89h.09A1.6 1.6 0 0 0 5 8.67a1.6 1.6 0 0 0-.32-1.77l-.06-.06A1.94 1.94 0 1 1 7.37 4.1l.06.06a1.6 1.6 0 0 0 1.77.32h.08A1.6 1.6 0 0 0 10.25 3v-.17a1.94 1.94 0 1 1 3.89 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.75 2.75l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97h.17a1.94 1.94 0 1 1 0 3.89h-.09a1.6 1.6 0 0 0-1.46.97Z" />
  </svg>
);

export const Bulb = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M9.5 18h5M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.45.95 1.05 1.05 1.7l.05.5h5l.05-.5c.1-.65.45-1.25 1.05-1.7A6 6 0 0 0 12 3Z" />
  </svg>
);

export const Shield = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M12 3 5 6v5.5c0 4 3 7.2 7 9.5 4-2.3 7-5.5 7-9.5V6l-7-3Z" />
    <path d="m9.3 12 1.9 1.9 3.6-3.7" />
  </svg>
);

export const ChevronRight = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </svg>
);

export const ArrowRight = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </svg>
);

export const Person = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M19 20v-1.6a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V20" />
    <circle cx="12" cy="7.5" r="3.6" />
  </svg>
);

export const Male = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="10" cy="14" r="5.2" />
    <path d="M14.8 9.2 20 4M15.4 4H20v4.6" />
  </svg>
);

export const Female = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="9" r="5.2" />
    <path d="M12 14.2V21M9 18h6" />
  </svg>
);

export const HeartRate = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M20.6 9.3A4.4 4.4 0 0 0 12 7.6a4.4 4.4 0 0 0-8.6 1.7c0 4.4 5.4 7.6 8.6 10.2 3.2-2.6 8.6-5.8 8.6-10.2Z" />
    <path d="M3.8 11.9h3.3L8.6 9.6l1.9 4.6 1.6-3.1h1.9" />
  </svg>
);

/** Presión arterial: manguito con manómetro, no una hoja de papel. */
export const Pressure = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <rect x="3.4" y="7.2" width="12" height="9.6" rx="2.4" />
    <path d="M6.6 7.2V5.6M12.2 7.2V5.6M6.6 16.8v1.6M12.2 16.8v1.6" />
    <circle cx="19.2" cy="12" r="2.6" />
    <path d="M15.4 12h1.2M19.2 12l1.3-1.3" />
  </svg>
);

export const Gauge = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M4 17a8 8 0 1 1 16 0" />
    <path d="m12 17 3.6-5" />
    <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const Droplet = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M12 3.5c3.2 3.6 5.6 6.3 5.6 9.1A5.6 5.6 0 0 1 6.4 12.6c0-2.8 2.4-5.5 5.6-9.1Z" />
  </svg>
);

export const Lungs = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M12 3.5v9" />
    <path d="M12 8.5c-.6-1.8-2-2.8-3.4-2.8C7 5.7 6 7 5.6 8.8L4.3 15c-.4 2 1 3.8 3 3.8h1.3c1.4 0 2.5-1.1 2.5-2.5v-4" />
    <path d="M12 8.5c.6-1.8 2-2.8 3.4-2.8 1.6 0 2.6 1.3 3 3.1l1.3 6.2c.4 2-1 3.8-3 3.8h-1.3c-1.4 0-2.5-1.1-2.5-2.5v-4" />
  </svg>
);

export const Flask = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M10 3.5h4M10.7 3.5v6L5.6 17.4c-.9 1.4.1 3.1 1.7 3.1h9.4c1.6 0 2.6-1.7 1.7-3.1L13.3 9.5v-6" />
    <path d="M7.6 14.5h8.8" />
  </svg>
);

/** Gasto cardiaco: flujo saliendo de la bomba, no un reloj más. */
export const Output = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M4.4 15.8a5.8 5.8 0 0 1 0-7.6c2.2-2.4 5.4-2.4 7.4 0" />
    <path d="M4.4 15.8c2 2.4 5.2 2.4 7.4 0" />
    <path d="M13.4 8.6h3.4M13.4 12h5M13.4 15.4h3.4" />
    <path d="m17.4 6.2 2.6 2.4-2.6 2.4M17.6 13.4l2.8 2-2.8 2" />
  </svg>
);

export const Waves = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M2.5 12h3.2l2-5 3 10 2.4-6.4 1.6 3.4h6.8" />
  </svg>
);

export const CheckCircle = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.6 12.2 2.3 2.3 4.5-4.7" />
  </svg>
);

export const Target = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const CheckSquare = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.4" />
    <path d="m8.4 12.2 2.4 2.4 4.8-5" />
  </svg>
);

export const Info = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11.2v5M12 7.9h.01" />
  </svg>
);

export const Bars = ({ className, style }: P) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="14" width="3.6" height="8" rx="1" />
    <rect x="7.6" y="10" width="3.6" height="12" rx="1" />
    <rect x="13.2" y="6" width="3.6" height="16" rx="1" />
    <rect x="18.8" y="2" width="3.6" height="20" rx="1" />
  </svg>
);

/* ------------------------------------------------------------- monitor */

export const AlertTriangle = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M10.3 4.3 2.6 17.5c-.7 1.2.2 2.7 1.7 2.7h15.4c1.5 0 2.4-1.5 1.7-2.7L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4.2M12 17.2h.01" />
  </svg>
);

export const Pause = ({ className, style }: P) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6.5" y="4.5" width="3.6" height="15" rx="1.2" />
    <rect x="13.9" y="4.5" width="3.6" height="15" rx="1.2" />
  </svg>
);

export const Bell = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M18 8.6a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4Z" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </svg>
);

export const Plus = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

export const ChevronDown = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="m5.5 9 6.5 6.5L18.5 9" />
  </svg>
);

export const Thermometer = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M13.5 14.2V5.4a1.9 1.9 0 1 0-3.8 0v8.8a3.6 3.6 0 1 0 3.8 0Z" />
  </svg>
);

/* --- agentes --- */

/** Agente clínico: estetoscopio. Antes era otro corazón con línea. */
export const AgentCardio = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M5.2 3.4v5a4.5 4.5 0 0 0 9 0v-5" />
    <path d="M3.6 3.4h3.2M12.6 3.4h3.2" />
    <path d="M9.7 12.9v2.7a4.3 4.3 0 0 0 8.6 0v-1.3" />
    <circle cx="18.3" cy="11.7" r="2.6" />
  </svg>
);

export const AgentPharma = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <rect
      x="3"
      y="8.4"
      width="18"
      height="7.2"
      rx="3.6"
      transform="rotate(-45 12 12)"
    />
    <path d="M9.4 9.4 14.6 14.6" />
  </svg>
);

export const AgentPhysio = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="5.2" r="2.4" />
    <circle cx="5.6" cy="17.6" r="2.4" />
    <circle cx="18.4" cy="17.6" r="2.4" />
    <path d="M12 7.6v4.2M10.2 12.6 7 15.6M13.8 12.6 17 15.6" />
  </svg>
);

export const AgentSim = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M12 3.2 20 7.4v9.2L12 20.8 4 16.6V7.4Z" />
    <path d="M4 7.4 12 11.6l8-4.2M12 11.6v9.2" />
  </svg>
);

export const AgentOrchestrator = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <rect x="3.4" y="3.4" width="7" height="7" rx="2" />
    <rect x="13.6" y="3.4" width="7" height="7" rx="2" />
    <rect x="3.4" y="13.6" width="7" height="7" rx="2" />
    <rect x="13.6" y="13.6" width="7" height="7" rx="2" />
  </svg>
);

/* --- nav inferior --- */

export const NavAgents = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="7.6" r="3.4" />
    <path d="M5 20v-1.2A5 5 0 0 1 10 14h4a5 5 0 0 1 5 4.8V20" />
  </svg>
);

export const NavSimulations = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="2.4" />
    <ellipse cx="12" cy="12" rx="9.2" ry="4.2" />
    <ellipse cx="12" cy="12" rx="9.2" ry="4.2" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="9.2" ry="4.2" transform="rotate(120 12 12)" />
  </svg>
);

export const NavResults = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M7 3.6h10a2 2 0 0 1 2 2v14.8l-7-3.4-7 3.4V5.6a2 2 0 0 1 2-2Z" />
  </svg>
);

/** Historial: reloj con retroceso, no el mismo reloj que Clock. */
export const NavHistory = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M3.7 12a8.3 8.3 0 1 0 2.6-6" />
    <path d="M3.3 3.7v4.1h4.1" />
    <path d="M12 7.5v4.7l3.1 1.9" />
  </svg>
);

export const Message = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M20.5 12.4a7.6 7.6 0 0 1-8.2 7.6c-.9 0-1.7-.1-2.5-.4L4.5 21l1.5-4.6a7.4 7.4 0 0 1-1-3.8 7.6 7.6 0 0 1 7.7-7.6 7.6 7.6 0 0 1 7.8 7.4Z" />
  </svg>
);

/* ------------------------------------------------------- intervenciones */

export const Syringe = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M17.4 3.4 20.6 6.6M18.6 5.4l-2.6 2.6M9.4 12.6l2 2M11.4 10.6l2 2" />
    <path d="M16 8 8.8 15.2l-3.2.8.8-3.2L13.6 5.6a1.4 1.4 0 0 1 2 0l.4.4a1.4 1.4 0 0 1 0 2Z" />
    <path d="m6.4 17.6-2.8 2.8" />
  </svg>
);

/** Tubo endotraqueal con conector: antes era indistinguible de un lápiz. */
export const Tube = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <rect x="14" y="2.6" width="6.6" height="4.6" rx="1.2" />
    <path d="M17.3 7.2c0 3.5-1.2 6.2-3.4 8.6-1.7 1.9-3.3 3.1-4.5 4.4" />
    <path d="M12.9 6c0 3.5-1.2 6.2-3.4 8.6-1.7 1.9-3.3 3.1-4.5 4.4" />
    <path d="M9.4 20.2a3 3 0 0 1-4.4-1.2" />
  </svg>
);

/** Muestra de laboratorio: tubo con tapón, distinto del matraz del lactato. */
export const Vial = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M8.4 2.8h7.2" />
    <path d="M9.8 2.8v14.6a2.9 2.9 0 0 0 5 2 2.9 2.9 0 0 0 .8-2V2.8" />
    <path d="M9.8 12.6h5.8M9.8 8.6h5.8" />
  </svg>
);

export const Eye = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M2.4 12S6 5.6 12 5.6 21.6 12 21.6 12 18 18.4 12 18.4 2.4 12 2.4 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const Clock = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7v5.2l3.4 2" />
  </svg>
);

export const X = ({ className, style }: P) => (
  <svg {...base} className={className} style={style}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

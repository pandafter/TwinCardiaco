type P = { className?: string; style?: React.CSSProperties };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LogoMark({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <path
        d="M4 7.5 L11.5 25.5 L19.5 5"
        stroke="currentColor"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 15.5 h3.4 l1.7 -4.6 l2.2 8.6 l1.8 -4 h3.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

export const Users = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 19v-1.4a3.5 3.5 0 0 0-2.6-3.4M15.4 5.2a3.2 3.2 0 0 1 0 6" />
  </svg>
);

export const Gear = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="2.9" />
    <path d="M19.4 14.5a1.6 1.6 0 0 0 .32 1.77l.06.06a1.94 1.94 0 1 1-2.75 2.75l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47v.17a1.94 1.94 0 1 1-3.89 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06A1.94 1.94 0 1 1 4.7 16.4l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97h-.17a1.94 1.94 0 1 1 0-3.89h.09A1.6 1.6 0 0 0 5 8.67a1.6 1.6 0 0 0-.32-1.77l-.06-.06A1.94 1.94 0 1 1 7.37 4.1l.06.06a1.6 1.6 0 0 0 1.77.32h.08A1.6 1.6 0 0 0 10.25 3v-.17a1.94 1.94 0 1 1 3.89 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.94 1.94 0 1 1 2.75 2.75l-.06.06a1.6 1.6 0 0 0-.32 1.77v.08a1.6 1.6 0 0 0 1.47.97h.17a1.94 1.94 0 1 1 0 3.89h-.09a1.6 1.6 0 0 0-1.46.97Z" />
  </svg>
);

export const Bulb = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9.5 18h5M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.45.95 1.05 1.05 1.7l.05.5h5l.05-.5c.1-.65.45-1.25 1.05-1.7A6 6 0 0 0 12 3Z" />
  </svg>
);

export const Shield = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3 5 6v5.5c0 4 3 7.2 7 9.5 4-2.3 7-5.5 7-9.5V6l-7-3Z" />
    <path d="m9.3 12 1.9 1.9 3.6-3.7" />
  </svg>
);

export const ChevronRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </svg>
);

export const ArrowRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </svg>
);

export const Person = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M19 20v-1.6a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4V20" />
    <circle cx="12" cy="7.5" r="3.6" />
  </svg>
);

export const Male = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="10" cy="14" r="5.2" />
    <path d="M14.8 9.2 20 4M15.4 4H20v4.6" />
  </svg>
);

export const Female = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="9" r="5.2" />
    <path d="M12 14.2V21M9 18h6" />
  </svg>
);

export const HeartRate = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M20.6 9.3A4.4 4.4 0 0 0 12 7.6a4.4 4.4 0 0 0-8.6 1.7c0 4.4 5.4 7.6 8.6 10.2 3.2-2.6 8.6-5.8 8.6-10.2Z" />
    <path d="M3.8 11.9h3.3L8.6 9.6l1.9 4.6 1.6-3.1h1.9" />
  </svg>
);

export const Pressure = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="5" y="3.5" width="14" height="17" rx="3" />
    <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
  </svg>
);

export const Gauge = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 17a8 8 0 1 1 16 0" />
    <path d="m12 17 3.6-5" />
    <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const Droplet = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3.5c3.2 3.6 5.6 6.3 5.6 9.1A5.6 5.6 0 0 1 6.4 12.6c0-2.8 2.4-5.5 5.6-9.1Z" />
  </svg>
);

export const Lungs = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3.5v9" />
    <path d="M12 8.5c-.6-1.8-2-2.8-3.4-2.8C7 5.7 6 7 5.6 8.8L4.3 15c-.4 2 1 3.8 3 3.8h1.3c1.4 0 2.5-1.1 2.5-2.5v-4" />
    <path d="M12 8.5c.6-1.8 2-2.8 3.4-2.8 1.6 0 2.6 1.3 3 3.1l1.3 6.2c.4 2-1 3.8-3 3.8h-1.3c-1.4 0-2.5-1.1-2.5-2.5v-4" />
  </svg>
);

export const Flask = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M10 3.5h4M10.7 3.5v6L5.6 17.4c-.9 1.4.1 3.1 1.7 3.1h9.4c1.6 0 2.6-1.7 1.7-3.1L13.3 9.5v-6" />
    <path d="M7.6 14.5h8.8" />
  </svg>
);

export const Output = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v4.6l3 1.9" />
  </svg>
);

export const Waves = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M2.5 12h3.2l2-5 3 10 2.4-6.4 1.6 3.4h6.8" />
  </svg>
);

export const CheckCircle = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.6 12.2 2.3 2.3 4.5-4.7" />
  </svg>
);

export const Target = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const CheckSquare = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.4" />
    <path d="m8.4 12.2 2.4 2.4 4.8-5" />
  </svg>
);

export const Info = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11.2v5M12 7.9h.01" />
  </svg>
);

export const Bars = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="14" width="3.6" height="8" rx="1" />
    <rect x="7.6" y="10" width="3.6" height="12" rx="1" />
    <rect x="13.2" y="6" width="3.6" height="16" rx="1" />
    <rect x="18.8" y="2" width="3.6" height="20" rx="1" />
  </svg>
);

/* ------------------------------------------------------------- monitor */

export const AlertTriangle = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M10.3 4.3 2.6 17.5c-.7 1.2.2 2.7 1.7 2.7h15.4c1.5 0 2.4-1.5 1.7-2.7L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4.2M12 17.2h.01" />
  </svg>
);

export const Pause = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6.5" y="4.5" width="3.6" height="15" rx="1.2" />
    <rect x="13.9" y="4.5" width="3.6" height="15" rx="1.2" />
  </svg>
);

export const Bell = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M18 8.6a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4Z" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </svg>
);

export const Plus = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

export const ChevronDown = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m5.5 9 6.5 6.5L18.5 9" />
  </svg>
);

export const Thermometer = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M13.5 14.2V5.4a1.9 1.9 0 1 0-3.8 0v8.8a3.6 3.6 0 1 0 3.8 0Z" />
  </svg>
);

/* --- agentes --- */

export const AgentCardio = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M20.4 9.4A4.3 4.3 0 0 0 12 7.7a4.3 4.3 0 0 0-8.4 1.7c0 4.3 5.3 7.4 8.4 10 3.1-2.6 8.4-5.7 8.4-10Z" />
    <path d="M4.2 11.8h2.9l1.3-2.2 1.8 4.4 1.5-3h2" />
  </svg>
);

export const AgentPharma = ({ className }: P) => (
  <svg {...base} className={className}>
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

export const AgentPhysio = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="5.2" r="2.4" />
    <circle cx="5.6" cy="17.6" r="2.4" />
    <circle cx="18.4" cy="17.6" r="2.4" />
    <path d="M12 7.6v4.2M10.2 12.6 7 15.6M13.8 12.6 17 15.6" />
  </svg>
);

export const AgentSim = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3.2 20 7.4v9.2L12 20.8 4 16.6V7.4Z" />
    <path d="M4 7.4 12 11.6l8-4.2M12 11.6v9.2" />
  </svg>
);

export const AgentOrchestrator = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="3.4" y="3.4" width="7" height="7" rx="2" />
    <rect x="13.6" y="3.4" width="7" height="7" rx="2" />
    <rect x="3.4" y="13.6" width="7" height="7" rx="2" />
    <rect x="13.6" y="13.6" width="7" height="7" rx="2" />
  </svg>
);

/* --- nav inferior --- */

export const NavAgents = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="7.6" r="3.4" />
    <path d="M5 20v-1.2A5 5 0 0 1 10 14h4a5 5 0 0 1 5 4.8V20" />
  </svg>
);

export const NavSimulations = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="2.4" />
    <ellipse cx="12" cy="12" rx="9.2" ry="4.2" />
    <ellipse cx="12" cy="12" rx="9.2" ry="4.2" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="9.2" ry="4.2" transform="rotate(120 12 12)" />
  </svg>
);

export const NavResults = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M7 3.6h10a2 2 0 0 1 2 2v14.8l-7-3.4-7 3.4V5.6a2 2 0 0 1 2-2Z" />
  </svg>
);

export const NavHistory = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7v5.2l3.4 2" />
  </svg>
);

export const Message = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M20.5 12.4a7.6 7.6 0 0 1-8.2 7.6c-.9 0-1.7-.1-2.5-.4L4.5 21l1.5-4.6a7.4 7.4 0 0 1-1-3.8 7.6 7.6 0 0 1 7.7-7.6 7.6 7.6 0 0 1 7.8 7.4Z" />
  </svg>
);

/* ------------------------------------------------------- intervenciones */

export const Syringe = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M17.4 3.4 20.6 6.6M18.6 5.4l-2.6 2.6M9.4 12.6l2 2M11.4 10.6l2 2" />
    <path d="M16 8 8.8 15.2l-3.2.8.8-3.2L13.6 5.6a1.4 1.4 0 0 1 2 0l.4.4a1.4 1.4 0 0 1 0 2Z" />
    <path d="m6.4 17.6-2.8 2.8" />
  </svg>
);

export const Tube = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M18.8 3.6 20.4 5.2a2 2 0 0 1 0 2.8l-9.6 9.6-4.4 1.2 1.2-4.4L17.2 4.8a1.1 1.1 0 0 1 1.6 0Z" />
    <path d="m14.4 6.4 3.2 3.2" />
  </svg>
);

export const Vial = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9.4 3h5.2M10.2 3v5.8l-3.6 8.4c-.7 1.6.4 3.4 2.2 3.4h6.4c1.8 0 2.9-1.8 2.2-3.4l-3.6-8.4V3" />
    <path d="M7.8 14.6h8.4" />
  </svg>
);

export const Eye = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M2.4 12S6 5.6 12 5.6 21.6 12 21.6 12 18 18.4 12 18.4 2.4 12 2.4 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const Clock = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7v5.2l3.4 2" />
  </svg>
);

export const X = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

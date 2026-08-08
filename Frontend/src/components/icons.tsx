type P = { className?: string };

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

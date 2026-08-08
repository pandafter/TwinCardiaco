"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Un número que se mueve hacia su valor nuevo en vez de saltar.
 *
 * En un monitor esto no es adorno: el ojo detecta el movimiento antes que el
 * dígito, así que ver el número *subiendo* comunica el deterioro medio segundo
 * antes de leerlo. Saltar de 88 a 143 no cuenta esa historia.
 *
 * La interpolación es solo de presentación — el valor real nunca se toca, y
 * cuando la diferencia es grande (reinicio, cambio de caso) salta directo en
 * vez de recorrer 60 puntos de pulso.
 */
export function AnimatedNumber({
  value,
  digits = 0,
  className,
  style,
}: {
  value: number;
  digits?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [shown, setShown] = useState(value);
  const raf = useRef<number | null>(null);
  const from = useRef(value);
  const start = useRef(0);

  useEffect(() => {
    // salto brusco (reset del caso): no tiene sentido animar el recorrido
    if (Math.abs(value - from.current) > Math.max(25, Math.abs(value) * 0.5)) {
      from.current = value;
      setShown(value);
      return;
    }
    from.current = shown;
    start.current = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - start.current) / 420);
      // easeOutCubic: rápido al principio, se posa al final
      const e = 1 - Math.pow(1 - p, 3);
      setShown(from.current + (value - from.current) * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // `shown` se lee como punto de partida, no como disparador
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={`num ${className ?? ""}`} style={style}>
      {shown.toFixed(digits)}
    </span>
  );
}

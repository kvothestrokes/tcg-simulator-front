interface StatusDotProps {
  /** true = en línea. */
  on: boolean;
  pulse?: boolean;
  className?: string;
}

/** Punto de estado: presencia de un jugador, salud del servicio. */
export function StatusDot({ on, pulse = false, className = '' }: StatusDotProps) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
        on ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-stroke-dim)]'
      } ${on && pulse ? 'animate-ping-slow' : ''} ${className}`}
      aria-hidden="true"
    />
  );
}

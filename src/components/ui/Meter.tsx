/**
 * Medidor segmentado: puntos de recurso y calor.
 *
 * El calor lleva además una marca de umbral y cambia de color al pasarlo, que
 * es la información que un jugador necesita ver de un vistazo desde el otro
 * lado de la mesa.
 */

interface MeterProps {
  value: number;
  max: number;
  /** Segmento a partir del cual se considera sobrecalentamiento. */
  threshold?: number;
  color?: string;
  overColor?: string;
  className?: string;
}

export function Meter({
  value,
  max,
  threshold,
  color = 'var(--color-ink)',
  overColor = 'var(--color-heat-max)',
  className = '',
}: MeterProps) {
  const over = threshold !== undefined && value >= threshold;
  const active = over ? overColor : color;

  return (
    <div
      className={`meter ${className}`}
      style={{ ['--meter-color' as string]: active }}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="meter__seg"
          data-on={i < value}
          data-threshold={threshold !== undefined && i + 1 === threshold}
        />
      ))}
    </div>
  );
}

interface StepperProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
}

/** Par de botones +/- con el valor en medio. */
export function Stepper({ value, min = 0, max, onChange, disabled, label }: StepperProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className="step"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={label ? `Reducir ${label}` : 'Reducir'}
      >
        −
      </button>
      <span className="display tabular min-w-[2.25rem] text-center text-lg leading-none">
        {value}
      </span>
      <button
        type="button"
        className="step"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={label ? `Aumentar ${label}` : 'Aumentar'}
      >
        +
      </button>
    </div>
  );
}

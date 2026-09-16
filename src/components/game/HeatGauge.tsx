/**
 * Medidor de calor.
 *
 * El calor lo declara el jugador: aquí no se acumula solo ni dispara nada al
 * pasar el umbral. El medidor existe para que los dos vean de un vistazo quién
 * está sobrecalentado, igual que un contador físico en la mesa.
 */

import { Meter, Stepper } from '../ui/Meter';
import { Panel } from '../ui/Panel';
import { HEAT_MAX, HEAT_THRESHOLD } from '../../lib/game/types';

interface HeatGaugeProps {
  value: number;
  /** Solo el dueño del tablero puede cambiarlo. */
  editable: boolean;
  onChange: (value: number) => void;
  compact?: boolean;
}

export function HeatGauge({ value, editable, onChange, compact = false }: HeatGaugeProps) {
  const over = value >= HEAT_THRESHOLD;

  return (
    <Panel
      tone={over ? 'danger' : 'default'}
      cut={10}
      className="shrink-0"
      innerClassName={`flex flex-col justify-between ${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className={`hud-title ${compact ? 'text-[10px]' : 'text-xs'}`}>Heat</h4>
        <span
          className="tabular display text-lg leading-none"
          style={{ color: over ? 'var(--color-heat-max)' : 'var(--color-heat)' }}
        >
          {value}
          <span className="text-[var(--color-ink-faint)] text-xs">/{HEAT_MAX}</span>
        </span>
      </div>

      <Meter
        value={value}
        max={HEAT_MAX}
        threshold={HEAT_THRESHOLD}
        color="var(--color-heat)"
        className="my-1.5"
      />

      {editable ? (
        <div className="flex items-center justify-between gap-2">
          <Stepper value={value} max={HEAT_MAX} onChange={onChange} label="calor" />
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => onChange(0)}
            disabled={value === 0}
            title="Disipar todo el calor"
          >
            Purgar
          </button>
        </div>
      ) : (
        <p className="hud-sub text-[9px]">
          {over ? 'Sobrecalentado' : `Umbral ${HEAT_THRESHOLD}`}
        </p>
      )}
    </Panel>
  );
}

/**
 * Deck action group for the sidebar "Mazo" panel.
 *
 * Presentational only: GameTable decides what is allowed (the same checks the
 * reducer uses, see rules.deckActionBlock) and passes the Spanish reason for
 * every disabled button, which shows up as its tooltip.
 */

import { Stepper } from '../ui/Meter';
import { REVEAL_MAX } from '../../lib/game/types';

export interface DeckActionBlocks {
  draw: string | null;
  extraDraw: string | null;
  reveal: string | null;
  mill: string | null;
  recycle: string | null;
}

interface DeckActionsProps {
  blocks: DeckActionBlocks;
  revealCount: number;
  onRevealCountChange: (value: number) => void;
  onDraw: () => void;
  onExtraDraw: () => void;
  onReveal: () => void;
  onMill: () => void;
  onRecycle: () => void;
}

export function DeckActions({
  blocks,
  revealCount,
  onRevealCountChange,
  onDraw,
  onExtraDraw,
  onReveal,
  onMill,
  onRecycle,
}: DeckActionsProps) {
  return (
    <div className="col-span-2 grid grid-cols-2 gap-1">
      <ActionButton
        label="Robar 1"
        hint="Roba 1 carta de tu mazo (herramienta manual)."
        block={blocks.draw}
        onClick={onDraw}
      />
      <ActionButton
        label="Robo extra"
        hint="Roba 1 carta y suma +1 de calor. Una vez por turno, solo en tu turno."
        block={blocks.extraDraw}
        onClick={onExtraDraw}
      />
      <div className="col-span-2 flex items-center justify-between gap-1">
        <Stepper
          value={revealCount}
          min={1}
          max={REVEAL_MAX}
          onChange={onRevealCountChange}
          label="cartas a revelar"
        />
        <ActionButton
          label={`Revelar ${revealCount}`}
          hint={`Mira las ${revealCount} cartas superiores de tu mazo y decide a dónde va cada una. El rival solo ve cuántas.`}
          block={blocks.reveal}
          onClick={onReveal}
          className="flex-1"
        />
      </div>
      <ActionButton
        label="Moler"
        hint="La carta superior de tu mazo va al Vacío (pública)."
        block={blocks.mill}
        onClick={onMill}
      />
      <ActionButton
        label="Reciclar"
        hint="Mira la carta superior: si es Nave o Gear va a tus Recursos (lista para gastar); si no, al Vacío."
        block={blocks.recycle}
        onClick={onRecycle}
      />
    </div>
  );
}

function ActionButton({
  label,
  hint,
  block,
  onClick,
  className = '',
}: {
  label: string;
  hint: string;
  block: string | null;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`btn btn--sm ${className}`}
      onClick={onClick}
      disabled={Boolean(block)}
      title={block ? `${hint} — No disponible: ${block}` : hint}
    >
      {label}
    </button>
  );
}

import { CardTile } from './CardTile';
import type { CardInstance } from '../../lib/game/types';

interface DiscardViewerProps {
  cards: CardInstance[];
  onClose: () => void;
  onSelect: (card: CardInstance) => void;
}

export function DiscardViewer({ cards, onClose, onSelect }: DiscardViewerProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Visor de descarte"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-4xl overflow-y-auto border border-[var(--color-stroke-faint)] bg-[var(--color-hull)] p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <h3 className="hud-title text-sm">Vacío espacial ({cards.length})</h3>
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Cerrar
          </button>
        </header>
        {cards.length === 0 ? (
          <p className="hud-sub text-xs">No hay cartas en el descarte.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cards.map((card) => (
              <CardTile
                key={card.uid}
                def={card.def}
                instance={card}
                width={110}
                onClick={() => onSelect(card)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

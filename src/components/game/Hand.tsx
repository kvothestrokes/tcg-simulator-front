/**
 * Tu mano. Es la única información oculta del simulador: vive en local y el
 * rival solo ve cuántas cartas tienes.
 *
 * Bajar una carta la revela, porque el evento PLAY lleva la definición
 * completa: así el rival puede dibujarla aunque no comparta tu catálogo.
 */

import { CardTile } from './CardTile';
import { setDragPayload } from './dnd';
import type { PrivateCard } from '../../hooks/usePrivateDeck';

interface HandProps {
  cards: PrivateCard[];
  selectedUid?: string;
  onSelect: (card: PrivateCard) => void;
  cardWidth: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function Hand({
  cards,
  selectedUid,
  onSelect,
  cardWidth,
  collapsed,
  onToggle,
}: HandProps) {
  return (
    <section
      className="shrink-0 border-t border-[var(--color-stroke-faint)] bg-[rgba(8,9,11,0.92)] backdrop-blur"
      aria-label="Tu mano"
    >
      <header className="flex items-center gap-3 px-3 py-1">
        <h3 className="hud-title text-[11px]">Mano</h3>
        <span className="hud-sub tabular">{cards.length}</span>
        <button type="button" className="btn btn--sm btn--ghost ml-auto" onClick={onToggle}>
          {collapsed ? 'Mostrar' : 'Ocultar'}
        </button>
      </header>

      {collapsed ? null : (
        <div className="flex items-end gap-1.5 overflow-x-auto px-3 pb-4">
          {cards.length === 0 ? (
            <p className="hud-sub py-6 text-[10px] opacity-60">
              No tienes cartas. Roba del mazo para empezar.
            </p>
          ) : (
            cards.map((card) => (
              <div key={card.uid} className="shrink-0">
                <CardTile
                  def={card.def}
                  width={cardWidth}
                  selected={selectedUid === card.uid}
                  draggable
                  onClick={() => onSelect(card)}
                  onDragStart={(event) =>
                    setDragPayload(event, { uid: card.uid, source: 'hand', from: 'hand' })
                  }
                />
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Void viewer. The void is public, so anyone can browse it; only the owner's
 * void is actionable. Moving a card out of the void costs nothing (it is a
 * move, not a play from hand).
 */

import { useMemo, useState } from 'react';

import { CardTile } from './CardTile';
import type { CardInstance } from '../../lib/game/types';

export interface DiscardActions {
  onToHand: (card: CardInstance) => void;
  /** Undefined when there is no empty battle slot. */
  onToBattle?: (card: CardInstance) => void;
  onToResources: (card: CardInstance) => void;
  onToDeck: (card: CardInstance, position: 'top' | 'bottom') => void;
}

interface DiscardViewerProps {
  cards: CardInstance[];
  /** Whose void this is, for the title. */
  ownerLabel?: string;
  /** Present only for your own void while you can act. */
  actions?: DiscardActions;
  onView: (card: CardInstance) => void;
  onClose: () => void;
}

export function DiscardViewer({ cards, ownerLabel, actions, onView, onClose }: DiscardViewerProps) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return cards;
    return cards.filter((card) => normalize(card.def.nombre).includes(needle));
  }, [cards, query]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Visor de descarte"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-5xl overflow-y-auto border border-[var(--color-stroke-faint)] bg-[var(--color-hull)] p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="hud-title text-sm">
            Vacío espacial{ownerLabel ? ` · ${ownerLabel}` : ''} ({cards.length})
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre…"
              aria-label="Buscar carta por nombre"
              className="w-48 border border-[var(--color-stroke-faint)] bg-transparent px-2 py-1 text-[11px]"
            />
            <button type="button" className="btn btn--sm" onClick={onClose} title="Cerrar el visor del Vacío">
              Cerrar
            </button>
          </div>
        </header>
        {!actions ? (
          <p className="hud-sub mb-2 text-[9px] opacity-70">Solo lectura.</p>
        ) : null}
        {cards.length === 0 ? (
          <p className="hud-sub text-xs">No hay cartas en el descarte.</p>
        ) : visible.length === 0 ? (
          <p className="hud-sub text-xs">Ninguna carta coincide con «{query}».</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {visible.map((card) => (
              <div key={card.uid} className="flex w-[118px] flex-col items-center gap-1">
                <CardTile def={card.def} instance={card} width={110} onClick={() => onView(card)} />
                <div className="grid w-full grid-cols-2 gap-0.5">
                  <MiniButton label="Ver" hint="Ver la carta en grande" onClick={() => onView(card)} />
                  {actions ? (
                    <>
                      <MiniButton label="Mano" hint="Devolver a tu mano" onClick={() => actions.onToHand(card)} />
                      <MiniButton
                        label="Batalla"
                        hint={
                          actions.onToBattle
                            ? 'Al primer hueco libre de tu Zona de Batalla'
                            : 'No hay huecos libres en tu Zona de Batalla'
                        }
                        onClick={actions.onToBattle ? () => actions.onToBattle?.(card) : undefined}
                      />
                      <MiniButton
                        label="Recursos"
                        hint="A tu Zona de Recursos"
                        onClick={() => actions.onToResources(card)}
                      />
                      <MiniButton
                        label="Mazo ↑"
                        hint="Arriba de tu mazo"
                        onClick={() => actions.onToDeck(card, 'top')}
                      />
                      <MiniButton
                        label="Mazo ↓"
                        hint="Al fondo de tu mazo"
                        onClick={() => actions.onToDeck(card, 'bottom')}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniButton({ label, hint, onClick }: { label: string; hint: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="btn btn--sm px-1 text-[9px]"
      onClick={onClick}
      disabled={!onClick}
      title={hint}
    >
      {label}
    </button>
  );
}

/** Case- and accent-insensitive match ("nave" finds "Nave Élite"). */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

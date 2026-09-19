/**
 * DeckCardViewer — renders a deck's cards as thumbnails with quantity steppers.
 * Opens CardViewerModal on click for the full-frame view.
 */

import { useState } from 'react';

import type { DeckCardItem } from '@/lib/decks/mappers';
import type { CardDef } from '@/lib/game/types';
import { maxCopiesFor, validateAddCard } from '@/lib/decks/validation';
import { CardTile } from '@/components/game/CardTile';
import { CardViewerModal } from '@/components/game/CardViewerModal';

interface DeckCardViewerProps {
  items: DeckCardItem[];
  /** Resolved CardDef for each card_id. Missing ids are skipped. */
  catalog: Map<string, CardDef>;
  onRemove: (cardId: string) => Promise<void>;
  /** Set the exact quantity for a card (used by the +/- steppers). */
  onSetQty: (cardId: string, qty: number) => Promise<void>;
}

export function DeckCardViewer({ items, catalog, onRemove, onSetQty }: DeckCardViewerProps) {
  const [viewed, setViewed] = useState<CardDef | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (cardId: string, fn: () => Promise<void>) => {
    setBusy(cardId);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed border-[var(--color-stroke-faint)] px-4 py-10">
        <p className="hud-sub text-[11px] opacity-60">
          No cards yet — add some from the catalog.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
        {items.map((item) => {
          const def = catalog.get(item.card_id);
          if (!def) return null;
          const max = maxCopiesFor(def.tipo);
          const isBusy = busy === item.card_id;
          const canAddMore = validateAddCard(def, items, catalog).ok;

          return (
            <div
              key={item.card_id}
              className="flex flex-col items-center gap-1.5 rounded-md border border-[var(--color-stroke-faint)] bg-[rgba(255,255,255,0.02)] p-2"
            >
              <CardTile def={def} width={96} onClick={() => setViewed(def)} />

              <div className="flex w-full items-center justify-between gap-1">
                <button
                  type="button"
                  className="btn btn--sm text-[11px] px-2"
                  disabled={isBusy}
                  aria-label={`Remove one ${def.nombre}`}
                  onClick={() =>
                    void run(item.card_id, () =>
                      item.qty <= 1 ? onRemove(item.card_id) : onSetQty(item.card_id, item.qty - 1),
                    )
                  }
                >
                  −
                </button>
                <span className="hud-sub tabular text-[11px]">
                  {item.qty}/{max}
                </span>
                <button
                  type="button"
                  className="btn btn--sm text-[11px] px-2"
                  disabled={isBusy || !canAddMore}
                  aria-label={`Add one ${def.nombre}`}
                  onClick={() => void run(item.card_id, () => onSetQty(item.card_id, item.qty + 1))}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="btn btn--sm btn--danger text-[9px] w-full"
                disabled={isBusy}
                onClick={() => void run(item.card_id, () => onRemove(item.card_id))}
                aria-label={`Remove ${def.nombre} from deck`}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {viewed ? <CardViewerModal def={viewed} onClose={() => setViewed(null)} /> : null}
    </>
  );
}

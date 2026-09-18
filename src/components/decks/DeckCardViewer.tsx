/**
 * DeckCardViewer — renders a deck's cards as thumbnails.
 * Opens CardViewerModal on click for the full-frame view.
 */

import { useState } from 'react';

import type { DeckCardItem } from '@/lib/decks/mappers';
import type { CardDef } from '@/lib/game/types';
import { CardTile } from '@/components/game/CardTile';
import { CardViewerModal } from '@/components/game/CardViewerModal';

interface DeckCardViewerProps {
  items: DeckCardItem[];
  /** Resolved CardDef for each card_id. Missing ids are skipped. */
  catalog: Map<string, CardDef>;
  onRemove: (cardId: string) => Promise<void>;
}

export function DeckCardViewer({ items, catalog, onRemove }: DeckCardViewerProps) {
  const [viewed, setViewed] = useState<CardDef | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const handleRemove = async (cardId: string) => {
    setRemoving(cardId);
    try {
      await onRemove(cardId);
    } finally {
      setRemoving(null);
    }
  };

  if (items.length === 0) {
    return <p className="hud-sub text-[10px] opacity-60">No cards in this deck yet.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const def = catalog.get(item.card_id);
          if (!def) return null;
          return (
            <div key={item.card_id} className="flex flex-col items-center gap-1">
              <CardTile
                def={def}
                width={80}
                onClick={() => setViewed(def)}
              />
              <span className="hud-sub text-[9px] tabular">×{item.qty}</span>
              <button
                type="button"
                className="btn btn--sm btn--danger text-[9px] w-full"
                disabled={removing === item.card_id}
                onClick={() => void handleRemove(item.card_id)}
                aria-label={`Remove ${def.nombre} from deck`}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {viewed ? (
        <CardViewerModal def={viewed} onClose={() => setViewed(null)} />
      ) : null}
    </>
  );
}

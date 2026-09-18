/**
 * DeckEditor — rename a deck, view/remove its cards, and add new ones.
 */

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import type { DeckCardItem } from '@/lib/decks/mappers';
import type { CardDef } from '@/lib/game/types';
import { findCard, SAMPLE_CATALOG } from '@/lib/game/cards';
import type { DeckSummary } from '@/hooks/useDecks';
import { CardPicker } from './CardPicker';
import { DeckCardViewer } from './DeckCardViewer';
import { Panel } from '@/components/ui/Panel';

interface DeckEditorProps {
  deck: DeckSummary;
  items: DeckCardItem[];
  onRename: (id: string, nombre: string) => Promise<void>;
  onAddCard: (deckId: string, cardId: string, qty: number) => Promise<void>;
  onRemoveCard: (deckId: string, cardId: string) => Promise<void>;
  onBack: () => void;
}

export function DeckEditor({ deck, items, onRename, onAddCard, onRemoveCard, onBack }: DeckEditorProps) {
  const [name, setName] = useState(deck.nombre);
  const [renaming, setRenaming] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Build catalog map for DeckCardViewer
  const [catalogMap, setCatalogMap] = useState<Map<string, CardDef>>(() => {
    const m = new Map<string, CardDef>();
    for (const c of SAMPLE_CATALOG) m.set(c.id, c);
    return m;
  });

  useEffect(() => {
    const m = new Map<string, CardDef>();
    for (const item of items) {
      const def = findCard(item.card_id);
      if (def) m.set(item.card_id, def);
    }
    // Fill any missing from SAMPLE_CATALOG as fallback
    for (const c of SAMPLE_CATALOG) {
      if (!m.has(c.id)) m.set(c.id, c);
    }
    setCatalogMap(m);
  }, [items]);

  // Keep name field in sync when prop changes
  useEffect(() => {
    setName(deck.nombre);
  }, [deck.nombre]);

  const handleRename = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || trimmed === deck.nombre) return;
      setRenaming(true);
      try {
        await onRename(deck.id, trimmed);
      } finally {
        setRenaming(false);
      }
    },
    [deck.id, deck.nombre, name, onRename],
  );

  return (
    <Panel cut={12} innerClassName="flex flex-col gap-4 p-3">
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onBack}>
          Back
        </button>
        <h2 className="hud-title text-sm min-w-0 truncate">{deck.nombre}</h2>
      </div>

      {/* Rename form */}
      <form onSubmit={(e) => void handleRename(e)} className="flex gap-2">
        <input
          className="field flex-1 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          disabled={renaming}
          aria-label="Deck name"
        />
        <button
          type="submit"
          className="btn btn--sm"
          disabled={renaming || name.trim() === '' || name.trim() === deck.nombre}
        >
          {renaming ? 'Saving…' : 'Rename'}
        </button>
      </form>

      {/* Cards in deck */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="hud-sub text-[10px]">Cards ({items.length})</p>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setShowPicker((v) => !v)}
          >
            {showPicker ? 'Hide catalog' : 'Add cards'}
          </button>
        </div>

        <DeckCardViewer
          items={items}
          catalog={catalogMap}
          onRemove={(cardId) => onRemoveCard(deck.id, cardId)}
        />
      </div>

      {/* Card picker */}
      {showPicker ? (
        <CardPicker
          deckId={deck.id}
          onAdd={(cardId, qty) => onAddCard(deck.id, cardId, qty)}
        />
      ) : null}
    </Panel>
  );
}

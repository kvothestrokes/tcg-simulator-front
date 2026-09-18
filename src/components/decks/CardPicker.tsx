/**
 * CardPicker — browse the card catalog and add cards to the selected deck.
 */

import { useEffect, useState } from 'react';

import type { CardDef } from '@/lib/game/types';
import { loadCatalog, SAMPLE_CATALOG } from '@/lib/game/cards';
import { CardTile } from '@/components/game/CardTile';
import { Panel } from '@/components/ui/Panel';

interface CardPickerProps {
  deckId: string;
  onAdd: (cardId: string, qty: number) => Promise<void>;
}

export function CardPicker({ deckId, onAdd }: CardPickerProps) {
  const [catalog, setCatalog] = useState<CardDef[]>(SAMPLE_CATALOG);
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Read the live catalog: DB rows when SUPABASE_ENABLED, SAMPLE_CATALOG otherwise.
    void loadCatalog().then((cards) => {
      if (active) setCatalog(cards);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleAdd = async (card: CardDef) => {
    setAdding(card.id);
    try {
      await onAdd(card.id, 1);
    } finally {
      setAdding(null);
    }
  };

  const filtered = filter.trim()
    ? catalog.filter(
        (c) =>
          c.nombre.toLowerCase().includes(filter.toLowerCase()) ||
          c.tipo.toLowerCase().includes(filter.toLowerCase()) ||
          c.faccion.toLowerCase().includes(filter.toLowerCase()),
      )
    : catalog;

  return (
    <Panel cut={10} innerClassName="flex flex-col gap-3 p-3">
      <h3 className="hud-title text-xs">Card Catalog</h3>

      <input
        className="field text-xs"
        placeholder="Filter by name, type, or faction…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2 overflow-y-auto" style={{ maxHeight: 320 }}>
        {filtered.map((card) => (
          <div key={card.id} className="flex flex-col items-center gap-1">
            <CardTile
              def={card}
              width={96}
              onClick={() => void handleAdd(card)}
              aria-label={`Add ${card.nombre} to deck`}
            />
            <button
              type="button"
              className="btn btn--sm w-full text-[10px]"
              disabled={adding === card.id || !deckId}
              onClick={() => void handleAdd(card)}
            >
              {adding === card.id ? '…' : 'Add'}
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

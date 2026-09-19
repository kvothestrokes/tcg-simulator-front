/**
 * CardPicker — browse the card catalog and add cards to the selected deck.
 *
 * Enforces the deck build rules at the UI seam: up to 3 copies of a normal card
 * and a single space-station card per deck. The Add control is disabled (and the
 * reason surfaced) when a rule would be broken; the pure rules live in
 * lib/decks/validation.
 */

import { useEffect, useMemo, useState } from 'react';

import type { CardDef } from '@/lib/game/types';
import type { DeckCardItem } from '@/lib/decks/mappers';
import { loadCatalog, SAMPLE_CATALOG } from '@/lib/game/cards';
import { isStation, maxCopiesFor, validateAddCard } from '@/lib/decks/validation';
import { CardTile } from '@/components/game/CardTile';
import { Panel } from '@/components/ui/Panel';

interface CardPickerProps {
  deckId: string;
  /** Current deck contents — used to enforce copy and station limits. */
  items: DeckCardItem[];
  onAdd: (cardId: string, qty: number) => Promise<void>;
}

export function CardPicker({ deckId, items, onAdd }: CardPickerProps) {
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

  // Resolver used by the rule checks to type the cards already in the deck.
  const catalogMap = useMemo(() => {
    const m = new Map<string, CardDef>();
    for (const c of catalog) m.set(c.id, c);
    return m;
  }, [catalog]);

  const qtyById = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.card_id, it.qty);
    return m;
  }, [items]);

  const handleAdd = async (card: CardDef) => {
    const current = qtyById.get(card.id) ?? 0;
    if (!validateAddCard(card, items, catalogMap).ok) return;
    setAdding(card.id);
    try {
      await onAdd(card.id, current + 1);
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
    <Panel cut={10} innerClassName="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="hud-title text-sm">Card Catalog</h3>
        <span className="hud-sub text-[10px] opacity-60">{filtered.length} cards</span>
      </div>

      <input
        className="field text-xs"
        placeholder="Filter by name, type, or faction…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 overflow-y-auto pr-1"
        style={{ maxHeight: '58vh' }}
      >
        {filtered.map((card) => {
          const current = qtyById.get(card.id) ?? 0;
          const max = maxCopiesFor(card.tipo);
          const check = validateAddCard(card, items, catalogMap);
          const disabled = adding === card.id || !deckId || !check.ok;
          const station = isStation(card.tipo);

          return (
            <div
              key={card.id}
              className="flex flex-col items-center gap-1.5 rounded-md border border-[var(--color-stroke-faint)] bg-[rgba(255,255,255,0.02)] p-2 transition-colors hover:border-[var(--color-signal)]"
            >
              <div className="relative">
                <CardTile
                  def={card}
                  width={station ? 132 : 108}
                  onClick={() => void handleAdd(card)}
                  aria-label={`Add ${card.nombre} to deck`}
                />
                {current > 0 ? (
                  <span className="tabular absolute -top-1.5 -right-1.5 z-10 min-w-[20px] rounded-full border border-[var(--color-signal)] bg-[var(--color-void)] px-1 text-center text-[10px] font-semibold text-[var(--color-signal)]">
                    {current}/{max}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                className="btn btn--sm w-full text-[10px]"
                disabled={disabled}
                title={check.ok ? undefined : (check as { error: string }).error}
                onClick={() => void handleAdd(card)}
              >
                {adding === card.id
                  ? '…'
                  : !check.ok
                    ? station
                      ? 'Limit: 1 station'
                      : 'Max copies'
                    : current > 0
                      ? 'Add copy'
                      : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

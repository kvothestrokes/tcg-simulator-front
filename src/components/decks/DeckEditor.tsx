/**
 * DeckEditor — rename a deck, view/tune its cards, and add new ones.
 *
 * Uses a two-column layout on wide screens: the current deck on the left and the
 * always-visible catalog on the right. A stats bar surfaces the build rules
 * (single station, up to 3 copies per card).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import type { DeckCardItem } from '@/lib/decks/mappers';
import type { CardDef } from '@/lib/game/types';
import { findCard, SAMPLE_CATALOG } from '@/lib/game/cards';
import { countNonStationCards, countStations, deckLegality, DECK_RULES } from '@/lib/decks/validation';
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
  onSetQty: (deckId: string, cardId: string, qty: number) => Promise<void>;
  onBack: () => void;
}

export function DeckEditor({
  deck,
  items,
  onRename,
  onAddCard,
  onRemoveCard,
  onSetQty,
  onBack,
}: DeckEditorProps) {
  const [name, setName] = useState(deck.nombre);
  const [renaming, setRenaming] = useState(false);

  // Build catalog map for DeckCardViewer + rule checks.
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

  const deckCards = useMemo(() => countNonStationCards(items, catalogMap), [items, catalogMap]);
  const stationCount = useMemo(() => countStations(items, catalogMap), [items, catalogMap]);
  const legality = useMemo(() => deckLegality(items, catalogMap), [items, catalogMap]);
  const atCardCap = deckCards >= DECK_RULES.MAX_DECK_CARDS;

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
    <Panel cut={12} innerClassName="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onBack}>
          ← Back
        </button>
        <h2 className="hud-title text-sm min-w-0 flex-1 truncate">{deck.nombre}</h2>
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

      {/* Stats + rules bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-[var(--color-stroke-faint)] py-2 text-[11px]">
        <span className="hud-sub">
          Cards:{' '}
          <span
            className={`tabular font-semibold ${atCardCap ? 'text-[#fda4af]' : 'text-[var(--color-signal)]'}`}
          >
            {deckCards}/{DECK_RULES.MAX_DECK_CARDS}
          </span>
        </span>
        <span className="hud-sub">
          Stations:{' '}
          <span className="tabular font-semibold text-[var(--color-signal)]">
            {stationCount}/{DECK_RULES.MAX_STATIONS}
          </span>
        </span>
        {legality.ok ? (
          <span className="tabular font-semibold text-[#86efac]">✓ Ready to play</span>
        ) : (
          <span className="hud-sub opacity-70" title={legality.errors.join(' ')}>
            {legality.errors[0]}
          </span>
        )}
        <span className="hud-sub ml-auto opacity-60">
          Rules: {DECK_RULES.MAX_DECK_CARDS} cards · 1 space station · up to {DECK_RULES.MAX_COPIES} copies
        </span>
      </div>

      {/* Two columns: deck on the left, catalog on the right */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="hud-sub text-[11px]">In deck ({items.length} unique)</p>
          <DeckCardViewer
            items={items}
            catalog={catalogMap}
            onRemove={(cardId) => onRemoveCard(deck.id, cardId)}
            onSetQty={(cardId, qty) => onSetQty(deck.id, cardId, qty)}
          />
        </div>

        <CardPicker
          deckId={deck.id}
          items={items}
          onAdd={(cardId, qty) => onAddCard(deck.id, cardId, qty)}
        />
      </div>
    </Panel>
  );
}

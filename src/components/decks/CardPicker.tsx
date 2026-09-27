/**
 * CardPicker — browse the card catalog and add cards to the selected deck.
 *
 * Enforces the deck build rules at the UI seam: up to 3 copies of a normal card
 * and a single space-station card per deck. The Add control is disabled (and the
 * reason surfaced) when a rule would be broken; the pure rules live in
 * lib/decks/validation.
 */

import { useEffect, useMemo, useState } from 'react';

import type { CardDef, CardType } from '@/lib/game/types';
import type { DeckCardItem } from '@/lib/decks/mappers';
import { loadCatalog, SAMPLE_CATALOG } from '@/lib/game/cards';
import { isStation, maxCopiesFor, validateAddCard } from '@/lib/decks/validation';
import {
  SORT_LABEL,
  viewCatalog,
  type CatalogSortKey,
  type SortDirection,
} from '@/lib/decks/catalogView';
import { CardTile } from '@/components/game/CardTile';
import { Panel } from '@/components/ui/Panel';

interface CardPickerProps {
  deckId: string;
  /** Current deck contents — used to enforce copy and station limits. */
  items: DeckCardItem[];
  onAdd: (cardId: string, qty: number) => Promise<void>;
}

/** Type chips; accents follow the zone color coding in global.css. */
const TYPE_CHIPS: { type: CardType | 'all'; label: string; accent: string }[] = [
  { type: 'all', label: 'Todos', accent: 'var(--color-ink)' },
  { type: 'Nave', label: 'Nave', accent: 'var(--color-zone-battle)' },
  { type: 'Orden', label: 'Orden', accent: 'var(--color-zone-orders)' },
  { type: 'Piloto', label: 'Piloto', accent: 'var(--color-zone-resources)' },
  { type: 'Gear', label: 'Gear', accent: 'var(--color-zone-gear)' },
  { type: 'Estación', label: 'Estación', accent: 'var(--color-zone-player)' },
];

const SORT_KEYS = Object.keys(SORT_LABEL) as CatalogSortKey[];

export function CardPicker({ deckId, items, onAdd }: CardPickerProps) {
  const [catalog, setCatalog] = useState<CardDef[]>(SAMPLE_CATALOG);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<CardType | 'all'>('all');
  const [sortKey, setSortKey] = useState<CatalogSortKey>('nombre');
  const [direction, setDirection] = useState<SortDirection>('asc');
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

  const filtered = useMemo(
    () => viewCatalog(catalog, { type: typeFilter, query: filter, sortKey, direction }),
    [catalog, direction, filter, sortKey, typeFilter],
  );

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

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filtrar por tipo">
        {TYPE_CHIPS.map((chip) => {
          const active = typeFilter === chip.type;
          return (
            <button
              key={chip.type}
              type="button"
              className="phase-chip cursor-pointer"
              data-state={active ? 'current' : 'upcoming'}
              aria-pressed={active}
              style={
                active
                  ? { background: chip.accent, borderColor: chip.accent }
                  : { borderColor: chip.accent, color: chip.accent }
              }
              onClick={() => setTypeFilter(chip.type)}
              title={chip.type === 'all' ? 'Mostrar todas las cartas' : `Mostrar solo cartas de tipo ${chip.label}`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="hud-sub text-[10px]" htmlFor="catalog-sort">
          Ordenar
        </label>
        <select
          id="catalog-sort"
          className="field w-auto cursor-pointer py-1 text-[11px]"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as CatalogSortKey)}
          title="Criterio de orden. ATK y DEF solo aplican a naves; el resto va al final."
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
          title={direction === 'asc' ? 'Orden ascendente (pulsa para descendente)' : 'Orden descendente (pulsa para ascendente)'}
          aria-label={direction === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
        >
          {direction === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

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

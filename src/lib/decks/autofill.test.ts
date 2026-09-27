import { describe, expect, it } from 'vitest';

import { autofillDeck } from './autofill';
import { deckLegality, DECK_RULES } from './validation';
import type { CardDef, CardType } from '../game/types';
import type { DeckCardItem } from './mappers';

function makeCard(id: string, tipo: CardType, coste_recursos = 1, nombre = id): CardDef {
  return {
    id,
    nombre,
    tipo,
    faccion: 'test',
    coste_recursos,
    coste_heat: 0,
    rareza: 'common',
    numero_coleccion: '000',
    autor: 'test',
  };
}

const qtyOf = (items: DeckCardItem[], id: string) => items.find((i) => i.card_id === id)?.qty ?? 0;
const total = (items: DeckCardItem[], catalog: CardDef[]) =>
  items.reduce((sum, i) => {
    const def = catalog.find((c) => c.id === i.card_id);
    return def?.tipo === 'Estación' ? sum : sum + i.qty;
  }, 0);

describe('autofillDeck', () => {
  const ships = Array.from({ length: 20 }, (_, i) => makeCard(`n${String(i).padStart(2, '0')}`, 'Nave', i % 4));
  const station = makeCard('st', 'Estación', 0);
  const catalog = [...ships, station];

  it('fills an empty deck to exactly 40 non-station cards and adds a station', () => {
    const result = autofillDeck([], catalog);
    expect(total(result.items, catalog)).toBe(DECK_RULES.MAX_DECK_CARDS);
    expect(qtyOf(result.items, 'st')).toBe(1);
    expect(result.complete).toBe(true);
    expect(result.stationAdded).toBe('st');
    const map = new Map(catalog.map((c) => [c.id, c]));
    expect(deckLegality(result.items, map).ok).toBe(true);
  });

  it('never exceeds the max copies per card', () => {
    const result = autofillDeck([], catalog);
    for (const item of result.items) expect(item.qty).toBeLessThanOrEqual(DECK_RULES.MAX_COPIES);
  });

  it('keeps the cards already in the deck and only adds on top', () => {
    const start: DeckCardItem[] = [{ card_id: 'n05', qty: 2 }];
    const result = autofillDeck(start, catalog);
    expect(qtyOf(result.items, 'n05')).toBeGreaterThanOrEqual(2);
    expect(result.added).toBe(40 - 2);
  });

  it('does not add a station when the deck already has one', () => {
    const other = makeCard('st2', 'Estación', 0);
    const result = autofillDeck([{ card_id: 'st', qty: 1 }], [...catalog, other]);
    expect(qtyOf(result.items, 'st2')).toBe(0);
    expect(result.stationAdded).toBeUndefined();
  });

  it('is deterministic: same input, same output', () => {
    expect(autofillDeck([], catalog)).toEqual(autofillDeck([], catalog));
  });

  it('spreads copies: every card gets one copy before any gets a second', () => {
    const result = autofillDeck([], catalog);
    // 20 distinct ships, 40 slots -> exactly 2 copies each.
    for (const ship of ships) expect(qtyOf(result.items, ship.id)).toBe(2);
  });

  it('reports an incomplete fill when the catalog cannot reach 40 legal cards', () => {
    const small = [makeCard('a', 'Nave'), makeCard('b', 'Orden'), station];
    const result = autofillDeck([], small);
    expect(total(result.items, small)).toBe(6);
    expect(result.complete).toBe(false);
  });

  it('does nothing to a deck that is already full', () => {
    const full = autofillDeck([], catalog).items;
    const again = autofillDeck(full, catalog);
    expect(again.added).toBe(0);
    expect(again.items).toEqual(full);
  });
});

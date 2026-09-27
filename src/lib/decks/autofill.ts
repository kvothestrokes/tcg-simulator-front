/**
 * Deck autofill — completes a deck up to the legal size.
 *
 * Pure and deterministic: candidates are the catalog's non-station cards in a
 * stable order (resource cost, then name, then id), and copies are added in
 * round-robin passes, so every card gets one copy before any gets a second and
 * no card goes above DECK_RULES.MAX_COPIES. Cards already in the deck are kept
 * untouched and count toward the total. If the deck has no station and the
 * catalog has one, the first station in the same order is added.
 */

import type { CardDef } from '../game/types';
import type { DeckCardItem } from './mappers';
import { countNonStationCards, countStations, DECK_RULES, isStation } from './validation';

export interface AutofillResult {
  items: DeckCardItem[];
  /** Non-station copies added. */
  added: number;
  /** Id of the station added, when the deck had none. */
  stationAdded?: string;
  /** The deck reached exactly DECK_RULES.MAX_DECK_CARDS non-station cards. */
  complete: boolean;
}

function stableOrder(a: CardDef, b: CardDef): number {
  return (
    (Number(a.coste_recursos) || 0) - (Number(b.coste_recursos) || 0) ||
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) ||
    a.id.localeCompare(b.id)
  );
}

export function autofillDeck(items: readonly DeckCardItem[], catalog: readonly CardDef[]): AutofillResult {
  const byId = new Map(catalog.map((card) => [card.id, card]));
  const qty = new Map(items.map((item) => [item.card_id, item.qty]));
  const order = items.map((item) => item.card_id);

  const bump = (id: string) => {
    if (!qty.has(id)) order.push(id);
    qty.set(id, (qty.get(id) ?? 0) + 1);
  };

  let stationAdded: string | undefined;
  if (countStations(items, byId) === 0) {
    const station = catalog.filter((card) => isStation(card.tipo)).sort(stableOrder)[0];
    if (station) {
      bump(station.id);
      stationAdded = station.id;
    }
  }

  const candidates = catalog.filter((card) => !isStation(card.tipo)).sort(stableOrder);
  const target = DECK_RULES.MAX_DECK_CARDS;
  let count = countNonStationCards(items, byId);
  const start = count;

  // One pass per copy level: level 1 gives each card its first copy, and so on.
  for (let level = 1; level <= DECK_RULES.MAX_COPIES && count < target; level++) {
    for (const card of candidates) {
      if (count >= target) break;
      if ((qty.get(card.id) ?? 0) >= level) continue;
      bump(card.id);
      count++;
    }
  }

  return {
    items: order.map((card_id) => ({ card_id, qty: qty.get(card_id) ?? 0 })),
    added: count - start,
    stationAdded,
    complete: count === target,
  };
}

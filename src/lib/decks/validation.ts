/**
 * Pure validation helpers for the decks feature.
 *
 * Every function returns a discriminated union:
 *   { ok: true }  — input is valid
 *   { ok: false, error: string }  — input is invalid, with a human-readable reason
 *
 * No side effects, no I/O — these are the unit-test seam.
 */

// ─── Result type ──────────────────────────────────────────────────────────────

import type { CardDef, CardType } from '../game/types';
import type { DeckCardItem } from './mappers';

export type ValidationResult = { ok: true } | { ok: false; error: string };

// ─── Required fields for a valid CardDef shape ────────────────────────────────

const REQUIRED_CARD_FIELDS = ['id', 'nombre', 'tipo', 'faccion', 'rareza', 'coste_recursos', 'coste_heat', 'numero_coleccion', 'autor'] as const;

// ─── validateQty ──────────────────────────────────────────────────────────────

/**
 * Validates that a deck_cards quantity is an integer >= 1.
 * Matches the DB CHECK constraint: `qty >= 1`.
 */
export function validateQty(qty: number): ValidationResult {
  if (!Number.isInteger(qty) || qty < 1) {
    return { ok: false, error: `Quantity must be an integer >= 1; received ${qty}.` };
  }
  return { ok: true };
}

// ─── validateCardId ───────────────────────────────────────────────────────────

/**
 * Validates that a card_id is non-empty and present in the given catalog set.
 *
 * @param id       - Card ID to validate.
 * @param catalog  - Set of known card IDs (e.g., derived from SAMPLE_CATALOG or DB).
 */
export function validateCardId(id: string, catalog: ReadonlySet<string>): ValidationResult {
  if (!id || id.trim() === '') {
    return { ok: false, error: 'Card ID must be a non-empty string.' };
  }
  if (!catalog.has(id)) {
    return { ok: false, error: `Card ID "${id}" not found in catalog.` };
  }
  return { ok: true };
}

// ─── validateCardDefShape ─────────────────────────────────────────────────────

/**
 * Validates that an unknown value has the minimum required fields of a CardDef.
 * Used to verify JSONB payloads before inserting into the DB.
 */
export function validateCardDefShape(value: unknown): ValidationResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'CardDef must be a non-null object.' };
  }

  const obj = value as Record<string, unknown>;
  for (const field of REQUIRED_CARD_FIELDS) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      return { ok: false, error: `CardDef is missing required field: "${field}".` };
    }
  }

  return { ok: true };
}

// ─── validateDeckName ─────────────────────────────────────────────────────────

/**
 * Validates that a deck name is a non-empty, non-whitespace string.
 */
export function validateDeckName(name: string): ValidationResult {
  if (!name || name.trim() === '') {
    return { ok: false, error: 'Deck name must be a non-empty string.' };
  }
  return { ok: true };
}

// ─── Deck build rules ───────────────────────────────────────────────────────────

/**
 * Deck construction limits enforced by the builder.
 */
export const DECK_RULES = {
  /** Max copies of a single non-station card. */
  MAX_COPIES: 3,
  /** Max number of space-station cards in a deck (one station, one copy). */
  MAX_STATIONS: 1,
  /** Max non-station cards in a deck. The station does not count toward this. */
  MAX_DECK_CARDS: 40,
} as const;

/** The CardType that represents a space station. */
export const STATION_TIPO: CardType = 'Estación';

/** Whether a card type is a space station. */
export function isStation(tipo: CardType): boolean {
  return tipo === STATION_TIPO;
}

/**
 * Max copies allowed for a card of the given type.
 * Stations are limited to a single copy; every other card to DECK_RULES.MAX_COPIES.
 */
export function maxCopiesFor(tipo: CardType): number {
  return isStation(tipo) ? DECK_RULES.MAX_STATIONS : DECK_RULES.MAX_COPIES;
}

/** Count how many distinct station cards are already in the deck. */
export function countStations(
  items: readonly DeckCardItem[],
  catalog: ReadonlyMap<string, CardDef>,
): number {
  return items.filter((item) => {
    const def = catalog.get(item.card_id);
    return def ? isStation(def.tipo) : false;
  }).length;
}

/**
 * Sum the quantities of every non-station card in the deck.
 * This is the number capped by DECK_RULES.MAX_DECK_CARDS — the station is excluded.
 */
export function countNonStationCards(
  items: readonly DeckCardItem[],
  catalog: ReadonlyMap<string, CardDef>,
): number {
  return items.reduce((sum, item) => {
    const def = catalog.get(item.card_id);
    if (def && isStation(def.tipo)) return sum;
    return sum + item.qty;
  }, 0);
}

/**
 * Validates whether one more copy of `card` may be added to the current deck.
 *
 * Rules enforced:
 *   - Up to DECK_RULES.MAX_COPIES copies of the same non-station card.
 *   - At most DECK_RULES.MAX_STATIONS space-station card per deck (single copy).
 *
 * @param card    - The card the user is trying to add.
 * @param items   - Current deck contents.
 * @param catalog - Resolver from card_id → CardDef, used to type existing items.
 */
export function validateAddCard(
  card: CardDef,
  items: readonly DeckCardItem[],
  catalog: ReadonlyMap<string, CardDef>,
): ValidationResult {
  const current = items.find((item) => item.card_id === card.id)?.qty ?? 0;

  if (isStation(card.tipo)) {
    // A second, different station is never allowed.
    const stationsAlready = countStations(items, catalog);
    const alreadyHasThis = current > 0;
    if (stationsAlready >= DECK_RULES.MAX_STATIONS && !alreadyHasThis) {
      return { ok: false, error: 'Only one space-station card is allowed per deck.' };
    }
    if (current >= DECK_RULES.MAX_STATIONS) {
      return { ok: false, error: 'Only one copy of a space-station card is allowed.' };
    }
    return { ok: true };
  }

  if (current >= DECK_RULES.MAX_COPIES) {
    return {
      ok: false,
      error: `You can only have up to ${DECK_RULES.MAX_COPIES} copies of "${card.nombre}".`,
    };
  }

  if (countNonStationCards(items, catalog) >= DECK_RULES.MAX_DECK_CARDS) {
    return {
      ok: false,
      error: `A deck can hold at most ${DECK_RULES.MAX_DECK_CARDS} cards (the station does not count).`,
    };
  }
  return { ok: true };
}

// ─── deckLegality ─────────────────────────────────────────────────────────────

/**
 * Whether a deck is legal to take into a match.
 *
 * A legal deck has exactly DECK_RULES.MAX_DECK_CARDS non-station cards and at
 * most one station. Returns every broken rule so the UI can list them.
 */
export function deckLegality(
  items: readonly DeckCardItem[],
  catalog: ReadonlyMap<string, CardDef>,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const nonStation = countNonStationCards(items, catalog);
  const stations = countStations(items, catalog);

  if (nonStation !== DECK_RULES.MAX_DECK_CARDS) {
    errors.push(
      `Deck must have exactly ${DECK_RULES.MAX_DECK_CARDS} cards (has ${nonStation}).`,
    );
  }
  if (stations > DECK_RULES.MAX_STATIONS) {
    errors.push(`A deck may only include ${DECK_RULES.MAX_STATIONS} space station.`);
  }

  return { ok: errors.length === 0, errors };
}

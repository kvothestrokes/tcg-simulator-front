/**
 * Deck export/import as JSON.
 *
 * Pure: builds the file object for download and parses/validates an uploaded
 * file. Unknown card ids are reported and skipped; every surviving card goes
 * through the same add rules as the builder (validateAddCard: max copies,
 * single station, 40-card cap), so an import can never produce a deck the
 * builder would refuse. Whether the result is match-legal (exactly 40 + 1
 * station) is reported via deckLegality, not forced.
 */

import type { CardDef } from '../game/types';
import type { DeckCardItem } from './mappers';
import { deckLegality, isStation, validateAddCard, type DeckLegality } from './validation';

export const DECK_FILE_FORMAT = 'cosmic-breaker-deck';
export const DEFAULT_IMPORT_NAME = 'Mazo importado';

export interface DeckFile {
  format: typeof DECK_FILE_FORMAT;
  version: 1;
  name: string;
  station: { id: string; nombre: string } | null;
  cards: { id: string; nombre: string; qty: number }[];
}

export function serializeDeck(
  name: string,
  items: readonly DeckCardItem[],
  catalog: ReadonlyMap<string, CardDef>,
): DeckFile {
  let station: DeckFile['station'] = null;
  const cards: DeckFile['cards'] = [];
  for (const item of items) {
    const def = catalog.get(item.card_id);
    if (def && isStation(def.tipo)) {
      station ??= { id: def.id, nombre: def.nombre };
      continue;
    }
    cards.push({ id: item.card_id, nombre: def?.nombre ?? item.card_id, qty: item.qty });
  }
  return { format: DECK_FILE_FORMAT, version: 1, name, station, cards };
}

export type ParseDeckResult =
  | {
      ok: true;
      name: string;
      items: DeckCardItem[];
      unknownIds: string[];
      /** Cards whose requested copies were cut by the builder rules. */
      trimmed: { id: string; requested: number; kept: number }[];
      legality: DeckLegality;
    }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses an exported deck. Error messages are Spanish (shown in the UI). */
export function parseDeckFile(text: string, catalog: ReadonlyMap<string, CardDef>): ParseDeckResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  if (!isRecord(raw) || !Array.isArray(raw.cards)) {
    return { ok: false, error: 'Formato inválido: falta la lista «cards».' };
  }

  // Requested copies per id, in file order, station first.
  const requested = new Map<string, number>();
  const add = (id: string, qty: number) => requested.set(id, (requested.get(id) ?? 0) + qty);

  if (raw.station !== undefined && raw.station !== null) {
    if (!isRecord(raw.station) || typeof raw.station.id !== 'string' || !raw.station.id) {
      return { ok: false, error: 'Formato inválido: «station» debe tener un «id».' };
    }
    add(raw.station.id, 1);
  }
  for (const entry of raw.cards) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      !entry.id ||
      typeof entry.qty !== 'number' ||
      !Number.isInteger(entry.qty) ||
      entry.qty < 1
    ) {
      return { ok: false, error: 'Formato inválido: cada carta necesita «id» (texto) y «qty» (entero ≥ 1).' };
    }
    add(entry.id, entry.qty);
  }

  const unknownIds: string[] = [];
  const trimmed: { id: string; requested: number; kept: number }[] = [];
  const items: DeckCardItem[] = [];

  for (const [id, wanted] of requested) {
    const def = catalog.get(id);
    if (!def) {
      unknownIds.push(id);
      continue;
    }
    let kept = 0;
    for (let i = 0; i < wanted; i++) {
      const current = items.find((item) => item.card_id === id);
      if (!validateAddCard(def, items, catalog).ok) break;
      if (current) current.qty += 1;
      else items.push({ card_id: id, qty: 1 });
      kept++;
    }
    if (kept < wanted) trimmed.push({ id, requested: wanted, kept });
  }

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 64) : DEFAULT_IMPORT_NAME;

  return { ok: true, name, items, unknownIds, trimmed, legality: deckLegality(items, catalog) };
}

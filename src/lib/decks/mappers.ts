/**
 * Pure data transformation helpers for the Supabase cards/decks schema.
 *
 * These functions have no side effects and no I/O — they are the unit-test seam
 * between the DB row shape and the in-memory domain types used by the game engine.
 *
 * DB → Domain: cardRowToDef, deckRowToModel
 * Domain → DB: cardDefToRow
 */

import type { CardDef, CardType } from '../game/types';

// ─── CardRow ─────────────────────────────────────────────────────────────────

/**
 * Represents one row from the `cards` table.
 *
 * Identity columns are stored as top-level columns; all other CardDef fields
 * are stored as JSON inside `data`.
 */
export interface CardRow {
  id: string;
  nombre: string;
  tipo: CardType;
  faccion: string;
  rareza: string;
  data: Record<string, unknown>;
  created_at?: string;
}

// ─── DeckRow ──────────────────────────────────────────────────────────────────

export interface DeckRow {
  id: string;
  owner: string;
  nombre: string;
  created_at: string;
  updated_at: string;
}

// ─── DeckCardItem ─────────────────────────────────────────────────────────────

export interface DeckCardItem {
  card_id: string;
  qty: number;
}

// ─── Deck (domain model) ─────────────────────────────────────────────────────

export interface Deck {
  id: string;
  owner: string;
  nombre: string;
  cards: DeckCardItem[];
  createdAt: string;
  updatedAt: string;
}

/** Summary used in list views (no cards array — loaded on demand). */
export interface DeckSummary {
  id: string;
  owner: string;
  nombre: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Identity columns ────────────────────────────────────────────────────────

/** Columns stored as top-level columns in the `cards` table. */
const IDENTITY_COLUMNS = new Set(['id', 'nombre', 'tipo', 'faccion', 'rareza']);

// ─── cardRowToDef ─────────────────────────────────────────────────────────────

/**
 * Merges a `cards` table row into a `CardDef`.
 *
 * Identity columns come from the top-level row properties; all other fields
 * come from the `data` JSONB column.
 */
export function cardRowToDef(row: CardRow): CardDef {
  return {
    ...(row.data as Omit<CardDef, 'id' | 'nombre' | 'tipo' | 'faccion' | 'rareza'>),
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    faccion: row.faccion,
    rareza: row.rareza,
  } as CardDef;
}

// ─── cardDefToRow ─────────────────────────────────────────────────────────────

/**
 * Splits a `CardDef` into a `CardRow` for upsert into the `cards` table.
 *
 * Identity columns are promoted to top-level; everything else goes into `data`.
 */
export function cardDefToRow(def: CardDef): CardRow {
  const { id, nombre, tipo, faccion, rareza, ...rest } = def;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (!IDENTITY_COLUMNS.has(key)) {
      data[key] = value;
    }
  }
  return { id, nombre, tipo, faccion, rareza, data };
}

// ─── deckRowToModel ────────────────────────────────────────────────────────────

/**
 * Assembles a `Deck` domain model from a `decks` row and its associated
 * `deck_cards` items.
 */
export function deckRowToModel(row: DeckRow, items: DeckCardItem[]): Deck {
  return {
    id: row.id,
    owner: row.owner,
    nombre: row.nombre,
    cards: items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

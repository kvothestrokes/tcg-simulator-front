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

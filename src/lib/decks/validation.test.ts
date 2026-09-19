/**
 * Unit tests for validation.ts — pure validation helpers.
 * These tests are written FIRST (RED) before implementation exists.
 */

import { describe, expect, it } from 'vitest';

import {
  countNonStationCards,
  countStations,
  deckLegality,
  DECK_RULES,
  isStation,
  maxCopiesFor,
  validateAddCard,
  validateCardDefShape,
  validateCardId,
  validateDeckName,
  validateQty,
} from './validation';
import type { CardDef, CardType } from '../game/types';
import type { DeckCardItem } from './mappers';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCard(id: string, tipo: CardType, nombre = id): CardDef {
  return {
    id,
    nombre,
    tipo,
    faccion: 'test',
    coste_recursos: 0,
    coste_heat: 0,
    rareza: 'common',
    numero_coleccion: '000',
    autor: 'test',
  };
}

function makeCatalog(...cards: CardDef[]): Map<string, CardDef> {
  return new Map(cards.map((c) => [c.id, c]));
}

const item = (card_id: string, qty: number): DeckCardItem => ({ card_id, qty });

// ─── validateQty ───────────────────────────────────────────────────────────

describe('validateQty', () => {
  it('accepts qty = 1 (minimum valid value)', () => {
    const result = validateQty(1);
    expect(result.ok).toBe(true);
  });

  it('accepts qty > 1', () => {
    const result = validateQty(4);
    expect(result.ok).toBe(true);
  });

  it('rejects qty = 0', () => {
    const result = validateQty(0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects negative qty', () => {
    const result = validateQty(-3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});

// ─── validateCardId ────────────────────────────────────────────────────────

describe('validateCardId', () => {
  const catalog = new Set(['cp_001', 'cp_008', 'cp_012']);

  it('accepts a card_id present in the catalog', () => {
    const result = validateCardId('cp_001', catalog);
    expect(result.ok).toBe(true);
  });

  it('accepts another known card_id from the catalog', () => {
    const result = validateCardId('cp_012', catalog);
    expect(result.ok).toBe(true);
  });

  it('rejects a card_id not in the catalog', () => {
    const result = validateCardId('unknown_card', catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects an empty string', () => {
    const result = validateCardId('', catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});

// ─── validateCardDefShape ──────────────────────────────────────────────────

describe('validateCardDefShape', () => {
  it('accepts a valid CardDef-shaped object', () => {
    const valid = {
      id: 'cp_001',
      nombre: 'Dron Desechable',
      tipo: 'Nave',
      faccion: 'CyberPunk',
      rareza: 'Común',
      coste_recursos: 1,
      coste_heat: 0,
      numero_coleccion: 'CP-001',
      autor: '',
    };
    const result = validateCardDefShape(valid);
    expect(result.ok).toBe(true);
  });

  it('rejects an object missing the required "nombre" field', () => {
    const invalid = {
      id: 'cp_001',
      tipo: 'Nave',
      faccion: 'CyberPunk',
      rareza: 'Común',
      coste_recursos: 1,
      coste_heat: 0,
      numero_coleccion: 'CP-001',
      autor: '',
    };
    const result = validateCardDefShape(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects an object missing the required "id" field', () => {
    const invalid = {
      nombre: 'Dron Desechable',
      tipo: 'Nave',
      faccion: 'CyberPunk',
      rareza: 'Común',
      coste_recursos: 1,
      coste_heat: 0,
      numero_coleccion: 'CP-001',
      autor: '',
    };
    const result = validateCardDefShape(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects a non-object value', () => {
    const result = validateCardDefShape(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});

// ─── validateDeckName ──────────────────────────────────────────────────────

describe('validateDeckName', () => {
  it('accepts a non-empty deck name', () => {
    const result = validateDeckName('My Deck');
    expect(result.ok).toBe(true);
  });

  it('accepts a single-character name', () => {
    const result = validateDeckName('X');
    expect(result.ok).toBe(true);
  });

  it('rejects an empty string', () => {
    const result = validateDeckName('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects a whitespace-only string', () => {
    const result = validateDeckName('   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});

// ─── deck build rules ──────────────────────────────────────────────────────────

describe('maxCopiesFor', () => {
  it('caps stations at 1 copy', () => {
    expect(maxCopiesFor('Estación')).toBe(DECK_RULES.MAX_STATIONS);
    expect(maxCopiesFor('Estación')).toBe(1);
  });

  it('caps non-station cards at 3 copies', () => {
    expect(maxCopiesFor('Nave')).toBe(DECK_RULES.MAX_COPIES);
    expect(maxCopiesFor('Nave')).toBe(3);
  });
});

describe('isStation', () => {
  it('is true only for the station type', () => {
    expect(isStation('Estación')).toBe(true);
    expect(isStation('Nave')).toBe(false);
  });
});

describe('countStations', () => {
  it('counts distinct station cards in the deck', () => {
    const catalog = makeCatalog(
      makeCard('s1', 'Estación'),
      makeCard('n1', 'Nave'),
    );
    expect(countStations([item('s1', 1), item('n1', 2)], catalog)).toBe(1);
    expect(countStations([item('n1', 2)], catalog)).toBe(0);
  });
});

describe('validateAddCard', () => {
  it('accepts adding a non-station card below the copy cap', () => {
    const nave = makeCard('n1', 'Nave');
    const catalog = makeCatalog(nave);
    expect(validateAddCard(nave, [item('n1', 2)], catalog).ok).toBe(true);
  });

  it('rejects a 4th copy of a non-station card', () => {
    const nave = makeCard('n1', 'Nave', 'Falcon');
    const catalog = makeCatalog(nave);
    const result = validateAddCard(nave, [item('n1', 3)], catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('3 copies');
  });

  it('accepts the first station card', () => {
    const station = makeCard('s1', 'Estación');
    const catalog = makeCatalog(station);
    expect(validateAddCard(station, [], catalog).ok).toBe(true);
  });

  it('rejects a second copy of the same station', () => {
    const station = makeCard('s1', 'Estación');
    const catalog = makeCatalog(station);
    expect(validateAddCard(station, [item('s1', 1)], catalog).ok).toBe(false);
  });

  it('rejects a second, different station', () => {
    const s1 = makeCard('s1', 'Estación');
    const s2 = makeCard('s2', 'Estación');
    const catalog = makeCatalog(s1, s2);
    const result = validateAddCard(s2, [item('s1', 1)], catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('one space-station');
  });

  it('rejects a non-station card once the deck holds 40 non-station cards', () => {
    // 40 distinct non-station cards, 1 copy each -> exactly at the cap.
    const cards = Array.from({ length: 40 }, (_, i) => makeCard(`c${i}`, 'Nave'));
    const catalog = makeCatalog(...cards);
    const items = cards.map((c) => item(c.id, 1));
    const extra = makeCard('extra', 'Nave');
    catalog.set(extra.id, extra);
    const result = validateAddCard(extra, items, catalog);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('40 cards');
  });

  it('does not count the station toward the 40-card cap', () => {
    const cards = Array.from({ length: 39 }, (_, i) => makeCard(`c${i}`, 'Nave'));
    const station = makeCard('s1', 'Estación');
    const catalog = makeCatalog(...cards, station);
    const items = [...cards.map((c) => item(c.id, 1)), item('s1', 1)];
    const extra = makeCard('extra', 'Nave');
    catalog.set(extra.id, extra);
    // 39 non-station + station -> 40th non-station is still allowed.
    expect(validateAddCard(extra, items, catalog).ok).toBe(true);
  });
});

describe('countNonStationCards', () => {
  it('sums non-station quantities and ignores the station', () => {
    const catalog = makeCatalog(makeCard('n1', 'Nave'), makeCard('s1', 'Estación'));
    expect(countNonStationCards([item('n1', 3), item('s1', 1)], catalog)).toBe(3);
  });
});

describe('deckLegality', () => {
  const forty = Array.from({ length: 40 }, (_, i) => makeCard(`c${i}`, 'Nave'));

  it('accepts exactly 40 non-station cards with one station', () => {
    const station = makeCard('s1', 'Estación');
    const catalog = makeCatalog(...forty, station);
    const items = [...forty.map((c) => item(c.id, 1)), item('s1', 1)];
    expect(deckLegality(items, catalog).ok).toBe(true);
  });

  it('rejects a deck with fewer than 40 cards', () => {
    const catalog = makeCatalog(...forty);
    const items = forty.slice(0, 30).map((c) => item(c.id, 1));
    const result = deckLegality(items, catalog);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('exactly 40');
  });
});

/**
 * Unit tests for mappers.ts — pure data transformation helpers.
 * These tests are written FIRST (RED) before implementation exists.
 */

import { describe, expect, it } from 'vitest';

import { cardDefToRow, cardRowToDef, deckRowToModel } from './mappers';
import type { CardDef } from '../game/types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const SAMPLE_DEF: CardDef = {
  id: 'cp_001',
  nombre: 'Dron Desechable',
  tipo: 'Nave',
  faccion: 'CyberPunk',
  rareza: 'Común',
  coste_recursos: 1,
  coste_heat: 0,
  ataque: 10,
  escudo: 10,
  espacios_gear: 0,
  palabras_clave: ['Reactor frío', 'Kamikaze'],
  texto_efecto: 'Al ser destruida, genera 1 chatarra adicional.',
  chatarra_al_morir: 2,
  numero_coleccion: 'CP-001',
  autor: '',
  notas_diseno: 'Coste de Heat 0.',
  rol: 'Caza',
};

const PILOTO_DEF: CardDef = {
  id: 'cp_012',
  nombre: 'Kaze, Piloto de Desguace',
  tipo: 'Piloto',
  faccion: 'CyberPunk',
  rareza: 'Rara',
  coste_recursos: 2,
  coste_heat: 1,
  requisito_enlace: 'Nave con rol Caza',
  bono_al_enlazar: '+10 de Ataque',
  palabras_clave: [],
  numero_coleccion: 'CP-012',
  autor: '',
};

// ─── cardRowToDef ──────────────────────────────────────────────────────────

describe('cardRowToDef', () => {
  it('merges identity columns and jsonb data into a CardDef', () => {
    const row = {
      id: 'cp_001',
      nombre: 'Dron Desechable',
      tipo: 'Nave' as const,
      faccion: 'CyberPunk',
      rareza: 'Común',
      data: {
        coste_recursos: 1,
        coste_heat: 0,
        ataque: 10,
        escudo: 10,
        rol: 'Caza',
        numero_coleccion: 'CP-001',
        autor: '',
      },
    };

    const result = cardRowToDef(row);

    expect(result.id).toBe('cp_001');
    expect(result.nombre).toBe('Dron Desechable');
    expect(result.tipo).toBe('Nave');
    expect(result.faccion).toBe('CyberPunk');
    expect(result.rareza).toBe('Común');
    expect(result.ataque).toBe(10);
    expect(result.rol).toBe('Caza');
  });

  it('preserves all fields from data jsonb (deep property access)', () => {
    const row = {
      id: 'cp_012',
      nombre: 'Kaze',
      tipo: 'Piloto' as const,
      faccion: 'CyberPunk',
      rareza: 'Rara',
      data: {
        coste_recursos: 2,
        coste_heat: 1,
        requisito_enlace: 'Nave con rol Caza',
        palabras_clave: ['Ráfaga'],
        numero_coleccion: 'CP-012',
        autor: '',
      },
    };

    const result = cardRowToDef(row);

    expect(result.requisito_enlace).toBe('Nave con rol Caza');
    expect(result.palabras_clave).toEqual(['Ráfaga']);
    expect(result.coste_heat).toBe(1);
  });
});

// ─── cardDefToRow ──────────────────────────────────────────────────────────

describe('cardDefToRow', () => {
  it('splits identity columns from the rest (data jsonb)', () => {
    const row = cardDefToRow(SAMPLE_DEF);

    expect(row.id).toBe('cp_001');
    expect(row.nombre).toBe('Dron Desechable');
    expect(row.tipo).toBe('Nave');
    expect(row.faccion).toBe('CyberPunk');
    expect(row.rareza).toBe('Común');

    // Non-identity fields must be inside data
    expect((row.data as Record<string, unknown>)['coste_recursos']).toBe(1);
    expect((row.data as Record<string, unknown>)['ataque']).toBe(10);
    expect((row.data as Record<string, unknown>)['rol']).toBe('Caza');
  });

  it('does NOT include identity columns inside data', () => {
    const row = cardDefToRow(SAMPLE_DEF);
    const data = row.data as Record<string, unknown>;

    expect('id' in data).toBe(false);
    expect('nombre' in data).toBe(false);
    expect('tipo' in data).toBe(false);
    expect('faccion' in data).toBe(false);
    expect('rareza' in data).toBe(false);
  });

  it('roundtrip: cardRowToDef(cardDefToRow(def)) deep-equals original', () => {
    const row = cardDefToRow(SAMPLE_DEF);
    const rebuilt = cardRowToDef(row);

    // All identity columns preserved
    expect(rebuilt.id).toBe(SAMPLE_DEF.id);
    expect(rebuilt.nombre).toBe(SAMPLE_DEF.nombre);
    // Optional fields preserved
    expect(rebuilt.ataque).toBe(SAMPLE_DEF.ataque);
    expect(rebuilt.palabras_clave).toEqual(SAMPLE_DEF.palabras_clave);
    expect(rebuilt.notas_diseno).toBe(SAMPLE_DEF.notas_diseno);
  });

  it('roundtrip is lossless for Piloto type', () => {
    const row = cardDefToRow(PILOTO_DEF);
    const rebuilt = cardRowToDef(row);

    expect(rebuilt.id).toBe(PILOTO_DEF.id);
    expect(rebuilt.requisito_enlace).toBe(PILOTO_DEF.requisito_enlace);
    expect(rebuilt.bono_al_enlazar).toBe(PILOTO_DEF.bono_al_enlazar);
  });
});

// ─── deckRowToModel ────────────────────────────────────────────────────────

describe('deckRowToModel', () => {
  it('assembles a Deck model with cards array from items', () => {
    const deckRow = {
      id: 'deck-uuid-1',
      owner: 'user-uuid-1',
      nombre: 'My Test Deck',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    const items = [
      { card_id: 'cp_001', qty: 2 },
      { card_id: 'cp_012', qty: 1 },
    ];

    const result = deckRowToModel(deckRow, items);

    expect(result.id).toBe('deck-uuid-1');
    expect(result.owner).toBe('user-uuid-1');
    expect(result.nombre).toBe('My Test Deck');
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0]).toEqual({ card_id: 'cp_001', qty: 2 });
    expect(result.cards[1]).toEqual({ card_id: 'cp_012', qty: 1 });
  });

  it('produces an empty cards array when items is empty', () => {
    const deckRow = {
      id: 'deck-uuid-2',
      owner: 'user-uuid-2',
      nombre: 'Empty Deck',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const result = deckRowToModel(deckRow, []);

    expect(result.id).toBe('deck-uuid-2');
    expect(result.cards).toHaveLength(0);
  });
});

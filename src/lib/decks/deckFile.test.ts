import { describe, expect, it } from 'vitest';

import { DECK_FILE_FORMAT, parseDeckFile, serializeDeck } from './deckFile';
import type { CardDef, CardType } from '../game/types';

function card(id: string, tipo: CardType): CardDef {
  return {
    id,
    nombre: `Carta ${id}`,
    tipo,
    faccion: 'test',
    coste_recursos: 0,
    coste_heat: 0,
    rareza: 'common',
    numero_coleccion: '000',
    autor: '',
  };
}

const catalog = [card('a', 'Nave'), card('b', 'Orden'), card('st', 'Estación'), card('st2', 'Estación')];
const byId = new Map(catalog.map((c) => [c.id, c]));

describe('serializeDeck', () => {
  it('writes name, station and non-station cards with ids and qty', () => {
    const file = serializeDeck(
      'Mi mazo',
      [
        { card_id: 'a', qty: 3 },
        { card_id: 'st', qty: 1 },
        { card_id: 'b', qty: 2 },
      ],
      byId,
    );
    expect(file.format).toBe(DECK_FILE_FORMAT);
    expect(file.version).toBe(1);
    expect(file.name).toBe('Mi mazo');
    expect(file.station).toEqual({ id: 'st', nombre: 'Carta st' });
    expect(file.cards).toEqual([
      { id: 'a', nombre: 'Carta a', qty: 3 },
      { id: 'b', nombre: 'Carta b', qty: 2 },
    ]);
  });

  it('round-trips through parseDeckFile', () => {
    const items = [
      { card_id: 'a', qty: 3 },
      { card_id: 'st', qty: 1 },
    ];
    const text = JSON.stringify(serializeDeck('X', items, byId));
    const parsed = parseDeckFile(text, byId);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.name).toBe('X');
      expect(parsed.items).toEqual([
        { card_id: 'st', qty: 1 },
        { card_id: 'a', qty: 3 },
      ]);
    }
  });
});

describe('parseDeckFile', () => {
  it('rejects text that is not JSON', () => {
    const result = parseDeckFile('{nope', byId);
    expect(result.ok).toBe(false);
  });

  it('rejects a JSON value without a cards array', () => {
    expect(parseDeckFile('[]', byId).ok).toBe(false);
    expect(parseDeckFile('{"name":"x"}', byId).ok).toBe(false);
  });

  it('rejects entries with a bad shape', () => {
    const result = parseDeckFile(JSON.stringify({ cards: [{ id: 'a', qty: 'tres' }] }), byId);
    expect(result.ok).toBe(false);
  });

  it('reports and skips unknown card ids', () => {
    const result = parseDeckFile(
      JSON.stringify({ name: 'Y', cards: [{ id: 'a', qty: 2 }, { id: 'ghost', qty: 1 }] }),
      byId,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.unknownIds).toEqual(['ghost']);
      expect(result.items).toEqual([{ card_id: 'a', qty: 2 }]);
    }
  });

  it('merges duplicated ids and trims copies above the limit', () => {
    const result = parseDeckFile(
      JSON.stringify({ cards: [{ id: 'a', qty: 2 }, { id: 'a', qty: 4 }] }),
      byId,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toEqual([{ card_id: 'a', qty: 3 }]);
      expect(result.trimmed).toEqual([{ id: 'a', requested: 6, kept: 3 }]);
    }
  });

  it('keeps a single station even if the file lists several', () => {
    const result = parseDeckFile(
      JSON.stringify({ station: { id: 'st' }, cards: [{ id: 'st2', qty: 1 }, { id: 'a', qty: 1 }] }),
      byId,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items.filter((i) => byId.get(i.card_id)?.tipo === 'Estación')).toEqual([
        { card_id: 'st', qty: 1 },
      ]);
      expect(result.trimmed.map((t) => t.id)).toContain('st2');
    }
  });

  it('falls back to a default name and reports legality of the result', () => {
    const result = parseDeckFile(JSON.stringify({ cards: [{ id: 'a', qty: 1 }] }), byId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.name).toBe('Mazo importado');
      expect(result.legality.ok).toBe(false);
    }
  });
});

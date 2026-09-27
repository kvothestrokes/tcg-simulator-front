import { describe, expect, it } from 'vitest';

import { viewCatalog } from './catalogView';
import type { CardDef, CardType } from '../game/types';

function card(id: string, tipo: CardType, extra: Partial<CardDef> = {}): CardDef {
  return {
    id,
    nombre: id,
    tipo,
    faccion: 'CyberPunk',
    coste_recursos: 0,
    coste_heat: 0,
    rareza: 'common',
    numero_coleccion: '000',
    autor: '',
    ...extra,
  };
}

const catalog: CardDef[] = [
  card('Bravo', 'Nave', { coste_recursos: 3, coste_heat: 1, ataque: 30, escudo: 10 }),
  card('alfa', 'Nave', { coste_recursos: 1, coste_heat: 2, ataque: 10, escudo: 40 }),
  card('Charlie', 'Orden', { coste_recursos: 2, coste_heat: 0, faccion: 'Piratas' }),
  card('Delta', 'Piloto', { coste_recursos: 2, coste_heat: 1 }),
  card('Eco', 'Estación'),
];

const ids = (cards: CardDef[]) => cards.map((c) => c.id);

describe('viewCatalog', () => {
  it('sorts by name ascending, case-insensitive, by default', () => {
    expect(ids(viewCatalog(catalog, {}))).toEqual(['alfa', 'Bravo', 'Charlie', 'Delta', 'Eco']);
  });

  it('filters by card type', () => {
    expect(ids(viewCatalog(catalog, { type: 'Nave' }))).toEqual(['alfa', 'Bravo']);
    expect(ids(viewCatalog(catalog, { type: 'all' }))).toHaveLength(5);
  });

  it('filters by free text over name, type and faction', () => {
    expect(ids(viewCatalog(catalog, { query: 'pira' }))).toEqual(['Charlie']);
    expect(ids(viewCatalog(catalog, { query: 'piloto' }))).toEqual(['Delta']);
  });

  it('sorts by resource cost with name as tiebreaker, and flips with desc', () => {
    expect(ids(viewCatalog(catalog, { sortKey: 'coste_recursos' }))).toEqual([
      'Eco',
      'alfa',
      'Charlie',
      'Delta',
      'Bravo',
    ]);
    expect(ids(viewCatalog(catalog, { sortKey: 'coste_recursos', direction: 'desc' }))).toEqual([
      'Bravo',
      'Charlie',
      'Delta',
      'alfa',
      'Eco',
    ]);
  });

  it('sorts by heat cost', () => {
    expect(ids(viewCatalog(catalog, { sortKey: 'coste_heat' }))[0]).toBe('Charlie');
  });

  it('sorts ships by ATK/DEF and always puts cards without that stat last', () => {
    expect(ids(viewCatalog(catalog, { sortKey: 'ataque' }))).toEqual([
      'alfa',
      'Bravo',
      'Charlie',
      'Delta',
      'Eco',
    ]);
    expect(ids(viewCatalog(catalog, { sortKey: 'escudo', direction: 'desc' })).slice(0, 2)).toEqual([
      'alfa',
      'Bravo',
    ]);
    expect(ids(viewCatalog(catalog, { sortKey: 'ataque', direction: 'desc' })).slice(2)).toEqual([
      'Charlie',
      'Delta',
      'Eco',
    ]);
  });

  it('does not mutate the input', () => {
    const copy = [...catalog];
    viewCatalog(catalog, { sortKey: 'ataque', direction: 'desc' });
    expect(catalog).toEqual(copy);
  });
});

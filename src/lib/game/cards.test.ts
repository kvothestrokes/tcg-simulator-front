import { describe, expect, it } from 'vitest';

import { buildStarterDeck, findCard, getStarterStation, playableCatalog, publicCardDef } from './cards';

describe('catálogo CyberPunk', () => {
  it('incluye los cinco tipos y deja la estación fuera del mazo', () => {
    const types = new Set(playableCatalog().map((card) => card.tipo));
    expect(types).toEqual(new Set(['Nave', 'Orden', 'Piloto', 'Gear']));
    expect(getStarterStation().tipo).toBe('Estación');
    expect(getStarterStation().hp).toBe(20);
    expect(getStarterStation().heat_actual).toBe(0);

    const deck = buildStarterDeck();
    expect(deck).toHaveLength(40);
    expect(deck.every((id) => findCard(id)?.tipo !== 'Estación')).toBe(true);
  });

  it('omite notas_diseno al publicar una carta', () => {
    const raw = findCard('cp_001');
    expect(raw?.notas_diseno).toBeTruthy();
    expect(publicCardDef(raw!).notas_diseno).toBeUndefined();
    expect(publicCardDef(raw!).nombre).toBe('Dron Desechable');
  });
});

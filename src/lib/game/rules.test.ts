import { describe, expect, it } from 'vitest';

import { canLinkTo, parseStatBonus, shipInSlot } from './rules';
import { emptyPlayer, type CardInstance } from './types';

function instance(partial: Partial<CardInstance> & Pick<CardInstance, 'uid' | 'def'>): CardInstance {
  return {
    ownerId: 'u1',
    zone: 'battle',
    faceUp: true,
    tapped: false,
    counters: {},
    ...partial,
  };
}

describe('parseStatBonus', () => {
  it('lee ataque y escudo de un texto de piloto', () => {
    expect(parseStatBonus('+10 de Ataque y gana Ráfaga.')).toEqual({ atk: 10, def: 0 });
    expect(parseStatBonus('+20 de Escudo')).toEqual({ atk: 0, def: 20 });
  });
});

describe('canLinkTo', () => {
  it('permite un piloto y hasta dos gears', () => {
    const ship = instance({
      uid: 's',
      def: {
        id: 's',
        nombre: 'Nave',
        tipo: 'Nave',
        faccion: 'Neutral',
        coste_recursos: 1,
        coste_heat: 0,
        rareza: 'C',
        numero_coleccion: '1',
        autor: '',
      },
      slot: 0,
    });
    const player = emptyPlayer('u1', 1);
    player.cards[ship.uid] = ship;
    const pilot = instance({
      uid: 'p',
      zone: 'pilots',
      def: {
        id: 'p',
        nombre: 'Piloto',
        tipo: 'Piloto',
        faccion: 'Neutral',
        coste_recursos: 1,
        coste_heat: 0,
        rareza: 'C',
        numero_coleccion: '2',
        autor: '',
      },
    });
    expect(canLinkTo(player, ship, pilot)).toBe(true);
    expect(shipInSlot(player, 0)?.uid).toBe('s');
  });
});

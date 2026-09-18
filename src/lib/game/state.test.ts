import { describe, expect, it } from 'vitest';

import { getStarterStation } from './cards';
import { GameEventType } from './events';
import { applyEvent, reduceAll } from './state';
import { emptyState } from './types';
import type { WireEvent } from '../realtime/protocol';

function event(partial: Partial<WireEvent> & Pick<WireEvent, 'sequence' | 'type'>): WireEvent {
  return {
    id: `e${partial.sequence}`,
    roomId: 'room',
    playerId: 'user-1',
    seat: 1,
    data: {},
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('SETUP de estación', () => {
  it('coloca la estación en zona pública sin contarla en el mazo', () => {
    const station = getStarterStation();
    const next = applyEvent(
      emptyState(),
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 30, deckName: 'Mazo de ejemplo', station },
      }),
    );

    const player = next.players['user-1'];
    expect(player?.deckCount).toBe(30);
    expect(player?.handCount).toBe(0);
    expect(player?.ready).toBe(true);
    const placed = Object.values(player?.cards ?? {});
    expect(placed).toHaveLength(1);
    expect(placed[0]?.zone).toBe('station');
    expect(placed[0]?.def.nombre).toBe('Estación Chatarrera K-9');
    expect(placed[0]?.def.notas_diseno).toBeUndefined();
    expect(placed[0]?.uid).toBe('station:user-1');
  });

  it('reconstruye la misma estación al reproducir el log', () => {
    const station = getStarterStation();
    const log = [
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 30, station },
      }),
    ];
    const first = reduceAll(log);
    const second = reduceAll(log);
    expect(first.players['user-1']?.cards['station:user-1']?.def.id).toBe(station.id);
    expect(second.players['user-1']?.cards).toEqual(first.players['user-1']?.cards);
  });
});

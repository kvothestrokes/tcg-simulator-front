import { describe, expect, it } from 'vitest';

import { getStarterStation } from './cards';
import { GameEventType, ServerEventType } from './events';
import { SHARED_RESOURCE_DEF, TOKEN_DRONE_DEF, effectiveAttack, shipGears, shipPilot } from './rules';
import { applyEvent, reduceAll } from './state';
import { DAMAGE_COUNTER, SHARED_RESOURCE_DECK_SIZE, emptyState, type CardDef } from './types';
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

function shipDef(overrides: Partial<CardDef> = {}): CardDef {
  return {
    id: 'ship_test',
    nombre: 'Caza de Prueba',
    tipo: 'Nave',
    faccion: 'Neutral',
    coste_recursos: 1,
    coste_heat: 0,
    ataque: 20,
    escudo: 30,
    espacios_gear: 2,
    rareza: 'Común',
    numero_coleccion: 'T-001',
    autor: '',
    ...overrides,
  };
}

function gearDef(atk = 0, def = 10): CardDef {
  return {
    id: 'gear_test',
    nombre: 'Cañón',
    tipo: 'Gear',
    faccion: 'Neutral',
    coste_recursos: 1,
    coste_heat: 0,
    modificador_ataque: atk,
    modificador_escudo: def,
    espacios_ocupa: 1,
    rareza: 'Común',
    numero_coleccion: 'T-G',
    autor: '',
  };
}

function pilotDef(): CardDef {
  return {
    id: 'pilot_test',
    nombre: 'Piloto',
    tipo: 'Piloto',
    faccion: 'Neutral',
    coste_recursos: 1,
    coste_heat: 0,
    bono_al_enlazar: '+10 de Ataque',
    rareza: 'Común',
    numero_coleccion: 'T-P',
    autor: '',
  };
}

function playShip(sequence: number, uid = 'ship-1', slot = 0): WireEvent {
  return event({
    sequence,
    type: GameEventType.Play,
    data: { uid, def: shipDef(), from: 'hand', to: 'battle', slot, faceUp: true },
  });
}

describe('SETUP de estación', () => {
  it('coloca la estación en zona pública sin contarla en el mazo', () => {
    const station = getStarterStation();
    const next = applyEvent(
      emptyState(),
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 40, deckName: 'Mazo de ejemplo', station },
      }),
    );

    const player = next.players['user-1'];
    expect(player?.deckCount).toBe(40);
    expect(player?.handCount).toBe(0);
    expect(player?.ready).toBe(true);
    const placed = Object.values(player?.cards ?? {});
    expect(placed).toHaveLength(1);
    expect(placed[0]?.zone).toBe('station');
    expect(placed[0]?.def.nombre).toBe('Estación Chatarrera K-9');
    expect(placed[0]?.def.notas_diseno).toBeUndefined();
    expect(placed[0]?.uid).toBe('station:user-1');
    expect(next.sharedResourceDeckCount).toBe(SHARED_RESOURCE_DECK_SIZE);
  });

  it('reconstruye la misma estación al reproducir el log', () => {
    const station = getStarterStation();
    const log = [
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 40, station },
      }),
    ];
    const first = reduceAll(log);
    const second = reduceAll(log);
    expect(first.players['user-1']?.cards['station:user-1']?.def.id).toBe(station.id);
    expect(second.players['user-1']?.cards).toEqual(first.players['user-1']?.cards);
  });
});

describe('TURN_START', () => {
  it('roba una carta y enfría 5 CC, sin tocar el mazo compartido', () => {
    const next = reduceAll([
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 40, station: getStarterStation() },
      }),
      event({ sequence: 2, type: GameEventType.Heat, data: { value: 7 } }),
      event({
        sequence: 3,
        type: GameEventType.TurnStart,
        data: { turn: 1, activePlayerId: 'user-1' },
      }),
    ]);
    const player = next.players['user-1']!;
    expect(next.phase).toBe('Inicial');
    expect(player.deckCount).toBe(39);
    expect(player.handCount).toBe(1);
    expect(player.heat).toBe(2);
    // El recurso compartido ya no es automático: se roba a mano (RESOURCE_DRAW).
    expect(next.sharedResourceDeckCount).toBe(SHARED_RESOURCE_DECK_SIZE);
  });

  it('endereza las cartas del jugador al iniciar su turno (refresco en Inicial)', () => {
    const next = reduceAll([
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 40, station: getStarterStation() },
      }),
      playShip(2),
      event({ sequence: 3, type: GameEventType.Tap, data: { uid: 'ship-1', tapped: true } }),
      event({ sequence: 4, type: GameEventType.Heat, data: { value: 6 } }),
      event({
        sequence: 5,
        type: GameEventType.TurnStart,
        data: { turn: 2, activePlayerId: 'user-1' },
      }),
    ]);
    const player = next.players['user-1']!;
    expect(player.cards['ship-1']?.tapped).toBe(false);
    expect(player.heat).toBe(1);
    expect(player.handCount).toBe(1);
    expect(player.deckCount).toBe(39);
  });

  it('declara derrota por deck-out si el mazo está vacío', () => {
    const next = reduceAll([
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 0, station: getStarterStation() },
      }),
      event({
        sequence: 2,
        type: ServerEventType.PlayerJoined,
        playerId: 'user-2',
        seat: 2,
        data: { userId: 'user-2', seat: 2 },
      }),
      event({
        sequence: 3,
        type: GameEventType.TurnStart,
        data: { turn: 1, activePlayerId: 'user-1' },
      }),
    ]);
    expect(next.status).toBe('finished');
    expect(next.endReason).toBe('deck_out');
    expect(next.winnerId).toBe('user-2');
  });
});

describe('RESOURCE_DRAW', () => {
  const setup = () =>
    event({
      sequence: 1,
      type: GameEventType.Setup,
      data: { deckCount: 40, station: getStarterStation() },
    });

  it('lleva una carta del mazo compartido a la zona de recursos', () => {
    const next = reduceAll([
      setup(),
      event({ sequence: 2, type: GameEventType.TurnStart, data: { turn: 1, activePlayerId: 'user-1' } }),
      event({ sequence: 3, type: GameEventType.ResourceDraw, data: { uid: 'res-a' } }),
    ]);
    const player = next.players['user-1']!;
    expect(next.sharedResourceDeckCount).toBe(SHARED_RESOURCE_DECK_SIZE - 1);
    expect(player.cards['res-a']?.def.id).toBe(SHARED_RESOURCE_DEF.id);
    expect(player.cards['res-a']?.zone).toBe('resources');
    expect(player.resourcePoints).toBe(1);
    expect(player.lastResourceDrawTurn).toBe(1);
  });

  it('ignora un segundo robo en el mismo turno', () => {
    const next = reduceAll([
      setup(),
      event({ sequence: 2, type: GameEventType.TurnStart, data: { turn: 1, activePlayerId: 'user-1' } }),
      event({ sequence: 3, type: GameEventType.ResourceDraw, data: { uid: 'res-a' } }),
      event({ sequence: 4, type: GameEventType.ResourceDraw, data: { uid: 'res-b' } }),
    ]);
    const player = next.players['user-1']!;
    expect(next.sharedResourceDeckCount).toBe(SHARED_RESOURCE_DECK_SIZE - 1);
    expect(player.cards['res-b']).toBeUndefined();
    expect(player.resourcePoints).toBe(1);
  });

  it('vuelve a permitir robar cuando avanza el turno', () => {
    const next = reduceAll([
      setup(),
      event({ sequence: 2, type: GameEventType.TurnStart, data: { turn: 1, activePlayerId: 'user-1' } }),
      event({ sequence: 3, type: GameEventType.ResourceDraw, data: { uid: 'res-a' } }),
      event({ sequence: 4, type: GameEventType.TurnStart, data: { turn: 2, activePlayerId: 'user-1' } }),
      event({ sequence: 5, type: GameEventType.ResourceDraw, data: { uid: 'res-b' } }),
    ]);
    const player = next.players['user-1']!;
    expect(next.sharedResourceDeckCount).toBe(SHARED_RESOURCE_DECK_SIZE - 2);
    expect(player.cards['res-b']?.zone).toBe('resources');
    expect(player.resourcePoints).toBe(2);
    expect(player.lastResourceDrawTurn).toBe(2);
  });
});

describe('fase de activación', () => {
  it('endereza naves, pilotos y recursos', () => {
    const next = reduceAll([
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 40, station: getStarterStation() },
      }),
      playShip(2),
      event({ sequence: 3, type: GameEventType.Tap, data: { uid: 'ship-1', tapped: true } }),
      event({
        sequence: 4,
        type: GameEventType.Phase,
        data: { phase: 'Activación', turn: 1, activePlayerId: 'user-1' },
      }),
    ]);
    expect(next.phase).toBe('Activación');
    expect(next.players['user-1']?.cards['ship-1']?.tapped).toBe(false);
  });

  it('mapea fases legacy al reglamento 2.4', () => {
    const next = applyEvent(
      emptyState(),
      event({
        sequence: 1,
        type: GameEventType.Phase,
        data: { phase: 'Preparación', turn: 2, activePlayerId: 'user-1' },
      }),
    );
    expect(next.phase).toBe('Inicial');
  });
});

describe('enlaces y destrucción', () => {
  it('limita a 2 gears por nave y eyecta piloto al destruir', () => {
    const next = reduceAll([
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 40, station: getStarterStation() },
      }),
      playShip(2),
      event({
        sequence: 3,
        type: GameEventType.Play,
        data: { uid: 'pilot-1', def: pilotDef(), from: 'hand', to: 'pilots', slot: 0, faceUp: true },
      }),
      event({
        sequence: 4,
        type: GameEventType.Play,
        data: { uid: 'gear-1', def: gearDef(5, 10), from: 'hand', to: 'resources', faceUp: true },
      }),
      event({
        sequence: 5,
        type: GameEventType.Play,
        data: { uid: 'gear-2', def: gearDef(0, 5), from: 'hand', to: 'resources', faceUp: true },
      }),
      event({
        sequence: 6,
        type: GameEventType.Play,
        data: { uid: 'gear-3', def: gearDef(1, 1), from: 'hand', to: 'resources', faceUp: true },
      }),
      event({ sequence: 7, type: GameEventType.Link, data: { childUid: 'pilot-1', parentUid: 'ship-1' } }),
      event({ sequence: 8, type: GameEventType.Link, data: { childUid: 'gear-1', parentUid: 'ship-1' } }),
      event({ sequence: 9, type: GameEventType.Link, data: { childUid: 'gear-2', parentUid: 'ship-1' } }),
      event({ sequence: 10, type: GameEventType.Link, data: { childUid: 'gear-3', parentUid: 'ship-1' } }),
    ]);
    const player = next.players['user-1']!;
    expect(shipPilot(player, 'ship-1')?.uid).toBe('pilot-1');
    expect(shipGears(player, 'ship-1')).toHaveLength(2);
    expect(player.cards['gear-3']?.attachedTo).toBeUndefined();
    expect(effectiveAttack(player, player.cards['ship-1']!)).toBe(35);

    const after = applyEvent(
      next,
      event({ sequence: 11, type: GameEventType.Destroy, data: { uid: 'ship-1' } }),
    );
    const later = after.players['user-1']!;
    expect(later.cards['ship-1']?.zone).toBe('void');
    expect(later.cards['pilot-1']?.zone).toBe('pilots');
    expect(later.cards['pilot-1']?.attachedTo).toBeUndefined();
    expect(later.cards['gear-1']?.zone).toBe('resources');
    expect(later.cards['gear-2']?.zone).toBe('resources');
  });
});

describe('tokens', () => {
  it('se retiran de la partida al salir de batalla y no van al vacío', () => {
    const next = reduceAll([
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 40, station: getStarterStation() },
      }),
      event({
        sequence: 2,
        type: GameEventType.TokenSpawn,
        data: { uid: 'tok-1', slot: 1, def: TOKEN_DRONE_DEF },
      }),
      event({
        sequence: 3,
        type: GameEventType.Move,
        data: { uid: 'tok-1', from: 'battle', to: 'void' },
      }),
    ]);
    const player = next.players['user-1']!;
    expect(player.cards['tok-1']).toBeUndefined();
    expect(Object.values(player.cards).filter((c) => c.zone === 'void')).toHaveLength(0);
  });
});

describe('ataque a estación', () => {
  it('acumula daño y gana al reducir HP a 0', () => {
    const station = { ...getStarterStation(), hp: 20, hp_max: 20 };
    const next = reduceAll([
      event({
        sequence: 1,
        type: GameEventType.Setup,
        data: { deckCount: 40, station },
      }),
      event({
        sequence: 2,
        type: ServerEventType.PlayerJoined,
        playerId: 'user-2',
        seat: 2,
        data: { userId: 'user-2', seat: 2 },
      }),
      event({
        sequence: 3,
        type: GameEventType.Setup,
        playerId: 'user-2',
        seat: 2,
        data: { deckCount: 40, station },
      }),
      event({
        sequence: 4,
        type: GameEventType.Play,
        playerId: 'user-2',
        seat: 2,
        data: {
          uid: 'ship-2',
          def: shipDef({ ataque: 25 }),
          from: 'hand',
          to: 'battle',
          slot: 0,
          faceUp: true,
        },
      }),
      event({
        sequence: 5,
        type: GameEventType.Attack,
        playerId: 'user-2',
        seat: 2,
        data: { sourceUid: 'ship-2', targetOwnerId: 'user-1', targetUid: 'station:user-1' },
      }),
    ]);
    expect(next.players['user-1']?.cards['station:user-1']?.counters[DAMAGE_COUNTER]).toBe(25);
    expect(next.status).toBe('finished');
    expect(next.endReason).toBe('station');
    expect(next.winnerId).toBe('user-2');
  });
});

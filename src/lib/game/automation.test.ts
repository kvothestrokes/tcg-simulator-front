/**
 * Automatic rules: cost payment, opening hand, auto resource draw, deck-out on
 * turn 1, extra draw, reveal/mill/recycle and counter cleanup.
 *
 * Every rule here runs inside the reducer so both clients rebuild the same board
 * from the same event log.
 */

import { describe, expect, it } from 'vitest';

import { getStarterStation } from './cards';
import { GameEventType, ServerEventType } from './events';
import { readyResources } from './rules';
import { applyEvent, reduceAll, rejectionReason } from './state';
import { DAMAGE_COUNTER, HEAT_MAX, SHARED_RESOURCE_DECK_SIZE, type CardDef, type GameState } from './types';
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

function def(overrides: Partial<CardDef> = {}): CardDef {
  return {
    id: 'card_test',
    nombre: 'Carta de Prueba',
    tipo: 'Nave',
    faccion: 'Neutral',
    coste_recursos: 0,
    coste_heat: 0,
    ataque: 20,
    escudo: 30,
    rareza: 'Común',
    numero_coleccion: 'T-001',
    autor: '',
    ...overrides,
  };
}

/** Builds a log step by step so every event gets the next sequence. */
function log() {
  const events: WireEvent[] = [];
  const api = {
    add(partial: Omit<Partial<WireEvent>, 'sequence'> & Pick<WireEvent, 'type'>) {
      events.push(event({ ...partial, sequence: events.length + 1 }));
      return api;
    },
    setup(deckCount = 40, extra: Record<string, unknown> = {}, playerId = 'user-1') {
      return api.add({
        type: GameEventType.Setup,
        playerId,
        seat: playerId === 'user-1' ? 1 : 2,
        data: { deckCount, station: getStarterStation(), ...extra },
      });
    },
    joinOpponent() {
      return api.add({
        type: ServerEventType.PlayerJoined,
        playerId: 'user-2',
        seat: 2,
        data: { userId: 'user-2', seat: 2 },
      });
    },
    turn(turn: number, activePlayerId = 'user-1', extra: Record<string, unknown> = {}) {
      return api.add({
        type: GameEventType.TurnStart,
        data: { turn, activePlayerId, ...extra },
      });
    },
    /** Resource cards land untapped (ready) in the resources zone. */
    resources(uids: string[]) {
      for (const uid of uids) {
        api.add({
          type: GameEventType.Play,
          data: { uid, def: def({ id: `r-${uid}`, tipo: 'Orden', nombre: uid }), from: 'hand', to: 'resources', faceUp: true },
        });
      }
      return api;
    },
    play(data: Record<string, unknown>) {
      return api.add({ type: GameEventType.Play, data: { from: 'hand', faceUp: true, payCost: true, ...data } });
    },
    events,
    state(): GameState {
      return reduceAll(events);
    },
  };
  return api;
}

describe('SETUP with opening hand', () => {
  it('draws the opening hand atomically when openingHand is declared', () => {
    const player = log().setup(40, { openingHand: 5 }).state().players['user-1']!;
    expect(player.deckCount).toBe(35);
    expect(player.handCount).toBe(5);
    expect(player.ready).toBe(true);
  });

  it('never draws more than the deck holds', () => {
    const player = log().setup(3, { openingHand: 5 }).state().players['user-1']!;
    expect(player.deckCount).toBe(0);
    expect(player.handCount).toBe(3);
  });

  it('keeps legacy SETUP events (no openingHand) drawing nothing', () => {
    const player = log().setup(40).state().players['user-1']!;
    expect(player.deckCount).toBe(40);
    expect(player.handCount).toBe(0);
  });
});

describe('automatic cost payment on PLAY', () => {
  it('taps exactly coste_recursos ready resources in uid order and adds heat', () => {
    const state = log()
      .setup()
      .resources(['res-c', 'res-a', 'res-b'])
      .play({ uid: 'ship-1', def: def({ coste_recursos: 2, coste_heat: 3 }), to: 'battle', slot: 0 })
      .state();
    const player = state.players['user-1']!;
    expect(player.cards['ship-1']?.zone).toBe('battle');
    expect(player.cards['res-a']?.tapped).toBe(true);
    expect(player.cards['res-b']?.tapped).toBe(true);
    expect(player.cards['res-c']?.tapped).toBe(false);
    expect(readyResources(player)).toHaveLength(1);
    expect(player.heat).toBe(3);
  });

  it('rejects an unaffordable play without touching the board or the hand count', () => {
    const builder = log().setup(40, { openingHand: 5 }).resources(['res-a']);
    const before = builder.state();
    builder.play({ uid: 'ship-1', def: def({ coste_recursos: 2 }), to: 'battle', slot: 0 });
    const last = builder.events[builder.events.length - 1]!;
    expect(rejectionReason(before, last)).toMatch(/recursos/);

    const player = builder.state().players['user-1']!;
    expect(player.cards['ship-1']).toBeUndefined();
    expect(player.cards['res-a']?.tapped).toBe(false);
    // 5 opening cards minus the resource played; the rejected ship stays in hand.
    expect(player.handCount).toBe(4);
    expect(player.heat).toBe(0);
    expect(builder.state().log.at(-1)?.text).toMatch(/recursos/);
  });

  it('charges pilots, station plays and cards linked to a ship', () => {
    const player = log()
      .setup()
      .resources(['res-a', 'res-b', 'res-c'])
      .play({ uid: 'ship-1', def: def({ coste_recursos: 1 }), to: 'battle', slot: 0 })
      .play({
        uid: 'pilot-1',
        def: def({ tipo: 'Piloto', coste_recursos: 1, coste_heat: 1 }),
        to: 'battle',
        slot: 0,
        attachedTo: 'ship-1',
      })
      .play({ uid: 'pilot-2', def: def({ tipo: 'Piloto', coste_recursos: 1 }), to: 'pilots', slot: 0 })
      .state()
      .players['user-1']!;
    expect(player.cards['pilot-1']?.attachedTo).toBe('ship-1');
    expect(player.cards['pilot-2']?.zone).toBe('pilots');
    expect(readyResources(player)).toHaveLength(0);
    expect(player.heat).toBe(1);
  });

  it('charges nothing for plays to resources or the void', () => {
    const player = log()
      .setup()
      .resources(['res-a'])
      .play({ uid: 'x-1', def: def({ coste_recursos: 5, coste_heat: 5 }), to: 'resources' })
      .play({ uid: 'x-2', def: def({ tipo: 'Orden', coste_recursos: 5, coste_heat: 5 }), to: 'void' })
      .state()
      .players['user-1']!;
    expect(player.cards['x-1']?.zone).toBe('resources');
    expect(player.cards['x-2']?.zone).toBe('void');
    expect(readyResources(player)).toHaveLength(2);
    expect(player.heat).toBe(0);
  });

  it('charges nothing for tokens', () => {
    const player = log()
      .setup()
      .play({ uid: 'tok-1', def: def({ coste_recursos: 3, coste_heat: 2 }), to: 'battle', slot: 1, isToken: true })
      .state()
      .players['user-1']!;
    expect(player.cards['tok-1']?.zone).toBe('battle');
    expect(player.heat).toBe(0);
  });

  it('clamps heat at HEAT_MAX', () => {
    const player = log()
      .setup()
      .add({ type: GameEventType.Heat, data: { value: 9 } })
      .play({ uid: 'ship-1', def: def({ coste_heat: 4 }), to: 'battle', slot: 0 })
      .state()
      .players['user-1']!;
    expect(player.heat).toBe(HEAT_MAX);
  });

  it('replays legacy PLAY events (no payCost) without charging', () => {
    const player = log()
      .setup()
      .add({
        type: GameEventType.Play,
        data: { uid: 'ship-1', def: def({ coste_recursos: 3, coste_heat: 2 }), from: 'hand', to: 'battle', slot: 0, faceUp: true },
      })
      .state()
      .players['user-1']!;
    expect(player.cards['ship-1']?.zone).toBe('battle');
    expect(player.heat).toBe(0);
  });
});

describe('ACTIVATE_ORDER', () => {
  const order = def({ id: 'order_1', nombre: 'Orden de Prueba', tipo: 'Orden', coste_recursos: 1, coste_heat: 2 });

  it('pays the cost and sends the order to the void', () => {
    const state = log()
      .setup(40, { openingHand: 5 })
      .resources(['res-a', 'res-b'])
      .add({ type: GameEventType.ActivateOrder, data: { uid: 'ord-1', def: order } })
      .state();
    const player = state.players['user-1']!;
    expect(player.cards['ord-1']?.zone).toBe('void');
    expect(player.cards['res-a']?.tapped).toBe(true);
    expect(player.cards['res-b']?.tapped).toBe(false);
    expect(player.heat).toBe(2);
    expect(player.handCount).toBe(2);
    expect(state.log.at(-1)?.text).toMatch(/Orden de Prueba/);
  });

  it('rejects an unaffordable order', () => {
    const builder = log().setup(40, { openingHand: 5 });
    const before = builder.state();
    builder.add({ type: GameEventType.ActivateOrder, data: { uid: 'ord-1', def: order } });
    expect(rejectionReason(before, builder.events.at(-1)!)).not.toBeNull();
    const player = builder.state().players['user-1']!;
    expect(player.cards['ord-1']).toBeUndefined();
    expect(player.handCount).toBe(5);
  });

  it('rejects activating a card that is not an order', () => {
    const builder = log().setup(40, { openingHand: 5 });
    const before = builder.state();
    builder.add({ type: GameEventType.ActivateOrder, data: { uid: 'x', def: def({ tipo: 'Nave' }) } });
    expect(rejectionReason(before, builder.events.at(-1)!)).not.toBeNull();
  });
});

describe('deck-out', () => {
  it('does not lose on turn 1 even with an empty deck', () => {
    const state = log().setup(0).joinOpponent().turn(1).state();
    expect(state.status).not.toBe('finished');
    expect(state.winnerId).toBeUndefined();
  });

  it('does not lose when drawing from an empty deck on turn 1', () => {
    const state = log()
      .setup(0)
      .joinOpponent()
      .add({ type: GameEventType.Draw, data: { count: 1 } })
      .state();
    expect(state.status).not.toBe('finished');
  });

  it('loses when a later turn starts with an empty deck', () => {
    const state = log().setup(0).joinOpponent().turn(2).state();
    expect(state.status).toBe('finished');
    expect(state.endReason).toBe('deck_out');
    expect(state.winnerId).toBe('user-2');
  });
});

describe('TURN_START automatic resource', () => {
  it('takes one resource from the shared deck using resourceUid', () => {
    const state = log().setup().turn(1, 'user-1', { resourceUid: 'res-auto', autoResource: true }).state();
    const player = state.players['user-1']!;
    expect(state.sharedResourceDeckCount).toBe(SHARED_RESOURCE_DECK_SIZE - 1);
    expect(player.cards['res-auto']?.zone).toBe('resources');
    expect(player.cards['res-auto']?.tapped).toBe(false);
    expect(player.lastResourceDrawTurn).toBe(1);
  });

  it('consumes the per-turn resource draw', () => {
    const state = log()
      .setup()
      .turn(1, 'user-1', { resourceUid: 'res-auto', autoResource: true })
      .add({ type: GameEventType.ResourceDraw, data: { uid: 'res-manual' } })
      .state();
    expect(state.players['user-1']?.cards['res-manual']).toBeUndefined();
    expect(state.sharedResourceDeckCount).toBe(SHARED_RESOURCE_DECK_SIZE - 1);
  });

  it('gives the resource to the active player even when the opponent declares the turn', () => {
    const state = log()
      .setup()
      .joinOpponent()
      .setup(40, {}, 'user-2')
      .add({
        type: GameEventType.TurnStart,
        playerId: 'user-2',
        seat: 2,
        data: { turn: 2, activePlayerId: 'user-1', resourceUid: 'res-auto', autoResource: true },
      })
      .state();
    expect(state.players['user-1']?.cards['res-auto']?.zone).toBe('resources');
    expect(state.players['user-2']?.cards['res-auto']).toBeUndefined();
  });

  it('skips the resource when the shared deck is empty', () => {
    const builder = log().setup();
    for (let turn = 1; turn <= SHARED_RESOURCE_DECK_SIZE + 1; turn++) {
      builder.turn(turn, 'user-1', { resourceUid: `res-${turn}`, autoResource: true });
    }
    const state = builder.state();
    expect(state.sharedResourceDeckCount).toBe(0);
    expect(state.players['user-1']?.cards[`res-${SHARED_RESOURCE_DECK_SIZE + 1}`]).toBeUndefined();
    expect(state.players['user-1']?.lastResourceDrawTurn).toBe(SHARED_RESOURCE_DECK_SIZE);
  });

  it('keeps legacy TURN_START events (no autoResource) away from the shared deck', () => {
    const state = log().setup().turn(1, 'user-1', { resourceUid: 'res-legacy' }).state();
    expect(state.sharedResourceDeckCount).toBe(SHARED_RESOURCE_DECK_SIZE);
    expect(state.players['user-1']?.cards['res-legacy']).toBeUndefined();
  });
});

describe('EXTRA_DRAW', () => {
  it('draws one card and adds one heat', () => {
    const player = log()
      .setup(40, { openingHand: 5 })
      .turn(1)
      .add({ type: GameEventType.ExtraDraw })
      .state()
      .players['user-1']!;
    expect(player.deckCount).toBe(33);
    expect(player.handCount).toBe(7);
    expect(player.heat).toBe(1);
    expect(player.lastExtraDrawTurn).toBe(1);
  });

  it('allows only one extra draw per turn', () => {
    const builder = log().setup(40, { openingHand: 5 }).turn(1).add({ type: GameEventType.ExtraDraw });
    const before = builder.state();
    builder.add({ type: GameEventType.ExtraDraw });
    expect(rejectionReason(before, builder.events.at(-1)!)).not.toBeNull();
    expect(builder.state().players['user-1']?.handCount).toBe(7);
  });

  it('allows it again on a later turn', () => {
    const player = log()
      .setup(40, { openingHand: 5 })
      .turn(1)
      .add({ type: GameEventType.ExtraDraw })
      .turn(2)
      .add({ type: GameEventType.ExtraDraw })
      .state()
      .players['user-1']!;
    expect(player.lastExtraDrawTurn).toBe(2);
    expect(player.handCount).toBe(9);
  });

  it('is rejected outside your turn, at max heat or with an empty deck', () => {
    const notMyTurn = log().setup(40, { openingHand: 5 }).joinOpponent().turn(1, 'user-2').state();
    expect(rejectionReason(notMyTurn, event({ sequence: 99, type: GameEventType.ExtraDraw }))).not.toBeNull();

    const hot = log()
      .setup(40, { openingHand: 5 })
      .turn(1)
      .add({ type: GameEventType.Heat, data: { value: HEAT_MAX } })
      .state();
    expect(rejectionReason(hot, event({ sequence: 99, type: GameEventType.ExtraDraw }))).not.toBeNull();

    const empty = log().setup(0).turn(1).state();
    expect(rejectionReason(empty, event({ sequence: 99, type: GameEventType.ExtraDraw }))).not.toBeNull();
  });
});

describe('REVEAL / REVEAL_RESOLVE', () => {
  it('logs how many cards were revealed without moving anything', () => {
    const state = log()
      .setup(40, { openingHand: 5 })
      .turn(1)
      .add({ type: GameEventType.Reveal, data: { count: 3 } })
      .state();
    expect(state.players['user-1']?.deckCount).toBe(34);
    expect(state.log.at(-1)?.text).toMatch(/revela 3 cartas/);
  });

  it('routes revealed cards: hand and void leave the deck, top/bottom stay', () => {
    const voidCard = def({ id: 'milled', nombre: 'Carta Revelada' });
    const state = log()
      .setup(40, { openingHand: 5 })
      .turn(1)
      .add({
        type: GameEventType.RevealResolve,
        data: {
          count: 4,
          routes: ['hand', 'void', 'top', 'bottom'],
          voidCards: [{ index: 1, uid: 'rev-1', def: voidCard }],
        },
      })
      .state();
    const player = state.players['user-1']!;
    // 40 - 5 opening - 1 turn draw = 34; hand + void leave the deck.
    expect(player.deckCount).toBe(32);
    expect(player.handCount).toBe(7);
    expect(player.cards['rev-1']?.zone).toBe('void');
    expect(player.cards['rev-1']?.def.nombre).toBe('Carta Revelada');
  });

  it('rejects malformed or out-of-turn resolutions', () => {
    const mine = log().setup(40, { openingHand: 5 }).turn(1).state();
    const mismatch = event({
      sequence: 99,
      type: GameEventType.RevealResolve,
      data: { count: 2, routes: ['hand'], voidCards: [] },
    });
    expect(rejectionReason(mine, mismatch)).not.toBeNull();

    const missingVoid = event({
      sequence: 99,
      type: GameEventType.RevealResolve,
      data: { count: 1, routes: ['void'], voidCards: [] },
    });
    expect(rejectionReason(mine, missingVoid)).not.toBeNull();

    const tooMany = event({
      sequence: 99,
      type: GameEventType.RevealResolve,
      data: { count: 6, routes: ['top', 'top', 'top', 'top', 'top', 'top'], voidCards: [] },
    });
    expect(rejectionReason(mine, tooMany)).not.toBeNull();

    const theirs = log().setup(40, { openingHand: 5 }).joinOpponent().turn(1, 'user-2').state();
    const valid = event({
      sequence: 99,
      type: GameEventType.RevealResolve,
      data: { count: 1, routes: ['top'], voidCards: [] },
    });
    expect(rejectionReason(theirs, valid)).not.toBeNull();
    expect(rejectionReason(mine, valid)).toBeNull();
  });
});

describe('MILL', () => {
  it('sends the top card of the deck to the void', () => {
    const player = log()
      .setup(40, { openingHand: 5 })
      .turn(1)
      .add({ type: GameEventType.Mill, data: { uid: 'mill-1', def: def({ nombre: 'Molida' }) } })
      .state()
      .players['user-1']!;
    expect(player.deckCount).toBe(33);
    expect(player.cards['mill-1']?.zone).toBe('void');
  });

  it('is rejected with an empty deck', () => {
    const state = log().setup(0).turn(1).state();
    const mill = event({ sequence: 99, type: GameEventType.Mill, data: { uid: 'm', def: def() } });
    expect(rejectionReason(state, mill)).not.toBeNull();
  });
});

describe('RECYCLE', () => {
  it('turns a ship into a ready resource', () => {
    const player = log()
      .setup(40, { openingHand: 5 })
      .turn(1)
      .add({ type: GameEventType.Recycle, data: { uid: 'rec-1', def: def({ tipo: 'Nave' }) } })
      .state()
      .players['user-1']!;
    expect(player.deckCount).toBe(33);
    expect(player.cards['rec-1']?.zone).toBe('resources');
    expect(player.cards['rec-1']?.tapped).toBe(false);
    expect(readyResources(player).map((c) => c.uid)).toContain('rec-1');
  });

  it('turns a gear into a ready resource', () => {
    const player = log()
      .setup(40, { openingHand: 5 })
      .turn(1)
      .add({ type: GameEventType.Recycle, data: { uid: 'rec-1', def: def({ tipo: 'Gear' }) } })
      .state()
      .players['user-1']!;
    expect(player.cards['rec-1']?.zone).toBe('resources');
  });

  it('sends any other card type to the void', () => {
    const player = log()
      .setup(40, { openingHand: 5 })
      .turn(1)
      .add({ type: GameEventType.Recycle, data: { uid: 'rec-1', def: def({ tipo: 'Orden' }) } })
      .state()
      .players['user-1']!;
    expect(player.cards['rec-1']?.zone).toBe('void');
  });
});

describe('counters cleanup', () => {
  it('clears counters when a card is moved to the void', () => {
    const player = log()
      .setup()
      .play({ uid: 'pilot-1', def: def({ tipo: 'Piloto' }), to: 'pilots', slot: 0 })
      .add({ type: GameEventType.Counter, data: { uid: 'pilot-1', key: 'marca', value: 2 } })
      .add({ type: GameEventType.Move, data: { uid: 'pilot-1', from: 'pilots', to: 'void' } })
      .state()
      .players['user-1']!;
    expect(player.cards['pilot-1']?.zone).toBe('void');
    expect(player.cards['pilot-1']?.counters).toEqual({});
  });

  it('clears counters when a ship is destroyed', () => {
    const player = log()
      .setup()
      .play({ uid: 'ship-1', def: def(), to: 'battle', slot: 0 })
      .add({ type: GameEventType.Counter, data: { uid: 'ship-1', key: DAMAGE_COUNTER, value: 10 } })
      .add({ type: GameEventType.Destroy, data: { uid: 'ship-1' } })
      .state()
      .players['user-1']!;
    expect(player.cards['ship-1']?.zone).toBe('void');
    expect(player.cards['ship-1']?.counters).toEqual({});
  });

  it('keeps counters while the card moves between board zones', () => {
    const player = log()
      .setup()
      .play({ uid: 'ship-1', def: def(), to: 'battle', slot: 0 })
      .add({ type: GameEventType.Counter, data: { uid: 'ship-1', key: DAMAGE_COUNTER, value: 10 } })
      .add({ type: GameEventType.Move, data: { uid: 'ship-1', from: 'battle', to: 'battle', slot: 3 } })
      .state()
      .players['user-1']!;
    expect(player.cards['ship-1']?.counters[DAMAGE_COUNTER]).toBe(10);
  });
});

describe('rejectionReason', () => {
  it('accepts ordinary events', () => {
    const state = log().setup().state();
    expect(rejectionReason(state, event({ sequence: 99, type: GameEventType.Draw, data: { count: 1 } }))).toBeNull();
  });

  it('does not mutate the state it validates', () => {
    const state = log().setup().state();
    const snapshot = JSON.stringify(state);
    applyEvent(state, event({ sequence: 99, type: GameEventType.ExtraDraw }));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

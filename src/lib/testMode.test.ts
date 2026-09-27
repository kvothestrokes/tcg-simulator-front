import { describe, expect, it } from 'vitest';

import { buildStarterDeck } from './game/cards';
import { GameEventType } from './game/events';
import { reduceAll } from './game/state';
import { OPENING_HAND_SIZE } from './game/types';
import { LocalRoom } from './realtime/localRoom';
import {
  TEST_PLAYER_ID,
  TEST_RIVAL_ID,
  TEST_SEATS,
  actorUserId,
  parseTestMode,
  prepareSeats,
  seedTestRoom,
} from './testMode';
import { shortName } from './session';

describe('parseTestMode', () => {
  it.each(['?test', '?test=1', '?test=true', '?code=ABC&test', '?test=yes'])('enables on %s', (search) => {
    expect(parseTestMode(search)).toBe(true);
  });

  it.each(['', '?code=ABC', '?test=0', '?test=false', '?testing=1'])('stays off on %s', (search) => {
    expect(parseTestMode(search)).toBe(false);
  });
});

describe('test seats', () => {
  it('have distinct short names, so the log can tell them apart', () => {
    expect(shortName(TEST_PLAYER_ID)).not.toBe(shortName(TEST_RIVAL_ID));
    expect(actorUserId('me')).toBe(TEST_PLAYER_ID);
    expect(actorUserId('rival')).toBe(TEST_RIVAL_ID);
  });
});

describe('seedTestRoom', () => {
  it('seats both players, activates the match and prepares both decks', () => {
    const room = new LocalRoom(TEST_SEATS);
    seedTestRoom(room);
    const state = reduceAll([...room.events]);

    expect(state.status).toBe('active');
    for (const userId of [TEST_PLAYER_ID, TEST_RIVAL_ID]) {
      const player = state.players[userId];
      expect(player?.ready).toBe(true);
      expect(player?.handCount).toBe(OPENING_HAND_SIZE);
      expect(player?.deckCount).toBe(buildStarterDeck().length - OPENING_HAND_SIZE);
    }
  });

  it('does nothing on a room that already has a log', () => {
    const room = new LocalRoom(TEST_SEATS);
    seedTestRoom(room);
    const before = room.currentSequence;
    seedTestRoom(room);
    expect(room.currentSequence).toBe(before);
  });
});

describe('prepareSeats', () => {
  it('re-prepares only the seats a RESET left unready', () => {
    const room = new LocalRoom(TEST_SEATS);
    seedTestRoom(room);
    room.declare(TEST_PLAYER_ID, { eventType: GameEventType.Reset, clientEventId: 'r', at: 'r' });

    const afterReset = reduceAll([...room.events]);
    const unready = TEST_SEATS.filter((s) => !afterReset.players[s.userId]?.ready).length;
    expect(prepareSeats(room, afterReset)).toBe(unready);

    const after = reduceAll([...room.events]);
    expect(after.players[TEST_PLAYER_ID]?.ready).toBe(true);
    expect(after.players[TEST_RIVAL_ID]?.ready).toBe(true);
    expect(prepareSeats(room, after)).toBe(0);
  });
});

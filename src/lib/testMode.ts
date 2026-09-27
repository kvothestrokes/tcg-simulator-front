/**
 * Offline test mode: the full game table with no backend and no auth.
 *
 * Opt-in ONLY through the URL (`/room/?test=1`, or just `?test`). Without the
 * param nothing here runs and the normal flow is untouched. When active:
 *
 *   - the room code is forced to TEST_ROOM_CODE, so private-deck keys
 *     (`cb:deck:TEST:*`) never collide with a real room;
 *   - identity is a fake seat (TEST_PLAYER_ID or TEST_RIVAL_ID), and the
 *     "play as" toggle switches between them (hot-seat: the board flips);
 *   - declarations go to an in-browser LocalRoom instead of the Go server,
 *     and its log is kept in localStorage so an F5 keeps the game.
 */

import { buildStarterDeck, getStarterStation } from './game/cards';
import { GameEventType } from './game/events';
import { OPENING_HAND_SIZE, type GameState } from './game/types';
import type { Identity } from './session';
import { LocalRoom, type LocalSeat } from './realtime/localRoom';
import type { WireEvent } from './realtime/protocol';

export const TEST_ROOM_CODE = 'TEST';
// Distinct first 4 characters: the log names players by shortName (4 chars).
export const TEST_PLAYER_ID = 'yo00-test-player';
export const TEST_RIVAL_ID = 'rv00-test-rival';

export type TestActor = 'me' | 'rival';

export const TEST_SEATS: LocalSeat[] = [
  { userId: TEST_PLAYER_ID, seat: 1 },
  { userId: TEST_RIVAL_ID, seat: 2 },
];

const LOG_KEY = 'cb:test:log';
const ACTOR_KEY = 'cb:test:actor';

/** `?test`, `?test=1`, `?test=true`… enable it; `?test=0` / `?test=false` do not. */
export function parseTestMode(search: string): boolean {
  const params = new URLSearchParams(search);
  if (!params.has('test')) return false;
  const value = (params.get('test') ?? '').trim().toLowerCase();
  return value !== '0' && value !== 'false' && value !== 'no' && value !== 'off';
}

/** Browser check against the current URL. Always false outside the browser. */
export function isTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  return parseTestMode(window.location.search);
}

export function actorUserId(actor: TestActor): string {
  return actor === 'rival' ? TEST_RIVAL_ID : TEST_PLAYER_ID;
}

export function testIdentity(actor: TestActor): Identity {
  return {
    userId: actorUserId(actor),
    label: actor === 'rival' ? 'Rival (prueba)' : 'Tú (prueba)',
    kind: 'anonymous',
  };
}

/** SETUP payload with the sample deck, as the table's own setupDeck builds it. */
export function sampleSetupData(): Record<string, unknown> {
  return {
    deckCount: buildStarterDeck().length,
    deckName: 'Mazo de ejemplo (prueba)',
    station: getStarterStation(),
    openingHand: OPENING_HAND_SIZE,
  };
}

/**
 * SETUP for every seat that is not ready yet in `state`.
 *
 * The table's own automatic SETUP is gated on a legal deck selected in
 * /decks (Supabase), which test mode does not have; this is its stand-in.
 * The private deck falls back to the sample deck when the loadout is empty.
 */
export function prepareSeats(room: LocalRoom, state: GameState): number {
  let prepared = 0;
  for (const { userId } of TEST_SEATS) {
    if (state.players[userId]?.ready) continue;
    const result = room.declare(userId, {
      ...sampleSetupData(),
      eventType: GameEventType.Setup,
      clientEventId: `test-setup-${userId}-${room.currentSequence + 1}`,
    });
    if (result.ok) prepared++;
  }
  return prepared;
}

/** A fresh room: both seats joined, match active, both decks prepared. */
export function seedTestRoom(room: LocalRoom): void {
  if (room.currentSequence > 0) return;
  for (const { userId } of TEST_SEATS) room.join(userId);
  room.setStatus('active');
  for (const { userId } of TEST_SEATS) {
    room.declare(userId, {
      ...sampleSetupData(),
      eventType: GameEventType.Setup,
      clientEventId: `test-setup-${userId}`,
    });
  }
}

// --- browser singletons ------------------------------------------------------

let room: LocalRoom | null = null;

/** The one local room of this tab, restored from localStorage and seeded. */
export function getTestRoom(): LocalRoom {
  if (room) return room;
  room = new LocalRoom(TEST_SEATS, {
    roomId: 'test-room',
    code: TEST_ROOM_CODE,
    initialEvents: readJson<WireEvent[]>(LOG_KEY) ?? [],
    onChange: (events) => writeJson(LOG_KEY, events),
  });
  seedTestRoom(room);
  return room;
}

/** Wipes the test log, both private decks and the actor, then reloads the page. */
export function hardResetTestRoom(): void {
  removeKey(LOG_KEY);
  removeKey(ACTOR_KEY);
  for (const { userId } of TEST_SEATS) removeKey(`cb:deck:${TEST_ROOM_CODE}:${userId}`);
  room = null;
  if (typeof window !== 'undefined') window.location.reload();
}

const actorListeners = new Set<() => void>();
let actor: TestActor | null = null;

export function getTestActor(): TestActor {
  if (actor) return actor;
  actor = readRaw(ACTOR_KEY) === 'rival' ? 'rival' : 'me';
  return actor;
}

export function setTestActor(next: TestActor): void {
  if (getTestActor() === next) return;
  actor = next;
  writeRaw(ACTOR_KEY, next);
  for (const listener of [...actorListeners]) listener();
}

export function subscribeTestActor(listener: () => void): () => void {
  actorListeners.add(listener);
  return () => {
    actorListeners.delete(listener);
  };
}

// --- storage helpers (never throw: private windows may block storage) --------

function readRaw(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // Without storage the test game lasts as long as the tab.
  }
}

function removeKey(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
}

function readJson<T>(key: string): T | null {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  writeRaw(key, JSON.stringify(value));
}

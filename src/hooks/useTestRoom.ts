/**
 * useTestRoom — read side of the offline test room for the test panel.
 *
 * Derives the shared board from the local log with the same pure reducer the
 * table uses, and exposes the "play as" actor. Only meaningful in test mode.
 */

import { useMemo, useSyncExternalStore } from 'react';

import { reduceAll } from '@/lib/game/state';
import type { GameState } from '@/lib/game/types';
import type { LocalRoom } from '@/lib/realtime/localRoom';
import {
  getTestActor,
  getTestRoom,
  setTestActor,
  subscribeTestActor,
  type TestActor,
} from '@/lib/testMode';

export interface UseTestRoomResult {
  room: LocalRoom;
  state: GameState;
  actor: TestActor;
  setActor: (actor: TestActor) => void;
}

export function useTestRoom(): UseTestRoomResult {
  const room = useMemo(() => getTestRoom(), []);
  const sequence = useSyncExternalStore(
    (listener) => room.subscribe(listener),
    () => room.currentSequence,
    () => 0,
  );
  const actor = useSyncExternalStore(subscribeTestActor, getTestActor, () => 'me' as const);
  // `sequence` is the cache key: the log only grows, one event per sequence.
  const state = useMemo(() => reduceAll([...room.events]), [room, sequence]);
  return { room, state, actor, setActor: setTestActor };
}

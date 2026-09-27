import { describe, expect, it } from 'vitest';

import { GameEventType, ServerEventType } from '../game/events';
import type { ConnectionState } from './client';
import { LocalRoom } from './localRoom';
import { LocalTransport } from './localTransport';
import type { ErrorPayload, WireEvent } from './protocol';

const SEATS = [
  { userId: 'p1', seat: 1 as const },
  { userId: 'p2', seat: 2 as const },
];

/** Synchronous scheduler: every "network" hop happens immediately. */
const now = (task: () => void) => task();

function connect(room: LocalRoom, userId: string) {
  const events: WireEvent[] = [];
  const states: ConnectionState[] = [];
  const errors: ErrorPayload[] = [];
  const transport = new LocalTransport({
    room,
    userId,
    schedule: now,
    onEvent: (event) => events.push(event),
    onStateChange: (state) => states.push(state),
    onError: (error) => errors.push(error),
  });
  void transport.connect();
  return { transport, events, states, errors };
}

describe('LocalTransport', () => {
  it('replays the full log on connect and ends connected', () => {
    const room = new LocalRoom(SEATS);
    room.join('p1');
    room.join('p2');
    const { events, states } = connect(room, 'p1');
    expect(events.map((e) => e.sequence)).toEqual([1, 2]);
    expect(states).toEqual(['connecting', 'syncing', 'connected']);
  });

  it('stamps declarations with its own seat and delivers them to every transport', () => {
    const room = new LocalRoom(SEATS);
    const me = connect(room, 'p1');
    const rival = connect(room, 'p2');
    rival.transport.declare(GameEventType.Draw, { count: 1 });
    me.transport.declare(GameEventType.Tap, { uid: 'u', tapped: true });

    expect(me.events.map((e) => [e.sequence, e.playerId])).toEqual([
      [1, 'p2'],
      [2, 'p1'],
    ]);
    expect(rival.events.map((e) => e.sequence)).toEqual([1, 2]);
  });

  it('reports server-side refusals through onError', () => {
    const room = new LocalRoom(SEATS);
    const { transport, errors, events } = connect(room, 'p1');
    transport.declare(ServerEventType.PlayerJoined, {});
    expect(errors.map((e) => e.code)).toEqual(['INVALID_MESSAGE']);
    expect(events).toEqual([]);
  });

  it('does not send anything once disconnected', () => {
    const room = new LocalRoom(SEATS);
    const { transport } = connect(room, 'p1');
    transport.disconnect();
    transport.declare(GameEventType.Draw, { count: 1 });
    expect(room.currentSequence).toBe(0);
  });

  it('never emits a sequence twice, and a full resync replays from zero', () => {
    const room = new LocalRoom(SEATS);
    room.join('p1');
    const { transport, events } = connect(room, 'p1');
    transport.requestSync(0);
    expect(events.map((e) => e.sequence)).toEqual([1]);
    transport.resetSequence();
    transport.requestSync(0);
    expect(events.map((e) => e.sequence)).toEqual([1, 1]);
  });

  it('sends chat and leave as sequenced server events', () => {
    const room = new LocalRoom(SEATS);
    const { transport, events, states } = connect(room, 'p1');
    transport.sendChat('gg');
    transport.leaveRoom();
    expect(events.map((e) => e.type)).toEqual([ServerEventType.Chat, ServerEventType.PlayerLeft]);
    expect(states.at(-1)).toBe('closed');
  });
});

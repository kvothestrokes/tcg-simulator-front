import { describe, expect, it } from 'vitest';

import { GameEventType, ServerEventType } from '../game/events';
import { LocalRoom, isReservedEventType, type LocalSeat } from './localRoom';
import type { WireEvent } from './protocol';

const SEATS: LocalSeat[] = [
  { userId: 'p1', seat: 1 },
  { userId: 'p2', seat: 2 },
];

function makeRoom(initialEvents: WireEvent[] = []) {
  return new LocalRoom(SEATS, { roomId: 'r', code: 'TEST', initialEvents, now: () => 'T' });
}

function declared(room: LocalRoom, actor: string, type: string, data: Record<string, unknown> = {}) {
  const result = room.declare(actor, { ...data, eventType: type, clientEventId: `${actor}-${type}-${room.currentSequence}` });
  if (!result.ok) throw new Error(result.error.message);
  return result.event;
}

describe('LocalRoom sequencing', () => {
  it('assigns strictly increasing sequences across server and declared events', () => {
    const room = makeRoom();
    room.join('p1');
    room.join('p2');
    room.setStatus('active');
    declared(room, 'p1', GameEventType.Draw, { count: 1 });
    declared(room, 'p2', GameEventType.Tap, { uid: 'x', tapped: true });

    expect(room.events.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(room.currentSequence).toBe(5);
    expect(room.eventsSince(3).map((e) => e.sequence)).toEqual([4, 5]);
  });

  it('continues after a restored log and drops out-of-order entries', () => {
    const restored = [
      { id: 'a', roomId: 'r', sequence: 1, type: 'DRAW', data: {}, createdAt: 'T' },
      { id: 'b', roomId: 'r', sequence: 1, type: 'DRAW', data: {}, createdAt: 'T' },
      { id: 'c', roomId: 'r', sequence: 4, type: 'DRAW', data: {}, createdAt: 'T' },
    ] as WireEvent[];
    const room = makeRoom(restored);
    expect(room.events.map((e) => e.id)).toEqual(['a', 'c']);
    expect(room.join('p1').sequence).toBe(5);
  });
});

describe('LocalRoom actor assignment', () => {
  it('stamps actor and seat and strips the envelope fields from data', () => {
    const room = makeRoom();
    const event = declared(room, 'p2', GameEventType.Draw, { count: 2 });
    expect(event.playerId).toBe('p2');
    expect(event.seat).toBe(2);
    expect(event.data).toEqual({ count: 2 });
    expect(event.clientEventId).toBe('p2-DRAW-0');
  });

  it('rejects actors without a seat', () => {
    const result = makeRoom().declare('ghost', { eventType: GameEventType.Draw, count: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_MEMBER');
  });

  it('returns the persisted event for a repeated clientEventId', () => {
    const room = makeRoom();
    const payload = { eventType: GameEventType.Draw, clientEventId: 'same', count: 1 };
    const first = room.declare('p1', payload);
    const second = room.declare('p1', payload);
    expect(first.ok && second.ok && first.event).toBe(second.ok && second.event);
    expect(room.currentSequence).toBe(1);
  });
});

describe('LocalRoom reserved types and closed rooms', () => {
  it.each(Object.values(ServerEventType))('refuses to let a client declare %s', (type) => {
    expect(isReservedEventType(type)).toBe(true);
    const result = makeRoom().declare('p1', { eventType: type, clientEventId: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_MESSAGE');
  });

  it('refuses a declaration without an event type', () => {
    expect(makeRoom().declare('p1', { count: 1 }).ok).toBe(false);
  });

  it('turns chat into a sequenced CHAT_MESSAGE from the actor', () => {
    const room = makeRoom();
    const result = room.chat('p1', '  hola  ', 'c1');
    expect(result.ok && result.event).toMatchObject({
      type: ServerEventType.Chat,
      playerId: 'p1',
      data: { message: 'hola' },
      sequence: 1,
    });
  });

  it('closes the room to declarations once finished', () => {
    const room = makeRoom();
    room.setStatus('finished');
    expect(room.status).toBe('finished');
    const result = room.declare('p1', { eventType: GameEventType.Draw, count: 1 });
    expect(!result.ok && result.error.code).toBe('ROOM_CLOSED');
  });

  it('notifies subscribers and persists through onChange', () => {
    const seen: number[] = [];
    let persisted = 0;
    const room = new LocalRoom(SEATS, { onChange: (events) => (persisted = events.length) });
    const off = room.subscribe((event) => seen.push(event.sequence));
    room.join('p1');
    off();
    room.join('p2');
    expect(seen).toEqual([1]);
    expect(persisted).toBe(2);
  });

  it('marks a player as left in the roster after PLAYER_LEFT', () => {
    const room = makeRoom();
    room.join('p1');
    room.leave('p1');
    expect(room.players().find((p) => p.userId === 'p1')?.leftAt).toBeDefined();
    expect(room.players().find((p) => p.userId === 'p2')?.leftAt).toBeUndefined();
  });
});

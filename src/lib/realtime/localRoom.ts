/**
 * LocalRoom — an in-memory stand-in for the Go realtime server.
 *
 * Used only by the offline test mode (see lib/testMode.ts). It does exactly
 * what the real server does with declarations and nothing more: it validates
 * the envelope, assigns the next sequence number, stamps the actor and seat,
 * persists the event in an ordered log and broadcasts it. Like the server, it
 * never interprets game content: rules live in the pure reducer, which the
 * table runs on these events exactly as it would on server events.
 *
 * Pure apart from the optional `onChange` hook (used to persist the log) and
 * the listeners it notifies. No timers, no storage, no randomness of its own.
 */

import { ServerEventType } from '../game/events';
import type { ErrorPayload, PlayerInfo, RoomInfo, RoomStatus, WireEvent } from './protocol';

export interface LocalSeat {
  userId: string;
  seat: 1 | 2;
}

export type LocalDeclareResult =
  | { ok: true; event: WireEvent }
  | { ok: false; error: ErrorPayload };

export interface LocalRoomOptions {
  roomId?: string;
  code?: string;
  /** Events restored from a previous session, in sequence order. */
  initialEvents?: WireEvent[];
  /** Called after every appended event with the full log (e.g. to persist it). */
  onChange?: (events: readonly WireEvent[]) => void;
  now?: () => string;
}

const RESERVED_TYPES = new Set<string>(Object.values(ServerEventType));
const CLOSED_STATUSES = new Set<RoomStatus>(['finished', 'abandoned']);

/** Server-generated types a client may never declare. */
export function isReservedEventType(type: string): boolean {
  return RESERVED_TYPES.has(type);
}

export class LocalRoom {
  readonly id: string;
  readonly code: string;
  private readonly seats: LocalSeat[];
  private readonly log: WireEvent[];
  private readonly listeners = new Set<(event: WireEvent) => void>();
  private readonly onChange?: (events: readonly WireEvent[]) => void;
  private readonly now: () => string;

  constructor(seats: LocalSeat[], options: LocalRoomOptions = {}) {
    this.seats = [...seats];
    this.id = options.roomId ?? 'local-room';
    this.code = options.code ?? 'LOCAL';
    this.onChange = options.onChange;
    this.now = options.now ?? (() => new Date().toISOString());
    this.log = sanitizeLog(options.initialEvents ?? []);
  }

  // --- reads -------------------------------------------------------------------

  get events(): readonly WireEvent[] {
    return this.log;
  }

  get currentSequence(): number {
    return this.log.at(-1)?.sequence ?? 0;
  }

  /** Last status announced in the log ('waiting' until someone changes it). */
  get status(): RoomStatus {
    for (let i = this.log.length - 1; i >= 0; i--) {
      const event = this.log[i]!;
      if (event.type === ServerEventType.RoomStatus) {
        return (event.data as { status?: RoomStatus }).status ?? 'waiting';
      }
    }
    return 'waiting';
  }

  seatOf(userId: string): 1 | 2 | undefined {
    return this.seats.find((s) => s.userId === userId)?.seat;
  }

  /** Events strictly after `sequence`, in order (what a SYNC would send). */
  eventsSince(sequence: number): WireEvent[] {
    return this.log.filter((event) => event.sequence > sequence);
  }

  info(): RoomInfo {
    return { id: this.id, code: this.code, status: this.status, currentSequence: this.currentSequence };
  }

  players(): PlayerInfo[] {
    const at = new Date(0).toISOString();
    return this.seats.map((s) => ({
      userId: s.userId,
      seat: s.seat,
      connected: true,
      joinedAt: at,
      lastSeenAt: at,
      leftAt: this.hasLeft(s.userId) ? at : undefined,
    }));
  }

  // --- writes ------------------------------------------------------------------

  /**
   * DECLARE_ACTION: `payload` carries `eventType` and `clientEventId` next to
   * the game data, exactly like the wire message. A repeated clientEventId
   * returns the already persisted event instead of appending a duplicate.
   */
  declare(actorId: string, payload: Record<string, unknown>): LocalDeclareResult {
    const { eventType, clientEventId, ...data } = payload;
    if (typeof eventType !== 'string' || eventType.trim() === '') {
      return fail('INVALID_MESSAGE', 'Falta el tipo de evento.');
    }
    if (isReservedEventType(eventType)) {
      return fail('INVALID_MESSAGE', `El tipo ${eventType} lo genera el servidor.`);
    }
    const guard = this.guardActor(actorId);
    if (guard) return guard;

    const id = typeof clientEventId === 'string' ? clientEventId : undefined;
    const duplicate = id ? this.log.find((event) => event.clientEventId === id) : undefined;
    if (duplicate) return { ok: true, event: duplicate };

    return { ok: true, event: this.append(eventType, data, actorId, id) };
  }

  chat(actorId: string, message: string, clientEventId?: string): LocalDeclareResult {
    const guard = this.guardActor(actorId);
    if (guard) return guard;
    const text = message.trim();
    if (!text) return fail('INVALID_MESSAGE', 'El mensaje está vacío.');
    return { ok: true, event: this.append(ServerEventType.Chat, { message: text }, actorId, clientEventId) };
  }

  join(userId: string): WireEvent {
    const seat = this.seatOf(userId) ?? 1;
    return this.append(ServerEventType.PlayerJoined, { userId, seat, voluntary: false }, userId);
  }

  leave(userId: string, voluntary = true): WireEvent {
    const seat = this.seatOf(userId) ?? 1;
    return this.append(ServerEventType.PlayerLeft, { userId, seat, voluntary }, userId);
  }

  setStatus(status: RoomStatus): WireEvent {
    return this.append(ServerEventType.RoomStatus, { status });
  }

  subscribe(listener: (event: WireEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // --- internals -----------------------------------------------------------------

  private guardActor(actorId: string): LocalDeclareResult | null {
    if (!this.seatOf(actorId)) return fail('NOT_A_MEMBER', 'No tienes asiento en esta sala.');
    if (CLOSED_STATUSES.has(this.status)) return fail('ROOM_CLOSED', 'La partida está cerrada.');
    return null;
  }

  private hasLeft(userId: string): boolean {
    let left = false;
    for (const event of this.log) {
      if (event.playerId !== userId) continue;
      if (event.type === ServerEventType.PlayerLeft) left = true;
      if (event.type === ServerEventType.PlayerJoined) left = false;
    }
    return left;
  }

  private append(
    type: string,
    data: Record<string, unknown>,
    actorId?: string,
    clientEventId?: string,
  ): WireEvent {
    const sequence = this.currentSequence + 1;
    const event: WireEvent = {
      id: `local-${sequence}`,
      roomId: this.id,
      sequence,
      playerId: actorId,
      seat: actorId ? this.seatOf(actorId) : undefined,
      type,
      data,
      clientEventId,
      createdAt: this.now(),
    };
    this.log.push(event);
    this.onChange?.(this.log);
    for (const listener of [...this.listeners]) listener(event);
    return event;
  }
}

function fail(code: ErrorPayload['code'], message: string): LocalDeclareResult {
  return { ok: false, error: { code, message } };
}

/** Keeps only well-formed events with strictly increasing sequences. */
function sanitizeLog(events: WireEvent[]): WireEvent[] {
  const out: WireEvent[] = [];
  let last = 0;
  for (const event of events) {
    if (!event || typeof event.type !== 'string' || !Number.isInteger(event.sequence)) continue;
    if (event.sequence <= last) continue;
    last = event.sequence;
    out.push(event);
  }
  return out;
}

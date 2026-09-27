/**
 * LocalTransport — a RealtimeClient look-alike backed by a LocalRoom.
 *
 * The offline test mode swaps the WebSocket client for this one and nothing
 * else changes: the hook receives the same callbacks (room, ordered and
 * de-duplicated events, errors, connection state), so the reducer, the private
 * deck and the rejection rules run exactly as in a real match.
 *
 * Delivery is asynchronous by default (like a network round trip, only
 * shorter), so a declaration never re-enters the caller's handler. Tests pass
 * a synchronous `schedule`.
 */

import type { ConnectionState, RealtimeHandlers } from './client';
import { randomUuid } from './client';
import type { LocalDeclareResult, LocalRoom } from './localRoom';
import type { WireEvent } from './protocol';

/** The subset of RealtimeClient the room hook drives. RealtimeClient satisfies it. */
export interface RoomTransport {
  connect(): Promise<void>;
  disconnect(): void;
  declare(eventType: string, data?: Record<string, unknown>): string;
  sendChat(message: string): void;
  leaveRoom(): void;
  requestSync(from?: number): void;
  resetSequence(): void;
}

export interface LocalTransportOptions extends RealtimeHandlers {
  room: LocalRoom;
  /** The seat this transport acts as: every declaration is stamped with it. */
  userId: string;
  schedule?: (task: () => void) => void;
}

const defaultSchedule = (task: () => void) => {
  setTimeout(task, 0);
};

export class LocalTransport implements RoomTransport {
  private readonly opts: LocalTransportOptions;
  private readonly schedule: (task: () => void) => void;
  private state: ConnectionState = 'idle';
  private lastSequence = 0;
  private unsubscribe: (() => void) | null = null;
  private stopped = true;

  constructor(options: LocalTransportOptions) {
    this.opts = options;
    this.schedule = options.schedule ?? defaultSchedule;
  }

  async connect(): Promise<void> {
    this.stopped = false;
    this.setState('connecting');
    this.schedule(() => {
      if (this.stopped) return;
      const { room, userId } = this.opts;
      const you = room.players().find((p) => p.userId === userId);
      if (you) this.opts.onRoom?.(room.info(), you, room.players());

      this.unsubscribe?.();
      this.unsubscribe = room.subscribe((event) => this.deliver(event));

      if (room.currentSequence > this.lastSequence) {
        this.setState('syncing');
        this.replayFrom(this.lastSequence);
      }
      this.setState('connected');
      this.opts.onLatency?.(0);
    });
  }

  disconnect(): void {
    this.stopped = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.setState('closed');
  }

  declare(eventType: string, data: Record<string, unknown> = {}): string {
    const clientEventId = randomUuid();
    // Like a closed socket: nothing leaves the client while disconnected.
    if (this.state !== 'connected') return clientEventId;
    this.report(this.opts.room.declare(this.opts.userId, { ...data, eventType, clientEventId }));
    return clientEventId;
  }

  sendChat(message: string): void {
    if (this.state !== 'connected') return;
    this.report(this.opts.room.chat(this.opts.userId, message, randomUuid()));
  }

  leaveRoom(): void {
    if (this.state !== 'connected') return;
    this.opts.room.leave(this.opts.userId, true);
    // The server broadcasts PLAYER_LEFT and then closes the socket.
    this.schedule(() => this.disconnect());
  }

  requestSync(from = this.lastSequence): void {
    this.schedule(() => {
      if (this.stopped) return;
      this.replayFrom(from);
    });
  }

  resetSequence(): void {
    this.lastSequence = 0;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getLastSequence(): number {
    return this.lastSequence;
  }

  // --- internals ---------------------------------------------------------------

  private replayFrom(from: number): void {
    for (const event of this.opts.room.eventsSince(from)) this.emit(event);
  }

  private deliver(event: WireEvent): void {
    this.schedule(() => {
      if (this.stopped) return;
      this.emit(event);
    });
  }

  /** Same de-duplication as RealtimeClient: only strictly newer sequences pass. */
  private emit(event: WireEvent): void {
    if (event.sequence <= this.lastSequence) return;
    this.lastSequence = event.sequence;
    this.opts.onEvent?.(event);
  }

  private report(result: LocalDeclareResult): void {
    if (result.ok) return;
    const { error } = result;
    this.schedule(() => this.opts.onError?.(error));
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.opts.onStateChange?.(state);
  }
}

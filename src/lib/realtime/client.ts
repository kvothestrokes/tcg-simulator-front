/**
 * Cliente WebSocket del simulador.
 *
 * Resuelve las cuatro cosas que hacen falta para que una partida sobreviva a la
 * vida real:
 *
 *   1. Reconexión con backoff exponencial y jitter.
 *   2. Sincronización incremental (y paginada) al reconectar.
 *   3. Deduplicación por secuencia.
 *   4. Renovación del token sin cortar la conexión.
 *
 * `lastSequence` vive SOLO en memoria, y es importante que sea así: el tablero
 * es una función del log de eventos, así que una pestaña recién cargada no
 * tiene tablero y necesita que le manden la partida entera. Si se guardara la
 * secuencia en localStorage, al recargar el servidor no enviaría nada —no falta
 * ningún evento nuevo— y la mesa aparecería vacía. Dentro de una misma pestaña,
 * en cambio, las reconexiones sí son incrementales, que es donde importa.
 *
 * Lo que sí sobrevive a un F5 es tu mano, porque es información privada que
 * nunca estuvo en el log (ver hooks/usePrivateDeck.ts).
 *
 * Normaliza además todos los mensajes con secuencia —jugadas, chat, altas,
 * bajas y cambios de estado— a un único flujo ordenado de `WireEvent`, que es
 * lo que consume el motor del juego.
 *
 * El token viaja en el subprotocolo (`['bearer', token]`), no en la query
 * string, para que no acabe en los logs de acceso de ningún proxy.
 */

import { REALTIME_WS_URL } from '../config';
import {
  CloseCode,
  type ClientMessage,
  type ErrorPayload,
  type MembershipPayload,
  type PlayerInfo,
  type PresencePayload,
  type RoomInfo,
  type RoomJoinedPayload,
  type RoomStatusPayload,
  type ServerMessage,
  type SyncCompletePayload,
  type SyncRequiredPayload,
  type WireEvent,
} from './protocol';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'syncing'
  | 'connected'
  | 'reconnecting'
  | 'closed';

export interface RealtimeHandlers {
  onStateChange?: (state: ConnectionState) => void;
  onRoom?: (room: RoomInfo, you: PlayerInfo, players: PlayerInfo[]) => void;
  /** Todo evento con secuencia, ya deduplicado y en orden. */
  onEvent?: (event: WireEvent) => void;
  /** Conexión y desconexión de sockets (estado volátil, sin secuencia). */
  onPresence?: (presence: PresencePayload) => void;
  /** El estado local era imposible: hay que descartarlo. */
  onResyncRequired?: (info: SyncRequiredPayload) => void;
  onError?: (error: ErrorPayload) => void;
  onLatency?: (ms: number) => void;
}

export interface RealtimeOptions extends RealtimeHandlers {
  /** UUID o código de la sala. */
  room: string;
  /** Debe devolver un token fresco; se llama en cada conexión y renovación. */
  getAccessToken: () => Promise<string | null>;
  baseUrl?: string;
  maxReconnectDelayMs?: number;
  /** Ping de aplicación para medir latencia. 0 lo desactiva. */
  pingIntervalMs?: number;
}

const INITIAL_RECONNECT_DELAY_MS = 500;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 15_000;
const DEFAULT_PING_INTERVAL_MS = 25_000;

export class RealtimeClient {
  private readonly opts: RealtimeOptions;
  private socket: WebSocket | null = null;
  private state: ConnectionState = 'idle';

  private lastSequence = 0;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pingSentAt = 0;
  private stopped = false;

  constructor(options: RealtimeOptions) {
    this.opts = options;
  }

  // --- API pública -----------------------------------------------------------

  async connect(): Promise<void> {
    this.stopped = false;
    await this.open();
  }

  /** Cierra la conexión sin abandonar la partida: el asiento se conserva. */
  disconnect(): void {
    this.stopped = true;
    this.clearTimers();
    this.socket?.close(CloseCode.Normal, 'client disconnect');
    this.socket = null;
    this.setState('closed');
  }

  /**
   * Declara una acción.
   *
   * El `clientEventId` se genera aquí: es lo que impide que un reintento tras
   * una reconexión registre la jugada dos veces.
   */
  declare(eventType: string, data: Record<string, unknown> = {}): string {
    const clientEventId = randomUuid();
    this.send({
      type: 'DECLARE_ACTION',
      payload: { ...data, eventType, clientEventId },
    });
    return clientEventId;
  }

  sendChat(message: string): void {
    this.send({
      type: 'CHAT_MESSAGE',
      payload: { message, clientEventId: randomUuid() },
    });
  }

  /** Abandono voluntario: libera el asiento. Cerrar la pestaña NO es esto. */
  leaveRoom(): void {
    this.stopped = true;
    this.send({ type: 'LEAVE_ROOM' });
  }

  requestSync(from = this.lastSequence): void {
    this.send({ type: 'SYNC_REQUEST', payload: { lastSequence: from } });
  }

  getLastSequence(): number {
    return this.lastSequence;
  }

  getState(): ConnectionState {
    return this.state;
  }

  /** Olvida el progreso local: la próxima sincronización traerá todo. */
  resetSequence(): void {
    this.lastSequence = 0;
  }

  // --- conexión --------------------------------------------------------------

  private async open(): Promise<void> {
    this.clearTimers();
    this.setState(this.reconnectAttempt === 0 ? 'connecting' : 'reconnecting');

    const token = await this.opts.getAccessToken();
    if (!token) {
      this.opts.onError?.({ code: 'UNAUTHORIZED', message: 'No hay sesión activa.' });
      this.scheduleReconnect(3_000);
      return;
    }

    const base = (this.opts.baseUrl ?? REALTIME_WS_URL).replace(/\/+$/, '');
    // `since` sincroniza en el propio handshake: un viaje menos al reconectar.
    const url = `${base}/v1/ws/rooms/${encodeURIComponent(this.opts.room)}?since=${this.lastSequence}`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(url, ['bearer', token]);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState('connected');
      this.startPing();
    };

    socket.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data) as ServerMessage;
      } catch {
        return;
      }
      this.handle(msg);
    };

    socket.onclose = (ev) => {
      this.clearTimers();
      this.socket = null;
      if (this.stopped) {
        this.setState('closed');
        return;
      }
      // 1008 suele ser el token caducado: reconectar de inmediato daría el
      // mismo resultado, así que se deja margen para que getAccessToken
      // refresque la sesión.
      this.scheduleReconnect(ev.code === CloseCode.PolicyViolation ? 2_000 : undefined);
    };
  }

  private scheduleReconnect(minDelayMs?: number): void {
    if (this.stopped || this.reconnectTimer) return;

    this.setState('reconnecting');
    this.reconnectAttempt += 1;

    const max = this.opts.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;
    const exponential = Math.min(
      INITIAL_RECONNECT_DELAY_MS * 2 ** (this.reconnectAttempt - 1),
      max,
    );
    // El jitter evita que los dos jugadores reconecten en el mismo milisegundo
    // tras una caída del servicio.
    const jittered = exponential * (0.5 + Math.random() * 0.5);

    this.reconnectTimer = setTimeout(
      () => {
        this.reconnectTimer = null;
        void this.open();
      },
      Math.max(minDelayMs ?? 0, jittered),
    );
  }

  // --- mensajes --------------------------------------------------------------

  private handle(msg: ServerMessage): void {
    switch (msg.type) {
      case 'ROOM_JOINED': {
        const p = msg.payload as RoomJoinedPayload;
        this.opts.onRoom?.(p.room, p.you, p.players);
        if (p.room.currentSequence > this.lastSequence) {
          this.setState('syncing');
          this.requestSync();
        } else {
          this.setState('connected');
        }
        break;
      }

      case 'SYNC_START':
        this.setState('syncing');
        break;

      case 'SYNC_COMPLETE': {
        const p = msg.payload as SyncCompletePayload;
        this.bumpSequence(p.lastSequence);
        if (p.hasMore) this.requestSync(p.lastSequence);
        else this.setState('connected');
        break;
      }

      case 'SYNC_REQUIRED': {
        this.resetSequence();
        this.opts.onResyncRequired?.(msg.payload as SyncRequiredPayload);
        break;
      }

      case 'GAME_EVENT':
      case 'CHAT_MESSAGE':
        this.emitEvent(msg.payload as WireEvent);
        break;

      case 'PLAYER_JOINED':
      case 'PLAYER_LEFT': {
        const p = msg.payload as MembershipPayload;
        if (!p.sequence) break; // sin secuencia no forma parte del historial
        this.emitEvent({
          id: `membership-${p.sequence}`,
          roomId: '',
          sequence: p.sequence,
          playerId: p.userId,
          seat: p.seat,
          type: msg.type,
          data: { userId: p.userId, seat: p.seat, voluntary: p.voluntary },
          createdAt: p.at,
        });
        break;
      }

      case 'ROOM_STATUS_CHANGED': {
        const p = msg.payload as RoomStatusPayload;
        if (!p.sequence) break;
        this.emitEvent({
          id: `status-${p.sequence}`,
          roomId: '',
          sequence: p.sequence,
          type: 'ROOM_STATUS_CHANGED',
          data: { status: p.status },
          createdAt: new Date().toISOString(),
        });
        break;
      }

      case 'PLAYER_CONNECTED':
      case 'PLAYER_DISCONNECTED':
        this.opts.onPresence?.(msg.payload as PresencePayload);
        break;

      case 'SESSION_EXPIRING':
        void this.refreshToken();
        break;

      case 'PONG':
        if (this.pingSentAt) {
          this.opts.onLatency?.(Date.now() - this.pingSentAt);
          this.pingSentAt = 0;
        }
        break;

      case 'ERROR':
        this.opts.onError?.(msg.payload as ErrorPayload);
        break;
    }
  }

  /** Deduplica por secuencia y avisa al motor del juego. */
  private emitEvent(event: WireEvent): void {
    if (!event?.sequence || event.sequence <= this.lastSequence) return;
    this.bumpSequence(event.sequence);
    this.opts.onEvent?.(event);
  }

  private send(msg: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(msg));
  }

  private async refreshToken(): Promise<void> {
    const token = await this.opts.getAccessToken();
    if (token) this.send({ type: 'TOKEN_REFRESH', payload: { token } });
  }

  private startPing(): void {
    const interval = this.opts.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS;
    if (interval <= 0) return;
    this.pingTimer = setInterval(() => {
      this.pingSentAt = Date.now();
      this.send({ type: 'PING', payload: { echo: this.pingSentAt } });
    }, interval);
  }

  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    this.opts.onStateChange?.(state);
  }

  // --- persistencia de lastSequence ------------------------------------------

  private bumpSequence(sequence: number): void {
    if (sequence <= this.lastSequence) return;
    this.lastSequence = sequence;
  }
}

/**
 * crypto.randomUUID con respaldo.
 *
 * randomUUID solo existe en contextos seguros (https o localhost); en una IP de
 * la red local por http no está, y sin el respaldo no se podrían declarar
 * acciones.
 */
export function randomUuid(): string {
  const webcrypto: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto;

  if (typeof webcrypto?.randomUUID === 'function') {
    return webcrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof webcrypto?.getRandomValues === 'function') {
    webcrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

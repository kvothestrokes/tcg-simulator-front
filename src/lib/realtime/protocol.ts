/**
 * Contrato JSON del WebSocket. Espejo de internal/protocol del backend.
 *
 * El servidor no interpreta el contenido del juego: `data` es opaco para él.
 */

export type ClientMessageType =
  | 'JOIN_ROOM'
  | 'LEAVE_ROOM'
  | 'DECLARE_ACTION'
  | 'CHAT_MESSAGE'
  | 'PING'
  | 'SYNC_REQUEST'
  | 'TOKEN_REFRESH';

export type ServerMessageType =
  | 'ROOM_JOINED'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'PLAYER_CONNECTED'
  | 'PLAYER_DISCONNECTED'
  | 'GAME_EVENT'
  | 'CHAT_MESSAGE'
  | 'SYNC_START'
  | 'SYNC_COMPLETE'
  | 'SYNC_REQUIRED'
  | 'ROOM_STATUS_CHANGED'
  | 'SESSION_EXPIRING'
  | 'ERROR'
  | 'PONG';

export interface ClientMessage {
  type: ClientMessageType;
  id?: string;
  payload?: unknown;
}

export interface ServerMessage<T = unknown> {
  type: ServerMessageType;
  payload: T;
  refId?: string;
  sentAt: string;
}

export type RoomStatus = 'waiting' | 'active' | 'finished' | 'abandoned';

export interface RoomInfo {
  id: string;
  code: string;
  status: RoomStatus;
  currentSequence: number;
}

export interface PlayerInfo {
  userId: string;
  seat: 1 | 2;
  connected: boolean;
  joinedAt: string;
  lastSeenAt: string;
  leftAt?: string;
}

export interface RoomJoinedPayload {
  room: RoomInfo;
  you: PlayerInfo;
  players: PlayerInfo[];
  serverTime: string;
  sessionExpiresAt: string;
}

/**
 * Evento persistido. `data` es exactamente lo que declaró el jugador.
 *
 * Los mensajes de membresía y de cambio de estado también llevan secuencia; el
 * cliente los normaliza a esta misma forma para que el motor del juego vea un
 * único flujo ordenado.
 */
export interface WireEvent<T = Record<string, unknown>> {
  id: string;
  roomId: string;
  sequence: number;
  playerId?: string;
  seat?: 1 | 2;
  type: string;
  data: T;
  clientEventId?: string;
  createdAt: string;
}

export interface PresencePayload {
  userId: string;
  seat: 1 | 2;
  connected: boolean;
  at: string;
}

export interface MembershipPayload {
  userId: string;
  seat: 1 | 2;
  at: string;
  sequence?: number;
  voluntary: boolean;
}

export interface SyncStartPayload {
  fromSequence: number;
  count: number;
}

export interface SyncCompletePayload {
  lastSequence: number;
  hasMore: boolean;
}

export interface SyncRequiredPayload {
  reason: string;
  currentSequence: number;
}

export interface RoomStatusPayload {
  status: RoomStatus;
  sequence?: number;
}

export interface SessionExpiringPayload {
  expiresAt: string;
  secondsLeft: number;
}

export interface PongPayload {
  serverTime: string;
  echo?: unknown;
}

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_A_MEMBER'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_CLOSED'
  | 'INVALID_MESSAGE'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'SYNC_FAILED'
  | 'INTERNAL_ERROR';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  fatal?: boolean;
}

/** Códigos de cierre con significado propio en este servicio. */
export const CloseCode = {
  Normal: 1000,
  /** Reemplazada por otra conexión más reciente del mismo usuario. */
  ReplacedByNewerConnection: 1001,
  /** Sesión caducada: renueva el token antes de reconectar. */
  PolicyViolation: 1008,
  /** El servicio se está reiniciando: reconecta. */
  ServiceRestarting: 1012,
  /** Consumidor lento: reconecta y re-sincroniza. */
  SlowConsumer: 1013,
} as const;

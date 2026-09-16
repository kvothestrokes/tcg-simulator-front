/**
 * Cliente REST del servicio de tiempo real.
 *
 *   GET  /health                      estado del servicio
 *   POST /v1/rooms                    crear sala (el creador ocupa el asiento 1)
 *   GET  /v1/rooms/{code}             estado de la sala (solo sus jugadores)
 *   POST /v1/rooms/{code}/join        ocupar el primer asiento libre
 *   POST /v1/rooms/{code}/finish      terminar la partida
 *
 * El WebSocket va aparte, en lib/realtime/client.ts.
 * La sesión sale de Supabase Auth, no de este cliente.
 */

import { REALTIME_URL } from './config';

export type RoomStatus = 'waiting' | 'active' | 'finished' | 'abandoned';

export interface RoomView {
  id: string;
  code: string;
  status: RoomStatus;
  createdBy: string;
  currentSequence: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerView {
  userId: string;
  seat: 1 | 2;
  connected: boolean;
  joinedAt: string;
  lastSeenAt: string;
  leftAt?: string;
}

export interface RoomResponse {
  room: RoomView;
  you?: PlayerView;
  players: PlayerView[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: string;
  rooms: number;
  connections: number;
  uptimeSeconds: number;
}

/**
 * Error del backend con su código estable.
 *
 * Programa siempre contra `code`, nunca contra `message`: los textos son para
 * personas y pueden cambiar.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Mensaje listo para enseñar, en español. */
  get humanMessage(): string {
    return API_ERROR_MESSAGES[this.code] ?? this.message;
  }
}

const API_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Tu sesión no es válida. Vuelve a entrar.',
  TOKEN_EXPIRED: 'Tu sesión caducó. Vuelve a entrar.',
  FORBIDDEN: 'No tienes acceso a esta sala.',
  NOT_A_MEMBER: 'No eres jugador de esta sala.',
  ROOM_NOT_FOUND: 'No existe ninguna sala con ese código.',
  ROOM_FULL: 'La sala ya tiene dos jugadores.',
  ROOM_CLOSED: 'Esa partida ya terminó.',
  CODE_TAKEN: 'Ese código de sala ya está en uso.',
  RATE_LIMITED: 'Vas demasiado rápido. Espera un momento.',
  INTERNAL_ERROR: 'El servidor falló. Inténtalo otra vez.',
  NETWORK: 'No se pudo contactar con el servidor.',
};

type TokenProvider = () => Promise<string | null>;

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Con false no se envía Authorization (solo /health). */
  auth?: boolean;
  signal?: AbortSignal;
}

export class RealtimeApi {
  constructor(
    private readonly getToken: TokenProvider,
    private readonly baseUrl: string = REALTIME_URL,
  ) {}

  /** Estado del servicio. No requiere sesión. */
  health(signal?: AbortSignal): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health', { auth: false, signal });
  }

  /** Crea una sala. Sin código, el servidor genera uno legible de 6 caracteres. */
  createRoom(code?: string): Promise<RoomResponse> {
    return this.request<RoomResponse>('/v1/rooms', {
      method: 'POST',
      body: code ? { code: code.toUpperCase() } : {},
    });
  }

  /** Estado de una sala. Devuelve ROOM_NOT_FOUND si no eres jugador de ella. */
  getRoom(code: string, signal?: AbortSignal): Promise<RoomResponse> {
    return this.request<RoomResponse>(`/v1/rooms/${encodeURIComponent(code.toUpperCase())}`, {
      signal,
    });
  }

  /** Ocupa el primer asiento libre. Es idempotente si ya estabas dentro. */
  joinRoom(code: string): Promise<RoomResponse> {
    return this.request<RoomResponse>(
      `/v1/rooms/${encodeURIComponent(code.toUpperCase())}/join`,
      { method: 'POST' },
    );
  }

  /** Marca la partida como terminada. Cualquiera de los dos jugadores puede. */
  finishRoom(code: string): Promise<RoomResponse> {
    return this.request<RoomResponse>(
      `/v1/rooms/${encodeURIComponent(code.toUpperCase())}/finish`,
      { method: 'POST' },
    );
  }

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, auth = true, signal } = opts;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    if (auth) {
      const token = await this.getToken();
      if (!token) {
        throw new ApiError('UNAUTHORIZED', 'No hay sesión activa.', 401);
      }
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      if (signal?.aborted) throw cause;
      throw new ApiError('NETWORK', 'No se pudo contactar con el servidor.', 0);
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(
        error?.code ?? `HTTP_${response.status}`,
        error?.message ?? `El servidor respondió ${response.status}.`,
        response.status,
      );
    }

    return payload as T;
  }
}

/** Traduce cualquier error a un texto presentable. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.humanMessage;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}

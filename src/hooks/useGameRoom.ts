/**
 * Orquestador de la sala: une REST, WebSocket y motor de estado.
 *
 * Un detalle de diseño que conviene tener presente: aquí NO hay actualizaciones
 * optimistas. Cuando declaras una acción, el tablero no cambia hasta que el
 * evento vuelve del servidor ya persistido. A cambio, los dos jugadores ven
 * exactamente lo mismo siempre, sin código de reconciliación ni estados
 * intermedios que puedan divergir. El viaje de ida y vuelta son milisegundos.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, RealtimeApi, errorMessage, type PlayerView, type RoomView } from '../lib/api';
import { GameEventType } from '../lib/game/events';
import { applyEvent, applyPresence, seedPlayers } from '../lib/game/state';
import { getStarterStation, publicCardDef } from '../lib/game/cards';
import { TOKEN_DRONE_DEF } from '../lib/game/rules';
import {
  emptyState,
  HEAT_MAX,
  RESOURCE_MAX,
  type CardDef,
  type CardInstance,
  type GameState,
  type PlayerState,
  type ZoneId,
} from '../lib/game/types';
import { RealtimeClient, randomUuid, type ConnectionState } from '../lib/realtime/client';
import type { ErrorPayload, WireEvent } from '../lib/realtime/protocol';
import { getAccessToken } from '../lib/session';

export interface UseGameRoomOptions {
  roomCode: string;
  userId: string | undefined;
  /**
   * Se llama con cada evento persistido, en orden y sin repetidos.
   *
   * Lo usa la mano privada: sus cartas se mueven cuando el evento vuelve del
   * servidor, no cuando pulsas el botón.
   */
  onEvent?: (event: WireEvent) => void;
}

export interface GameActions {
  /** Declara el mazo listo y fija el contador de cartas. */
  setupDeck: (deckCount: number, deckName?: string, station?: CardDef) => void;
  draw: (count: number) => void;
  shuffleDeck: (deckCount: number) => void;
  playCard: (input: {
    uid: string;
    def: CardDef;
    from: ZoneId;
    to: ZoneId;
    slot?: number;
    faceUp?: boolean;
    attachedTo?: string;
    isToken?: boolean;
  }) => void;
  moveCard: (input: {
    uid: string;
    from: ZoneId;
    to: ZoneId;
    slot?: number;
    faceUp?: boolean;
    attachedTo?: string | null;
  }) => void;
  /** La definición viaja en el evento para que la mano pueda recuperarla. */
  returnToHand: (card: CardInstance) => void;
  returnToDeck: (card: CardInstance, position?: 'top' | 'bottom' | 'shuffle') => void;
  tapCard: (uid: string, tapped: boolean) => void;
  flipCard: (uid: string, faceUp: boolean) => void;
  setCounter: (uid: string, key: string, value: number) => void;
  setHeat: (value: number) => void;
  setResources: (value: number) => void;
  setPhase: (phase: string, turn: number, activePlayerId?: string) => void;
  startTurn: (turn: number, activePlayerId: string) => void;
  linkCard: (childUid: string, parentUid: string) => void;
  unlinkCard: (childUid: string) => void;
  attack: (sourceUid: string, targetOwnerId: string, targetUid: string) => void;
  destroyCard: (uid: string) => void;
  spawnToken: (slot: number) => void;
  removeCard: (uid: string) => void;
  concede: (winnerId: string) => void;
  rollDice: (sides: number) => void;
  resetTable: () => void;
  sendChat: (message: string) => void;
  /** Abandono voluntario: libera el asiento. */
  leaveRoom: () => void;
  /** Cierra la partida para los dos (REST). */
  finishGame: () => Promise<void>;
  /** Vuelve a pedir toda la partida desde cero. */
  fullResync: () => void;
}

export interface UseGameRoomResult {
  loading: boolean;
  fatalError: string | null;
  connection: ConnectionState;
  latencyMs: number | null;
  lastError: ErrorPayload | null;
  room: RoomView | null;
  roster: PlayerView[];
  state: GameState;
  me: PlayerState | undefined;
  opponent: PlayerState | undefined;
  actions: GameActions;
}

export function useGameRoom({ roomCode, userId, onEvent }: UseGameRoomOptions): UseGameRoomResult {
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastError, setLastError] = useState<ErrorPayload | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [roster, setRoster] = useState<PlayerView[]>([]);
  const [state, setState] = useState<GameState>(() => emptyState());

  const clientRef = useRef<RealtimeClient | null>(null);
  const api = useMemo(() => new RealtimeApi(getAccessToken), []);

  // El callback cambia en cada render; se guarda en una ref para no reabrir la
  // conexión cada vez.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!roomCode || !userId) return;

    let cancelled = false;
    setLoading(true);
    setFatalError(null);
    setState(emptyState());

    // 1. Asegurar el asiento por REST. Es idempotente: si ya estabas dentro,
    //    devuelve el mismo asiento. Hacerlo antes de abrir el socket permite
    //    dar un error claro (ROOM_FULL, ROOM_CLOSED) en vez de un socket que se
    //    abre y se cierra sin explicación.
    void api
      .joinRoom(roomCode)
      .then((response) => {
        if (cancelled) return;
        setRoom(response.room);
        setRoster(response.players);
        setState((current) =>
          seedPlayers({ ...current, status: response.room.status }, response.players),
        );
        setLoading(false);

        // 2. Abrir el WebSocket. El cliente se encarga de reconectar y
        //    sincronizar desde lastSequence.
        const client = new RealtimeClient({
          room: roomCode,
          getAccessToken,
          onStateChange: setConnection,
          onLatency: setLatencyMs,
          onError: setLastError,
          onRoom: (info, _you, players) => {
            setRoom((current) => (current ? { ...current, status: info.status } : current));
            setRoster(
              players.map((p) => ({
                userId: p.userId,
                seat: p.seat,
                connected: p.connected,
                joinedAt: p.joinedAt,
                lastSeenAt: p.lastSeenAt,
                leftAt: p.leftAt,
              })),
            );
            setState((current) => seedPlayers({ ...current, status: info.status }, players));
          },
          onEvent: (event) => {
            // Primero la mano privada, después el tablero compartido: así el
            // render que provoca el cambio de estado ya ve la mano al día.
            onEventRef.current?.(event);
            setState((current) => applyEvent(current, event));
          },
          onPresence: (presence) => {
            setState((current) =>
              applyPresence(current, presence.userId, presence.seat, presence.connected),
            );
            setRoster((current) =>
              current.map((p) =>
                p.userId === presence.userId ? { ...p, connected: presence.connected } : p,
              ),
            );
          },
          onResyncRequired: () => {
            // El estado local era imposible: se descarta y se espera la
            // partida completa, que el servidor manda a continuación.
            setState((current) => seedPlayers(emptyState(), toRoster(current)));
          },
        });

        clientRef.current = client;
        void client.connect();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoading(false);
        setFatalError(
          error instanceof ApiError ? error.humanMessage : errorMessage(error),
        );
      });

    return () => {
      cancelled = true;
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, [api, roomCode, userId]);

  // --- acciones --------------------------------------------------------------

  const declare = useCallback((type: string, data: Record<string, unknown> = {}) => {
    clientRef.current?.declare(type, data);
  }, []);

  const actions = useMemo<GameActions>(
    () => ({
      setupDeck: (deckCount, deckName, station) =>
        declare(GameEventType.Setup, {
          deckCount,
          deckName: deckName ?? 'Mazo inicial',
          station: station ?? getStarterStation(),
        }),

      draw: (count) => declare(GameEventType.Draw, { count }),

      shuffleDeck: (deckCount) => declare(GameEventType.Shuffle, { deckCount }),

      playCard: ({ uid, def, from, to, slot, faceUp = true, attachedTo, isToken }) =>
        declare(GameEventType.Play, {
          uid,
          def: publicCardDef(def),
          from,
          to,
          slot,
          faceUp,
          attachedTo,
          isToken,
        }),

      moveCard: ({ uid, from, to, slot, faceUp, attachedTo }) =>
        declare(GameEventType.Move, { uid, from, to, slot, faceUp, attachedTo }),

      returnToHand: (card) =>
        declare(GameEventType.ToHand, { uid: card.uid, from: card.zone, def: card.def }),

      returnToDeck: (card, position = 'shuffle') =>
        declare(GameEventType.ToDeck, {
          uid: card.uid,
          from: card.zone,
          position,
          def: card.def,
        }),

      tapCard: (uid, tapped) => declare(GameEventType.Tap, { uid, tapped }),

      flipCard: (uid, faceUp) => declare(GameEventType.Flip, { uid, faceUp }),

      setCounter: (uid, key, value) => declare(GameEventType.Counter, { uid, key, value }),

      setHeat: (value) =>
        declare(GameEventType.Heat, { value: clamp(value, 0, HEAT_MAX) }),

      setResources: (value) =>
        declare(GameEventType.Resource, { value: clamp(value, 0, RESOURCE_MAX) }),

      setPhase: (phase, turn, activePlayerId) =>
        declare(GameEventType.Phase, { phase, turn, activePlayerId }),

      startTurn: (turn, activePlayerId) =>
        declare(GameEventType.TurnStart, {
          turn,
          activePlayerId,
          resourceUid: randomUuid(),
        }),

      linkCard: (childUid, parentUid) => declare(GameEventType.Link, { childUid, parentUid }),

      unlinkCard: (childUid) => declare(GameEventType.Unlink, { childUid }),

      attack: (sourceUid, targetOwnerId, targetUid) =>
        declare(GameEventType.Attack, { sourceUid, targetOwnerId, targetUid }),

      destroyCard: (uid) => declare(GameEventType.Destroy, { uid }),

      spawnToken: (slot) =>
        declare(GameEventType.TokenSpawn, {
          uid: randomUuid(),
          slot,
          def: publicCardDef(TOKEN_DRONE_DEF),
        }),

      removeCard: (uid) => declare(GameEventType.Remove, { uid }),

      concede: (winnerId) =>
        declare(GameEventType.GameOver, { winnerId, reason: 'concede' }),

      rollDice: (sides) =>
        declare(GameEventType.Dice, {
          sides,
          // El resultado lo calcula quien tira, igual que en una mesa real:
          // el servidor no arbitra nada.
          result: 1 + Math.floor(Math.random() * Math.max(2, sides)),
        }),

      resetTable: () => declare(GameEventType.Reset, { at: randomUuid() }),

      sendChat: (message) => clientRef.current?.sendChat(message),

      leaveRoom: () => clientRef.current?.leaveRoom(),

      finishGame: async () => {
        try {
          const response = await api.finishRoom(roomCode);
          setRoom(response.room);
        } catch (error) {
          setLastError({ code: 'INTERNAL_ERROR', message: errorMessage(error) });
        }
      },

      fullResync: () => {
        const client = clientRef.current;
        if (!client) return;
        client.resetSequence();
        setState((current) => seedPlayers(emptyState(), toRoster(current)));
        client.requestSync(0);
      },
    }),
    [api, declare, roomCode],
  );

  const me = userId ? state.players[userId] : undefined;
  const opponent = useMemo(
    () => Object.values(state.players).find((p) => p.userId !== userId),
    [state.players, userId],
  );

  return {
    loading,
    fatalError,
    connection,
    latencyMs,
    lastError,
    room,
    roster,
    state,
    me,
    opponent,
    actions,
  };
}

function toRoster(state: GameState): PlayerView[] {
  return Object.values(state.players).map((p) => ({
    userId: p.userId,
    seat: p.seat,
    connected: p.connected,
    joinedAt: new Date(0).toISOString(),
    lastSeenAt: new Date(0).toISOString(),
    leftAt: p.left ? new Date(0).toISOString() : undefined,
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Motor de estado del juego.
 *
 * El tablero compartido NO se guarda en ningún sitio: es una función pura del
 * log de eventos. Como los dos clientes reciben exactamente los mismos eventos
 * en el mismo orden (lo garantiza la secuencia del backend), los dos llegan al
 * mismo tablero. Eso es lo que hace que reconectar, recargar la página o
 * reiniciar el servidor no pierdan la partida: basta con volver a reproducir.
 *
 * Lo único que NO se reconstruye desde aquí es tu mano y tu mazo, que son
 * información oculta y viven en local (ver hooks/usePrivateDeck.ts).
 */

import {
  GameEventType,
  ServerEventType,
  type CounterData,
  type DiceData,
  type DrawData,
  type FlipData,
  type HeatData,
  type MoveData,
  type PhaseData,
  type PlayData,
  type ResourceData,
  type SetupData,
  type ShuffleData,
  type TapData,
  type ToDeckData,
  type ToHandData,
} from './events';
import {
  CARD_TYPE_LABEL,
  emptyPlayer,
  emptyState,
  HEAT_MAX,
  RESOURCE_MAX,
  ZONE_LABEL,
  type CardInstance,
  type GameState,
  type LogEntry,
  type PlayerState,
  type ZoneId,
} from './types';
import type { WireEvent } from '../realtime/protocol';

const MAX_LOG_ENTRIES = 300;

/** Reproduce una lista de eventos desde cero. */
export function reduceAll(events: WireEvent[], base = emptyState()): GameState {
  return events.reduce((state, event) => applyEvent(state, event), base);
}

/**
 * Aplica un evento al estado. Es pura: devuelve un estado nuevo.
 *
 * Nunca lanza: un evento desconocido o mal formado se registra en el log y se
 * ignora. Un cliente de otra versión no debe poder romper la partida del rival.
 */
export function applyEvent(state: GameState, event: WireEvent): GameState {
  if (event.sequence <= state.lastSequence) return state;

  const next: GameState = { ...state, lastSequence: event.sequence };
  const data = (event.data ?? {}) as Record<string, unknown>;
  const actorId = event.playerId;

  switch (event.type) {
    // --- eventos del servidor ------------------------------------------------
    case ServerEventType.PlayerJoined: {
      const userId = (data.userId as string) ?? actorId;
      if (!userId) break;
      const seat = ((data.seat as number) ?? event.seat ?? 1) as 1 | 2;
      withPlayer(next, userId, seat, (p) => ({ ...p, left: false }));
      pushLog(next, event, `${name(userId)} entró a la sala.`);
      break;
    }

    case ServerEventType.PlayerLeft: {
      const userId = (data.userId as string) ?? actorId;
      if (!userId) break;
      withPlayer(next, userId, (event.seat ?? 1) as 1 | 2, (p) => ({ ...p, left: true }));
      pushLog(next, event, `${name(userId)} abandonó la partida.`);
      break;
    }

    case ServerEventType.RoomStatus: {
      const status = data.status as GameState['status'];
      if (status) next.status = status;
      pushLog(next, event, `La partida pasó a «${status}».`);
      break;
    }

    case ServerEventType.Chat: {
      const message = String(data.message ?? '');
      pushLog(next, event, message, { message });
      break;
    }

    // --- eventos declarados por los jugadores --------------------------------
    case GameEventType.Setup: {
      const d = data as unknown as SetupData;
      if (!actorId) break;
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        deckCount: clamp(d.deckCount ?? 0, 0, 999),
        handCount: 0,
        cards: {},
        heat: 0,
        resourcePoints: 0,
        ready: true,
      }));
      pushLog(next, event, `${name(actorId)} preparó su mazo (${d.deckCount ?? 0} cartas).`);
      break;
    }

    case GameEventType.Draw: {
      const d = data as unknown as DrawData;
      if (!actorId) break;
      const count = clamp(d.count ?? 1, 1, 20);
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        deckCount: Math.max(0, p.deckCount - count),
        handCount: p.handCount + count,
      }));
      pushLog(next, event, `${name(actorId)} robó ${count} carta${count === 1 ? '' : 's'}.`);
      break;
    }

    case GameEventType.Shuffle: {
      const d = data as unknown as ShuffleData;
      if (!actorId) break;
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({
        ...p,
        deckCount: clamp(d.deckCount ?? p.deckCount, 0, 999),
      }));
      pushLog(next, event, `${name(actorId)} barajó su mazo.`);
      break;
    }

    case GameEventType.Play: {
      const d = data as unknown as PlayData;
      if (!actorId || !d?.uid || !d?.def) break;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const card: CardInstance = {
          uid: d.uid,
          def: d.def,
          ownerId: actorId,
          zone: d.to,
          slot: d.slot,
          faceUp: d.faceUp ?? true,
          tapped: false,
          counters: {},
        };
        return {
          ...p,
          cards: { ...p.cards, [d.uid]: card },
          handCount: d.from === 'hand' ? Math.max(0, p.handCount - 1) : p.handCount,
          deckCount: d.from === 'deck' ? Math.max(0, p.deckCount - 1) : p.deckCount,
        };
      });
      pushLog(
        next,
        event,
        d.faceUp === false
          ? `${name(actorId)} colocó una carta boca abajo en ${ZONE_LABEL[d.to]}.`
          : `${name(actorId)} jugó ${d.def.name} (${CARD_TYPE_LABEL[d.def.type]}) en ${ZONE_LABEL[d.to]}.`,
      );
      break;
    }

    case GameEventType.Move: {
      const d = data as unknown as MoveData;
      if (!actorId || !d?.uid) break;
      let moved: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const card = p.cards[d.uid];
        if (!card) return p;
        moved = {
          ...card,
          zone: d.to,
          slot: d.slot,
          faceUp: d.faceUp ?? card.faceUp,
          // Salir de la zona de batalla endereza la carta: es lo que se hace
          // en la mesa real al recoger una nave.
          tapped: d.to === 'battle' ? card.tapped : false,
        };
        return { ...p, cards: { ...p.cards, [d.uid]: moved } };
      });
      if (moved) {
        pushLog(
          next,
          event,
          `${name(actorId)} movió ${cardName(moved)} a ${ZONE_LABEL[d.to]}.`,
        );
      }
      break;
    }

    case GameEventType.ToHand: {
      const d = data as unknown as ToHandData;
      if (!actorId || !d?.uid) break;
      let removed: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        removed = p.cards[d.uid];
        if (!removed) return p;
        const cards = { ...p.cards };
        delete cards[d.uid];
        return { ...p, cards, handCount: p.handCount + 1 };
      });
      if (removed) pushLog(next, event, `${name(actorId)} devolvió ${cardName(removed)} a su mano.`);
      break;
    }

    case GameEventType.ToDeck: {
      const d = data as unknown as ToDeckData;
      if (!actorId || !d?.uid) break;
      let removed: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        removed = p.cards[d.uid];
        if (!removed) return p;
        const cards = { ...p.cards };
        delete cards[d.uid];
        return { ...p, cards, deckCount: p.deckCount + 1 };
      });
      if (removed) pushLog(next, event, `${name(actorId)} devolvió ${cardName(removed)} al mazo.`);
      break;
    }

    case GameEventType.Tap: {
      const d = data as unknown as TapData;
      if (!actorId || !d?.uid) break;
      let card: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const current = p.cards[d.uid];
        if (!current) return p;
        card = { ...current, tapped: Boolean(d.tapped) };
        return { ...p, cards: { ...p.cards, [d.uid]: card } };
      });
      if (card) {
        pushLog(next, event, `${name(actorId)} ${d.tapped ? 'giró' : 'enderezó'} ${cardName(card)}.`);
      }
      break;
    }

    case GameEventType.Flip: {
      const d = data as unknown as FlipData;
      if (!actorId || !d?.uid) break;
      let card: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const current = p.cards[d.uid];
        if (!current) return p;
        card = { ...current, faceUp: Boolean(d.faceUp) };
        return { ...p, cards: { ...p.cards, [d.uid]: card } };
      });
      if (card) {
        pushLog(
          next,
          event,
          `${name(actorId)} puso ${cardName(card)} boca ${d.faceUp ? 'arriba' : 'abajo'}.`,
        );
      }
      break;
    }

    case GameEventType.Counter: {
      const d = data as unknown as CounterData;
      if (!actorId || !d?.uid) break;
      let card: CardInstance | undefined;
      withPlayer(next, actorId, event.seat ?? 1, (p) => {
        const current = p.cards[d.uid];
        if (!current) return p;
        const counters = { ...current.counters };
        const value = clamp(d.value ?? 0, -99, 99);
        if (value === 0) delete counters[d.key];
        else counters[d.key] = value;
        card = { ...current, counters };
        return { ...p, cards: { ...p.cards, [d.uid]: card } };
      });
      if (card) {
        pushLog(next, event, `${name(actorId)} dejó ${cardName(card)} con ${d.key} ${d.value}.`);
      }
      break;
    }

    case GameEventType.Heat: {
      const d = data as unknown as HeatData;
      if (!actorId) break;
      const value = clamp(d.value ?? 0, 0, HEAT_MAX);
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({ ...p, heat: value }));
      pushLog(next, event, `${name(actorId)} fijó su calor en ${value}.`);
      break;
    }

    case GameEventType.Resource: {
      const d = data as unknown as ResourceData;
      if (!actorId) break;
      const value = clamp(d.value ?? 0, 0, RESOURCE_MAX);
      withPlayer(next, actorId, event.seat ?? 1, (p) => ({ ...p, resourcePoints: value }));
      pushLog(next, event, `${name(actorId)} fijó sus puntos de recurso en ${value}.`);
      break;
    }

    case GameEventType.Phase: {
      const d = data as unknown as PhaseData;
      next.phase = d.phase ?? next.phase;
      next.turn = clamp(d.turn ?? next.turn, 1, 999);
      next.activePlayerId = d.activePlayerId ?? next.activePlayerId;
      pushLog(
        next,
        event,
        `Turno ${next.turn} · ${next.phase}${
          next.activePlayerId ? ` · juega ${name(next.activePlayerId)}` : ''
        }.`,
      );
      break;
    }

    case GameEventType.Dice: {
      const d = data as unknown as DiceData;
      pushLog(
        next,
        event,
        `${name(actorId)} tiró 1d${d.sides ?? 6} y sacó ${d.result ?? '?'}.`,
      );
      break;
    }

    case GameEventType.Reset: {
      const players: Record<string, PlayerState> = {};
      for (const [id, p] of Object.entries(next.players)) {
        players[id] = { ...emptyPlayer(id, p.seat), connected: p.connected, left: p.left };
      }
      next.players = players;
      next.turn = 1;
      next.phase = 'Preparación';
      next.activePlayerId = undefined;
      pushLog(next, event, `${name(actorId)} reinició la mesa.`);
      break;
    }

    default:
      // Evento de una versión más nueva del cliente: se anota y se sigue.
      pushLog(next, event, `${name(actorId)} declaró ${event.type}.`);
      break;
  }

  return next;
}

// --- utilidades --------------------------------------------------------------

/** Aplica una transformación al jugador, creándolo si aún no existía. */
function withPlayer(
  state: GameState,
  userId: string,
  seat: 1 | 2,
  update: (player: PlayerState) => PlayerState,
): void {
  const current = state.players[userId] ?? emptyPlayer(userId, seat);
  state.players = { ...state.players, [userId]: update(current) };
}

function pushLog(
  state: GameState,
  event: WireEvent,
  text: string,
  chat?: LogEntry['chat'],
): void {
  const entry: LogEntry = {
    sequence: event.sequence,
    playerId: event.playerId,
    type: event.type,
    text,
    at: event.createdAt,
    chat,
  };
  const log = [...state.log, entry];
  state.log = log.length > MAX_LOG_ENTRIES ? log.slice(log.length - MAX_LOG_ENTRIES) : log;
}

function cardName(card: CardInstance): string {
  return card.faceUp ? card.def.name : 'una carta boca abajo';
}

/** Nombre corto y estable a partir del id; la UI lo sustituye por el real. */
function name(userId?: string): string {
  if (!userId) return 'El sistema';
  return `Piloto-${userId.slice(0, 4).toUpperCase()}`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Presencia en vivo: no viene del log, se aplica encima. */
export function applyPresence(
  state: GameState,
  userId: string,
  seat: 1 | 2,
  connected: boolean,
): GameState {
  const next = { ...state };
  withPlayer(next, userId, seat, (p) => ({ ...p, connected }));
  return next;
}

/** Siembra los jugadores conocidos por el servidor al entrar en la sala. */
export function seedPlayers(
  state: GameState,
  roster: { userId: string; seat: 1 | 2; connected: boolean; leftAt?: string }[],
): GameState {
  const next = { ...state };
  for (const entry of roster) {
    withPlayer(next, entry.userId, entry.seat, (p) => ({
      ...p,
      seat: entry.seat,
      connected: entry.connected,
      left: Boolean(entry.leftAt),
    }));
  }
  return next;
}

export function zoneCount(player: PlayerState | undefined, zone: ZoneId): number {
  if (!player) return 0;
  if (zone === 'deck') return player.deckCount;
  if (zone === 'hand') return player.handCount;
  return Object.values(player.cards).filter((card) => card.zone === zone).length;
}

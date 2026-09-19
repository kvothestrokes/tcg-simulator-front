/**
 * Eventos declarativos del juego.
 *
 * Cada uno es una frase del tipo "el jugador dice que hace esto". El servidor
 * los guarda en `game_events` y los retransmite sin interpretarlos: aquí no hay
 * validación de reglas, ni daño, ni resolución de efectos.
 *
 * Los nombres cumplen el formato que exige el backend ([A-Z0-9_.], máx. 64) y
 * evitan los cuatro tipos que él se reserva (CHAT_MESSAGE, PLAYER_JOINED,
 * PLAYER_LEFT, ROOM_STATUS_CHANGED).
 */

import type { CardDef, ZoneId } from './types';

export const GameEventType = {
  /** El jugador declara su mazo listo. Fija el contador de cartas. */
  Setup: 'SETUP',
  /** Roba del mazo a la mano. No revela nada: solo mueve contadores. */
  Draw: 'DRAW',
  /** Baja una carta a una zona pública. Aquí SÍ se revela la carta. */
  Play: 'PLAY',
  /** Mueve una carta ya visible entre zonas públicas. */
  Move: 'MOVE',
  /** Devuelve una carta visible a la mano: vuelve a ser información oculta. */
  ToHand: 'TO_HAND',
  /** Devuelve una carta visible al mazo. */
  ToDeck: 'TO_DECK',
  Tap: 'TAP',
  Flip: 'FLIP',
  Counter: 'COUNTER',
  /** Fija el calor declarado del jugador. */
  Heat: 'HEAT',
  /** Fija los puntos de recurso declarados. */
  Resource: 'RESOURCE',
  /** Cambio de fase dentro del turno (Activación / Principal / Final). */
  Phase: 'PHASE',
  /** Inicio de turno: robo, recurso compartido y refrigeración. */
  TurnStart: 'TURN_START',
  /** Enlaza un piloto o gear a una nave. */
  Link: 'LINK',
  Unlink: 'UNLINK',
  /** Ataque de una nave a otra nave o a la estación. */
  Attack: 'ATTACK',
  /** Destruye una nave y aplica desenganche (piloto eyecta, gears a recursos). */
  Destroy: 'DESTROY',
  /** Convoca un token a una ranura de batalla. */
  TokenSpawn: 'TOKEN_SPAWN',
  /** Retira un token de la partida (nunca al descarte). */
  Remove: 'REMOVE',
  GameOver: 'GAME_OVER',
  Dice: 'DICE',
  Shuffle: 'SHUFFLE',
  /** Vacía el tablero para empezar otra partida en la misma sala. */
  Reset: 'RESET',
} as const;

export type GameEventName = (typeof GameEventType)[keyof typeof GameEventType];

/** Tipos que genera el servidor y que el cliente solo lee. */
export const ServerEventType = {
  PlayerJoined: 'PLAYER_JOINED',
  PlayerLeft: 'PLAYER_LEFT',
  RoomStatus: 'ROOM_STATUS_CHANGED',
  Chat: 'CHAT_MESSAGE',
} as const;

// --- formas de los payloads --------------------------------------------------

export interface SetupData {
  deckCount: number;
  deckName?: string;
  /** Estación inicial revelada en zona pública; no cuenta como carta del mazo. */
  station?: CardDef;
}

export interface DrawData {
  count: number;
}

export interface PlayData {
  uid: string;
  def: CardDef;
  from: ZoneId;
  to: ZoneId;
  slot?: number;
  faceUp: boolean;
  attachedTo?: string;
  isToken?: boolean;
}

export interface MoveData {
  uid: string;
  from: ZoneId;
  to: ZoneId;
  slot?: number;
  faceUp?: boolean;
  attachedTo?: string | null;
}

export interface ToHandData {
  uid: string;
  from: ZoneId;
}

export interface ToDeckData {
  uid: string;
  from: ZoneId;
  position: 'top' | 'bottom' | 'shuffle';
}

export interface TapData {
  uid: string;
  tapped: boolean;
}

export interface FlipData {
  uid: string;
  faceUp: boolean;
}

export interface CounterData {
  uid: string;
  key: string;
  value: number;
}

export interface HeatData {
  value: number;
}

export interface ResourceData {
  value: number;
}

export interface PhaseData {
  phase: string;
  turn: number;
  activePlayerId?: string;
}

export interface TurnStartData {
  turn: number;
  activePlayerId: string;
  /** Uid de la carta de recurso que sale del mazo compartido (si queda). */
  resourceUid?: string;
}

export interface LinkData {
  childUid: string;
  parentUid: string;
}

export interface UnlinkData {
  childUid: string;
}

export interface AttackData {
  sourceUid: string;
  targetOwnerId: string;
  targetUid: string;
}

export interface DestroyData {
  uid: string;
}

export interface TokenSpawnData {
  uid: string;
  slot: number;
  def: CardDef;
}

export interface RemoveData {
  uid: string;
}

export interface GameOverData {
  winnerId: string;
  reason: 'deck_out' | 'station' | 'concede';
  loserId?: string;
}

export interface DiceData {
  sides: number;
  result: number;
}

export interface ShuffleData {
  deckCount: number;
}

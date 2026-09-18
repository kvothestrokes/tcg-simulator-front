/**
 * Tipos del juego.
 *
 * IMPORTANTE: todo esto vive en el cliente. El servidor no conoce ni una sola
 * de estas reglas — guarda y retransmite declaraciones, nada más. Si mañana
 * cambias las cartas o las zonas, el backend no se entera.
 */

/** Zonas del tablero, tal cual el wireframe (más mano y mazo, que son privadas). */
export type ZoneId =
  | 'station' // Estación Espacial
  | 'battle' // Zona de Batalla
  | 'pilots' // Área de Pilotos (3 huecos)
  | 'resources' // Zona de Recursos
  | 'void' // Vacío (pila de descarte)
  | 'deck' // Mazo (privado)
  | 'hand'; // Mano (privada)

/** Zonas cuyo contenido solo conoce su dueño. */
export const PRIVATE_ZONES: ZoneId[] = ['deck', 'hand'];

/** Zonas visibles para los dos jugadores. */
export const PUBLIC_ZONES: ZoneId[] = ['station', 'battle', 'pilots', 'resources', 'void'];

export const ZONE_LABEL: Record<ZoneId, string> = {
  station: 'Estación Espacial',
  battle: 'Zona de Batalla',
  pilots: 'Área de Pilotos',
  resources: 'Zona de Recursos',
  void: 'Vacío',
  deck: 'Mazo',
  hand: 'Mano',
};

export type CardType = 'Nave' | 'Orden' | 'Piloto' | 'Gear' | 'Estación';

export type FactionId =
  | 'Imperio Galáctico'
  | 'Piratas'
  | 'Xeno'
  | 'CyberPunk'
  | 'IA'
  | 'SteamPunk'
  | 'Neutral';

export interface FactionTheme {
  id: FactionId;
  short: string;
  primary: string;
  accent: string;
  ink: string;
  border: string;
  glow: string;
  bgFrom: string;
  bgTo: string;
  artFrom: string;
  artTo: string;
  pattern: 'grid' | 'scan' | 'organic' | 'neon' | 'geometric' | 'gears' | 'stars';
}

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  Nave: 'Nave',
  Orden: 'Orden',
  Piloto: 'Piloto',
  Gear: 'Gear',
  Estación: 'Estación',
};

/**
 * Contrato compartido con Card Forger.
 * `notas_diseno` es metadato interno: nunca se pinta en frame, inspector ni tooltips.
 */
export interface CardDef {
  id: string;
  nombre: string;
  tipo: CardType;
  faccion: string;
  coste_recursos: number;
  coste_heat: number;
  rol?: string;
  ataque?: number;
  escudo?: number;
  espacios_gear?: number;
  chatarra_al_morir?: number;
  palabras_clave?: string[];
  texto_efecto?: string;
  subtipo?: string;
  momento_juego?: string;
  requisito_enlace?: string;
  bono_al_enlazar?: string;
  bono_sin_enlazar?: string;
  espacios_ocupa?: number;
  restriccion_equipamiento?: string;
  modificador_ataque?: number;
  modificador_escudo?: number;
  hp?: number;
  hp_max?: number;
  heat_actual?: number;
  heat_umbral?: number;
  rareza: string;
  numero_coleccion: string;
  autor: string;
  artwork_url?: string;
  notas_diseno?: string;
}

/**
 * Carta en juego.
 *
 * `uid` identifica la copia concreta; `def` viaja en el evento que la revela,
 * así que el rival puede dibujarla aunque no tenga tu catálogo.
 */
export interface CardInstance {
  uid: string;
  def: CardDef;
  ownerId: string;
  zone: ZoneId;
  /** Hueco 0-2 dentro del Área de Pilotos. */
  slot?: number;
  faceUp: boolean;
  tapped: boolean;
  counters: Record<string, number>;
}

/** Estado compartido de un jugador. Se reconstruye entero desde el log. */
export interface PlayerState {
  userId: string;
  seat: 1 | 2;
  connected: boolean;
  left: boolean;
  /** Cartas visibles en zonas públicas. */
  cards: Record<string, CardInstance>;
  /** Contadores derivados de los eventos: nadie ve el contenido real. */
  deckCount: number;
  handCount: number;
  heat: number;
  resourcePoints: number;
  ready: boolean;
}

export interface LogEntry {
  sequence: number;
  playerId?: string;
  type: string;
  text: string;
  at: string;
  /** Los mensajes de chat se pintan distinto. */
  chat?: { message: string };
}

export interface GameState {
  players: Record<string, PlayerState>;
  /** Turno declarado por los jugadores; el servidor no lo impone. */
  activePlayerId?: string;
  turn: number;
  phase: string;
  status: 'waiting' | 'active' | 'finished' | 'abandoned';
  log: LogEntry[];
  lastSequence: number;
}

/** Calor máximo del medidor y umbral de sobrecalentamiento. */
export const HEAT_MAX = 12;
export const HEAT_THRESHOLD = 8;

export const RESOURCE_MAX = 12;

export const PILOT_SLOTS = 3;

export const PHASES = ['Preparación', 'Recursos', 'Despliegue', 'Combate', 'Fin'] as const;
export type Phase = (typeof PHASES)[number];

export function emptyPlayer(userId: string, seat: 1 | 2): PlayerState {
  return {
    userId,
    seat,
    connected: false,
    left: false,
    cards: {},
    deckCount: 0,
    handCount: 0,
    heat: 0,
    resourcePoints: 0,
    ready: false,
  };
}

export function emptyState(): GameState {
  return {
    players: {},
    turn: 1,
    phase: 'Preparación',
    status: 'waiting',
    log: [],
    lastSequence: 0,
  };
}

/** Cartas de un jugador en una zona, ordenadas por hueco. */
export function cardsInZone(player: PlayerState | undefined, zone: ZoneId): CardInstance[] {
  if (!player) return [];
  return Object.values(player.cards)
    .filter((card) => card.zone === zone)
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || a.uid.localeCompare(b.uid));
}

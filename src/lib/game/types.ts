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

export type CardType = 'nave' | 'piloto' | 'modulo' | 'tactica';

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  nave: 'Nave',
  piloto: 'Piloto',
  modulo: 'Módulo',
  tactica: 'Táctica',
};

export type FactionId = 'orion' | 'vega' | 'kepler' | 'nomada';

export interface Faction {
  id: FactionId;
  name: string;
  /** Color de la franja lateral de la carta. */
  color: string;
}

export const FACTIONS: Record<FactionId, Faction> = {
  orion: { id: 'orion', name: 'Consorcio Orión', color: '#67e8f9' },
  vega: { id: 'vega', name: 'Flota Vega', color: '#fb923c' },
  kepler: { id: 'kepler', name: 'Cónclave Kepler', color: '#c084fc' },
  nomada: { id: 'nomada', name: 'Nómadas', color: '#4ade80' },
};

/** Definición de carta del catálogo. */
export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  faction: FactionId;
  cost: number;
  /** Poder de ataque. Solo informativo: el servidor no calcula combate. */
  power?: number;
  /** Integridad / resistencia. También informativa. */
  integrity?: number;
  /** Calor que el jugador declara al usarla. Nadie lo aplica automáticamente. */
  heat?: number;
  text: string;
  keywords?: string[];
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

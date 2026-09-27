/**
 * Resolvers puros del reglamento 2.4.
 *
 * No emiten eventos ni tocan I/O: reciben estado/cartas y devuelven el
 * siguiente valor. El reducer los aplica; la UI los usa para pintar ATK/DEF
 * efectivo y decidir destinos legales.
 */

import {
  BATTLE_SLOTS,
  DAMAGE_COUNTER,
  GEAR_MAX_PER_SHIP,
  HEAT_MAX,
  REVEAL_MAX,
  cardsInZone,
  type CardDef,
  type CardInstance,
  type GameState,
  type PlayerState,
  type ZoneId,
} from './types';

export const SHARED_RESOURCE_DEF: CardDef = {
  id: 'res_shared',
  nombre: 'Célula de Recurso',
  tipo: 'Orden',
  subtipo: 'Recurso',
  faccion: 'Neutral',
  coste_recursos: 0,
  coste_heat: 0,
  rareza: 'Común',
  numero_coleccion: 'RES-001',
  autor: '',
  texto_efecto: 'Vertical: lista para gastarse. Horizontal: agotada.',
};

export const TOKEN_DRONE_DEF: CardDef = {
  id: 'token_drone',
  nombre: 'Dron Token',
  tipo: 'Nave',
  rol: 'Token',
  faccion: 'Neutral',
  coste_recursos: 0,
  coste_heat: 0,
  ataque: 10,
  escudo: 10,
  espacios_gear: 0,
  rareza: 'Común',
  numero_coleccion: 'TKN-001',
  autor: '',
  texto_efecto: 'Unidad token. Si sale de batalla, se retira de la partida.',
};

export function isRootShip(card: CardInstance): boolean {
  return card.zone === 'battle' && card.def.tipo === 'Nave' && !card.attachedTo;
}

export function attachedTo(player: PlayerState | undefined, parentUid: string): CardInstance[] {
  if (!player) return [];
  return Object.values(player.cards)
    .filter((card) => card.attachedTo === parentUid)
    .sort((a, b) => a.uid.localeCompare(b.uid));
}

export function shipPilot(player: PlayerState | undefined, shipUid: string): CardInstance | undefined {
  return attachedTo(player, shipUid).find((card) => card.def.tipo === 'Piloto');
}

export function shipGears(player: PlayerState | undefined, shipUid: string): CardInstance[] {
  return attachedTo(player, shipUid).filter((card) => card.def.tipo === 'Gear');
}

export function shipInSlot(player: PlayerState | undefined, slot: number): CardInstance | undefined {
  return cardsInZone(player, 'battle').find((card) => isRootShip(card) && card.slot === slot);
}

export function firstEmptyBattleSlot(player: PlayerState | undefined): number | undefined {
  for (let slot = 0; slot < BATTLE_SLOTS; slot++) {
    if (!shipInSlot(player, slot)) return slot;
  }
  return undefined;
}

export function readyResources(player: PlayerState | undefined): CardInstance[] {
  return cardsInZone(player, 'resources').filter((card) => !card.tapped);
}

export function parseStatBonus(text: string | undefined): { atk: number; def: number } {
  if (!text) return { atk: 0, def: 0 };
  const atk = text.match(/\+(\d+)\s*(?:de\s*)?Ataque/i);
  const def = text.match(/\+(\d+)\s*(?:de\s*)?(?:Escudo|DEF|Resistencia)/i);
  return {
    atk: atk ? Number(atk[1]) : 0,
    def: def ? Number(def[1]) : 0,
  };
}

export function effectiveAttack(player: PlayerState | undefined, ship: CardInstance): number {
  let atk = ship.def.ataque ?? 0;
  const pilot = shipPilot(player, ship.uid);
  if (pilot) atk += parseStatBonus(pilot.def.bono_al_enlazar).atk;
  for (const gear of shipGears(player, ship.uid)) {
    atk += gear.def.modificador_ataque ?? 0;
  }
  return atk;
}

export function effectiveDefense(player: PlayerState | undefined, ship: CardInstance): number {
  let def = ship.def.escudo ?? 0;
  const pilot = shipPilot(player, ship.uid);
  if (pilot) def += parseStatBonus(pilot.def.bono_al_enlazar).def;
  for (const gear of shipGears(player, ship.uid)) {
    def += gear.def.modificador_escudo ?? 0;
  }
  return def;
}

export function damageOn(card: CardInstance): number {
  return card.counters[DAMAGE_COUNTER] ?? 0;
}

export function stationHp(station: CardInstance): number {
  return station.def.hp ?? station.def.hp_max ?? 0;
}

export function canLinkTo(player: PlayerState | undefined, parent: CardInstance, child: CardInstance): boolean {
  if (!isRootShip(parent)) return false;
  if (child.uid === parent.uid) return false;
  if (child.def.tipo === 'Piloto') return !shipPilot(player, parent.uid);
  if (child.def.tipo === 'Gear') return shipGears(player, parent.uid).length < GEAR_MAX_PER_SHIP;
  return false;
}

export function findCardAcross(
  players: Record<string, PlayerState>,
  uid: string,
): { player: PlayerState; card: CardInstance } | undefined {
  for (const player of Object.values(players)) {
    const card = player.cards[uid];
    if (card) return { player, card };
  }
  return undefined;
}

// --- costs -------------------------------------------------------------------

/** Board zones where a card played from hand pays its cost. */
export const COST_ZONES: readonly ZoneId[] = ['battle', 'pilots', 'station'];

/**
 * Whether a play pays its cost: only hand → battle / pilots / station, and
 * never tokens. Resources and the void are free.
 */
export function playPaysCost(input: { from: ZoneId; to: ZoneId; isToken?: boolean }): boolean {
  return input.from === 'hand' && !input.isToken && COST_ZONES.includes(input.to);
}

function resourceCost(def: CardDef): number {
  return Math.max(0, Math.round(Number(def.coste_recursos) || 0));
}

function heatCost(def: CardDef): number {
  return Math.max(0, Math.round(Number(def.coste_heat) || 0));
}

/** Spanish reason when the player cannot pay `def`, otherwise null. */
export function costBlock(player: PlayerState | undefined, def: CardDef): string | null {
  const needed = resourceCost(def);
  const ready = readyResources(player).length;
  if (ready >= needed) return null;
  return `Faltan recursos: necesitas ${needed} y tienes ${ready} listo${ready === 1 ? '' : 's'}.`;
}

/**
 * Pays `def`: taps exactly `coste_recursos` ready resources (slot, then uid
 * order, so both clients tap the same cards) and adds `coste_heat`, clamped at
 * HEAT_MAX. The caller must check `costBlock` first.
 */
export function payCost(player: PlayerState, def: CardDef): PlayerState {
  const cards = { ...player.cards };
  for (const card of readyResources(player).slice(0, resourceCost(def))) {
    cards[card.uid] = { ...card, tapped: true };
  }
  return { ...player, cards, heat: Math.min(HEAT_MAX, Math.max(0, player.heat + heatCost(def))) };
}

// --- deck actions --------------------------------------------------------------

export type DeckAction = 'extraDraw' | 'reveal' | 'mill' | 'recycle';

/** Same convention as the UI: before the first turn nobody holds the initiative. */
export function isPlayersTurn(state: GameState, userId: string | undefined): boolean {
  if (!userId) return false;
  return !state.activePlayerId || state.activePlayerId === userId;
}

/**
 * Spanish reason why `userId` cannot run a deck action right now, or null.
 * Shared by the reducer (to reject) and the UI (to disable with a tooltip).
 */
export function deckActionBlock(
  state: GameState,
  userId: string | undefined,
  action: DeckAction,
  count = 1,
): string | null {
  const player = userId ? state.players[userId] : undefined;
  if (!player) return 'Aún no estás en la mesa.';
  if (!isPlayersTurn(state, userId)) return 'Solo en tu turno.';
  if (player.deckCount <= 0) return 'Tu mazo está vacío.';
  if (action === 'extraDraw') {
    if (player.lastExtraDrawTurn === state.turn) return 'Ya usaste el Robo Extra este turno.';
    if (player.heat >= HEAT_MAX) return 'Calor al máximo.';
  }
  if (action === 'reveal') {
    if (!Number.isInteger(count) || count < 1 || count > REVEAL_MAX) {
      return `Puedes revelar entre 1 y ${REVEAL_MAX} cartas.`;
    }
    if (count > player.deckCount) return 'No quedan tantas cartas en el mazo.';
  }
  return null;
}

/** Recycle: Ships and Gears become resources; everything else goes to the void. */
export function recycleDestination(def: CardDef): 'resources' | 'void' {
  return def.tipo === 'Nave' || def.tipo === 'Gear' ? 'resources' : 'void';
}

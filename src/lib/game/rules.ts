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
  cardsInZone,
  type CardDef,
  type CardInstance,
  type PlayerState,
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

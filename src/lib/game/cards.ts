/**
 * Catálogo de ejemplo.
 *
 * Existe para que el simulador se pueda jugar hoy. Cuando tengas las cartas
 * reales (en Supabase o servidas por el backend), sustituye `loadCatalog` por
 * la llamada correspondiente: es el único punto que hay que tocar, porque el
 * resto de la app solo conoce el tipo `CardDef`.
 */

import type { CardDef } from './types';

export const SAMPLE_CATALOG: CardDef[] = [
  {
    id: 'orn-001',
    name: 'Corbeta Aguja',
    type: 'nave',
    faction: 'orion',
    cost: 1,
    power: 2,
    integrity: 2,
    heat: 1,
    text: 'Puede atacar el turno en que se despliega.',
    keywords: ['Rápida'],
  },
  {
    id: 'orn-002',
    name: 'Crucero Meridiano',
    type: 'nave',
    faction: 'orion',
    cost: 3,
    power: 4,
    integrity: 5,
    heat: 2,
    text: 'Mientras tenga un piloto asignado, ignora el primer daño de cada turno.',
    keywords: ['Blindaje'],
  },
  {
    id: 'orn-003',
    name: 'Kira Solano',
    type: 'piloto',
    faction: 'orion',
    cost: 2,
    power: 1,
    text: 'La nave que pilota gana +2 de poder.',
    keywords: ['As'],
  },
  {
    id: 'orn-004',
    name: 'Dique Seco Orbital',
    type: 'modulo',
    faction: 'orion',
    cost: 2,
    text: 'Al comienzo de tu turno, reduce tu calor en 1.',
    keywords: ['Refrigeración'],
  },
  {
    id: 'veg-001',
    name: 'Cañonera Yunque',
    type: 'nave',
    faction: 'vega',
    cost: 2,
    power: 3,
    integrity: 3,
    heat: 2,
    text: 'Al atacar, declara +1 de calor para golpear dos veces.',
    keywords: ['Sobrecarga'],
  },
  {
    id: 'veg-002',
    name: 'Acorazado Fragua',
    type: 'nave',
    faction: 'vega',
    cost: 5,
    power: 7,
    integrity: 7,
    heat: 4,
    text: 'No puede ser bloqueado por naves de coste 2 o menos.',
    keywords: ['Imponente'],
  },
  {
    id: 'veg-003',
    name: 'Bruna Tejada',
    type: 'piloto',
    faction: 'vega',
    cost: 3,
    power: 2,
    text: 'Su nave puede atacar aunque esté girada.',
    keywords: ['Veterana'],
  },
  {
    id: 'veg-004',
    name: 'Descarga Térmica',
    type: 'tactica',
    faction: 'vega',
    cost: 1,
    text: 'Reduce tu calor en 3. Solo en tu turno.',
    keywords: ['Instantánea'],
  },
  {
    id: 'kep-001',
    name: 'Sonda Espejo',
    type: 'nave',
    faction: 'kepler',
    cost: 1,
    power: 0,
    integrity: 3,
    text: 'Mientras esté en juego, mira la primera carta que robe tu rival.',
    keywords: ['Vigía'],
  },
  {
    id: 'kep-002',
    name: 'Tejedora de Vacío',
    type: 'nave',
    faction: 'kepler',
    cost: 4,
    power: 3,
    integrity: 4,
    heat: 2,
    text: 'Al desplegarse, devuelve una carta del Vacío a tu mano.',
    keywords: ['Eco'],
  },
  {
    id: 'kep-003',
    name: 'Archivista Vel',
    type: 'piloto',
    faction: 'kepler',
    cost: 2,
    power: 1,
    text: 'Cuando su nave sea destruida, roba una carta.',
    keywords: ['Memoria'],
  },
  {
    id: 'kep-004',
    name: 'Colapso Gravitatorio',
    type: 'tactica',
    faction: 'kepler',
    cost: 3,
    text: 'Devuelve una nave desplegada a la mano de su dueño.',
    keywords: ['Instantánea'],
  },
  {
    id: 'nom-001',
    name: 'Chatarrero Errante',
    type: 'nave',
    faction: 'nomada',
    cost: 2,
    power: 2,
    integrity: 2,
    heat: 1,
    text: 'Cuando destruya una nave, gana 1 punto de recurso.',
    keywords: ['Carroñero'],
  },
  {
    id: 'nom-002',
    name: 'Remolcador Ancla',
    type: 'nave',
    faction: 'nomada',
    cost: 3,
    power: 1,
    integrity: 6,
    text: 'Las naves rivales deben atacarla a ella si pueden.',
    keywords: ['Provocación'],
  },
  {
    id: 'nom-003',
    name: 'Mercado Flotante',
    type: 'modulo',
    faction: 'nomada',
    cost: 2,
    text: 'Una vez por turno: descarta una carta para ganar 1 punto de recurso.',
    keywords: ['Trueque'],
  },
  {
    id: 'nom-004',
    name: 'Ruta de Contrabando',
    type: 'tactica',
    faction: 'nomada',
    cost: 1,
    text: 'Roba dos cartas y descarta una.',
    keywords: ['Instantánea'],
  },
];

const CATALOG_BY_ID = new Map(SAMPLE_CATALOG.map((card) => [card.id, card]));

export function findCard(id: string): CardDef | undefined {
  return CATALOG_BY_ID.get(id);
}

/**
 * Punto único de integración con las cartas reales.
 *
 * Hoy devuelve el catálogo de ejemplo. Para conectar Supabase, cambia el cuerpo
 * por la consulta y deja la firma igual: ningún componente cambia.
 */
export async function loadCatalog(): Promise<CardDef[]> {
  return SAMPLE_CATALOG;
}

/** Mazo de ejemplo: 30 cartas, dos copias de cada definición salvo las caras. */
export function buildStarterDeck(): string[] {
  const deck: string[] = [];
  for (const card of SAMPLE_CATALOG) {
    // Las cartas de coste alto van en menor cantidad; es un mazo de muestra,
    // no una lista competitiva.
    const copies = card.cost >= 4 ? 1 : 2;
    for (let i = 0; i < copies; i++) deck.push(card.id);
  }
  // Se completa hasta 30 con las cartas baratas.
  const cheap = SAMPLE_CATALOG.filter((c) => c.cost <= 2).map((c) => c.id);
  let i = 0;
  while (deck.length < 30 && cheap.length > 0) {
    deck.push(cheap[i % cheap.length]!);
    i++;
  }
  return deck.slice(0, 30);
}

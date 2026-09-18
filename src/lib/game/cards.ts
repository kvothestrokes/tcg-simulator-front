/**
 * Card catalog — sample data and Supabase-backed loading.
 *
 * SAMPLE_CATALOG is the offline fallback. When SUPABASE_ENABLED is true,
 * loadCatalog fetches from the `cards` table and populates CATALOG_BY_ID.
 *
 * Call hydrateCatalog() once at app entry so CATALOG_BY_ID is never empty
 * when the synchronous engine helpers (findCard, buildStarterDeck) run.
 */

import type { CardDef } from './types';
import { HEAT_THRESHOLD } from './types';
import { SUPABASE_ENABLED } from '../config';
import { cardRowToDef } from '../decks/mappers';

export const SAMPLE_CATALOG: CardDef[] = [
  {
    id: 'cp_001',
    nombre: 'Dron Desechable',
    tipo: 'Nave',
    rol: 'Caza',
    faccion: 'CyberPunk',
    coste_recursos: 1,
    coste_heat: 0,
    ataque: 10,
    escudo: 10,
    espacios_gear: 0,
    palabras_clave: ['Reactor frío', 'Kamikaze'],
    texto_efecto: 'Al ser destruida, genera 1 chatarra adicional.',
    chatarra_al_morir: 2,
    rareza: 'Común',
    numero_coleccion: 'CP-001',
    autor: '',
    notas_diseno: 'Coste de Heat 0: permite turnos de muchas acciones. Motor de chatarra base.',
  },
  {
    id: 'cp_008',
    nombre: 'Mercado Negro',
    tipo: 'Orden',
    subtipo: 'Instantánea',
    faccion: 'CyberPunk',
    coste_recursos: 1,
    coste_heat: 1,
    momento_juego: 'Tu turno',
    palabras_clave: [],
    texto_efecto:
      'Busca en tu mazo 1 Nave de coste 2 o menos, añádela a tu mano y baraja. Generas 1 chatarra.',
    rareza: 'Común',
    numero_coleccion: 'CP-008',
    autor: '',
    notas_diseno: 'BUSCADOR/tutor barato. Arranca el motor cuando la mano es mala.',
  },
  {
    id: 'cp_012',
    nombre: 'Kaze, Piloto de Desguace',
    tipo: 'Piloto',
    faccion: 'CyberPunk',
    coste_recursos: 2,
    coste_heat: 1,
    requisito_enlace: 'Nave con rol Caza',
    bono_al_enlazar: '+10 de Ataque y gana Ráfaga.',
    bono_sin_enlazar: 'Tus Naves generan 1 chatarra adicional al ser destruidas.',
    palabras_clave: [],
    rareza: 'Rara',
    numero_coleccion: 'CP-012',
    autor: '',
    notas_diseno: 'Flexible: agresivo enlazado, motor si no. Ráfaga premia el combate mutuo.',
  },
  {
    id: 'cp_014',
    nombre: 'Blindaje Reciclado',
    tipo: 'Gear',
    faccion: 'CyberPunk',
    coste_recursos: 1,
    coste_heat: 0,
    espacios_ocupa: 1,
    restriccion_equipamiento: 'Cualquier Nave',
    modificador_ataque: 0,
    modificador_escudo: 20,
    palabras_clave: ['Reactor frío'],
    texto_efecto:
      'La Nave equipada gana +20 de Escudo. Al ser destruido este Gear, generas 1 chatarra.',
    rareza: 'Común',
    numero_coleccion: 'CP-014',
    autor: '',
    notas_diseno: 'Sube un Caza de 10 a 30 de Escudo y sobrevive al combate mutuo.',
  },
  {
    id: 'cp_stn_k9',
    nombre: 'Estación Chatarrera K-9',
    tipo: 'Estación',
    rol: 'Base',
    faccion: 'CyberPunk',
    coste_recursos: 0,
    coste_heat: 0,
    hp: 20,
    hp_max: 20,
    heat_actual: 0,
    heat_umbral: HEAT_THRESHOLD,
    texto_efecto: 'Descarta 3 de chatarra para curar 1 a la estación.',
    rareza: 'Común',
    numero_coleccion: 'CP-STN',
    autor: '',
  },
];

// Mutable cache — populated from SAMPLE_CATALOG at module load;
// replaced by DB rows after hydrateCatalog() resolves.
const CATALOG_BY_ID = new Map<string, CardDef>(SAMPLE_CATALOG.map((card) => [card.id, card]));

export function findCard(id: string): CardDef | undefined {
  return CATALOG_BY_ID.get(id);
}

export function getStarterStation(): CardDef {
  const station = SAMPLE_CATALOG.find((card) => card.tipo === 'Estación');
  if (!station) throw new Error('El catálogo no define una estación inicial.');
  return publicCardDef(station);
}

/** Quita metadatos que no deben viajar en eventos ni pintarse. */
export function publicCardDef(def: CardDef): CardDef {
  const { notas_diseno: _notes, ...rest } = def;
  return rest;
}

export function playableCatalog(): CardDef[] {
  return SAMPLE_CATALOG.filter((card) => card.tipo !== 'Estación');
}

/**
 * Load the card catalog.
 *
 * When SUPABASE_ENABLED is true, fetches from the `cards` table and populates
 * CATALOG_BY_ID. On error or when disabled, falls back to SAMPLE_CATALOG.
 *
 * This is the single integration seam — no other file needs to change when
 * the data source changes.
 */
export async function loadCatalog(): Promise<CardDef[]> {
  if (!SUPABASE_ENABLED) {
    return SAMPLE_CATALOG;
  }

  try {
    const { supabase } = await import('../session');
    const client = await supabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.from('cards') as any).select('*') as {
      data: unknown[] | null;
      error: unknown;
    };

    if (error || !data || data.length === 0) {
      return SAMPLE_CATALOG;
    }

    const defs = (data as Parameters<typeof cardRowToDef>[0][]).map(cardRowToDef);

    // Populate the synchronous cache
    CATALOG_BY_ID.clear();
    for (const def of defs) {
      CATALOG_BY_ID.set(def.id, def);
    }

    return defs;
  } catch {
    return SAMPLE_CATALOG;
  }
}

let hydrated = false;

/**
 * Hydrate CATALOG_BY_ID from the DB exactly once.
 *
 * Call this at app entry (e.g., DecksPanel mount) so findCard() and
 * buildStarterDeck() never operate on an empty cache.
 * Subsequent calls are no-ops.
 */
export async function hydrateCatalog(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  await loadCatalog();
}

/** Mazo de ejemplo: 30 cartas jugables, sin la estación (se coloca en SETUP). */
export function buildStarterDeck(): string[] {
  const playable = playableCatalog();
  const deck: string[] = [];
  let i = 0;
  while (deck.length < 30 && playable.length > 0) {
    deck.push(playable[i % playable.length]!.id);
    i++;
  }
  return deck;
}

export function stationUid(ownerId: string): string {
  return `station:${ownerId}`;
}

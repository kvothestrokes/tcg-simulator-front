/**
 * Catalog view for the deck builder: filter by type and text, then sort.
 *
 * Pure: never mutates the input. Ties (and cards without the sorted stat, such
 * as ATK/DEF on non-ships) fall back to name then id, and cards without the
 * stat always go last regardless of direction.
 */

import type { CardDef, CardType } from '../game/types';

export type CatalogSortKey = 'nombre' | 'coste_recursos' | 'coste_heat' | 'ataque' | 'escudo';
export type SortDirection = 'asc' | 'desc';

export interface CatalogViewOptions {
  type?: CardType | 'all';
  query?: string;
  sortKey?: CatalogSortKey;
  direction?: SortDirection;
}

/** Spanish labels for the sort control (in-game UI copy). */
export const SORT_LABEL: Record<CatalogSortKey, string> = {
  nombre: 'Nombre',
  coste_recursos: 'Coste',
  coste_heat: 'Calor',
  ataque: 'ATK',
  escudo: 'DEF',
};

function byName(a: CardDef, b: CardDef): number {
  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
}

function statOf(card: CardDef, key: Exclude<CatalogSortKey, 'nombre'>): number | undefined {
  if ((key === 'ataque' || key === 'escudo') && card.tipo !== 'Nave') return undefined;
  const value = Number(card[key]);
  return Number.isFinite(value) ? value : undefined;
}

export function viewCatalog(cards: readonly CardDef[], options: CatalogViewOptions): CardDef[] {
  const { type = 'all', sortKey = 'nombre', direction = 'asc' } = options;
  const query = options.query?.trim().toLowerCase() ?? '';
  const sign = direction === 'desc' ? -1 : 1;

  const filtered = cards.filter((card) => {
    if (type !== 'all' && card.tipo !== type) return false;
    if (!query) return true;
    return [card.nombre, card.tipo, card.faccion].some((field) => field.toLowerCase().includes(query));
  });

  return [...filtered].sort((a, b) => {
    if (sortKey === 'nombre') return sign * byName(a, b);
    const va = statOf(a, sortKey);
    const vb = statOf(b, sortKey);
    if (va === undefined || vb === undefined) {
      if (va === vb) return byName(a, b);
      return va === undefined ? 1 : -1;
    }
    return sign * (va - vb) || byName(a, b);
  });
}

import type { CardDef, CardType } from '../game/types';

export const CARD_SIZE_PORTRAIT = { w: 420, h: 588 };
export const CARD_SIZE_STATION = { w: 720, h: 400 };

export function getCardSize(tipo: CardType): { w: number; h: number } {
  return tipo === 'Estación' ? CARD_SIZE_STATION : CARD_SIZE_PORTRAIT;
}

export function cardTypeClass(tipo: string): string {
  return tipo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function signedStat(value: number, suffix: string): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value} ${suffix}`;
}

/** Etiqueta compacta de modificadores de Gear. Omite ceros. */
export function formatGearModifiers(
  card: Pick<CardDef, 'modificador_ataque' | 'modificador_escudo'>,
): string {
  const parts: string[] = [];
  if (card.modificador_ataque) parts.push(signedStat(card.modificador_ataque, 'ATQ'));
  if (card.modificador_escudo) parts.push(signedStat(card.modificador_escudo, 'ESC'));
  return parts.join(' · ');
}

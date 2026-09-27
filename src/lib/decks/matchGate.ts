/**
 * Match-start gate: whether the chosen deck may be taken into a room.
 *
 * Pure and shared by the lobby (blocks create/join) and the table (blocks the
 * automatic SETUP). There is no fallback deck: the old starter deck repeats
 * each sample card 10 times, which breaks the 3-copy rule, and the sample
 * catalog only has 4 playable cards (12 legal copies), so it cannot be made
 * legal. A player must pick a legal deck built in /decks.
 *
 * Messages are Spanish because they are in-game UI copy.
 */

import { DECK_RULES, type DeckIssue } from './validation';

export interface MatchGateInput {
  selectedDeckId: string | null;
  /** The selected id still matches one of the player's decks. */
  deckExists: boolean;
  /** Deck contents finished loading (success or failure). */
  resolved: boolean;
  legality: { ok: boolean; issues: readonly DeckIssue[] } | null;
}

/** Spanish description of one broken deck rule. */
export function deckIssueMessage(issue: DeckIssue): string {
  switch (issue.code) {
    case 'card_count':
      return `debe tener exactamente ${DECK_RULES.MAX_DECK_CARDS} cartas sin contar la estación (tiene ${issue.count})`;
    case 'station_missing':
      return 'falta la estación espacial (1 por mazo)';
    case 'station_extra':
      return `solo puede llevar ${DECK_RULES.MAX_STATIONS} estación (tiene ${issue.count})`;
    case 'too_many_copies':
      return `«${issue.nombre}» tiene ${issue.qty} copias (máximo ${issue.max})`;
    case 'unknown_card':
      return `la carta «${issue.cardId}» no está en el catálogo`;
  }
}

/** Spanish reason why the match cannot start with this deck, or null. */
export function matchStartBlock(input: MatchGateInput): string | null {
  if (!input.selectedDeckId) return 'Elige un mazo para jugar.';
  if (!input.deckExists) return 'El mazo elegido ya no existe. Elige otro.';
  if (!input.resolved || !input.legality) return 'Comprobando tu mazo…';
  if (input.legality.ok) return null;
  const [first, ...rest] = input.legality.issues;
  if (!first) return 'Tu mazo no es legal.';
  const more = rest.length
    ? ` (y ${rest.length} problema${rest.length === 1 ? '' : 's'} más)`
    : '';
  return `Tu mazo no es legal: ${deckIssueMessage(first)}${more}.`;
}

/**
 * Pure operations over the private deck and hand (see hooks/usePrivateDeck.ts).
 *
 * Index 0 is the top of the deck. No randomness here: shuffling stays in the
 * hook, which is the only place allowed to be non-deterministic.
 */

import type { RevealRoute } from './events';

export interface Piles<T> {
  deck: T[];
  hand: T[];
}

/** Draws up to `count` cards from the top of the deck into the hand. */
export function drawTop<T>(piles: Piles<T>, count: number): Piles<T> {
  const taken = piles.deck.slice(0, Math.max(0, count));
  return { deck: piles.deck.slice(taken.length), hand: [...piles.hand, ...taken] };
}

/**
 * Removes a card by uid. If it is not there (for instance when the match is
 * rebuilt on another device, where the shuffle differed) it removes the first
 * card, so the count still matches what the opponent sees.
 */
export function removeByUid<T extends { uid: string }>(cards: T[], uid: string): T[] {
  const index = cards.findIndex((card) => card.uid === uid);
  if (index === -1) return cards.slice(1);
  return [...cards.slice(0, index), ...cards.slice(index + 1)];
}

/**
 * Routes the top `routes.length` cards. Cards sent back to the top keep their
 * original relative order, bottom ones go under the rest in order, hand ones
 * are appended to the hand, and void ones are returned in `voided`.
 */
export function routeRevealed<T>(
  piles: Piles<T>,
  routes: RevealRoute[],
): Piles<T> & { voided: T[] } {
  const revealed = piles.deck.slice(0, routes.length);
  const rest = piles.deck.slice(revealed.length);
  const pick = (route: RevealRoute) => revealed.filter((_, index) => routes[index] === route);
  return {
    deck: [...pick('top'), ...rest, ...pick('bottom')],
    hand: [...piles.hand, ...pick('hand')],
    voided: pick('void'),
  };
}

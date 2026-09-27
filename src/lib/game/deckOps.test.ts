import { describe, expect, it } from 'vitest';

import { drawTop, removeByUid, routeRevealed } from './deckOps';

const cards = (...uids: string[]) => uids.map((uid) => ({ uid }));
const uids = (list: { uid: string }[]) => list.map((card) => card.uid);

describe('drawTop', () => {
  it('moves cards from the top of the deck to the end of the hand', () => {
    const next = drawTop({ deck: cards('a', 'b', 'c'), hand: cards('h') }, 2);
    expect(uids(next.deck)).toEqual(['c']);
    expect(uids(next.hand)).toEqual(['h', 'a', 'b']);
  });

  it('draws what is left when the deck runs short', () => {
    const next = drawTop({ deck: cards('a'), hand: [] }, 5);
    expect(next.deck).toEqual([]);
    expect(uids(next.hand)).toEqual(['a']);
  });
});

describe('removeByUid', () => {
  it('removes the matching card', () => {
    expect(uids(removeByUid(cards('a', 'b', 'c'), 'b'))).toEqual(['a', 'c']);
  });

  it('falls back to the first card so counts stay in sync', () => {
    expect(uids(removeByUid(cards('a', 'b'), 'zzz'))).toEqual(['b']);
  });
});

describe('routeRevealed', () => {
  it('routes each revealed card and never loses one', () => {
    const next = routeRevealed(
      { deck: cards('a', 'b', 'c', 'd', 'e', 'f'), hand: cards('h') },
      ['bottom', 'hand', 'top', 'void', 'top'],
    );
    // Top keeps the original relative order; bottom goes under the rest.
    expect(uids(next.deck)).toEqual(['c', 'e', 'f', 'a']);
    expect(uids(next.hand)).toEqual(['h', 'b']);
    expect(uids(next.voided)).toEqual(['d']);
    expect(next.deck.length + next.hand.length + next.voided.length).toBe(7);
  });

  it('leaves the deck untouched when everything goes back on top', () => {
    const next = routeRevealed({ deck: cards('a', 'b', 'c'), hand: [] }, ['top', 'top']);
    expect(uids(next.deck)).toEqual(['a', 'b', 'c']);
  });
});

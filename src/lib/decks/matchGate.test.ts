import { describe, expect, it } from 'vitest';

import { deckIssueMessage, matchStartBlock } from './matchGate';

const legal = { ok: true, issues: [] };

describe('matchStartBlock', () => {
  it('blocks when no deck is selected (the starter deck is not playable)', () => {
    expect(
      matchStartBlock({ selectedDeckId: null, deckExists: false, resolved: true, legality: null }),
    ).toMatch(/Elige un mazo/);
  });

  it('blocks when the selected deck no longer exists', () => {
    expect(
      matchStartBlock({ selectedDeckId: 'd1', deckExists: false, resolved: true, legality: null }),
    ).toMatch(/ya no existe/);
  });

  it('blocks while the deck is still being checked', () => {
    expect(
      matchStartBlock({ selectedDeckId: 'd1', deckExists: true, resolved: false, legality: null }),
    ).toMatch(/Comprobando/);
  });

  it('blocks an illegal deck and gives the first reason plus a count of the rest', () => {
    const reason = matchStartBlock({
      selectedDeckId: 'd1',
      deckExists: true,
      resolved: true,
      legality: {
        ok: false,
        issues: [{ code: 'card_count', count: 12 }, { code: 'station_missing' }],
      },
    });
    expect(reason).toContain('40');
    expect(reason).toContain('12');
    expect(reason).toContain('1 problema más');
  });

  it('allows a legal deck', () => {
    expect(
      matchStartBlock({ selectedDeckId: 'd1', deckExists: true, resolved: true, legality: legal }),
    ).toBeNull();
  });
});

describe('deckIssueMessage', () => {
  it('describes every issue in Spanish', () => {
    expect(deckIssueMessage({ code: 'station_missing' })).toMatch(/estación/);
    expect(deckIssueMessage({ code: 'station_extra', count: 2 })).toMatch(/estación/);
    expect(
      deckIssueMessage({ code: 'too_many_copies', cardId: 'a', nombre: 'Dron', qty: 4, max: 3 }),
    ).toMatch(/Dron.*4.*3/);
    expect(deckIssueMessage({ code: 'unknown_card', cardId: 'zz' })).toMatch(/zz/);
  });
});

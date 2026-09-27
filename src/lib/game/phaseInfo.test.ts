import { describe, expect, it } from 'vitest';

import { nextTransition, phaseChipStates } from './phaseInfo';
import { emptyPlayer, emptyState, type GameState, type PlayerState } from './types';

function table(overrides: Partial<GameState> = {}, players: Partial<PlayerState>[] = []): GameState {
  const state = { ...emptyState(), status: 'active' as const, ...overrides };
  state.players = {};
  players.forEach((partial, index) => {
    const id = partial.userId ?? `u${index + 1}`;
    state.players[id] = { ...emptyPlayer(id, (index + 1) as 1 | 2), deckCount: 30, ...partial, userId: id };
  });
  return state;
}

describe('phaseChipStates', () => {
  it('marks earlier phases as past, the current one as current and the rest upcoming', () => {
    expect(phaseChipStates('Principal')).toEqual(['past', 'past', 'current', 'upcoming']);
    expect(phaseChipStates('Inicial')).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('normalizes legacy phase names', () => {
    expect(phaseChipStates('Combate')).toEqual(['past', 'past', 'current', 'upcoming']);
  });
});

describe('nextTransition', () => {
  const both = [{ userId: 'me' }, { userId: 'rival' }];

  it('before the first turn it starts your turn with the TURN_START refresh', () => {
    const t = nextTransition(table({}, both), 'me', 'rival');
    expect(t.kind).toBe('start');
    expect(t.label).toBe('Empezar turno');
    expect(t.detail).toBe('tú: enderezar, robar 1, −5 calor, +1 recurso');
  });

  it('from Inicial goes to Activación, which untaps your cards', () => {
    const t = nextTransition(table({ activePlayerId: 'me', phase: 'Inicial' }, both), 'me', 'rival');
    expect(t.kind).toBe('phase');
    expect(t.target).toBe('Activación');
    expect(t.detail).toBe('Enderezar cartas');
  });

  it('Activación → Principal and Principal → Final have no automatic effect', () => {
    const a = nextTransition(table({ activePlayerId: 'me', phase: 'Activación' }, both), 'me', 'rival');
    expect(a.target).toBe('Principal');
    expect(a.detail).toBe('Sin efectos automáticos');
    const p = nextTransition(table({ activePlayerId: 'me', phase: 'Principal' }, both), 'me', 'rival');
    expect(p.target).toBe('Final');
  });

  it('from Final passes the turn and describes the opponent refresh', () => {
    const t = nextTransition(table({ activePlayerId: 'me', phase: 'Final', turn: 3 }, both), 'me', 'rival');
    expect(t.kind).toBe('pass');
    expect(t.label).toBe('Pasar turno');
    expect(t.detail).toBe('rival: enderezar, robar 1, −5 calor, +1 recurso');
  });

  it('omits the resource when the shared deck is empty', () => {
    const t = nextTransition(
      table({ activePlayerId: 'me', phase: 'Final', sharedResourceDeckCount: 0 }, both),
      'me',
      'rival',
    );
    expect(t.detail).toBe('rival: enderezar, robar 1, −5 calor, sin recursos compartidos');
  });

  it('warns that the opponent loses by deck-out after turn 1', () => {
    const t = nextTransition(
      table({ activePlayerId: 'me', phase: 'Final', turn: 2 }, [{ userId: 'me' }, { userId: 'rival', deckCount: 0 }]),
      'me',
      'rival',
    );
    expect(t.detail).toBe('rival: pierde por mazo vacío');
  });

  it('says there is nothing to draw on turn 1 with an empty deck', () => {
    const t = nextTransition(
      table({}, [{ userId: 'me', deckCount: 0 }, { userId: 'rival' }]),
      'me',
      'rival',
    );
    expect(t.detail).toBe('tú: enderezar, sin cartas que robar, −5 calor, +1 recurso');
  });

  it('passes the turn to yourself when there is no opponent yet', () => {
    const t = nextTransition(table({ activePlayerId: 'me', phase: 'Final' }, [{ userId: 'me' }]), 'me', undefined);
    expect(t.detail.startsWith('tú:')).toBe(true);
  });

  it("on the opponent's turn there is nothing for you to advance", () => {
    const t = nextTransition(table({ activePlayerId: 'rival', phase: 'Principal' }, both), 'me', 'rival');
    expect(t.kind).toBe('wait');
    expect(t.label).toBe('Espera al rival');
  });
});

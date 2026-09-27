/**
 * Phase flow descriptions for the center strip.
 *
 * Pure: derives, from the current state, what the phase-advance button will
 * declare next and what the reducer will do automatically when it lands. The
 * texts mirror state.ts exactly:
 *   - TURN_START: untap everything, draw 1 (if the deck has cards), heat
 *     −HEAT_COOLDOWN, +1 shared resource (if the shared deck has cards and the
 *     player has not drawn one this turn), or a deck-out loss after turn 1.
 *   - PHASE → Activación: untaps the active player's cards.
 *   - PHASE → Principal / Final: nothing automatic.
 */

import { HEAT_COOLDOWN, normalizePhase, PHASES, type GameState, type Phase } from './types';

export type PhaseChipState = 'past' | 'current' | 'upcoming';

/** State of each PHASES chip for the current phase (legacy names normalized). */
export function phaseChipStates(phase: string | undefined): PhaseChipState[] {
  const current = PHASES.indexOf(normalizePhase(phase));
  return PHASES.map((_, index) => (index < current ? 'past' : index === current ? 'current' : 'upcoming'));
}

export interface PhaseTransition {
  /** start: first TURN_START · phase: PHASE event · pass: TURN_START for the next player · wait: not your turn. */
  kind: 'start' | 'phase' | 'pass' | 'wait';
  /** Button label (Spanish UI copy). */
  label: string;
  /** What happens automatically (Spanish UI copy). */
  detail: string;
  /** Phase reached by a `phase` transition. */
  target?: Phase;
}

/** Spanish summary of the reducer's TURN_START refresh for `playerId` on `turn`. */
export function turnStartSummary(state: GameState, playerId: string | undefined, turn: number): string {
  const player = playerId ? state.players[playerId] : undefined;
  if (player && player.deckCount <= 0 && turn > 1) return 'pierde por mazo vacío';
  const draw = (player?.deckCount ?? 0) > 0 ? 'robar 1' : 'sin cartas que robar';
  const resource =
    state.sharedResourceDeckCount <= 0
      ? 'sin recursos compartidos'
      : player?.lastResourceDrawTurn === turn
        ? ''
        : '+1 recurso';
  return ['enderezar', draw, `−${HEAT_COOLDOWN} calor`, resource].filter(Boolean).join(', ');
}

const PHASE_EFFECT: Partial<Record<Phase, string>> = {
  Activación: 'Enderezar cartas',
};

export function nextTransition(
  state: GameState,
  userId: string | undefined,
  opponentId: string | undefined,
): PhaseTransition {
  if (!state.activePlayerId) {
    return {
      kind: 'start',
      label: 'Empezar turno',
      detail: `tú: ${turnStartSummary(state, userId, state.turn)}`,
    };
  }
  if (state.activePlayerId !== userId) {
    return { kind: 'wait', label: 'Espera al rival', detail: 'Solo quien tiene el turno avanza la fase.' };
  }

  const phase = normalizePhase(state.phase);
  if (phase === 'Final') {
    const nextId = opponentId ?? userId;
    const who = opponentId ? 'rival' : 'tú';
    return {
      kind: 'pass',
      label: 'Pasar turno',
      detail: `${who}: ${turnStartSummary(state, nextId, state.turn + 1)}`,
    };
  }

  const target = PHASES[PHASES.indexOf(phase) + 1] ?? 'Principal';
  return {
    kind: 'phase',
    label: `Ir a ${target}`,
    detail: PHASE_EFFECT[target] ?? 'Sin efectos automáticos',
    target,
  };
}

import { logEvent, type Transition } from '../events';
import type { CoreGameState, GameResult } from '../types';

export function hasWon(state: CoreGameState): boolean {
  return state.purification >= 100 && state.habitats >= state.targetHabitats;
}

export function finishGame(
  state: CoreGameState,
  reason: Exclude<GameResult, null>
): Transition<CoreGameState> {
  if (state.gameOver) return { state, events: [] };

  const result = reason === 'defeat' && hasWon(state) ? 'victory' : reason;
  const next: CoreGameState = {
    ...state,
    gameOver: true,
    phase: 'ended',
    gameResult: result,
    contribution:
      state.habitats * 20 +
      Math.floor(state.purification) +
      Math.floor(state.resources.money / 5) +
      state.prestige
  };

  return {
    state: next,
    events: [
      { type: 'phase.changed', phase: 'ended' },
      { type: 'game.ended', result },
      logEvent('log.game_over', { result })
    ]
  };
}

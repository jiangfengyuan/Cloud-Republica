import { logEvent, type DomainEvent, type Transition } from '../events';
import { nextRandom } from '../random';
import type { CoreGameState } from '../types';

export function drawCard(state: CoreGameState): Transition<CoreGameState> {
  if (state.hand.length >= state.handLimit) {
    return { state, events: [logEvent('log.hand_full')] };
  }

  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile];
  let rngState = state.rngState;
  const events: DomainEvent[] = [];

  if (drawPile.length === 0) {
    if (discardPile.length === 0) {
      return { state, events: [logEvent('log.deck_empty')] };
    }
    drawPile = discardPile;
    discardPile = [];
    for (let index = drawPile.length - 1; index > 0; index--) {
      const random = nextRandom(rngState);
      rngState = random.state;
      const swapIndex = Math.floor(random.value * (index + 1));
      const current = drawPile[index];
      drawPile[index] = drawPile[swapIndex] as number;
      drawPile[swapIndex] = current as number;
    }
  }

  const definitionId = drawPile.pop();
  if (definitionId === undefined) return { state, events };
  const next = {
    ...state,
    rngState,
    drawPile,
    discardPile,
    nextCardUid: state.nextCardUid + 1,
    hand: [
      ...state.hand,
      { definitionId, instanceId: state.nextCardUid }
    ]
  };
  return { state: next, events };
}

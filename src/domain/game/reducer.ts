import type { Transition } from './events';
import type { CoreGameState, GameDependencies, GameResult, ResourceEffect, ResourceKey } from './types';
import { finishGame } from './rules/outcome';
import { drawCard } from './rules/deck';
import { applyResourceEffect, modifyResource } from './rules/resources';
import { settleTurn } from './rules/settlement';
import { acknowledgeEvent, beginTurn, rollEvent } from './rules/turns';

export type GameCommand =
  | { type: 'resource.modify'; resource: ResourceKey; amount: number }
  | { type: 'resource.apply-effect'; effect: ResourceEffect }
  | { type: 'turn.begin' }
  | { type: 'event.roll' }
  | { type: 'event.acknowledge' }
  | { type: 'deck.draw' }
  | { type: 'turn.settle' }
  | { type: 'game.finish'; reason: Exclude<GameResult, null> };

export function reduceGame(
  state: CoreGameState,
  command: GameCommand,
  dependencies: GameDependencies = { events: [], cards: [] }
): Transition<CoreGameState> {
  switch (command.type) {
    case 'resource.modify':
      return modifyResource(state, command.resource, command.amount);
    case 'resource.apply-effect':
      return applyResourceEffect(state, command.effect);
    case 'turn.begin':
      return beginTurn(state);
    case 'event.roll':
      return rollEvent(state, dependencies);
    case 'event.acknowledge':
      return acknowledgeEvent(state);
    case 'deck.draw':
      return drawCard(state);
    case 'turn.settle':
      return settleTurn(state, dependencies);
    case 'game.finish':
      return finishGame(state, command.reason);
  }
}

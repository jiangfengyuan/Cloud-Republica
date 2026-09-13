import type { CoreGameState, ResourceKey } from '../../domain/game/types';

export interface ResourceViewModel {
  key: ResourceKey;
  value: number;
  tone: 'normal' | 'warning' | 'critical';
  suffix: '' | '%';
}

export interface GamePanelViewModel {
  screen: 'game';
  phase: CoreGameState['phase'];
  turn: number;
  maxTurns: number;
  resources: ResourceViewModel[];
  purification: number;
  habitats: number;
  targetHabitats: number;
  hand: CoreGameState['hand'];
  selectedCount: number;
  drawPileCount: number;
  discardPileCount: number;
  canAct: boolean;
}

const resourceKeys: ResourceKey[] = [
  'money', 'materials', 'energy', 'research', 'morale', 'integrity'
];

function resourceTone(key: ResourceKey, value: number): ResourceViewModel['tone'] {
  if (key === 'integrity' && value < 30) return 'critical';
  if (key === 'integrity' && value < 50) return 'warning';
  if (key === 'morale' && value < 30) return 'warning';
  if (key === 'energy' && value < 10) return 'warning';
  return 'normal';
}

export function selectGamePanel(state: CoreGameState): GamePanelViewModel {
  return {
    screen: 'game',
    phase: state.phase,
    turn: state.turn,
    maxTurns: state.maxTurns,
    resources: resourceKeys.map(key => ({
      key,
      value: state.resources[key],
      tone: resourceTone(key, state.resources[key]),
      suffix: key === 'integrity' ? '%' : ''
    })),
    purification: state.purification,
    habitats: state.habitats,
    targetHabitats: state.targetHabitats,
    hand: state.hand,
    selectedCount: state.selectedCards.length,
    drawPileCount: state.drawPile.length,
    discardPileCount: state.discardPile.length,
    canAct: state.phase === 'action' && !state.gameOver
  };
}

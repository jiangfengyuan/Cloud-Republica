import { describe, expect, it } from 'vitest';
import { selectGamePanel } from '../../src/presentation/view-models/game-panel';
import { selectStartScreen } from '../../src/presentation/view-models/start-screen';
import type { CoreGameState } from '../../src/domain/game/types';

describe('presentation view models', () => {
  it('derives start actions without coupling the page to storage', () => {
    expect(selectStartScreen({
      selectedFaction: 'guild', selectedDifficulty: 'medium', selectedDeck: 'full',
      canResume: true, legacyPoints: 3
    })).toMatchObject({ screen: 'start', primaryAction: 'start', secondaryAction: 'resume' });
  });

  it('derives the action board from reducer state', () => {
    const state = {
      phase: 'action', gameOver: false, turn: 2, maxTurns: 20,
      resources: { money: 20, materials: 12, energy: 8, research: 5, morale: 25, integrity: 29 },
      purification: 10, habitats: 2, targetHabitats: 6,
      hand: [{ definitionId: 1, instanceId: 4 }], selectedCards: [4],
      drawPile: [2, 3], discardPile: [5]
    } as CoreGameState;
    const panel = selectGamePanel(state);
    expect(panel).toMatchObject({
      screen: 'game', canAct: true, selectedCount: 1, drawPileCount: 2, discardPileCount: 1
    });
    expect(panel.resources.find(resource => resource.key === 'energy')?.tone).toBe('warning');
    expect(panel.resources.find(resource => resource.key === 'integrity')?.tone).toBe('critical');
  });
});

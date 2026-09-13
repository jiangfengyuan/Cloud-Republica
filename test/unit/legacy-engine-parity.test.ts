import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { reduceGame } from '../../src/domain/game/reducer';
import type { CoreGameState, EventDefinition, ResourceEffect, ResourceKey } from '../../src/domain/game/types';

interface LegacyEngine {
  modifyResource(state: CoreGameState, resource: ResourceKey, amount: number): void;
  applyResourceEffect(state: CoreGameState, effect: ResourceEffect): void;
  startNewTurn(state: CoreGameState): void;
  triggerEventPhase(state: CoreGameState): EventDefinition | null;
  applyEvent(state: CoreGameState): void;
  onLog: ((key: string, params: Record<string, unknown>) => void) | null;
}

interface LegacyData {
  EVENTS: EventDefinition[];
}

const requireLegacy = createRequire(import.meta.url);
const legacyData = requireLegacy('../../js/data.js') as LegacyData;
const legacyEngine = requireLegacy('../../js/engine.js') as LegacyEngine;
legacyEngine.onLog = null;

function state(overrides: Partial<CoreGameState> = {}): CoreGameState {
  return {
    resources: { money: 65, materials: 75, energy: 25, research: 8, morale: 70, integrity: 100 },
    purification: 0,
    purificationMultiplier: 1,
    habitats: 1,
    targetHabitats: 6,
    moraleFloor: 0,
    ultimate: false,
    insurance: false,
    prestige: 0,
    contribution: 0,
    gameOver: false,
    gameResult: null,
    phase: 'setup',
    turn: 0,
    maxTurns: 22,
    cardsPlayedThisTurn: 0,
    selectedCards: [],
    extraCardPlayed: false,
    eventTriggered: false,
    strike: false,
    shieldActive: false,
    stormShield: false,
    pendingEvent: null,
    rngState: 2202,
    energyMaintenance: 4,
    corrosionRate: 2,
    handLimit: 8,
    drawPerTurn: 2,
    moneyMultiplier: 1,
    researchIncome: 0,
    moraleDecayDelta: 0,
    noMoraleDecay: false,
    hand: [],
    permanentCards: [],
    drawPile: [],
    discardPile: [],
    nextCardUid: 1,
    timedEffects: [],
    delayedEffects: [],
    maturedIncome: { money: 0, materials: 0, energy: 0, research: 0, morale: 0 },
    ...overrides
  };
}

function clone(value: CoreGameState): CoreGameState {
  return structuredClone(value);
}

function comparable(value: CoreGameState) {
  return {
    resources: value.resources,
    purification: value.purification,
    ultimate: value.ultimate,
    insurance: value.insurance,
    gameOver: value.gameOver,
    gameResult: value.gameResult,
    contribution: value.contribution,
    phase: value.phase,
    turn: value.turn,
    cardsPlayedThisTurn: value.cardsPlayedThisTurn,
    selectedCards: value.selectedCards,
    extraCardPlayed: value.extraCardPlayed,
    eventTriggered: value.eventTriggered,
    strike: value.strike,
    shieldActive: value.shieldActive,
    pendingEventId: value.pendingEvent?.id ?? null,
    rngState: value.rngState
  };
}

describe('legacy engine and new reducer shadow parity', () => {
  it.each([
    ['money', -999],
    ['morale', 200],
    ['integrity', -100]
  ] as const)('matches modifyResource for %s %s', (resource, amount) => {
    const legacy = state();
    legacyEngine.modifyResource(legacy, resource, amount);
    const next = reduceGame(state(), { type: 'resource.modify', resource, amount }).state;
    expect(comparable(next)).toEqual(comparable(legacy));
  });

  it('matches compound event resource effects', () => {
    const effect = { money: 12, materials: -8, morale: 40, integrity: -3, purification: 5 };
    const legacy = state({ purificationMultiplier: 1.15 });
    legacyEngine.applyResourceEffect(legacy, effect);
    const next = reduceGame(state({ purificationMultiplier: 1.15 }), {
      type: 'resource.apply-effect',
      effect
    }).state;
    expect(comparable(next)).toEqual(comparable(legacy));
  });

  it('matches turn start, event roll and event acknowledgement', () => {
    const legacy = state();
    legacyEngine.startNewTurn(legacy);
    legacyEngine.triggerEventPhase(legacy);

    let next = reduceGame(state(), { type: 'turn.begin' }, { events: legacyData.EVENTS, cards: [] }).state;
    next = reduceGame(next, { type: 'event.roll' }, { events: legacyData.EVENTS, cards: [] }).state;
    expect(comparable(next)).toEqual(comparable(legacy));

    legacyEngine.applyEvent(legacy);
    next = reduceGame(next, { type: 'event.acknowledge' }, { events: legacyData.EVENTS, cards: [] }).state;
    expect(comparable(next)).toEqual(comparable(legacy));
  });

  it('matches timeout victory and defeat outcomes', () => {
    for (const goalsMet of [false, true]) {
      const input = state({
        turn: 22,
        purification: goalsMet ? 100 : 0,
        habitats: goalsMet ? 6 : 1
      });
      const legacy = clone(input);
      legacyEngine.startNewTurn(legacy);
      const next = reduceGame(input, { type: 'turn.begin' }).state;
      expect(comparable(next)).toEqual(comparable(legacy));
    }
  });
});

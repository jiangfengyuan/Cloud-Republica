import { describe, expect, it } from 'vitest';
import { nextRandom } from '../../src/domain/game/random';
import { reduceGame } from '../../src/domain/game/reducer';
import type { CoreGameState, EventDefinition } from '../../src/domain/game/types';

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

const events: EventDefinition[] = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  effect: index === 0 ? { integrity: -3 } : index === 1 ? { energy: -5, research: -2 } : {}
}));

describe('new immutable domain reducer', () => {
  it('matches legacy resource clamping without mutating input', () => {
    const original = state();
    const transition = reduceGame(original, { type: 'resource.modify', resource: 'morale', amount: 200 });
    expect(transition.state.resources.morale).toBe(100);
    expect(original.resources.morale).toBe(70);
    expect(transition.events[0]).toMatchObject({ type: 'resource.changed', current: 100 });
  });

  it('ignores non-finite resource deltas', () => {
    const original = state();
    expect(reduceGame(original, { type: 'resource.modify', resource: 'money', amount: Number.NaN })).toEqual({ state: original, events: [] });
    expect(reduceGame(original, { type: 'resource.modify', resource: 'money', amount: Number.POSITIVE_INFINITY })).toEqual({ state: original, events: [] });
  });

  it('keeps the legacy crash priority: ultimate, then insurance, then crash', () => {
    const protectedState = state({ ultimate: true, insurance: true });
    const protectedResult = reduceGame(protectedState, { type: 'resource.modify', resource: 'integrity', amount: -100 });
    expect(protectedResult.state).toMatchObject({ ultimate: false, insurance: true, gameOver: false });
    expect(protectedResult.state.resources.integrity).toBe(20);

    const crashed = reduceGame(state(), { type: 'resource.modify', resource: 'integrity', amount: -100 });
    expect(crashed.state).toMatchObject({ gameOver: true, gameResult: 'crash', phase: 'ended' });
  });

  it('clamps purification and applies only positive multipliers', () => {
    const boosted = state({ purification: 95, purificationMultiplier: 1.15 });
    const up = reduceGame(boosted, { type: 'resource.apply-effect', effect: { purification: 10 } });
    expect(up.state.purification).toBe(100);
    const down = reduceGame({ ...up.state, purification: 2 }, { type: 'resource.apply-effect', effect: { purification: -5 } });
    expect(down.state.purification).toBe(0);
  });

  it('uses the exact serializable LCG sequence from the legacy engine', () => {
    const first = nextRandom(2202);
    expect(first.state).toBe(384220977);
    expect(first.value).toBe(first.state / 4294967296);
    expect(nextRandom(first.state).state).toBe(35466972);
  });

  it('advances turn, rolls an event and applies it through explicit commands', () => {
    const begun = reduceGame(state(), { type: 'turn.begin' }, { events, cards: [] });
    expect(begun.state).toMatchObject({ turn: 1, phase: 'event' });
    const rolled = reduceGame(begun.state, { type: 'event.roll' }, { events, cards: [] });
    expect(rolled.state.pendingEvent?.id).toBe(2);
    const acknowledged = reduceGame(rolled.state, { type: 'event.acknowledge' }, { events, cards: [] });
    expect(acknowledged.state).toMatchObject({ phase: 'action', pendingEvent: null });
    expect(acknowledged.state.resources).toMatchObject({ energy: 20, research: 6 });
  });

  it('resolves timeout using the existing victory condition', () => {
    const winning = state({ turn: 22, purification: 100, habitats: 6 });
    expect(reduceGame(winning, { type: 'turn.begin' }).state.gameResult).toBe('victory');
    expect(reduceGame(state({ turn: 22 }), { type: 'turn.begin' }).state.gameResult).toBe('defeat');
  });
});

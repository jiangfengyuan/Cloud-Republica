import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reduceGame } from '../../src/domain/game/reducer';
import type {
  CardDefinition,
  CoreGameState,
  EventDefinition,
  GameDependencies,
  ResourceEffect
} from '../../src/domain/game/types';

interface LegacyCard {
  id: number;
  uid: number;
  venusEffect?: ResourceEffect;
}

interface LegacyEffect {
  cardId: number;
  turnsLeft: number;
  income: ResourceEffect;
}

interface LegacyState extends Omit<CoreGameState, 'hand' | 'permanentCards' | 'timedEffects' | 'delayedEffects'> {
  hand: LegacyCard[];
  permanentCards: LegacyCard[];
  timedEffects: LegacyEffect[];
  delayedEffects: LegacyEffect[];
}

interface LegacyEngine {
  rng: () => number;
  drawInitialCards(state: LegacyState): void;
  drawCard(state: LegacyState): void;
  startNewTurn(state: LegacyState): void;
  triggerEventPhase(state: LegacyState): EventDefinition | null;
  applyEvent(state: LegacyState): void;
  endTurn(state: LegacyState): { ok: boolean };
  subscribe(listener: (event: { key: string }) => void): () => void;
}

interface LegacyStateModule {
  createInitialState(difficulty: string, faction: string): LegacyState;
}

interface LegacyData {
  CARD_DATABASE: CardDefinition[];
  EVENTS: EventDefinition[];
}

const requireLegacy = createRequire(import.meta.url);
const data = requireLegacy('../../js/data.js') as LegacyData;
const stateModule = requireLegacy('../../js/state.js') as LegacyStateModule;
const engine = requireLegacy('../../js/engine.js') as LegacyEngine;
const dependencies: GameDependencies = { cards: data.CARD_DATABASE, events: data.EVENTS };
const seeds = JSON.parse(readFileSync(resolve('test/fixtures/legacy-seed-baseline.json'), 'utf8')) as {
  deckRng: number;
  cases: Array<{ difficulty: string; seed: number }>;
};

function toCore(legacy: LegacyState): CoreGameState {
  return {
    resources: { ...legacy.resources },
    purification: legacy.purification,
    purificationMultiplier: legacy.purificationMultiplier,
    habitats: legacy.habitats,
    targetHabitats: legacy.targetHabitats,
    moraleFloor: legacy.moraleFloor,
    ultimate: legacy.ultimate,
    insurance: legacy.insurance,
    prestige: legacy.prestige,
    contribution: legacy.contribution,
    gameOver: legacy.gameOver,
    gameResult: legacy.gameResult,
    phase: legacy.phase,
    turn: legacy.turn,
    maxTurns: legacy.maxTurns,
    cardsPlayedThisTurn: legacy.cardsPlayedThisTurn,
    selectedCards: [...legacy.selectedCards],
    extraCardPlayed: legacy.extraCardPlayed,
    eventTriggered: legacy.eventTriggered,
    strike: legacy.strike,
    shieldActive: legacy.shieldActive,
    stormShield: legacy.stormShield,
    pendingEvent: legacy.pendingEvent ? {
      id: legacy.pendingEvent.id,
      effect: { ...legacy.pendingEvent.effect }
    } : null,
    rngState: legacy.rngState,
    energyMaintenance: legacy.energyMaintenance,
    corrosionRate: legacy.corrosionRate,
    handLimit: legacy.handLimit,
    drawPerTurn: legacy.drawPerTurn,
    moneyMultiplier: legacy.moneyMultiplier,
    researchIncome: legacy.researchIncome,
    moraleDecayDelta: legacy.moraleDecayDelta,
    noMoraleDecay: legacy.noMoraleDecay,
    hand: legacy.hand.map(card => ({ definitionId: card.id, instanceId: card.uid })),
    permanentCards: legacy.permanentCards.map(card => ({ definitionId: card.id, instanceId: card.uid })),
    drawPile: [...legacy.drawPile],
    discardPile: [...legacy.discardPile],
    nextCardUid: legacy.nextCardUid,
    timedEffects: legacy.timedEffects.map(effect => ({
      sourceCardId: effect.cardId,
      turnsLeft: effect.turnsLeft,
      income: { ...effect.income }
    })),
    delayedEffects: legacy.delayedEffects.map(effect => ({
      sourceCardId: effect.cardId,
      turnsLeft: effect.turnsLeft,
      income: { ...effect.income }
    })),
    maturedIncome: { ...legacy.maturedIncome }
  };
}

function summary(state: LegacyState | CoreGameState) {
  const isLegacy = (card: LegacyCard | CoreGameState['hand'][number]): card is LegacyCard => 'id' in card;
  const effectSummary = (effect: LegacyEffect | CoreGameState['timedEffects'][number]) => (
    'cardId' in effect
      ? { sourceCardId: effect.cardId, turnsLeft: effect.turnsLeft, income: effect.income }
      : effect
  );
  return {
    resources: state.resources,
    purification: state.purification,
    phase: state.phase,
    turn: state.turn,
    gameOver: state.gameOver,
    gameResult: state.gameResult,
    contribution: state.contribution,
    rngState: state.rngState,
    hand: state.hand.map(card => isLegacy(card) ? { definitionId: card.id, instanceId: card.uid } : card),
    permanentCards: state.permanentCards.map(card => isLegacy(card) ? { definitionId: card.id, instanceId: card.uid } : card),
    drawPile: state.drawPile,
    discardPile: state.discardPile,
    nextCardUid: state.nextCardUid,
    timedEffects: state.timedEffects.map(effectSummary),
    delayedEffects: state.delayedEffects.map(effectSummary),
    maturedIncome: state.maturedIncome,
    pendingEventId: state.pendingEvent?.id ?? null,
    strike: state.strike
  };
}

function createStartedLegacy(difficulty: string, seed: number): LegacyState {
  engine.rng = () => seeds.deckRng;
  const state = stateModule.createInitialState(difficulty, 'none');
  state.rngState = seed;
  engine.drawInitialCards(state);
  engine.startNewTurn(state);
  engine.triggerEventPhase(state);
  return state;
}

describe('complete turn replay parity', () => {
  for (const seedCase of seeds.cases) {
    it('replays the frozen ' + seedCase.difficulty + ' seed through settlement and next event', () => {
      const legacy = createStartedLegacy(seedCase.difficulty, seedCase.seed);
      let next = toCore(legacy);

      engine.applyEvent(legacy);
      next = reduceGame(next, { type: 'event.acknowledge' }, dependencies).state;
      expect(summary(next)).toEqual(summary(legacy));

      const legacyLogKeys: string[] = [];
      const unsubscribe = engine.subscribe(event => legacyLogKeys.push(event.key));
      engine.endTurn(legacy);
      unsubscribe();
      const settlement = reduceGame(next, { type: 'turn.settle' }, dependencies);
      next = settlement.state;
      expect(summary(next)).toEqual(summary(legacy));
      expect(settlement.events.filter(event => event.type === 'log').map(event => event.key)).toEqual(legacyLogKeys);

      engine.startNewTurn(legacy);
      engine.triggerEventPhase(legacy);
      next = reduceGame(next, { type: 'turn.begin' }, dependencies).state;
      next = reduceGame(next, { type: 'event.roll' }, dependencies).state;
      expect(summary(next)).toEqual(summary(legacy));
    });
  }

  it('matches permanent, timed, delayed, maintenance and draw ordering', () => {
    const legacy = createStartedLegacy('medium', 778899);
    engine.applyEvent(legacy);
    legacy.permanentCards = [{ ...data.CARD_DATABASE.find(card => card.id === 3), id: 3, uid: 70 } as LegacyCard];
    legacy.timedEffects = [{ cardId: 24, turnsLeft: 1, income: { money: 2, materials: 2, energy: 2 } }];
    legacy.delayedEffects = [{ cardId: 2, turnsLeft: 1, income: { money: 12 } }];
    legacy.maturedIncome = { money: 1, materials: 1, energy: 0, research: 0, morale: 0 };
    const initial = toCore(legacy);

    engine.endTurn(legacy);
    const next = reduceGame(initial, { type: 'turn.settle' }, dependencies).state;
    expect(summary(next)).toEqual(summary(legacy));
  });

  it('matches discard reshuffle, serializable RNG and normalized card instances', () => {
    const legacy = createStartedLegacy('medium', 123456);
    legacy.hand = [];
    legacy.drawPile = [];
    legacy.discardPile = [1, 2, 3, 4];
    legacy.nextCardUid = 20;
    const initial = toCore(legacy);

    engine.drawCard(legacy);
    const next = reduceGame(initial, { type: 'deck.draw' }, dependencies).state;
    expect(summary(next)).toEqual(summary(legacy));
  });
});

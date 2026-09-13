import { logEvent, type DomainEvent, type Transition } from '../events';
import type { CoreGameState, GameDependencies, MaturedIncome, ResourceEffect, ResourceKey } from '../types';
import { drawCard } from './deck';
import { finishGame, hasWon } from './outcome';
import { applyResourceEffect, modifyResource } from './resources';

const INCOME_KEYS = ['money', 'materials', 'energy', 'research', 'morale'] as const satisfies readonly ResourceKey[];

interface SettlementIncome extends MaturedIncome {
  purification: number;
}

function applyChange(
  state: CoreGameState,
  resource: ResourceKey,
  amount: number,
  events: DomainEvent[]
): CoreGameState {
  const transition = modifyResource(state, resource, amount);
  events.push(...transition.events);
  return transition.state;
}

export function settleTurn(
  state: CoreGameState,
  dependencies: GameDependencies
): Transition<CoreGameState> {
  if (state.phase !== 'action') return { state, events: [] };

  let next: CoreGameState = { ...state, phase: 'settlement' };
  const events: DomainEvent[] = [
    { type: 'phase.changed', phase: 'settlement' },
    logEvent('log.settlement_begin')
  ];
  const income: SettlementIncome = {
    money: 0,
    materials: 0,
    energy: 0,
    research: 0,
    morale: 0,
    purification: 0
  };

  for (const instance of next.permanentCards) {
    const effect = dependencies.cards.find(card => card.id === instance.definitionId)?.venusEffect;
    if (!effect) continue;
    for (const key of INCOME_KEYS) income[key] += effect[key] ?? 0;
    income.purification += effect.purification ?? 0;
  }
  for (const key of INCOME_KEYS) income[key] += next.maturedIncome[key];

  if (Object.values(income).some(Boolean)) events.push(logEvent('log.income_summary', { ...income }));
  if (income.money) next = applyChange(next, 'money', Math.round(income.money * next.moneyMultiplier), events);
  for (const key of ['materials', 'energy', 'research', 'morale'] as const) {
    if (income[key]) next = applyChange(next, key, income[key], events);
  }
  if (next.researchIncome) next = applyChange(next, 'research', next.researchIncome, events);
  if (income.purification) {
    next = { ...next, purification: Math.max(0, Math.min(100, next.purification + income.purification)) };
    events.push(logEvent('log.purification_income', {
      amount: income.purification,
      total: next.purification.toFixed(1)
    }));
  }

  const activeTimed = [];
  for (const timed of next.timedEffects) {
    const applied = applyResourceEffect(next, timed.income);
    next = applied.state;
    events.push(...applied.events);
    const turnsLeft = timed.turnsLeft - 1;
    if (turnsLeft > 0) {
      activeTimed.push({ ...timed, turnsLeft });
      events.push(logEvent('log.timed_remaining', { cardId: timed.sourceCardId, turns: turnsLeft }));
    } else {
      events.push(logEvent('log.timed_expired', { cardId: timed.sourceCardId }));
    }
  }
  next = { ...next, timedEffects: activeTimed };

  const activeDelayed = [];
  let maturedIncome = { ...next.maturedIncome };
  for (const delayed of next.delayedEffects) {
    const turnsLeft = delayed.turnsLeft - 1;
    if (turnsLeft <= 0) {
      for (const key of INCOME_KEYS) maturedIncome[key] += delayed.income[key] ?? 0;
      events.push(logEvent('log.delayed_matured', { cardId: delayed.sourceCardId }));
    } else {
      activeDelayed.push({ ...delayed, turnsLeft });
      events.push(logEvent('log.delayed_countdown', { cardId: delayed.sourceCardId, turns: turnsLeft }));
    }
  }
  next = { ...next, delayedEffects: activeDelayed, maturedIncome };

  next = applyChange(next, 'energy', -next.energyMaintenance, events);
  events.push(logEvent('log.maintenance', { amount: -next.energyMaintenance }));
  next = applyChange(next, 'integrity', -next.corrosionRate, events);
  events.push(logEvent('log.corrosion', { amount: -next.corrosionRate }));
  if (next.gameOver) return { state: next, events };

  if (!next.noMoraleDecay) {
    const decay = 1 + (next.moraleDecayDelta || 0);
    next = applyChange(next, 'morale', -decay, events);
    events.push(logEvent('log.morale_decay', { amount: -decay }));
  }
  if (next.resources.morale < 30) events.push(logEvent('log.low_morale'));

  for (let count = 0; count < next.drawPerTurn; count++) {
    const drawn = drawCard(next);
    next = drawn.state;
    events.push(...drawn.events);
  }

  if (hasWon(next)) {
    const ended = finishGame(next, 'victory');
    return { state: ended.state, events: [...events, ...ended.events] };
  }

  events.push(logEvent('log.turn_complete', { turn: next.turn }));
  return { state: next, events };
}

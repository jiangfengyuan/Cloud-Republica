import { logEvent, type DomainEvent, type Transition } from '../events';
import type { CoreGameState, ResourceEffect, ResourceKey } from '../types';
import { finishGame } from './outcome';

const RESOURCE_KEYS: readonly ResourceKey[] = [
  'money', 'materials', 'energy', 'research', 'morale', 'integrity'
];

export function modifyResource(
  state: CoreGameState,
  resource: ResourceKey,
  amount: number
): Transition<CoreGameState> {
  if (!Number.isFinite(amount)) return { state, events: [] };

  const previous = state.resources[resource];
  let current = previous + amount;
  if (resource === 'integrity' || resource === 'morale') current = Math.max(0, Math.min(100, current));
  else current = Math.max(0, current);
  if (resource === 'morale' && state.moraleFloor > 0) current = Math.max(state.moraleFloor, current);

  let next: CoreGameState = {
    ...state,
    resources: { ...state.resources, [resource]: current }
  };
  const events: DomainEvent[] = [
    { type: 'resource.changed', resource, previous, current, requestedDelta: amount }
  ];

  if (resource !== 'integrity' || current > 0) return { state: next, events };

  if (next.ultimate) {
    next = { ...next, ultimate: false, resources: { ...next.resources, integrity: 20 } };
    return { state: next, events: [...events, logEvent('log.ultimate_activated')] };
  }
  if (next.insurance) {
    next = {
      ...next,
      insurance: false,
      resources: {
        ...next.resources,
        integrity: 20,
        money: Math.floor(next.resources.money / 2),
        materials: Math.floor(next.resources.materials / 2),
        energy: Math.floor(next.resources.energy / 2),
        research: Math.floor(next.resources.research / 2)
      }
    };
    return { state: next, events: [...events, logEvent('log.insurance_activated')] };
  }

  const ended = finishGame(next, 'crash');
  return { state: ended.state, events: [...events, ...ended.events] };
}

export function applyResourceEffect(
  state: CoreGameState,
  effect: ResourceEffect
): Transition<CoreGameState> {
  let next = state;
  const events: DomainEvent[] = [];

  for (const resource of RESOURCE_KEYS) {
    const amount = effect[resource];
    if (!amount) continue;
    const transition = modifyResource(next, resource, amount);
    next = transition.state;
    events.push(...transition.events);
  }

  if (effect.purification) {
    const requestedDelta = effect.purification > 0
      ? effect.purification * (next.purificationMultiplier || 1)
      : effect.purification;
    const previous = next.purification;
    const current = Math.max(0, Math.min(100, previous + requestedDelta));
    next = { ...next, purification: current };
    events.push(
      { type: 'purification.changed', previous, current, requestedDelta },
      logEvent('log.purification_change', {
        amount: (requestedDelta > 0 ? '+' : '') + Math.round(requestedDelta * 10) / 10
      })
    );
  }

  return { state: next, events };
}

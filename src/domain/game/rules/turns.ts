import { logEvent, type DomainEvent, type Transition } from '../events';
import { nextRandom } from '../random';
import type { CoreGameState, GameDependencies } from '../types';
import { finishGame } from './outcome';
import { applyResourceEffect } from './resources';

export function beginTurn(state: CoreGameState): Transition<CoreGameState> {
  if (state.gameOver) return { state, events: [] };
  const turn = state.turn + 1;
  if (turn > state.maxTurns) return finishGame({ ...state, turn }, 'defeat');

  const next: CoreGameState = {
    ...state,
    turn,
    phase: 'event',
    cardsPlayedThisTurn: 0,
    selectedCards: [],
    extraCardPlayed: false,
    eventTriggered: false,
    strike: false
  };
  return {
    state: next,
    events: [
      { type: 'phase.changed', phase: 'event' },
      logEvent('log.turn_begin', { turn, max: next.maxTurns })
    ]
  };
}

export function rollEvent(
  state: CoreGameState,
  dependencies: GameDependencies
): Transition<CoreGameState> {
  if (state.gameOver) return { state, events: [] };
  if (state.shieldActive) {
    return {
      state: { ...state, shieldActive: false, pendingEvent: null },
      events: [{ type: 'event.rolled', eventId: null }, logEvent('log.shield_block')]
    };
  }

  const random = nextRandom(state.rngState);
  const id = Math.floor(random.value * 20) + 1;
  const event = dependencies.events.find(candidate => candidate.id === id) ?? dependencies.events[0] ?? null;
  let next: CoreGameState = { ...state, rngState: random.state, pendingEvent: event };
  const events: DomainEvent[] = [];

  if (event?.id === 2 && next.stormShield) {
    next = { ...next, pendingEvent: null };
    events.push({ type: 'event.rolled', eventId: null }, logEvent('log.storm_shield_block'));
  } else {
    events.push({ type: 'event.rolled', eventId: event?.id ?? null });
  }
  return { state: next, events };
}

export function acknowledgeEvent(state: CoreGameState): Transition<CoreGameState> {
  if (state.gameOver) return { state, events: [] };
  let next = state;
  const events: DomainEvent[] = [];
  const event = state.pendingEvent;
  if (event) {
    events.push(logEvent('log.event_applied', { turn: state.turn, eventId: event.id }));
    const applied = applyResourceEffect(next, event.effect);
    next = applied.state;
    events.push(...applied.events);
    if (event.effect.strike) {
      next = { ...next, strike: true };
      events.push(logEvent('log.strike'));
    }
  }
  next = { ...next, pendingEvent: null, phase: 'action' };
  events.push({ type: 'phase.changed', phase: 'action' });
  return { state: next, events };
}

import type { GameResult, ResourceKey } from './types';

export type LogParams = Readonly<Record<string, string | number | boolean>>;

export type DomainEvent =
  | { type: 'log'; key: string; params: LogParams }
  | { type: 'resource.changed'; resource: ResourceKey; previous: number; current: number; requestedDelta: number }
  | { type: 'purification.changed'; previous: number; current: number; requestedDelta: number }
  | { type: 'phase.changed'; phase: 'event' | 'action' | 'settlement' | 'ended' }
  | { type: 'event.rolled'; eventId: number | null }
  | { type: 'game.ended'; result: Exclude<GameResult, null> };

export interface Transition<State> {
  state: State;
  events: readonly DomainEvent[];
}

export function logEvent(key: string, params: LogParams = {}): DomainEvent {
  return { type: 'log', key, params };
}

import { reduceGame } from '../domain/game/reducer';
import { nextRandom } from '../domain/game/random';
import { migrateActiveGame } from '../infrastructure/persistence/save-schema';

export const CloudRepublicNext = Object.freeze({
  version: '0.2.0',
  reduceGame,
  nextRandom,
  migrateActiveGame
});

declare global {
  interface Window {
    CloudRepublicNext?: typeof CloudRepublicNext;
  }
}

if (typeof window !== 'undefined') window.CloudRepublicNext = CloudRepublicNext;

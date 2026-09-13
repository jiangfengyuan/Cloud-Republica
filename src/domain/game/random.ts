export interface RandomStep {
  value: number;
  state: number;
}

export function nextRandom(rngState: number): RandomStep {
  const state = (Math.imul(1664525, rngState >>> 0) + 1013904223) >>> 0;
  return { state, value: state / 4294967296 };
}

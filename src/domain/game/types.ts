export type ResourceKey = 'money' | 'materials' | 'energy' | 'research' | 'morale' | 'integrity';

export interface Resources {
  money: number;
  materials: number;
  energy: number;
  research: number;
  morale: number;
  integrity: number;
}

export interface ResourceEffect {
  money?: number;
  materials?: number;
  energy?: number;
  research?: number;
  morale?: number;
  integrity?: number;
  purification?: number;
  strike?: boolean;
}

export interface EventDefinition {
  id: number;
  effect: ResourceEffect;
}

export interface CardDefinition {
  id: number;
  venusEffect?: ResourceEffect & { habitat?: number; corrosion?: number };
}

export interface CardInstance {
  definitionId: number;
  instanceId: number;
}

export interface TimedEffect {
  sourceCardId: number;
  turnsLeft: number;
  income: ResourceEffect;
}

export interface DelayedEffect {
  sourceCardId: number;
  turnsLeft: number;
  income: ResourceEffect;
}

export interface MaturedIncome {
  money: number;
  materials: number;
  energy: number;
  research: number;
  morale: number;
}

export type GamePhase = 'setup' | 'event' | 'action' | 'settlement' | 'ended';
export type GameResult = 'victory' | 'defeat' | 'crash' | null;

export interface CoreGameState {
  resources: Resources;
  purification: number;
  purificationMultiplier: number;
  habitats: number;
  targetHabitats: number;
  moraleFloor: number;
  ultimate: boolean;
  insurance: boolean;
  prestige: number;
  contribution: number;
  gameOver: boolean;
  gameResult: GameResult;
  phase: GamePhase;
  turn: number;
  maxTurns: number;
  cardsPlayedThisTurn: number;
  selectedCards: number[];
  extraCardPlayed: boolean;
  eventTriggered: boolean;
  strike: boolean;
  shieldActive: boolean;
  stormShield: boolean;
  pendingEvent: EventDefinition | null;
  rngState: number;
  energyMaintenance: number;
  corrosionRate: number;
  handLimit: number;
  drawPerTurn: number;
  moneyMultiplier: number;
  researchIncome: number;
  moraleDecayDelta: number;
  noMoraleDecay: boolean;
  hand: CardInstance[];
  permanentCards: CardInstance[];
  drawPile: number[];
  discardPile: number[];
  nextCardUid: number;
  timedEffects: TimedEffect[];
  delayedEffects: DelayedEffect[];
  maturedIncome: MaturedIncome;
}

export interface GameDependencies {
  events: readonly EventDefinition[];
  cards: readonly CardDefinition[];
}

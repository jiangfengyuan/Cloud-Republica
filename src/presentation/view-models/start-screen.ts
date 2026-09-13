export interface StartScreenInput {
  selectedFaction: string;
  selectedDifficulty: string;
  selectedDeck: string;
  canResume: boolean;
  legacyPoints: number;
}

export interface StartScreenViewModel extends StartScreenInput {
  screen: 'start';
  primaryAction: 'start';
  secondaryAction: 'resume' | null;
}

export function selectStartScreen(input: StartScreenInput): StartScreenViewModel {
  return {
    screen: 'start',
    primaryAction: 'start',
    secondaryAction: input.canResume ? 'resume' : null,
    ...input
  };
}

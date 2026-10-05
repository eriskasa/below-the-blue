export type EncounterContent = {
  title: string;
  replayTitle?: string;
  description: string;
  instructionTitle: string;
  instructionText: string;
  hintText: string;
  successText: string;
  watchText?: string;
  repeatText?: string;
  retryText?: string;
};

export type EncounterStage = "idle" | "invitation" | "instruction" | "watching" | "repeat" | "retry" | "celebration" | "message";
export type EncounterSnapshot = {
  stage: EncounterStage;
  highlightedFish: number | null;
  hintOpen: boolean;
  completed: boolean;
  replayable: boolean;
};

export function encounterLocksMovement(stage: EncounterStage) {
  return stage !== "idle" && stage !== "invitation";
}

export function encounterRequestsFocus(stage: EncounterStage) {
  return encounterLocksMovement(stage);
}

// Other encounters provide this contract and their own copy; UI owns no puzzle logic.
export type EncounterController = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => EncounterSnapshot;
  play: () => void;
  start: () => void;
  leave: () => void;
  toggleHint: () => void;
};

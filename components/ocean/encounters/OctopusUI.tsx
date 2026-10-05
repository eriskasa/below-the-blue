import { useSyncExternalStore } from "react";
import { EncounterUI } from "./EncounterUI";
import { octopusEncounter, patternRounds } from "./octopusEncounter";
import type { OctopusEncounterSession } from "./octopusEncounter";
import type { PuzzlePresentation } from "./puzzlePresentation";
import styles from "./PatternPuzzle.module.css";

export function OctopusUI({ encounter, presentation }: { encounter: OctopusEncounterSession; presentation: PuzzlePresentation }) {
  const state = useSyncExternalStore(encounter.subscribe, encounter.getSnapshot, encounter.getSnapshot);
  const round = patternRounds[state.round];
  return <EncounterUI encounter={encounter} presentation={presentation}
    content={{ ...octopusEncounter.content, hintText: round.hint }}
    progress={<>
      <div className={styles.dots} aria-label={`Pattern ${state.round + 1} of 3`}>
        {patternRounds.map((_, index) => <span key={index} aria-hidden="true" data-lit={index <= state.round} />)}
      </div>
      <span className={styles.screenReader}>Sequence: {round.sequence.join(", ")}, missing pearl.</span>
    </>} />;
}

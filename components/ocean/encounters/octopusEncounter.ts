import type { Vector3 } from "three";
import { avoidEncounter } from "./encounterAvoidance.ts";
import { encounterLocksMovement } from "./encounter.ts";
import type { EncounterContent, EncounterSnapshot } from "./encounter.ts";

export const pearlColors = { Blue: "#70baff", Purple: "#b392e4", Seafoam: "#b3ebc8", Aqua: "#50d8d9", Coral: "#f4a08d" } as const;
export type PearlColor = keyof typeof pearlColors;
type PatternRound = { sequence: readonly PearlColor[]; choices: readonly PearlColor[]; correctAnswer: PearlColor; hint: string };
export const patternRounds = [
  { sequence: ["Blue", "Purple", "Blue", "Purple"], choices: ["Blue", "Purple", "Seafoam"], correctAnswer: "Blue", hint: "Look for what repeats." },
  { sequence: ["Aqua", "Aqua", "Coral", "Aqua", "Aqua", "Coral"], choices: ["Aqua", "Coral", "Purple"], correctAnswer: "Aqua", hint: "Try grouping the pearls together." },
  { sequence: ["Purple", "Blue", "Seafoam", "Purple", "Blue"], choices: ["Purple", "Blue", "Seafoam"], correctAnswer: "Seafoam", hint: "Follow the colors from the beginning." },
] as const satisfies readonly PatternRound[];
export const octopusEncounter = {
  id: "octopus-pattern-01" as const,
  position: { x: 0, y: -62, z: .6 }, radius: 5,
  collisionHalfSize: { x: 1.6, y: 1.5 },
  timing: { retry: 650, correct: 1300, celebration: 2000, message: 2200 },
  content: {
    title: "A curious octopus watches you...", replayTitle: "The octopus recognizes you...",
    description: "It seems to be arranging something.", instructionTitle: "Complete the Pattern",
    instructionText: "Choose what comes next.", repeatText: "Choose what comes next.",
    retryText: "Take another look.", hintText: patternRounds[0].hint,
    successText: "Patterns flow through everything.",
  } satisfies EncounterContent,
};
export function avoidOctopus(position: Vector3, velocity: Vector3) {
  avoidEncounter(position, velocity, octopusEncounter.position, octopusEncounter.collisionHalfSize);
}
type PatternSnapshot = EncounterSnapshot & { round: number; selected: PearlColor | null; answeredAt: number };
export function createOctopusEncounter(now = () => performance.now()) {
  let snapshot: PatternSnapshot = { stage: "idle", highlightedFish: null, hintOpen: false, completed: false, replayable: true, round: 0, selected: null, answeredAt: 0 };
  let inside = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<PatternSnapshot>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); };
  const cancel = () => clearTimeout(timer);
  const later = (ms: number, action: () => void) => { cancel(); timer = setTimeout(action, ms); };
  const leave = () => { cancel(); publish({ stage: "idle", hintOpen: false, selected: null }); };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    restoreCompletion(completed: boolean) { if (snapshot.stage === "idle") publish({ completed }); },
    proximity(distance: number) {
      if (encounterLocksMovement(snapshot.stage)) return;
      if (distance > octopusEncounter.radius) { inside = false; if (snapshot.stage === "invitation") leave(); }
      else if (!inside) { inside = true; publish({ stage: "invitation" }); }
    },
    play() { if (snapshot.stage === "invitation") publish({ stage: "repeat", round: 0, selected: null, hintOpen: false }); },
    start() { /* Patterns are visible immediately; no memory playback phase. */ },
    choose(color: PearlColor) {
      const round = patternRounds[snapshot.round];
      if (snapshot.stage !== "repeat" || !(round.choices as readonly PearlColor[]).includes(color)) return;
      publish({ selected: color, answeredAt: now(), hintOpen: false });
      if (color !== round.correctAnswer) {
        publish({ stage: "retry" });
        later(octopusEncounter.timing.retry, () => publish({ stage: "repeat", selected: null }));
        return;
      }
      publish({ stage: "celebration" });
      if (snapshot.round < patternRounds.length - 1) {
        later(octopusEncounter.timing.correct, () => publish({ stage: "repeat", round: snapshot.round + 1, selected: null }));
      } else {
        later(octopusEncounter.timing.celebration, () => {
          if (snapshot.completed) { leave(); return; }
          publish({ stage: "message" });
          later(octopusEncounter.timing.message, () => publish({ stage: "idle", completed: true, selected: null }));
        });
      }
    },
    toggleHint() { if (snapshot.stage === "repeat" || snapshot.stage === "retry") publish({ hintOpen: !snapshot.hintOpen }); },
    leave,
  };
}
export type OctopusEncounterSession = ReturnType<typeof createOctopusEncounter>;

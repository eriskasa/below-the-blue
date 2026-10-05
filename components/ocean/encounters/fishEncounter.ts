import { depthZones } from "../depth.ts";
import { encounterLocksMovement } from "./encounter.ts";
import type { EncounterContent, EncounterSnapshot } from "./encounter.ts";
import { avoidEncounter } from "./encounterAvoidance.ts";
import type { Vector3 } from "three";

const sunlit = depthZones.find(zone => zone.id === "sunlit")!;

export const fishEncounter = {
  position: { x: 0, y: -(sunlit.minDepth + sunlit.maxDepth) / 2, z: .6 },
  radius: 6,
  collisionHalfSize: { x: 3.3, y: .85 },
  fishCount: 3,
  formation: [{ x: -.23, y: -.16 }, { x: .23, y: -.16 }, { x: 0, y: .32 }],
  timing: { lead: 650, glow: 750, gap: 350, selection: 220, retry: 1000, celebration: 3400, message: 2400 },
  content: {
    title: "A curious school of fish...",
    replayTitle: "A familiar school of fish...",
    description: "They seem to be showing you a pattern.",
    instructionTitle: "Remember their glow.",
    instructionText: "Watch the order, then select the fish in the same sequence.",
    hintText: "Watch which fish glow first, second, and third. Repeat the same order.",
    successText: "The current remembers you.",
    watchText: "Watch their glow…",
    repeatText: "Your turn. Select the fish in order.",
    retryText: "Let's watch once more.",
  } satisfies EncounterContent,
};

export function avoidFishSchool(position: Vector3, velocity: Vector3) {
  avoidEncounter(position, velocity, fishEncounter.position, fishEncounter.collisionHalfSize);
}

export function createFishEncounter(random = Math.random) {
  let snapshot: EncounterSnapshot = { stage: "idle", highlightedFish: null, hintOpen: false, completed: false, replayable: true };
  let inside = false;
  let sequence: number[] = [];
  let selected = 0;
  let generation = 0;
  const listeners = new Set<() => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const publish = (patch: Partial<EncounterSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  };
  const cancel = () => {
    generation++;
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
  };
  const later = (delay: number, action: () => void) => {
    const scheduledGeneration = generation;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (scheduledGeneration === generation) action();
    }, delay);
    timers.add(timer);
  };
  const watch = () => {
    cancel();
    selected = 0;
    publish({ stage: "watching", highlightedFish: null });
    const { lead, glow, gap } = fishEncounter.timing;
    sequence.forEach((fish, index) => {
      const begins = lead + index * (glow + gap);
      later(begins, () => publish({ highlightedFish: fish }));
      later(begins + glow, () => publish({ highlightedFish: null }));
    });
    later(lead + sequence.length * (glow + gap), () => publish({ stage: "repeat" }));
  };
  const leave = () => {
    cancel();
    selected = 0;
    sequence = [];
    publish({ stage: "idle", highlightedFish: null, hintOpen: false });
  };

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    restoreCompletion(completed: boolean) {
      if (snapshot.stage === "idle") publish({ completed, replayable: true });
    },
    proximity(distance: number) {
      if (distance > fishEncounter.radius && inside && !encounterLocksMovement(snapshot.stage)) {
        inside = false;
        if (snapshot.stage !== "idle") leave();
      } else if (distance <= fishEncounter.radius && !inside) {
        inside = true;
        if (!snapshot.completed || snapshot.replayable) publish({ stage: "invitation" });
      }
    },
    play() {
      if (snapshot.stage === "invitation") publish({ stage: "instruction" });
    },
    start() {
      if (snapshot.stage !== "instruction") return;
      sequence = Array.from({ length: fishEncounter.fishCount }, (_, index) => index);
      for (let index = sequence.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [sequence[index], sequence[other]] = [sequence[other], sequence[index]];
      }
      watch();
    },
    selectFish(fish: number) {
      if (snapshot.stage !== "repeat" || snapshot.highlightedFish !== null || !Number.isInteger(fish) || fish < 0 || fish >= fishEncounter.fishCount) return;
      if (sequence[selected] !== fish) {
        cancel();
        publish({ stage: "retry", highlightedFish: null });
        later(fishEncounter.timing.retry, watch);
        return;
      }
      selected++;
      if (selected < sequence.length) {
        publish({ highlightedFish: fish });
        later(fishEncounter.timing.selection, () => publish({ highlightedFish: null }));
        return;
      }
      cancel();
      publish({ stage: "celebration", highlightedFish: null, hintOpen: false });
      later(fishEncounter.timing.celebration, () => {
        if (snapshot.completed) {
          publish({ stage: "idle", highlightedFish: null });
          return;
        }
        publish({ stage: "message" });
        later(fishEncounter.timing.message, () => {
          publish({ stage: "idle", completed: true, highlightedFish: null });
        });
      });
    },
    toggleHint() {
      if (["watching", "repeat", "retry"].includes(snapshot.stage)) publish({ hintOpen: !snapshot.hintOpen });
    },
    leave,
  };
}
export type FishEncounterSession = ReturnType<typeof createFishEncounter>;

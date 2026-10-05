import { encounterRequestsFocus } from "./encounter.ts";
import type { EncounterController } from "./encounter.ts";

export const puzzleTransitionMs = 600;
export type PuzzlePhase = "exploration" | "entering" | "active" | "leaving";
export type PuzzlePresentationSnapshot = { phase: PuzzlePhase; startedAt: number };

export function puzzleTransitionProgress(snapshot: PuzzlePresentationSnapshot, now: number) {
  const progress = Math.max(0, Math.min(1, (now - snapshot.startedAt) / puzzleTransitionMs));
  return progress * progress * (3 - 2 * progress);
}

// Presentation owns only entry/return timing and screen space. The encounter
// still owns every puzzle timer, answer, completion flag, and replay decision.
export function createPuzzlePresentation(encounter: EncounterController, now = () => performance.now()) {
  let snapshot: PuzzlePresentationSnapshot = { phase: "exploration", startedAt: 0 };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let area: HTMLDivElement | null = null;
  let targets: HTMLDivElement | null = null;
  const listeners = new Set<() => void>();
  const publish = (phase: PuzzlePhase) => {
    snapshot = { phase, startedAt: now() };
    listeners.forEach(listener => listener());
  };
  const transition = (phase: "entering" | "leaving") => {
    clearTimeout(timer);
    publish(phase);
    timer = setTimeout(() => publish(phase === "entering" ? "active" : "exploration"), puzzleTransitionMs);
  };

  return {
    getArea: () => area,
    getTargets: () => targets,
    setArea: (element: HTMLDivElement | null) => { area = element; },
    setTargets: (element: HTMLDivElement | null) => { targets = element; },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect() {
      const sync = () => {
        const requested = encounterRequestsFocus(encounter.getSnapshot().stage);
        if (requested && snapshot.phase === "exploration") transition("entering");
        else if (!requested && (snapshot.phase === "entering" || snapshot.phase === "active")) transition("leaving");
      };
      const unsubscribe = encounter.subscribe(sync);
      sync();
      return () => { unsubscribe(); clearTimeout(timer); };
    },
  };
}
export type PuzzlePresentation = ReturnType<typeof createPuzzlePresentation>;

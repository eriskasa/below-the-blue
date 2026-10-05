import { getDepthZone, worldYToDepth } from "../depth.ts";
import type { DepthState, DepthZone } from "../depth.ts";
import type { FishEncounterSession } from "../encounters/fishEncounter.ts";
import { encounterLocksMovement } from "../encounters/encounter.ts";
import type { PuzzlePresentation } from "../encounters/puzzlePresentation.ts";
import { defaultPosition, defaultProgress, progressSaveIntervalMs, readProgress, writeProgress } from "./progress.ts";
import type { EncounterId, PlayerPosition, ProgressStorage } from "./progress.ts";
import { travelDestination } from "./travel.ts";

type SavedEncounter = { id: EncounterId; encounter: Pick<FishEncounterSession, "getSnapshot" | "subscribe" | "restoreCompletion" | "leave">; presentation: PuzzlePresentation };
type TravelPhase = "idle" | "outgoing" | "covered" | "incoming";
export function createExplorationProgress(depth: DepthState, encounter: FishEncounterSession, presentation: PuzzlePresentation, now = () => performance.now(), additionalEncounters: SavedEncounter[] = []) {
  const encounters: SavedEncounter[] = [{ id: "fish-school", encounter, presentation }, ...additionalEncounters];
  let progress = defaultProgress();
  let storage: ProgressStorage | undefined;
  let dirty = false, lastSave = -Infinity;
  let relocation: PlayerPosition | null = null;
  let destination: PlayerPosition | null = null;
  let snapshot = { ready: false, currentZone: depth.currentZone.id, discoveredZones: progress.discoveredZones, travelPhase: "idle" as TravelPhase };
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<typeof snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  };
  const flush = () => {
    if (!snapshot.ready || !dirty) return;
    writeProgress(storage, progress);
    dirty = false;
    lastSave = now();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    prepare(nextStorage: ProgressStorage | undefined) {
      if (snapshot.ready) return;
      storage = nextStorage;
      progress = readProgress(storage);
      const position = progress.playerPosition;
      // A fresh/default start keeps the existing idle swim behavior.
      relocation = position.x === defaultPosition.x && position.depth === defaultPosition.depth ? null : position;
      depth.visited = new Set(progress.discoveredZones);
      depth.currentDepth = position.depth;
      depth.currentZone = getDepthZone(-position.depth);
      depth.zoneDifficulty = depth.currentZone.futureDifficulty;
      encounters.forEach(({ id, encounter }) => encounter.restoreCompletion(progress.completedEncounters.includes(id)));
      publish({ ready: true, currentZone: depth.currentZone.id, discoveredZones: progress.discoveredZones });
    },
    connectEncounter() {
      const disconnect = encounters.map(({ id, encounter }) => encounter.subscribe(() => {
        if (encounter.getSnapshot().completed && !progress.completedEncounters.includes(id)) {
          progress.completedEncounters = [...progress.completedEncounters, id];
          dirty = true;
        }
        // Entry, completion and dismissal also checkpoint the exploration position.
        flush();
      }));
      return () => disconnect.forEach(stop => stop());
    },
    observe(position: { x: number; y: number }, exploring: boolean) {
      if (!snapshot.ready || relocation || !exploring || snapshot.travelPhase !== "idle") return;
      const next = { x: position.x, depth: worldYToDepth(position.y) };
      if (next.x !== progress.playerPosition.x || next.depth !== progress.playerPosition.depth) {
        progress.playerPosition = next;
        dirty = true;
      }
      const discovered = [...depth.visited];
      const newZone = discovered.some(zone => !progress.discoveredZones.includes(zone));
      if (newZone) { progress.discoveredZones = discovered; dirty = true; }
      if (newZone || snapshot.currentZone !== depth.currentZone.id) publish({ currentZone: depth.currentZone.id, discoveredZones: progress.discoveredZones });
      if (newZone || now() - lastSave >= progressSaveIntervalMs) flush();
    },
    requestTravel(zone: DepthZone["id"]) {
      if (!snapshot.ready || relocation || snapshot.travelPhase !== "idle" || !progress.discoveredZones.includes(zone)
        || encounters.some(({ encounter, presentation }) => presentation.getSnapshot().phase !== "exploration" || encounterLocksMovement(encounter.getSnapshot().stage))) return false;
      destination = travelDestination(zone, progress.playerPosition.x);
      encounters.forEach(({ encounter }) => encounter.leave());
      publish({ travelPhase: "outgoing" });
      return true;
    },
    covered() {
      if (snapshot.travelPhase !== "outgoing" || !destination) return;
      relocation = destination;
      publish({ travelPhase: "covered" });
    },
    getRelocation: () => relocation,
    acknowledgeRelocation() {
      if (!relocation) return;
      progress.playerPosition = { ...relocation };
      depth.currentDepth = relocation.depth;
      depth.currentZone = getDepthZone(-relocation.depth);
      depth.zoneDifficulty = depth.currentZone.futureDifficulty;
      relocation = null;
      const traveling = snapshot.travelPhase === "covered";
      if (traveling) { dirty = true; flush(); }
      publish({ currentZone: depth.currentZone.id, travelPhase: traveling ? "incoming" : snapshot.travelPhase });
    },
    finishTravel() {
      if (snapshot.travelPhase !== "incoming") return;
      destination = null;
      publish({ travelPhase: "idle" });
    },
    flush,
  };
}
export type ExplorationProgress = ReturnType<typeof createExplorationProgress>;

import { depthZones, verticalWorldDepth } from "../depth.ts";
import type { DepthZone } from "../depth.ts";
import { gameplaySettings } from "../gameplaySettings.ts";

export const progressStorageKey = "whale-exploration-progress";
export const progressSaveIntervalMs = 2000;
export type PlayerPosition = { x: number; depth: number };
export const encounterIds = ["fish-school", "octopus-pattern-01"] as const;
export type EncounterId = typeof encounterIds[number];
export type Progress = {
  version: 1;
  playerPosition: PlayerPosition;
  discoveredZones: DepthZone["id"][];
  completedEncounters: EncounterId[];
};
export type ProgressStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const defaultPosition: PlayerPosition = { x: 0, depth: 1.4 };
export function defaultProgress(): Progress {
  return { version: 1, playerPosition: { ...defaultPosition }, discoveredZones: ["surface"], completedEncounters: [] };
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
export function parseProgress(raw: string | null): Progress {
  try {
    const data: unknown = JSON.parse(raw ?? "null");
    if (!record(data) || data.version !== 1 || !record(data.playerPosition)
      || !Array.isArray(data.discoveredZones) || !Array.isArray(data.completedEncounters)) return defaultProgress();
    const { x, depth } = data.playerPosition;
    if (typeof x !== "number" || typeof depth !== "number" || !Number.isFinite(x) || !Number.isFinite(depth)) return defaultProgress();
    const discovered = data.discoveredZones;
    const completed = data.completedEncounters;
    return {
      version: 1,
      playerPosition: {
        x: Math.max(-gameplaySettings.horizontalWorldHalfWidth, Math.min(gameplaySettings.horizontalWorldHalfWidth, x)),
        depth: Math.max(0, Math.min(verticalWorldDepth, depth)),
      },
      discoveredZones: depthZones.filter(zone => zone.id === "surface" || discovered.includes(zone.id)).map(zone => zone.id),
      completedEncounters: encounterIds.filter(id => completed.includes(id)),
    };
  } catch { return defaultProgress(); }
}
export function readProgress(storage: ProgressStorage | undefined) {
  try { return parseProgress(storage?.getItem(progressStorageKey) ?? null); }
  catch { return defaultProgress(); }
}
export function writeProgress(storage: ProgressStorage | undefined, progress: Progress) {
  try { storage?.setItem(progressStorageKey, JSON.stringify(progress)); } catch { /* Storage may be blocked or full. Keep playing in memory. */ }
}
export function resetProgress(storage: ProgressStorage | undefined = browserProgressStorage()) {
  try { storage?.removeItem(progressStorageKey); } catch { /* Optional development reset. */ }
}
export function browserProgressStorage(): ProgressStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; } catch { return undefined; }
}

import type { DepthZone } from "../depth.ts";
import { gameplaySettings } from "../gameplaySettings.ts";
import { octopusEncounter } from "../encounters/octopusEncounter.ts";
import { fishEncounter } from "../encounters/fishEncounter.ts";
import { whaleEncounterFootprint } from "../encounters/encounterAvoidance.ts";
import type { PlayerPosition } from "./progress.ts";

export const travelDepths: Record<DepthZone["id"], number> = {
  surface: 2, sunlit: 25, "blue-depths": 60, "deep-ocean": 105,
  twilight: 160, abyss: 225, "dark-abyss": 295, "ocean-floor": 340,
};
export const travelFadeMs = 360;
export function travelDestination(zone: DepthZone["id"], currentX: number): PlayerPosition {
  const depth = travelDepths[zone];
  // Keep clear of both the collision ellipse and the invitation's proximity area.
  let x = Math.max(-gameplaySettings.horizontalWorldHalfWidth + 1, Math.min(gameplaySettings.horizontalWorldHalfWidth - 1, currentX));
  for (const encounter of [fishEncounter, octopusEncounter]) {
    const dy = Math.max(0, Math.abs(-depth - encounter.position.y) - whaleEncounterFootprint.y);
    const clearance = encounter.radius + .5;
    if (dy >= clearance) continue;
    const safeX = whaleEncounterFootprint.x + Math.sqrt(clearance ** 2 - dy ** 2);
    const dx = x - encounter.position.x;
    if (Math.abs(dx) < safeX) x = encounter.position.x + (dx < 0 ? -safeX : safeX);
  }
  return { x, depth };
}

import type { Vector3 } from "three";

type Point = { x: number; y: number };
// Half-size of the 9.2-unit model, with a little room for its existing tilt.
export const whaleEncounterFootprint = { x: 4.6, y: 2.5 };
export const encounterPersonalSpace = .25;

export function encounterDistance(position: Point, center: Point, halfSize = whaleEncounterFootprint) {
  return Math.hypot(Math.max(0, Math.abs(position.x - center.x) - halfSize.x), Math.max(0, Math.abs(position.y - center.y) - halfSize.y));
}

// Expand a small creature ellipse by the whale's footprint. Invitation range is
// separate; steering changes only the inward part of input near this boundary.
export function avoidEncounter(position: Point, velocity: Vector3, center: Point, creatureHalfSize: Point, halfSize = whaleEncounterFootprint) {
  const dx = position.x - center.x, dy = position.y - center.y;
  const rx = creatureHalfSize.x + halfSize.x + encounterPersonalSpace;
  const ry = creatureHalfSize.y + halfSize.y + encounterPersonalSpace;
  const normalized = Math.hypot(dx / rx, dy / ry);
  const radius = normalized > 0 ? Math.hypot(dx, dy) / normalized : Math.min(rx, ry);
  // A small integration cushion lets existing acceleration brake before contact.
  const clearance = (normalized - 1) * radius - .12;
  const band = 1.5;
  if (clearance >= band) return;
  const gradient = Math.hypot(dx / (rx * rx), dy / (ry * ry));
  const nx = gradient > 0 ? dx / (rx * rx) / gradient : 0;
  const ny = gradient > 0 ? dy / (ry * ry) / gradient : 1;
  const inward = velocity.x * nx + velocity.y * ny;
  if (inward >= 0 && clearance >= 0) return;
  const speed = velocity.length();
  const removed = Math.max(0, -inward - Math.max(0, clearance) * 3.5);
  const tangent = velocity.y * nx - velocity.x * ny;
  const side = tangent < 0 ? -1 : 1;
  velocity.x += nx * removed - ny * side * removed * .65;
  velocity.y += ny * removed + nx * side * removed * .65;
  if (clearance < 0) {
    const push = Math.min(1.5, -clearance * 2);
    velocity.x += nx * push;
    velocity.y += ny * push;
  }
  velocity.clampLength(0, Math.max(speed, clearance < 0 ? 1.5 : 0));
}

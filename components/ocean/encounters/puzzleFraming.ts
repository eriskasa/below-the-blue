import type { Camera, Vector3 } from "three";

export type ScreenArea = { left: number; top: number; width: number; height: number };
export type ViewportSize = { width: number; height: number };

// Map a normalized formation point into the measured puzzle area, then onto a
// camera-facing plane. Exploration camera position, aspect and zoom can change.
export function puzzleObjectPosition(target: Vector3, camera: Camera, viewport: ViewportSize, area: ScreenArea, point: { x: number; y: number }, depth = 12) {
  const x = (area.left + area.width * (.5 + point.x)) / viewport.width * 2 - 1;
  const y = 1 - (area.top + area.height * (.5 + point.y)) / viewport.height * 2;
  return target.set(x * depth / camera.projectionMatrix.elements[0], y * depth / camera.projectionMatrix.elements[5], -depth).applyMatrix4(camera.matrixWorld);
}

export function puzzleObjectScale(camera: Camera, viewport: ViewportSize, pixelWidth: number, modelWidth: number, depth = 12) {
  return pixelWidth * 2 * depth / (viewport.width * camera.projectionMatrix.elements[0] * modelWidth);
}

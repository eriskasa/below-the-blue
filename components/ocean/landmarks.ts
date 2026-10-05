export function createLandmarks(width: number) {
  return [
    { x: width * .29, depth: -32, scale: .8 },
    { x: width * 1.5 + 35, depth: -44, scale: .6 },
    { x: -width - 48, depth: -37, scale: .7 },
  ];
}
export type Landmark = ReturnType<typeof createLandmarks>[number];

// Recycle only well beyond the frustum, then leave a generous empty stretch of horizon.
export function advanceLandmark(item: Landmark, all: Landmark[], travel: number, halfWidth: number, direction: number, random = Math.random) {
  const relativeX = item.x - travel;
  if (direction > 0 && relativeX < -halfWidth - 18) {
    item.x = Math.max(travel + halfWidth, ...all.map((landmark) => landmark.x)) + 45 + random() * 45;
    item.scale = .55 + random() * .3;
  } else if (direction < 0 && relativeX > halfWidth + 18) {
    item.x = Math.min(travel - halfWidth, ...all.map((landmark) => landmark.x)) - 45 - random() * 45;
    item.scale = .55 + random() * .3;
  }
}

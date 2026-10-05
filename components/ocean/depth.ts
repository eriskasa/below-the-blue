// Gameplay meters map directly to negative world Y. Each palette is reached at
// the end of its zone, blending continuously from the previous zone's palette.
export const depthZones = [
  { id: "surface", name: "Surface", minDepth: 0, maxDepth: 15, topColor: "#226b94", bottomColor: "#215d86", visualIntensity: 1, futureDifficulty: 0 },
  { id: "sunlit", name: "Sunlit Waters", minDepth: 15, maxDepth: 40, topColor: "#1d608b", bottomColor: "#17496e", visualIntensity: .85, futureDifficulty: 1 },
  { id: "blue-depths", name: "Blue Depths", minDepth: 40, maxDepth: 80, topColor: "#164a73", bottomColor: "#103653", visualIntensity: .65, futureDifficulty: 2 },
  { id: "deep-ocean", name: "Deep Ocean", minDepth: 80, maxDepth: 130, topColor: "#102f51", bottomColor: "#0b223d", visualIntensity: .45, futureDifficulty: 3 },
  { id: "twilight", name: "Twilight Zone", minDepth: 130, maxDepth: 190, topColor: "#0c213b", bottomColor: "#08172b", visualIntensity: .25, futureDifficulty: 4 },
  { id: "abyss", name: "Abyss", minDepth: 190, maxDepth: 260, topColor: "#081529", bottomColor: "#050e1d", visualIntensity: .12, futureDifficulty: 5 },
  { id: "dark-abyss", name: "Dark Abyss", minDepth: 260, maxDepth: 330, topColor: "#050d1c", bottomColor: "#030915", visualIntensity: .06, futureDifficulty: 6 },
  { id: "ocean-floor", name: "Ocean Floor", minDepth: 330, maxDepth: 350, topColor: "#09182a", bottomColor: "#061122", visualIntensity: .12, futureDifficulty: 7 },
] as const;
export type DepthZone = typeof depthZones[number];
export const verticalWorldDepth = depthZones[depthZones.length - 1].maxDepth;
// Framing space below the logical floor, including tall portrait viewports.
export const underwaterBackdropDepth = verticalWorldDepth + 80;

export function worldYToDepth(worldY: number) {
  return Math.max(0, Math.min(verticalWorldDepth, -worldY));
}

export function depthToWorldY(depth: number) {
  return -Math.max(0, Math.min(verticalWorldDepth, depth));
}

export function getDepthZone(worldY: number): DepthZone {
  const depth = worldYToDepth(worldY);
  return depthZones.find(zone => depth < zone.maxDepth) ?? depthZones[depthZones.length - 1];
}

export function smoothDepthProgress(depth: number, min: number, max: number) {
  const t = Math.max(0, Math.min(1, (depth - min) / (max - min)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function getDepthBlend(depth: number) {
  const to = getDepthZone(-depth);
  const index = depthZones.indexOf(to);
  const from = depthZones[Math.max(0, index - 1)];
  return { from, to, progress: smoothDepthProgress(depth, to.minDepth, to.maxDepth) };
}

export type ZoneDiscovery = { zone: DepthZone; depth: number; sequence: number };

export function createDepthState() {
  return {
    currentDepth: 0,
    currentZone: depthZones[0] as DepthZone,
    zoneDifficulty: depthZones[0].futureDifficulty as number,
    visited: new Set<DepthZone["id"]>([depthZones[0].id]),
    discovery: null as ZoneDiscovery | null,
  };
}
export type DepthState = ReturnType<typeof createDepthState>;

export function updateDepthState(state: DepthState, worldY: number) {
  state.currentDepth = worldYToDepth(worldY);
  state.currentZone = getDepthZone(worldY);
  state.zoneDifficulty = state.currentZone.futureDifficulty;
  if (state.visited.has(state.currentZone.id)) return;
  state.visited.add(state.currentZone.id);
  state.discovery = { zone: state.currentZone, depth: state.currentDepth, sequence: (state.discovery?.sequence ?? 0) + 1 };
}

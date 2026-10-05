import { Color } from "three";
import { depthZones, getDepthBlend, smoothDepthProgress, worldYToDepth } from "./depth.ts";

const palettes = new Map(depthZones.map(zone => [zone.id, {
  top: new Color(zone.topColor), bottom: new Color(zone.bottomColor),
}]));

export function createDepthVisuals() {
  return {
    top: new Color(depthZones[0].topColor),
    bottom: new Color(depthZones[0].bottomColor),
    intensity: 1,
    gradientOffset: 0,
  };
}

// Mutate existing colors/uniforms; the render loop never creates Color objects.
export function updateDepthVisuals(visuals: ReturnType<typeof createDepthVisuals>, cameraY: number) {
  const depth = worldYToDepth(cameraY);
  const { from, to, progress } = getDepthBlend(depth);
  const start = palettes.get(from.id)!;
  const end = palettes.get(to.id)!;
  visuals.top.lerpColors(start.top, end.top, progress);
  visuals.bottom.lerpColors(start.bottom, end.bottom, progress);
  visuals.intensity = from.visualIntensity + (to.visualIntensity - from.visualIntensity) * progress;
  // Keep the original surface gradient fixed, then gently carry it with the
  // camera so the deep backdrop retains a soft top-to-bottom color gradient.
  visuals.gradientOffset = depth * smoothDepthProgress(depth, depthZones[0].maxDepth, depthZones[1].maxDepth);
}

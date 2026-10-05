import { MathUtils } from "three";
import { gameplaySettings } from "./gameplaySettings.ts";

export function diveTarget(whaleY: number, visibleHeight: number, surfaceMargin = 0) {
  const threshold = visibleHeight * gameplaySettings.cameraFollowThreshold;
  const dive = Math.min(0, whaleY + threshold);
  // The distant cutaway needs extra framing room before its waterline clears
  // the viewport. Apply it only during a dive, preserving the surface view.
  return dive - surfaceMargin * MathUtils.smoothstep(-dive, 0, threshold);
}

export function followDive(currentY: number, whaleY: number, visibleHeight: number, delta: number, surfaceMargin = 0) {
  const target = diveTarget(whaleY, visibleHeight, surfaceMargin);
  return MathUtils.damp(currentY, target, gameplaySettings.cameraFollowDamping, MathUtils.clamp(delta, 0, .05));
}

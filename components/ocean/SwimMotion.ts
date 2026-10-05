import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { MathUtils } from "three";
import { sampleWaterHeight } from "./waves";
import type { WaveState } from "./waves";
import { advanceSwim, createSwimState } from "./swimBehavior";
import type { SwimSettings, SwimState, SwimSteering } from "./swimBehavior";

export { swimSettings } from "./swimBehavior";
export type { SwimSettings } from "./swimBehavior";
export type SwimMotion = RefObject<SwimState>;

export function useSwimMotion(settings: SwimSettings, water: RefObject<WaveState>, steer?: SwimSteering, enabled = true): SwimMotion {
  const motion = useRef(createSwimState());
  useFrame(({ camera, viewport }, delta) => {
    if (!enabled) return;
    const width = viewport.getCurrentViewport(camera, motion.current.position).width;
    // Leave room for the 9.2-unit model even when exploring the edge in portrait.
    const state = motion.current;
    const height = sampleWaterHeight(state.head.x + state.worldOffset, state.head.z, water.current);
    advanceSwim(state, delta, settings, MathUtils.clamp(width * .5 - 5, 1, 9.1), Math.random, height, steer);
  }, -2);
  return motion;
}

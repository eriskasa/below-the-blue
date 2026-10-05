import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { SwimMotion } from "./SwimMotion";
import { updateDepthState } from "./depth";
import type { DepthState } from "./depth";

export function DepthTracker({ motion, depth }: { motion: SwimMotion; depth: RefObject<DepthState> }) {
  useFrame(() => updateDepthState(depth.current, motion.current.worldPosition.y), -1);
  return null;
}

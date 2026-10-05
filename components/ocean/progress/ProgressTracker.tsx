import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import type { SwimMotion } from "../SwimMotion";
import { clearMovementInput } from "../movementInput";
import type { MovementInput } from "../movementInput";
import type { ExplorationProgress } from "./explorationProgress";
import { relocateWhale } from "./relocation";

export function ProgressTracker({ progress, motion, input, exploring }: {
  progress: ExplorationProgress; motion: SwimMotion; input: RefObject<MovementInput>; exploring: boolean;
}) {
  useFrame(() => {
    const position = progress.getRelocation();
    if (!position) return;
    clearMovementInput(input.current);
    relocateWhale(motion.current, position);
    progress.acknowledgeRelocation();
  }, -4);
  useFrame(() => progress.observe(motion.current.worldPosition, exploring), -.5);
  return null;
}

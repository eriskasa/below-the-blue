import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils } from "three";
import type { SwimMotion } from "./SwimMotion";
import { diveTarget, followDive } from "./cameraFollow";
import { oceanBounds } from "./waves";

export function Camera({ motion }: { motion: SwimMotion }) {
  const size = useThree((state) => state.size);
  const diveOffset = useRef(0);
  const relocationRevision = useRef(0);
  useFrame(({ camera, pointer }, delta) => {
    const t = motion.current.time;
    const dt = Math.min(delta, .05);
    const distance = Math.max(60, 47 / (size.width / size.height));
    const visibleHeight = 2 * Math.tan(22 * Math.PI / 360) * (distance - motion.current.position.z);
    const surfaceMargin = Math.max(0, motion.current.position.z - oceanBounds.nearZ) * Math.tan(22 * Math.PI / 360) + oceanBounds.backdropTop;
    if (relocationRevision.current !== motion.current.relocationRevision) {
      relocationRevision.current = motion.current.relocationRevision;
      diveOffset.current = diveTarget(motion.current.position.y, visibleHeight, surfaceMargin);
      camera.position.set(pointer.x * .65 + Math.sin(t * .15) * .18 + motion.current.position.x * .14,
        1.1 + pointer.y * .3 + Math.sin(t * .19) * .14 + diveOffset.current, distance + Math.sin(t * .12) * .22);
    }
    const previousOffset = diveOffset.current;
    diveOffset.current = followDive(previousOffset, motion.current.position.y, visibleHeight, dt, surfaceMargin);
    camera.position.x = MathUtils.damp(camera.position.x, pointer.x * .65 + Math.sin(t * .15) * .18 + motion.current.position.x * .14, 1.2, dt);
    camera.position.y = MathUtils.damp(camera.position.y - previousOffset, 1.1 + pointer.y * .3 + Math.sin(t * .19) * .14, 1.1, dt) + diveOffset.current;
    camera.position.z = MathUtils.damp(camera.position.z, distance + Math.sin(t * .12) * .22, 1.5, dt);
    camera.lookAt(camera.position.x * .22, diveOffset.current, -3);
  }, -.75);
  return null;
}

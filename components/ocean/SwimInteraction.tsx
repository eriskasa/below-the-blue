import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { SwimMotion } from "./SwimMotion";
import { setSwimInput, setSwimTarget } from "./swimBehavior";
import { bindMovementKeyboard, clearMovementInput } from "./movementInput";
import type { MovementInput } from "./movementInput";

export function SwimInteraction({ motion, input }: { motion: SwimMotion; input: RefObject<MovementInput> }) {
  const { camera, gl } = useThree();
  const revision = useRef(0);
  useFrame(() => {
    if (revision.current === input.current.revision) return;
    revision.current = input.current.revision;
    setSwimInput(motion.current, input.current.x, input.current.y);
  }, -2.5);
  useEffect(() => {
    const canvas = gl.domElement;
    const unbind = bindMovementKeyboard(canvas, input.current);
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const plane = new Plane(new Vector3(0, 0, 1));
    const target = new Vector3();
    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      canvas.focus({ preventScroll: true });
      clearMovementInput(input.current);
      revision.current = input.current.revision;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      plane.constant = -motion.current.position.z;
      if (raycaster.ray.intersectPlane(plane, target)) setSwimTarget(motion.current, target);
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      unbind();
    };
  }, [camera, gl, motion, input]);
  return null;
}

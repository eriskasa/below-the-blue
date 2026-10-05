import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Group } from "three";
import type { SwimMotion } from "./SwimMotion";
import { advanceLandmark, createLandmarks } from "./landmarks";

export function Island({ motion }: { motion: SwimMotion }) {
  const ref = useRef<Group>(null);
  const state = useRef({ initialized: false, landmarks: createLandmarks(50), depth: new Vector3() });
  useFrame(({ camera, viewport }) => {
    const group = ref.current;
    if (!group) return;
    const world = state.current;
    if (!world.initialized) {
      world.depth.set(0, 0, -32);
      world.landmarks = createLandmarks(viewport.getCurrentViewport(camera, world.depth).width);
      world.initialized = true;
    }
    world.landmarks.forEach((landmark, i) => {
      world.depth.set(0, 0, landmark.depth);
      const halfWidth = viewport.getCurrentViewport(camera, world.depth).width * .5;
      advanceLandmark(landmark, world.landmarks, motion.current.worldOffset, halfWidth, motion.current.velocity.x);
      const object = group.children[i];
      object.position.set(landmark.x - motion.current.worldOffset, .025, landmark.depth);
      object.scale.setScalar(landmark.scale);
    });
  });
  return <group ref={ref}>{[0, 1, 2].map((variant) => <group key={variant}>
    {variant === 1 ? <mesh scale={[.65, .55, .4]} position={[0, .25, 0]}>
      <icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#70b9ba" />
    </mesh> : <>
      <mesh scale={[variant === 2 ? 1 : 1.5, .24, .65]}>
        <sphereGeometry args={[1, 16, 8]} /><meshBasicMaterial color="#70b9ba" />
      </mesh>
      <mesh position={[-.8, .18, .04]} scale={[.25, .24, .23]}>
        <icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#70b4b8" />
      </mesh>
      {(variant === 2 ? [0] : [-.3, .4]).map((x, i) => <group key={x} position={[x, .16, 0]} scale={i ? .72 : 1}>
        <mesh position={[0, .29, 0]}>
          <cylinderGeometry args={[.025, .035, .58, 5]} /><meshBasicMaterial color="#6aabad" />
        </mesh>
        <mesh position={[0, .66, 0]} scale={[.28, .4, .24]}>
          <sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#69b1b3" />
        </mesh>
      </group>)}
    </>}
  </group>)}</group>;
}

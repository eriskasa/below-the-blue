import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import type { Group } from "three";

const fish = [
  { depth: -5, speed: .38, scale: .34, direction: 1, offset: -.72, level: .32, phase: 1.7 },
  { depth: -9, speed: .27, scale: .25, direction: -1, offset: .3, level: .39, phase: 4.1 },
  { depth: -7, speed: .44, scale: .29, direction: 1, offset: .82, level: .42, phase: 2.8 },
  { depth: -3, speed: .31, scale: .3, direction: -1, offset: -.15, level: .37, phase: 5.3 },
  { depth: -10, speed: .34, scale: .23, direction: 1, offset: -.4, level: .28, phase: .6 },
];

export function Fish() {
  const group = useRef<Group>(null);
  const state = useRef({
    time: 0, depth: new Vector3(),
    swimmers: fish.map((item) => ({ x: 0, initialized: false, speed: item.speed, targetSpeed: item.speed })),
  });
  useFrame(({ camera, viewport }, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, .05);
    const school = state.current;
    school.time += dt;
    group.current.children.forEach((swimmer, i) => {
      const config = fish[i];
      const movement = school.swimmers[i];
      school.depth.set(0, 0, config.depth);
      const view = viewport.getCurrentViewport(camera, school.depth);
      const boundary = view.width * .5 + 1.5;
      if (!movement.initialized) {
        movement.x = config.offset * boundary;
        movement.initialized = true;
      }
      movement.speed = MathUtils.damp(movement.speed, movement.targetSpeed, .4, dt);
      movement.x += movement.speed * config.direction * dt;
      if (movement.x * config.direction > boundary) {
        movement.x = -config.direction * (boundary + 1 + Math.random() * 4);
        movement.targetSpeed = config.speed * (.75 + Math.random() * .5);
      }
      swimmer.position.set(movement.x, -view.height * config.level + Math.sin(school.time * (.24 + i * .037) + config.phase) * .2, config.depth);
      swimmer.rotation.z = Math.cos(school.time * .3 + config.phase) * .035;
      // Each fish has its own tail beat, unrelated to the whale and other scenery.
      swimmer.children[1].rotation.y = Math.sin(school.time * (2.2 + i * .31) + config.phase) * .32;
    });
  });
  return <group ref={group}>{fish.map((item, i) => <group key={i} scale={[item.scale * item.direction, item.scale, item.scale]}>
    <mesh scale={[1, .32, .23]}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial color={i % 2 ? "#347b97" : "#428ba3"} />
    </mesh>
    <group position={[-.85, 0, 0]}>
      <mesh position={[-.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[.42, .65, .16]}>
        <coneGeometry args={[1, 1, 3]} />
        <meshBasicMaterial color="#367f99" />
      </mesh>
    </group>
  </group>)}</group>;
}

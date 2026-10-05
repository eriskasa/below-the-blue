import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { DataTexture, LinearFilter, Vector3 } from "three";
import type { BufferGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import type { SwimMotion } from "./SwimMotion";
import { swimSettings } from "./swimBehavior";
import { oceanSettings, sampleWaterHeight } from "./waves";
import type { WaveState } from "./waves";

type EffectMesh = Mesh<BufferGeometry, MeshBasicMaterial>;
const rippleCount = 5;
const wakeCount = 20;
const dropletCount = 5;
const rippleSlots = Array.from({ length: rippleCount }, (_, i) => i);
const wakeSlots = Array.from({ length: wakeCount }, (_, i) => i);
const dropletSlots = Array.from({ length: dropletCount }, (_, i) => i);

export function WaterInteraction({ motion, water }: { motion: SwimMotion; water: RefObject<WaveState> }) {
  // Feather the existing surface ring instead of drawing a hard pale annulus at grazing angles.
  const rippleMask = useMemo(() => {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
      const alpha = Math.exp(-(((radius - .72) / .14) ** 2)) * Math.max(0, Math.min(1, (1 - radius) / .12));
      const offset = (y * size + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = Math.round(alpha * 255);
      data[offset + 3] = 255;
    }
    const texture = new DataTexture(data, size, size);
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => rippleMask.dispose(), [rippleMask]);
  const ripples = useRef<Group>(null);
  const wake = useRef<Group>(null);
  const splash = useRef<Group>(null);
  const state = useRef({
    rippleAges: Array<number>(rippleCount).fill(10), wakeAges: Array<number>(wakeCount).fill(10),
    rippleIndex: 0, wakeIndex: 0, lastWake: 0, lastRipple: -10,
    above: false, splashAge: 10, splashOrigin: new Vector3(), lastOffset: 0,
  });
  useFrame((_, delta) => {
    if (!ripples.current || !wake.current || !splash.current) return;
    const dt = Math.min(delta, .05);
    const whale = motion.current;
    const effects = state.current;
    const shift = whale.worldOffset - effects.lastOffset;
    effects.lastOffset = whale.worldOffset;
    for (const child of ripples.current.children) child.position.x -= shift;
    for (const child of wake.current.children) child.position.x -= shift;
    effects.splashOrigin.x -= shift;
    const surface = sampleWaterHeight(whale.head.x + whale.worldOffset, whale.head.z, water.current);
    // Hysteresis prevents bobbing at the boundary from repeatedly creating splashes.
    const emerging = !effects.above && whale.head.y > surface + .035;
    const diving = effects.above && whale.head.y < surface - .07;
    if (emerging || diving) effects.above = emerging;
    if ((emerging || diving) && whale.time - effects.lastRipple > 2) {
      const index = effects.rippleIndex++ % rippleCount;
      const mesh = ripples.current.children[index] as EffectMesh;
      mesh.position.set(whale.head.x, surface + .045, whale.head.z);
      effects.rippleAges[index] = 0;
      effects.lastRipple = whale.time;
      if (emerging) {
        effects.splashOrigin.copy(mesh.position);
        effects.splashAge = 0;
      }
    }
    if (whale.travelSpeed > swimSettings.normalSwimSpeed * 1.2 && whale.time - effects.lastWake > .24) {
      const index = effects.wakeIndex++ % wakeCount;
      const mesh = wake.current.children[index] as EffectMesh;
      mesh.position.copy(whale.wake);
      mesh.position.y = Math.min(mesh.position.y, -.15);
      effects.wakeAges[index] = 0;
      effects.lastWake = whale.time;
    }
    ripples.current.children.forEach((child, i) => {
      const mesh = child as EffectMesh;
      const age = effects.rippleAges[i] += dt;
      mesh.visible = age < 4.5;
      mesh.position.y = sampleWaterHeight(mesh.position.x + whale.worldOffset, mesh.position.z, water.current) + .045;
      const x = mesh.position.x + whale.worldOffset;
      const z = mesh.position.z;
      const dx = (sampleWaterHeight(x + .25, z, water.current) - sampleWaterHeight(x - .25, z, water.current)) * 2;
      const dz = (sampleWaterHeight(x, z + .25, water.current) - sampleWaterHeight(x, z - .25, water.current)) * 2;
      mesh.rotation.set(-Math.PI / 2 + Math.atan(dz), -Math.atan(dx), 0);
      mesh.scale.setScalar(.25 + age * .48);
      mesh.material.opacity = Math.sin(Math.min(1, age / 4.5) * Math.PI) * .16;
    });
    wake.current.children.forEach((child, i) => {
      const mesh = child as EffectMesh;
      const age = effects.wakeAges[i] += dt;
      mesh.visible = age < 3.5;
      mesh.scale.set(.18 + age * .22, .04 + age * .05, 1);
      mesh.position.y += dt * .055;
      mesh.material.opacity = Math.sin(Math.min(1, age / 3.5) * Math.PI) * .075;
    });
    effects.splashAge += dt;
    splash.current.children.forEach((child, i) => {
      const mesh = child as EffectMesh;
      const age = effects.splashAge;
      const angle = i / dropletCount * Math.PI * 2;
      mesh.visible = age < 1.2;
      mesh.position.copy(effects.splashOrigin);
      mesh.position.x += Math.cos(angle) * age * .32;
      mesh.position.z += Math.sin(angle) * age * .32;
      mesh.position.y += Math.max(0, Math.sin(age / 1.2 * Math.PI)) * .14;
      mesh.material.opacity = Math.max(0, 1 - age / 1.2) * .22;
    });
  });
  return <>
    <group ref={ripples}>{rippleSlots.map((i) => <mesh key={i} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial color={oceanSettings.reflectionColor} alphaMap={rippleMask} transparent opacity={0} depthWrite={false} />
    </mesh>)}</group>
    <group ref={wake}>{wakeSlots.map((i) => <mesh key={i} visible={false}>
      <circleGeometry args={[1, 20]} />
      <meshBasicMaterial color="#7ad0db" transparent opacity={0} depthWrite={false} />
    </mesh>)}</group>
    <group ref={splash}>{dropletSlots.map((i) => <mesh key={i} visible={false} scale={[.025, .045, .025]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color={oceanSettings.reflectionColor} transparent opacity={0} depthWrite={false} />
    </mesh>)}</group>
  </>;
}

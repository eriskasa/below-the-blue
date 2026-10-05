import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Box3, Color, Group, Mesh, MeshStandardMaterial, ShaderMaterial, Vector3 } from "three";
import { whaleVertex, whaleFragment } from "./whaleShaders";
import { swimSettings, type SwimMotion, type SwimSettings } from "./SwimMotion";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { RefObject } from "react";
import type { WaveState } from "./waves";
import type { WhaleColor } from "./ui/preferences";
import { useWhaleBodyColor } from "./ui/useWhaleBodyColor";

// Source geometry and UVs are preserved; the GPU bends the single unrigged mesh.
const asset = { url: "/models/whale.glb", length: 9.2, rotation: [0, 0, 0] as const };

function swimmingMaterial(source: MeshStandardMaterial, settings: SwimSettings) {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: source.map }, uHasMap: { value: Boolean(source.map) },
      uPurple: { value: new Color("#926ab3") }, uTail: { value: new Color("#88458f") },
      uEye: { value: new Color("#dffaff") }, uTime: { value: 0 },
      uTailStrength: { value: settings.tailStrength }, uBodyWave: { value: settings.bodyWave },
      uFinStrength: { value: settings.finStrength },
      uWaterTime: { value: 0 }, uSwellProgress: { value: 1 }, uSwellStrength: { value: 0 },
      uSwellCenter: { value: 0 }, uTravel: { value: 0 },
    },
    vertexShader: whaleVertex,
    fragmentShader: whaleFragment,
  });
}

export function Whale({ motion, water, color, settings = swimSettings }: { motion: SwimMotion; water: RefObject<WaveState>; color: WhaleColor; settings?: SwimSettings }) {
  const { scene } = useGLTF(asset.url);
  const ref = useRef<Group>(null);
  const materials = useRef<ShaderMaterial[]>([]);
  const model = useMemo(() => {
    const object = clone(scene);
    object.rotation.set(...asset.rotation);
    object.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(object);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const wrapper = new Group();
    object.position.sub(center);
    wrapper.add(object);
    wrapper.scale.setScalar(asset.length / Math.max(size.x, size.y, size.z));
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.material = Array.isArray(child.material)
        ? child.material.map((material: MeshStandardMaterial) => swimmingMaterial(material, settings)) : swimmingMaterial(child.material, settings);
    });
    return wrapper;
  }, [scene, settings]);
  useWhaleBodyColor(model, color);
  useEffect(() => {
    const owned: ShaderMaterial[] = [];
    model.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const list = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of list) if (material instanceof ShaderMaterial) owned.push(material);
    });
    materials.current = owned;
    return () => { owned.forEach((material) => material.dispose()); };
  }, [model]);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.copy(motion.current.position);
    ref.current.quaternion.copy(motion.current.orientation);
    for (const material of materials.current) {
      // eslint-disable-next-line react-hooks/immutability -- R3F uniforms are mutable GPU state, not React render state.
      material.uniforms.uTime.value = motion.current.phase;
      material.uniforms.uWaterTime.value = water.current.time;
      material.uniforms.uSwellProgress.value = water.current.progress;
      material.uniforms.uSwellStrength.value = water.current.strength;
      material.uniforms.uSwellCenter.value = water.current.centerX;
      material.uniforms.uTravel.value = motion.current.worldOffset;
    }
  });
  return <group ref={ref}><primitive object={model} dispose={null} /></group>;
}

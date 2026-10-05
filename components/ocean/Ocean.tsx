import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DoubleSide, ShaderMaterial } from "three";
import { oceanBounds, oceanSettings } from "./waves";
import { oceanFragment, oceanVertex } from "./oceanShaders";
import type { WaveState } from "./waves";
import type { SwimMotion } from "./SwimMotion";

export function Ocean({ water, motion }: { water: RefObject<WaveState>; motion: SwimMotion }) {
  const ref = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uWaterTime: { value: 0 }, uSwellProgress: { value: 1 }, uSwellStrength: { value: 0 },
    uTravel: { value: 0 }, uSwellCenter: { value: 0 },
    uSurface: { value: new Color(oceanSettings.surfaceColor) },
    uMiddle: { value: new Color(oceanSettings.middleColor) },
    uDeep: { value: new Color(oceanSettings.deepColor) },
    uReflection: { value: new Color(oceanSettings.reflectionColor) },
    uHighlight: { value: new Color(oceanSettings.highlightColor) },
    uRoughness: { value: oceanSettings.roughness },
    uSpecularStrength: { value: oceanSettings.specularStrength },
    uReflectionStrength: { value: oceanSettings.reflectionStrength },
  }), []);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.uniforms.uWaterTime.value = water.current.time;
    ref.current.uniforms.uSwellProgress.value = water.current.progress;
    ref.current.uniforms.uSwellStrength.value = water.current.strength;
    ref.current.uniforms.uSwellCenter.value = water.current.centerX;
    ref.current.uniforms.uTravel.value = motion.current.worldOffset;
  });
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (oceanBounds.nearZ + oceanBounds.farZ) * .5]}>
    <planeGeometry args={[oceanBounds.width, oceanBounds.nearZ - oceanBounds.farZ, oceanBounds.widthSegments, oceanBounds.depthSegments]} />
    <shaderMaterial ref={ref} uniforms={uniforms} side={DoubleSide}
      transparent depthWrite={false} vertexShader={oceanVertex} fragmentShader={oceanFragment} />
  </mesh>;
}

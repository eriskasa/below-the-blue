import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Vector2 } from "three";
import type { Mesh, ShaderMaterial } from "three";
import type { PuzzlePresentation } from "../encounters/puzzlePresentation";
import { puzzleObjectPosition, puzzleObjectScale } from "../encounters/puzzleFraming";

// The puzzle fish share the ocean canvas. Put its opaque panel behind their
// camera-facing plane (12 units), but in front of the exploration world.
const surfaceDepth = 14;
export function PuzzleSurface({ presentation }: { presentation: PuzzlePresentation }) {
  const mesh = useRef<Mesh>(null);
  const uniforms = useMemo(() => ({
    uColor: { value: new Color("#0d2534") },
    uSize: { value: new Vector2() },
    uRadius: { value: 28 },
    uOpacity: { value: 0 },
  }), []);
  const material = useRef<ShaderMaterial & { uniforms: typeof uniforms }>(null);
  useFrame(({ camera, size }) => {
    if (!mesh.current || !material.current) return;
    const panel = presentation.getArea()?.parentElement;
    mesh.current.visible = Boolean(panel);
    if (!panel) return;
    const area = panel.getBoundingClientRect();
    const style = getComputedStyle(panel);
    camera.updateMatrixWorld();
    puzzleObjectPosition(mesh.current.position, camera, size, area, { x: 0, y: 0 }, surfaceDepth);
    const unitsPerPixel = puzzleObjectScale(camera, size, 1, 1, surfaceDepth);
    mesh.current.scale.set(area.width * unitsPerPixel, area.height * unitsPerPixel, 1);
    mesh.current.quaternion.copy(camera.quaternion);
    material.current.uniforms.uSize.value.set(area.width, area.height);
    material.current.uniforms.uRadius.value = parseFloat(style.borderTopLeftRadius);
    // Match the existing panel entrance/exit, including reduced-motion styles.
    material.current.uniforms.uOpacity.value = Number(style.opacity);
  });
  return <mesh ref={mesh} visible={false}>
    <planeGeometry args={[1, 1]} />
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false}
      vertexShader={`varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`}
      fragmentShader={`varying vec2 vUv;
        uniform vec3 uColor;
        uniform vec2 uSize;
        uniform float uRadius, uOpacity;
        void main() {
          vec2 q = abs((vUv - .5) * uSize) - (uSize * .5 - uRadius);
          float edge = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - uRadius;
          float coverage = 1. - smoothstep(-.5, .5, edge);
          if (coverage == 0.) discard;
          gl_FragColor = vec4(uColor, coverage * uOpacity);
          #include <colorspace_fragment>
        }`} />
  </mesh>;
}

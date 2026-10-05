import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, MeshStandardMaterial, type Group } from "three";
import { skyColors, skyGradient, skyVertex } from "./Sky";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import type { SwimMotion } from "./SwimMotion";

const banks = [
  { position: [-18, 5.4, -38], scale: [1.2, 1.15, 1.4] },
  { position: [-10, 5.8, -40], scale: [1.15, 1.0, 1.3] },
  { position: [-1, 5.9, -36], scale: [1.15, 1.3, 1.5] },
  { position: [8, 6.1, -39], scale: [1.15, 1.1, 1.4] },
  { position: [15, 5.7, -35], scale: [1.0, 1.3, 1.2] },
  { position: [21, 5.5, -37], scale: [1.1, 1.15, 1.5] },
  { position: [-19, 3.7, -23], scale: [1.3, 1.2, 1.5] },
  { position: [-8, 4.5, -21], scale: [1.2, 1.1, 1.3] },
  { position: [1, 3.7, -25], scale: [1.1, 1.15, 1.5] },
  { position: [10, 4.8, -20], scale: [1.35, 1.3, 1.4] },
  { position: [20, 3.5, -24], scale: [1.1, 1.1, 1.5] },
] as const;

// Smoothly united ellipsoids produce one continuous cloud surface, rather than intersecting spheres.
function cloudGeometry() {
  const resolution = 96;
  const material = new MeshStandardMaterial();
  const volume = new MarchingCubes(resolution, material, false, false, 120000);
  volume.isolation = 0;
  const lobes = [
    [-3.8, .2, 0, 2.2, 1.7, 1.4], [-2, 1, 0, 1.8, 2.1, 1.6],
    [.5, 1.3, 0, 1.85, 2.4, 1.8], [3, .3, 0, 2.1, 1.7, 1.6],
    [-1.8, -.35, .3, 2.8, 1.4, 1.4], [1.7, -.15, .3, 2.9, 1.2, 1.4],
  ];
  for (let z=0; z<resolution; z++) for (let y=0; y<resolution; y++) for (let x=0; x<resolution; x++) {
    const px=(x/resolution*2-1)*8, py=(y/resolution*2-1)*4, pz=(z/resolution*2-1)*4;
    let distance=100;
    for (const [cx,cy,cz,rx,ry,rz] of lobes) {
      const d=(Math.hypot((px-cx)/rx,(py-cy)/ry,(pz-cz)/rz)-1)*Math.min(rx,ry,rz);
      const h=Math.max(.55-Math.abs(distance-d),0)/.55;
      distance=Math.min(distance,d)-h*h*.55*.25;
    }
    volume.field[x+y*resolution+z*resolution*resolution]=-distance;
  }
  volume.update();
  const geometry=volume.geometry.clone();
  geometry.scale(8,4,4);
  volume.geometry.dispose();
  material.dispose();
  return geometry;
}

export function Clouds({ motion }: { motion: SwimMotion }) {
  const ref = useRef<Group>(null);
  const geometry = useMemo(() => cloudGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((cloud, i) => {
      const bank = banks[i];
      const depthScale = (60-bank.position[2])/60;
      const travel = motion.current.worldOffset * (i < 6 ? .1 : .16);
      const x = bank.position[0]*depthScale + Math.sin(clock.elapsedTime*(.035+i*.002)+i)*.9 - travel;
      // Banks wrap only far outside the view; distant layers travel more slowly.
      cloud.position.x = ((x + 85) % 170 + 170) % 170 - 85;
      cloud.position.y = (bank.position[1]-(i<6?.6:.45))*depthScale + Math.sin(clock.elapsedTime*.065+i*1.7)*.18;
    });
  });
  return <group ref={ref}>{banks.map((bank, i) => <mesh key={i} geometry={geometry} position={[bank.position[0], bank.position[1] - (i < 6 ? .6 : .45), bank.position[2]]} scale={[bank.scale[0]*(60-bank.position[2])/60, bank.scale[1]*(60-bank.position[2])/60, bank.scale[2]]}>
    <shaderMaterial uniforms={{ ...skyColors, uLayer: { value: i < 6 ? .42 : .64 }, uPale: { value: new Color("#9ee1d8") } }} vertexShader={skyVertex.replace("varying vec3 vWorld;", "varying vec3 vWorld; varying vec3 vNormal;").replace("vWorld =", "vNormal = normalize(normalMatrix * normal); vWorld =")} fragmentShader={`
      varying vec3 vWorld, vNormal;
      uniform vec3 uHorizon, uSky, uMiddle, uPale;
      uniform float uLayer;
      ${skyGradient}
      void main() {
        vec3 sky = skyColor(vWorld.y*60./(60.-vWorld.z));
        float haze = smoothstep(2.8, 9.5, vWorld.y*60./(60.-vWorld.z));
        vec3 pale = uPale * (.91 + .14 * max(dot(normalize(vNormal), normalize(vec3(-.4,.8,1.))),0.));
        gl_FragColor = vec4(mix(sky, pale, haze * uLayer), 1.);
        #include <colorspace_fragment>
      }
    `} />
  </mesh>)}</group>;
}

import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, ShaderMaterial } from "three";
import { skyVertex } from "./Sky";
import { oceanBounds, waveGLSL } from "./waves";
import type { WaveState } from "./waves";
import type { SwimMotion } from "./SwimMotion";
import { underwaterBackdropDepth } from "./depth";
import { createDepthVisuals, updateDepthVisuals } from "./depthVisuals";

export function Underwater({ water, motion }: { water: RefObject<WaveState>; motion: SwimMotion }) {
  const material = useRef<ShaderMaterial>(null);
  const particles = useRef<ShaderMaterial>(null);
  const visuals = useMemo(() => createDepthVisuals(), []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uWater: { value: visuals.top },
    uDeep: { value: visuals.bottom },
    uGlow: { value: new Color("#189ed0") },
    uGradientOffset: { value: 0 }, uVisualIntensity: { value: 1 },
    uWaterTime: { value: 0 }, uSwellProgress: { value: 1 }, uSwellStrength: { value: 0 },
    uSwellCenter: { value: 0 }, uTravel: { value: 0 },
  }), [visuals]);
  const positions = useMemo(() => {
    const data = new Float32Array(230 * 3);
    const random = (n: number) => { const x = Math.sin(n*127.1)*43758.5453; return x-Math.floor(x); };
    for (let i=0;i<230;i++) {
      data[i*3]=(random(i+1)-.5)*55;
      data[i*3+1]=-random(i+301)*23-.6;
      data[i*3+2]=random(i+601)*24-10;
    }
    return data;
  }, []);
  useFrame(({ camera }, delta) => {
    updateDepthVisuals(visuals, camera.position.y);
    if (material.current) {
      material.current.uniforms.uGradientOffset.value = visuals.gradientOffset;
      material.current.uniforms.uVisualIntensity.value = visuals.intensity;
      material.current.uniforms.uTime.value += Math.min(delta,.05);
      material.current.uniforms.uWaterTime.value = water.current.time;
      material.current.uniforms.uSwellProgress.value = water.current.progress;
      material.current.uniforms.uSwellStrength.value = water.current.strength;
      material.current.uniforms.uSwellCenter.value = water.current.centerX;
      material.current.uniforms.uTravel.value = motion.current.worldOffset;
    }
    if (particles.current && material.current) particles.current.uniforms.uTime.value = material.current.uniforms.uTime.value;
  });
  return <group>
    <mesh position={[0, (-underwaterBackdropDepth + oceanBounds.backdropTop) * .5, -14]}>
      <boxGeometry args={[200, underwaterBackdropDepth + oceanBounds.backdropTop, 1]} />
      <shaderMaterial ref={material} uniforms={uniforms} alphaToCoverage vertexShader={skyVertex} fragmentShader={`
        ${waveGLSL}
        varying vec3 vWorld;
        uniform float uTime, uTravel, uGradientOffset, uVisualIntensity;
        uniform vec3 uWater, uDeep, uGlow;
        void main() {
          // Waterline and surface glow retain their existing world-space behavior.
          float coverage = 1.0;
          // Evaluate screen derivatives before branching, including on quads that straddle the boundary band.
          float pixelWidth = max(fwidth(vWorld.y), .0001);
          if (vWorld.y > -${oceanBounds.backdropTop.toFixed(3)}) {
            float boundary = vWorld.y - waterHeight(vec2(vWorld.x + uTravel, vWorld.z));
            coverage = 1.0 - smoothstep(-pixelWidth * .5, pixelWidth * .5, boundary);
            if (coverage <= 0.0) discard;
          }
          float depth = clamp((-vWorld.y - uGradientOffset) / 19., 0., 1.);
          vec2 center = vec2(sin(uTime*.13)*1.8, -1.3+sin(uTime*.17)*.5);
          vec2 lightPosition = (vWorld.xy-center)/vec2(9.,8.);
          float glow = exp(-dot(lightPosition,lightPosition));
          float caustic = sin(vWorld.x*.6+sin(vWorld.y*.5+uTime*.18)+uTime*.24);
          caustic *= sin(vWorld.y*.8-uTime*.2+vWorld.x*.24);
          vec3 water = mix(uWater,uDeep,depth);
          vec3 color = mix(water,uGlow,glow*.9);
          color += vec3(.003,.014,.018)*caustic*exp(-depth*2.)*uVisualIntensity;
          gl_FragColor = vec4(color,coverage);
          #include <colorspace_fragment>
        }
      `} />
    </mesh>
    <points frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]} /></bufferGeometry>
      <shaderMaterial ref={particles} transparent depthWrite={false} uniforms={{uTime:{value:0}}}
        vertexShader={`uniform float uTime; varying float vAlpha;
          void main(){
            vec3 p=position;
            p.x+=sin(uTime*.16+position.z)*.3+sin(uTime*.09)*.5;
            p.y=-.6-mod(-position.y+uTime*.075,23.);
            p.z+=sin(uTime*.11+position.x)*.25;
            vec4 view=modelViewMatrix*vec4(p,1.);
            gl_Position=projectionMatrix*view;
            gl_PointSize=clamp(120./-view.z,1.,3.5);
            vAlpha=(1.-smoothstep(-2.,-.6,p.y))*smoothstep(-24.,-19.,p.y)*.32;
          }`}
        fragmentShader={`varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.65,.9,1.,(1.-smoothstep(.15,1.,r))*vAlpha);}`} />
    </points>
  </group>;
}

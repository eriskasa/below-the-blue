import { Color } from "three";

export const skyVertex = `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.);
  }
`;

// Shared by sky and clouds so the lower cloud volumes disappear into the horizon haze.
export const skyGradient = `
  vec3 skyColor(float y) {
    float h = clamp(y / 11.25, 0., 1.);
    vec3 low = mix(uHorizon, uMiddle, smoothstep(0., .48, h));
    return mix(low, uSky, smoothstep(.25, 1., h));
  }
`;
export const skyColors = {
  uHorizon: { value: new Color("#cfdfd9") },
  uSky: { value: new Color("#46b5c0") },
  uMiddle: { value: new Color("#76d8ce") },
};

export function Sky() {
  return <mesh position={[0, 30, -60]}>
    <boxGeometry args={[200, 100, 1]} />
    <shaderMaterial uniforms={skyColors} vertexShader={skyVertex} fragmentShader={`
      varying vec3 vWorld;
      uniform vec3 uHorizon, uSky, uMiddle;
      ${skyGradient}
      void main() {
        gl_FragColor = vec4(skyColor(vWorld.y*60./(60.-vWorld.z)), 1.);
        #include <colorspace_fragment>
      }
    `} />
  </mesh>;
}

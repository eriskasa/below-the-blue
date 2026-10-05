import { MathUtils } from "three";

// Scene units and seconds. Edit here, then reload to rebuild the shared CPU/GPU wave model.
export const oceanSettings = {
  waveAmplitude: .18,
  waveLength: 48,
  waveSpeed: 1.15,
  secondaryAmplitude: .05,
  secondaryWaveLength: 34,
  secondarySpeed: .72,
  tertiaryAmplitude: .014,
  tertiaryWaveLength: 71,
  tertiarySpeed: .48,
  swellAmplitude: .1,
  swellWidth: 16,
  swellDuration: 25,
  roughness: .88,
  specularStrength: .045,
  reflectionStrength: .12,
  surfaceColor: "#57baca",
  middleColor: "#379eb8",
  deepColor: "#226b94",
  reflectionColor: "#76d8ce",
  highlightColor: "#8ed9dc",
};

// Meet the existing underwater front face and stop in front of the sky at z=-59.5.
export const oceanBounds = {
  width: 180,
  nearZ: -13.5,
  farZ: -59.35,
  waveFadeStartZ: -42,
  widthSegments: 256,
  depthSegments: 64,
  // The backdrop is clipped to the wave height; its flat top must sit above every crest.
  backdropTop: Math.max(.6, oceanSettings.waveAmplitude + oceanSettings.secondaryAmplitude + oceanSettings.tertiaryAmplitude + oceanSettings.swellAmplitude + .1),
};

export function createWaveState() {
  return { time: 0, nextAt: 0, startsAt: -100, duration: oceanSettings.swellDuration, strength: 0, progress: 1, centerX: 0, initialized: false };
}
export type WaveState = ReturnType<typeof createWaveState>;
export function advanceWaves(state: WaveState, delta: number, random = Math.random, travel = 0) {
  state.time += MathUtils.clamp(delta, 0, .05);
  if (!state.initialized) { state.nextAt = 12 + random() * 13; state.initialized = true; }
  if (state.time >= state.nextAt) {
    state.startsAt = state.time;
    state.centerX = travel;
    state.duration = oceanSettings.swellDuration * (.9 + random() * .2);
    state.strength = oceanSettings.swellAmplitude * (.8 + random() * .2);
    state.nextAt = state.time + state.duration + 20 + random() * 25;
  }
  state.progress = MathUtils.clamp((state.time - state.startsAt) / state.duration, 0, 1);
}

function wave(amplitude: number, length: number, speed: number, direction: number, phase: number) {
  const frequency = Math.PI * 2 / length;
  return { amplitude, x: Math.cos(direction) * frequency, z: Math.sin(direction) * frequency, speed: -speed * frequency, phase };
}

// Three incommensurate, broad wave directions. The primary layer carries most of the shape.
const layers = [
  wave(oceanSettings.waveAmplitude, oceanSettings.waveLength, oceanSettings.waveSpeed, .18, 0),
  wave(oceanSettings.secondaryAmplitude, oceanSettings.secondaryWaveLength, oceanSettings.secondarySpeed, .93, 1.9),
  wave(oceanSettings.tertiaryAmplitude, oceanSettings.tertiaryWaveLength, oceanSettings.tertiarySpeed, -.38, 4.2),
];
const fadeLength = oceanBounds.waveFadeStartZ - oceanBounds.farZ;

export function sampleWaterHeight(x: number, z: number, state: WaveState) {
  let height = 0;
  for (const layer of layers) height += Math.sin(x * layer.x + z * layer.z + state.time * layer.speed + layer.phase) * layer.amplitude;
  const distance = (x - (state.centerX - 55 + state.progress * 110) + z * .12) / oceanSettings.swellWidth;
  const envelope = Math.sin(state.progress * Math.PI);
  height += Math.exp(-distance * distance) * envelope * envelope * state.strength;
  const fade = MathUtils.clamp((z - oceanBounds.farZ) / fadeLength, 0, 1);
  return height * fade * fade * (3 - 2 * fade);
}

// Generate both displacement and exact spatial derivatives from the same coefficients.
// Do not use pow(sin(...), 2): GLSL pow is undefined for a negative base at the endpoints.
const glsl = (value: number) => value.toFixed(12);
export const waveGLSL = `
  uniform float uWaterTime, uSwellProgress, uSwellStrength, uSwellCenter;
  vec3 waterSample(vec2 p) {
    float height = 0.0;
    vec2 gradient = vec2(0.0);
    ${layers.map((layer, i) => `
      vec2 k${i} = vec2(${glsl(layer.x)}, ${glsl(layer.z)});
      float phase${i} = dot(p, k${i}) + uWaterTime * ${glsl(layer.speed)} + ${glsl(layer.phase)};
      height += sin(phase${i}) * ${glsl(layer.amplitude)};
      gradient += cos(phase${i}) * ${glsl(layer.amplitude)} * k${i};
    `).join("")}
    float d = (p.x - (uSwellCenter - 55.0 + uSwellProgress * 110.0) + p.y * .12) / ${glsl(oceanSettings.swellWidth)};
    float envelope = sin(uSwellProgress * 3.141592653589793);
    float swell = exp(-d*d) * envelope * envelope * uSwellStrength;
    height += swell;
    gradient += -2.0 * d * swell * vec2(1.0, .12) / ${glsl(oceanSettings.swellWidth)};
    float f = clamp((p.y - ${glsl(oceanBounds.farZ)}) / ${glsl(fadeLength)}, 0.0, 1.0);
    float fade = f*f*(3.0-2.0*f);
    float fadeDerivative = 6.0*f*(1.0-f) / ${glsl(fadeLength)};
    return vec3(height * fade, gradient.x * fade, gradient.y * fade + height * fadeDerivative);
  }
  float waterHeight(vec2 p) { return waterSample(p).x; }
`;

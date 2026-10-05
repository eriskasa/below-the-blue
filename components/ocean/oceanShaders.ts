import { oceanBounds, waveGLSL } from "./waves";

export const oceanVertex = `
  ${waveGLSL}
  uniform float uTravel;
  varying vec3 vWorld, vWaterNormal;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 wave = waterSample(vec2(vWorld.x + uTravel, vWorld.z));
    vWorld.y += wave.x;
    vWaterNormal = normalize(vec3(-wave.y, 1.0, -wave.z));
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

export const oceanFragment = `
  uniform vec3 uSurface, uMiddle, uDeep, uReflection, uHighlight;
  uniform float uRoughness, uSpecularStrength, uReflectionStrength;
  varying vec3 vWorld, vWaterNormal;
  void main() {
    vec3 n = normalize(vWaterNormal);
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 light = normalize(vec3(-.35, .85, .4));
    float distanceIntoWater = clamp((${oceanBounds.nearZ.toFixed(3)} - vWorld.z) / ${(oceanBounds.nearZ - oceanBounds.farZ).toFixed(3)}, 0.0, 1.0);

    // Art-directed optical depth: broad color fields, without contour/crest masks.
    vec3 body = mix(uSurface, uMiddle, smoothstep(0.0, .8, distanceIntoWater));
    body = mix(body, uDeep, smoothstep(.2, 1.0, distanceIntoWater) * .24);
    float diffuse = .5 + .5 * dot(n, light);
    vec3 color = body * (.92 + .08 * diffuse);

    // A blurred cyan sky lobe rather than a white environment map or sharp sun reflection.
    float facing = clamp(dot(n, view), 0.0, 1.0);
    float fresnel = .02 + .98 * pow(1.0 - facing, 5.0);
    vec3 reflected = reflect(-view, n);
    vec3 skyReflection = mix(uSurface, uReflection, smoothstep(-.25, .65, reflected.y));
    float reflection = clamp(uReflectionStrength, 0.0, .35) * fresnel;
    color = mix(color, skyReflection, reflection);

    float roughness = clamp(uRoughness, .55, 1.0);
    vec3 halfway = normalize(light + view);
    float softHighlight = pow(max(dot(n, halfway), 0.0), mix(24.0, 3.0, roughness));
    color = mix(color, uHighlight, softHighlight * clamp(uSpecularStrength, 0.0, .2));

    // Distance-only haze and feathering: no height-dependent bright lines at the horizon.
    float haze = smoothstep(.35, 1.0, distanceIntoWater);
    color = mix(color, uReflection, haze * .32);
    float opacity = 1.0 - smoothstep(.78, 1.0, distanceIntoWater);
    gl_FragColor = vec4(color, opacity);
    #include <colorspace_fragment>
  }
`;

import { waveGLSL } from "./waves";

// The supplied mesh uses Z-down coordinates. Deform in anatomical X/right, Y/up, Z/front space.
export const whaleVertex = `
  uniform float uTime, uTailStrength, uBodyWave, uFinStrength;
  varying vec2 vUv;
  varying vec3 vWorld, vNormal;
  mat2 rotate2(float a) { return mat2(cos(a), sin(a), -sin(a), cos(a)); }
  vec3 deform(vec3 original, inout vec3 objectNormal) {
    vec3 n = vec3(objectNormal.x, -objectNormal.z, objectNormal.y);
    vec3 p = vec3(original.x, -original.z, original.y);
    float beat = uTime * 2.5;
    float tail = (1. - smoothstep(-.36, -.16, p.x)) * smoothstep(.30, .49, p.y);
    vec3 hinge = vec3(-.27, .44, 0.);
    vec3 tailOffset = p - hinge;
    mat2 tailBend = rotate2(sin(beat) * uTailStrength * tail);
    mat2 tailFlap = rotate2(cos(beat + .45) * uTailStrength * .6 * tail);
    tailOffset.xy = tailBend * tailOffset.xy;
    n.xy = tailBend * n.xy;
    n.yz = tailFlap * n.yz;
    tailOffset.yz = tailFlap * tailOffset.yz;
    p = hinge + tailOffset;

    float fin = (1. - smoothstep(.12, .28, p.y)) * smoothstep(.045, .13, abs(p.z));
    fin *= smoothstep(-.29, -.18, p.x) * (1. - smoothstep(.03, .19, p.x));
    float side = sign(p.z);
    vec3 root = vec3(-.045, .25, side * .065);
    vec3 finOffset = p - root;
    mat2 finFlap = rotate2(side * sin(beat * .65 + side * .7) * uFinStrength * fin);
    mat2 finSweep = rotate2(sin(beat * .65 + .8) * uFinStrength * .25 * fin);
    finOffset.yz = finFlap * finOffset.yz;
    n.yz = finFlap * n.yz;
    n.xy = finSweep * n.xy;
    finOffset.xy = finSweep * finOffset.xy;
    p = root + finOffset;

    // The wave travels from the body toward the tail; the face remains relatively steady.
    float body = 1. - smoothstep(.12, .49, p.x);
    p.z += sin(beat - p.x * 7.) * uBodyWave * body;
    p.y += sin(beat - p.x * 5. + .8) * uBodyWave * .4 * body;
    n.x += cos(beat-p.x*7.)*uBodyWave*body*7.*n.z;
    objectNormal = normalize(vec3(n.x,n.z,-n.y));
    return vec3(p.x, p.z, -p.y);
  }
  void main() {
    vUv = uv;
    vec3 movingNormal = normal;
    vec3 p = deform(position, movingNormal);
    // Rotate the shading frame with each region in the same pass; avoid three evaluations per vertex.
    vNormal = normalize(mat3(modelMatrix) * movingNormal);
    vWorld = (modelMatrix * vec4(p, 1.)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.);
  }
`;

export const whaleFragment = `
  ${waveGLSL}
  uniform float uTravel;
  uniform sampler2D uMap;
  uniform bool uHasMap;
  uniform float uTime;
  uniform vec3 uPurple, uTail, uEye;
  varying vec2 vUv;
  varying vec3 vWorld, vNormal;
  void main() {
    vec3 texel = uHasMap ? texture2D(uMap, vUv).rgb : vec3(0.);
    float eye = smoothstep(.48, .72, min(texel.r, min(texel.g, texel.b)));
    float surface = waterHeight(vec2(vWorld.x + uTravel, vWorld.z));
    float submerged = 1. - smoothstep(-.06, .06, vWorld.y - surface);
    vec3 base = mix(uTail, uPurple, submerged);
    vec3 n = normalize(vNormal);
    float broadLight = .5 + .5 * dot(n, normalize(vec3(-.4,.8,1.)));
    vec3 color = base * (.65 + .52 * broadLight);
    float rim = pow(1. - max(dot(n, normalize(cameraPosition-vWorld)),0.), 3.);
    color += vec3(.025,.035,.065) * rim * submerged;
    float caustic = pow(.5 + .5 * sin(vWorld.x * 1.4 + sin(vWorld.z * 1.6 + uTime*.3) + uTime*.4), 6.);
    color += vec3(.035,.085,.095) * caustic * submerged * max(n.y*.5+.5, .15);
    color = mix(color, uEye * (.9 + .1*broadLight), eye);
    float fog = (1.-exp(-length(cameraPosition-vWorld)*.0015)) * submerged;
    color = mix(color, vec3(.025,.23,.36), fog);
    gl_FragColor = vec4(color, 1.);
    #include <colorspace_fragment>
  }
`;

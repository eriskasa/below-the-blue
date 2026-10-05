import { Euler, MathUtils, Quaternion, Vector2, Vector3 } from "three";
import { gameplaySettings } from "./gameplaySettings.ts";
import { verticalWorldDepth } from "./depth.ts";

export const swimSettings = {
  swimSpeed: 1, normalSwimSpeed: 1.02, interactionSwimSpeed: gameplaySettings.normalSpeed,
  acceleration: gameplaySettings.acceleration, deceleration: gameplaySettings.deceleration,
  tailStrength: .42, bodyWave: .018, finStrength: .52,
  verticalBob: .18, turnStrength: .12, bankStrength: .09,
};
export type SwimSettings = typeof swimSettings;
export type Behavior = "cruise" | "quicken" | "edge" | "dive" | "rise" | "foreground" | "turn" | "surface";
const excursions: Behavior[] = ["quicken", "edge", "dive", "rise", "foreground", "turn"];
const cruiseMotion = { acceleration: .75, deceleration: .98, maxSpeed: 1.36 };
const smooth = (t: number) => { const x = MathUtils.clamp(t, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };

// Landmarks in the normalized source GLB; the nose points along +X.
export const headLandmark = new Vector3(3.5, .9, 0);
export const wakeLandmark = new Vector3(-2.6, -.4, 0);

export function createSwimState() {
  return {
    time: 0, phase: 0, speed: 1, travelSpeed: 0, relocationRevision: 0,
    position: new Vector3(0, -1.4, .6), worldPosition: new Vector3(0, -1.4, .6),
    velocity: new Vector3(), desiredVelocity: new Vector3(), worldOffset: 0,
    orientation: new Quaternion(), head: headLandmark.clone(), wake: wakeLandmark.clone(),
    behavior: "cruise" as Behavior, lastBehavior: "cruise" as Behavior,
    startsAt: 0, duration: 0, nextAt: 0, nextSurfaceAt: 0, nextTurnAt: 0,
    initialized: false, direction: 1, strength: 1, horizontalLimit: 7.2,
    interactionTarget: new Vector3(), interacting: false,
    input: new Vector2(), controlled: false,
    target: new Quaternion(), angles: new Euler(), steering: new Vector3(),
  };
}
export type SwimState = ReturnType<typeof createSwimState>;
export type SwimSteering = (position: Vector3, desiredVelocity: Vector3) => void;

export function setSwimInput(state: SwimState, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  state.input.set(x, y).clampLength(0, 1);
  state.controlled = true;
  state.interacting = false;
  state.behavior = "cruise";
}

// Input is in the rendered scene. Targets stay fixed in world space as the camera travels.
export function setSwimTarget(state: SwimState, point: Vector3) {
  if (![point.x, point.y, point.z].every(Number.isFinite)) return;
  state.interactionTarget.set(
    MathUtils.clamp(MathUtils.clamp(point.x, -state.horizontalLimit, state.horizontalLimit) + state.worldOffset, -gameplaySettings.horizontalWorldHalfWidth, gameplaySettings.horizontalWorldHalfWidth),
    MathUtils.clamp(point.y, -verticalWorldDepth, -gameplaySettings.surfaceClearance),
    state.worldPosition.z,
  );
  state.steering.copy(state.interactionTarget).sub(state.worldPosition).clampLength(0, 10);
  state.interactionTarget.copy(state.worldPosition).add(state.steering);
  state.interacting = true;
  state.controlled = true;
  state.input.set(0, 0);
  state.behavior = "cruise";
  // Do not reset velocity, tail phase, or orientation on repeated clicks.
}

export function advanceSwim(state: SwimState, delta: number, settings: SwimSettings, horizontalLimit: number, random = Math.random, surfaceHeight = 0, steer?: SwimSteering) {
  const dt = MathUtils.clamp(delta, 0, .05);
  if (dt === 0) return;
  const range = (low: number, high: number) => low + random() * (high - low);
  if (!state.initialized) {
    state.nextAt = range(6, 11);
    state.nextSurfaceAt = range(38, 58);
    state.nextTurnAt = range(65, 85);
    state.horizontalLimit = horizontalLimit;
    state.initialized = true;
  }
  state.time += dt;
  state.horizontalLimit = MathUtils.damp(state.horizontalLimit, horizontalLimit, 1.5, dt);
  if (!state.controlled && !state.interacting && state.time >= state.nextTurnAt) {
    state.direction *= -1;
    state.nextTurnAt = state.time + range(40, 75);
  }
  if (state.behavior !== "cruise" && state.time >= state.startsAt + state.duration) {
    state.lastBehavior = state.behavior;
    state.behavior = "cruise";
    state.nextAt = state.time + range(5, 10);
  }
  if (!state.controlled && !state.interacting && state.behavior === "cruise" && state.time >= state.nextAt) {
    if (state.time >= state.nextSurfaceAt) {
      state.behavior = "surface";
      state.nextSurfaceAt = state.time + range(65, 105);
    } else {
      const choices = excursions.filter((behavior) => behavior !== state.lastBehavior);
      state.behavior = choices[Math.floor(random() * choices.length)];
    }
    state.startsAt = state.time;
    state.duration = state.behavior === "surface" ? range(12, 15) : range(10, 17);
    state.strength = range(.8, 1);
  }
  const progress = (state.time - state.startsAt) / state.duration;
  const weight = state.behavior === "cruise" || state.interacting ? 0 : smooth(progress / .4) * smooth((1 - progress) / .4);
  const intensity = weight * state.strength;
  const cruiseSpeed = settings.normalSwimSpeed * (1 + .08 * Math.sin(state.time * .23));
  const acceleration = state.controlled ? settings.acceleration : cruiseMotion.acceleration;
  const deceleration = state.controlled ? settings.deceleration : cruiseMotion.deceleration;
  const desired = state.desiredVelocity;
  if (state.interacting) {
    state.interactionTarget.y = Math.min(state.interactionTarget.y, surfaceHeight - gameplaySettings.surfaceClearance);
    state.steering.copy(state.interactionTarget).sub(state.worldPosition);
    const distance = state.steering.length();
    // Slow inside the braking distance, including near clicks, without snapping to the target.
    const speed = Math.min(settings.interactionSwimSpeed, Math.sqrt(2 * settings.deceleration * distance), distance * 6);
    desired.copy(state.steering).normalize().multiplyScalar(speed);
    if (distance < .12 && state.velocity.length() < .22) {
      state.interacting = false;
      if (Math.abs(state.steering.x) > .01) state.direction = Math.sign(state.steering.x);
      state.behavior = "cruise";
      state.nextAt = state.time + range(5, 9);
      state.nextTurnAt = state.time + range(35, 60);
    }
  } else if (state.controlled) {
    desired.set(state.input.x, state.input.y, 0).multiplyScalar(settings.interactionSwimSpeed);
  } else {
    let y = -1.4 + Math.sin(state.phase * .8) * settings.verticalBob;
    let z = -1.5 + Math.cos(state.time * .065) * 2.1;
    if (state.behavior === "dive") { y -= intensity * 3.25; z -= intensity * .7; }
    if (state.behavior === "rise") y = MathUtils.lerp(y, -1.25, intensity);
    if (state.behavior === "foreground") z += intensity * 3.2;
    if (state.behavior === "surface") y = MathUtils.lerp(y, surfaceHeight - .95, weight);
    const faster = state.behavior === "quicken" ? 1 + .55 * intensity : 1;
    desired.set(state.direction * cruiseSpeed * faster, (y - state.worldPosition.y) * 1.4, (z - state.worldPosition.z) * .8);
    if (state.behavior === "turn") desired.z += Math.sin(progress * Math.PI * 2) * intensity * .5;
    desired.clampLength(0, cruiseMotion.maxSpeed);
  }
  steer?.(state.worldPosition, desired);
  // Brake before reaching world edges; these bounds are independent of camera framing.
  const minX = -gameplaySettings.horizontalWorldHalfWidth;
  const maxX = gameplaySettings.horizontalWorldHalfWidth;
  const minY = -verticalWorldDepth;
  const maxY = surfaceHeight - gameplaySettings.surfaceClearance;
  const brakingSpeed = (room: number) => Math.sqrt(2 * deceleration * Math.max(0, room));
  desired.x = MathUtils.clamp(desired.x, -brakingSpeed(state.worldPosition.x - minX), brakingSpeed(maxX - state.worldPosition.x));
  if (state.controlled) {
    desired.y = MathUtils.clamp(desired.y, -brakingSpeed(state.worldPosition.y - minY), brakingSpeed(maxY - state.worldPosition.y));
    // Follow a receding wave gently if it passes below the current center.
    if (state.worldPosition.y > maxY) desired.y = Math.min(desired.y, (maxY - state.worldPosition.y) * 8);
    desired.clampLength(0, settings.interactionSwimSpeed);
  }
  const releasing = state.controlled && !state.interacting && state.input.lengthSq() === 0;
  const reversing = state.velocity.dot(desired) < 0;
  const rate = releasing ? Math.max(deceleration, settings.interactionSwimSpeed / gameplaySettings.drift)
    : !reversing && desired.length() > state.velocity.length() ? acceleration : deceleration;
  state.steering.copy(desired).sub(state.velocity).clampLength(0, rate * dt);
  state.velocity.add(state.steering);
  const previousY = state.worldPosition.y;
  state.worldPosition.addScaledVector(state.velocity, dt);

  // Numerical guards only: normal travel slows before the edges above.
  const boundedX = MathUtils.clamp(state.worldPosition.x, minX, maxX);
  if (boundedX !== state.worldPosition.x) { state.worldPosition.x = boundedX; state.velocity.x = 0; }
  if (state.controlled) {
    const boundedY = MathUtils.clamp(state.worldPosition.y, minY, Math.max(maxY, previousY));
    if (boundedY !== state.worldPosition.y) { state.worldPosition.y = boundedY; state.velocity.y = 0; }
  }

  // A floating origin follows only after the whale has crossed the central framing area.
  // Landmarks subtract this same offset, so sustained travel actually carries them offscreen.
  const edgeWeight = state.behavior === "edge" ? intensity : 0;
  const followRate = state.controlled ? Math.max(2.5, settings.interactionSwimSpeed / Math.max(.25, state.horizontalLimit * .6)) : 2.5;
  const margin = state.controlled ? Math.max(.75, settings.interactionSwimSpeed / followRate + .15) : .75;
  const framing = Math.max(.1, Math.min(state.horizontalLimit - margin, state.horizontalLimit * (.76 + .18 * edgeWeight)));
  const localX = state.worldPosition.x - state.worldOffset;
  const follow = localX - MathUtils.clamp(localX, -framing, framing);
  state.worldOffset += follow * (1 - Math.exp(-dt * followRate));
  state.position.copy(state.worldPosition);
  state.position.x -= state.worldOffset;
  state.travelSpeed = state.velocity.length();
  state.speed = MathUtils.damp(state.speed, MathUtils.clamp(state.travelSpeed / settings.normalSwimSpeed, .65, 1.9), 2, dt);
  state.phase += dt * settings.swimSpeed * state.speed;
  if (state.controlled && Math.abs(state.velocity.x) > .04) state.direction = Math.sign(state.velocity.x);
  const heading = state.controlled ? (state.direction > 0 ? 0 : Math.PI)
    : Math.hypot(state.velocity.x, state.velocity.z) > .04 ? Math.atan2(-state.velocity.z, state.velocity.x) : state.angles.y;
  const pitch = MathUtils.clamp(state.velocity.y * .03, state.controlled ? -.14 : -.025, state.controlled ? .14 : .025);
  state.angles.set(
    Math.sin(state.phase * .65) * settings.bankStrength,
    heading + Math.sin(state.phase * .31) * settings.turnStrength * .3,
    pitch + Math.cos(state.phase * .8) * .025 + (state.behavior === "surface" ? weight * .09 : 0),
    "YXZ",
  );
  state.target.setFromEuler(state.angles);
  state.orientation.slerp(state.target, 1 - Math.exp(-dt * (state.controlled || state.interacting ? 4 : 1.5)));
  state.head.copy(headLandmark).applyQuaternion(state.orientation).add(state.position);
  state.wake.copy(wakeLandmark).applyQuaternion(state.orientation).add(state.position);
}

import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { advanceSwim, createSwimState, setSwimTarget, swimSettings } from "../components/ocean/swimBehavior.ts";
import { advanceLandmark, createLandmarks } from "../components/ocean/landmarks.ts";
import { advanceWaves, createWaveState, sampleWaterHeight } from "../components/ocean/waves.ts";
import { verticalWorldDepth } from "../components/ocean/depth.ts";

function random(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function cruise() {
  const state = createSwimState();
  advanceSwim(state, 1 / 60, swimSettings, 7.2, random(1));
  state.nextAt = state.nextTurnAt = 10000;
  return state;
}
function step(state, seconds, observe = () => {}) {
  const rng = random(45);
  for (let i = 0; i < seconds * 60; i++) {
    advanceSwim(state, 1 / 60, swimSettings, 7.2, rng);
    observe(state);
  }
}

test("near and far targets brake and arrive without position or speed resets", () => {
  for (const distance of [.25, 7]) {
    const state = cruise();
    setSwimTarget(state, state.position.clone().add(new Vector3(distance, 0, 0)));
    let peak = 0;
    let arrived = false;
    const previous = state.worldPosition.clone();
    const velocity = state.velocity.clone();
    for (let i = 0; i < 30 * 60 && state.interacting; i++) {
      advanceSwim(state, 1 / 60, swimSettings, 7.2, () => .5);
      assert.ok(state.worldPosition.distanceTo(previous) <= swimSettings.interactionSwimSpeed / 60 + .0001);
      assert.ok(state.velocity.distanceTo(velocity) <= Math.max(swimSettings.acceleration, swimSettings.deceleration) / 60 + .0001);
      peak = Math.max(peak, state.travelSpeed);
      previous.copy(state.worldPosition);
      velocity.copy(state.velocity);
      arrived = !state.interacting;
    }
    assert.ok(arrived);
    assert.ok(state.worldPosition.distanceTo(state.interactionTarget) < .12);
    assert.ok(state.travelSpeed < .22);
    assert.equal(state.behavior, "cruise");
    if (distance < 1) assert.ok(peak < swimSettings.interactionSwimSpeed * .5);
    else assert.ok(peak > swimSettings.interactionSwimSpeed * .9 && peak <= swimSettings.interactionSwimSpeed + 1e-9);
    step(state, 1);
    assert.ok(state.travelSpeed < .001, "arrival leaves the player at the chosen depth");
  }
});

test("repeated clicks retain velocity and phase, clamp distant targets, and reach the last target", () => {
  const state = cruise();
  setSwimTarget(state, new Vector3(7, -3, 1));
  step(state, 2);
  const phase = state.phase;
  const velocity = state.velocity.clone();
  const position = state.worldPosition.clone();
  setSwimTarget(state, new Vector3(-1000, -1000, 1000));
  assert.equal(state.phase, phase);
  assert.deepEqual(state.velocity, velocity);
  assert.deepEqual(state.worldPosition, position);
  assert.ok(state.interactionTarget.distanceTo(position) <= 10.00001);
  assert.ok(state.interactionTarget.y >= -verticalWorldDepth);
  assert.equal(state.interactionTarget.z, position.z, "targets stay in the 2.5D plane");
  step(state, .6);
  setSwimTarget(state, new Vector3(3, -2.5, 0));
  for (let i = 0; i < 30 * 60 && state.interacting; i++) advanceSwim(state, 1 / 60, swimSettings, 7.2, () => .5);
  assert.equal(state.interacting, false);
  assert.ok(state.worldPosition.distanceTo(state.interactionTarget) < .12);
});

test("right and left travel move landmarks oppositely and leave an empty horizon", () => {
  const state = cruise();
  const items = createLandmarks(50);
  const firstX = items[0].x;
  let emptyFrames = 0;
  let previousOffset = 0;
  step(state, 90, () => {
    assert.ok(state.worldOffset >= previousOffset - 1e-6);
    assert.ok(Math.abs(state.position.x) < 7.2);
    for (const item of items) advanceLandmark(item, items, state.worldOffset, 25, state.velocity.x, () => .5);
    if (items.every((item) => Math.abs(item.x - state.worldOffset) > 27)) emptyFrames++;
    previousOffset = state.worldOffset;
  });
  assert.ok(firstX - state.worldOffset < -27, "the original island must leave the left edge");
  assert.ok(emptyFrames > 10 * 60, "leave at least ten seconds of empty horizon");
  const before = state.worldOffset;
  state.direction = -1;
  step(state, 35);
  assert.ok(state.worldOffset < before - 10, "left travel must move the background right");
});

test("landmarks only recycle offscreen, with irregular generous spacing", () => {
  const items = createLandmarks(50);
  const rng = random(81);
  for (const direction of [1, -1]) {
    for (let i = 0; i < 800; i++) {
      const travel = i * direction;
      for (const item of items) {
        const oldX = item.x;
        advanceLandmark(item, items, travel, 25, direction, rng);
        if (oldX !== item.x) {
          assert.ok(Math.abs(oldX - travel) > 43);
          assert.ok((item.x - travel) * direction >= 70);
        }
      }
    }
  }
});

test("rolling waves remain calm and continuous while irregular swells follow the traveling world", () => {
  const state = createWaveState();
  const rng = random(99);
  const events = [];
  let lastStart = state.startsAt;
  let previous = sampleWaterHeight(0, -12, state);
  let maxChange = 0;
  let peak = 0;
  for (let i = 0; i < 300 * 60; i++) {
    const travel = i / 60 * .8;
    advanceWaves(state, 1 / 60, rng, travel);
    const height = sampleWaterHeight(travel, -12, state);
    maxChange = Math.max(maxChange, Math.abs(height - previous));
    peak = Math.max(peak, Math.abs(height));
    assert.ok(Math.abs(height) < .41);
    previous = height;
    if (state.startsAt !== lastStart) {
      events.push(state.startsAt);
      assert.equal(state.centerX, travel);
      lastStart = state.startsAt;
    }
  }
  assert.ok(maxChange < .015, `wave discontinuity ${maxChange}`);
  assert.ok(peak > .2);
  assert.ok(events.length > 3);
  assert.ok(events[0] < 30);
  assert.ok(new Set(events.slice(1).map((time, i) => Math.round(time - events[i]))).size > 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { advanceSwim, createSwimState, setSwimInput, setSwimTarget, swimSettings } from "../components/ocean/swimBehavior.ts";
import { createMovementInput, setMovementKey, setTouchMovement } from "../components/ocean/movementInput.ts";
import { gameplaySettings } from "../components/ocean/gameplaySettings.ts";
import { depthZones, depthToWorldY, getDepthZone, verticalWorldDepth } from "../components/ocean/depth.ts";
import { followDive } from "../components/ocean/cameraFollow.ts";

function player(y = -12) {
  const state = createSwimState();
  state.position.y = state.worldPosition.y = y;
  return state;
}
function step(state, seconds, fps = 60, limit = 7.2) {
  for (let frame = 0; frame < seconds * fps; frame++) advanceSwim(state, 1 / fps, swimSettings, limit, () => .5);
}

test("all eight movement keys translate directly; diagonals and touch share the same speed", () => {
  for (const [key, x, y] of [["ArrowUp", 0, 1], ["w", 0, 1], ["ArrowDown", 0, -1], ["s", 0, -1], ["ArrowLeft", -1, 0], ["a", -1, 0], ["ArrowRight", 1, 0], ["d", 1, 0]]) {
    const input = createMovementInput();
    setMovementKey(input, key, true);
    const state = player();
    setSwimInput(state, input.x, input.y);
    step(state, 1);
    assert.equal(Math.sign(state.velocity.x), x);
    assert.equal(Math.sign(state.velocity.y), y);
    assert.ok(Math.abs(state.travelSpeed - gameplaySettings.normalSpeed) < 1e-9);
    assert.equal(state.worldPosition.z, .6);
  }
  for (const [horizontal, vertical] of [["a", "w"], ["d", "w"], ["a", "s"], ["d", "s"]]) {
    const input = createMovementInput();
    setMovementKey(input, horizontal, true);
    setMovementKey(input, vertical, true);
    const keyboard = player(), touch = player();
    setSwimInput(keyboard, input.x, input.y);
    setTouchMovement(input, horizontal === "a" ? -1 : 1, vertical === "w" ? 1 : -1);
    setSwimInput(touch, input.touchX, input.touchY);
    step(keyboard, 1); step(touch, 1);
    assert.ok(keyboard.worldPosition.distanceTo(touch.worldPosition) < 1e-9);
    assert.ok(Math.abs(keyboard.travelSpeed - gameplaySettings.normalSpeed) < 1e-9);
  }
});

test("nearby travel is quick, release drift is short, and animation continues at rest", () => {
  for (const fps of [30, 60, 120]) {
    const state = player();
    setSwimInput(state, 1, 0);
    step(state, .75, fps);
    assert.ok(state.worldPosition.x > 3, "a nearby three-unit trip takes less than .75 seconds");
    const position = state.worldPosition.clone(), phase = state.phase;
    setSwimInput(state, 0, 0);
    step(state, .2, fps);
    assert.equal(state.travelSpeed, 0);
    assert.ok(state.worldPosition.distanceTo(position) > 0);
    assert.ok(state.worldPosition.distanceTo(position) < .45);
    assert.ok(state.phase > phase);
    const resting = state.worldPosition.clone();
    step(state, 3, fps);
    assert.deepEqual(state.worldPosition, resting);
  }
  const target = player();
  setSwimTarget(target, new Vector3(4, -12, .6));
  step(target, 1.6);
  assert.equal(target.interacting, false);
  assert.ok(target.worldPosition.distanceTo(new Vector3(4, -12, .6)) < .12);
});

test("world edges brake softly without escape, and horizontal framing fits portrait", () => {
  for (const [x, y] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, 1]]) {
    const state = player();
    setSwimInput(state, x, y);
    const boundarySeconds = Math.ceil(Math.max(gameplaySettings.horizontalWorldHalfWidth * 2, verticalWorldDepth) * Math.SQRT2 / gameplaySettings.normalSpeed) + 5;
    for (let i = 0; i < boundarySeconds * 60; i++) {
      const position = state.worldPosition.clone();
      advanceSwim(state, 1 / 60, swimSettings, 1, () => .5);
      assert.ok(state.worldPosition.distanceTo(position) <= gameplaySettings.normalSpeed / 60 + 1e-8);
      assert.ok(Math.abs(state.worldPosition.x) <= gameplaySettings.horizontalWorldHalfWidth);
      assert.ok(state.worldPosition.y >= -verticalWorldDepth);
      assert.ok(state.worldPosition.y <= -gameplaySettings.surfaceClearance);
      assert.ok(Math.abs(state.position.x) <= 1, "fast travel must fit narrow framing");
    }
    assert.ok(state.travelSpeed < .01);
    setSwimInput(state, -x, -y);
    step(state, .3);
    assert.ok(state.travelSpeed > 4, "leaving a boundary responds immediately");
  }
});

test("a dive and return use a continuous damped camera offset with no horizontal changes", () => {
  const state = player(-1.4);
  let cameraY = 0;
  const height = 24;
  assert.equal(followDive(0, -1.4, height, 1 / 60), 0);
  setSwimInput(state, 0, -1);
  const diveSeconds = Math.ceil(verticalWorldDepth / gameplaySettings.normalSpeed) + 3;
  for (let frame = 0; frame < diveSeconds * 60; frame++) {
    advanceSwim(state, 1 / 60, swimSettings, 7.2, () => .5);
    const next = followDive(cameraY, state.position.y, height, 1 / 60);
    assert.ok(Math.abs(next - cameraY) <= gameplaySettings.normalSpeed / 60 + .001);
    assert.ok(state.position.y - next > -height * .25);
    cameraY = next;
  }
  assert.equal(state.worldPosition.y, -verticalWorldDepth);
  assert.ok(cameraY < -50, "surface leaves the screen in deep water");
  assert.equal(state.worldPosition.x, 0);
  assert.equal(state.worldOffset, 0);
  setSwimInput(state, 0, 1);
  for (let frame = 0; frame < (diveSeconds + 1) * 60; frame++) {
    advanceSwim(state, 1 / 60, swimSettings, 7.2, () => .5);
    cameraY = followDive(cameraY, state.position.y, height, 1 / 60);
  }
  assert.ok(Math.abs(cameraY) < .001);
  assert.ok(state.position.y < 0 && state.position.y > -2);
});

test("tilt follows vertical input and settles during horizontal movement", () => {
  for (const direction of [-1, 1]) {
    const state = player(-20);
    setSwimInput(state, direction, 1);
    step(state, .7);
    assert.ok(state.angles.z > .08);
    setSwimInput(state, direction, -1);
    step(state, .7);
    assert.ok(state.angles.z < -.08);
    setSwimInput(state, direction, 0);
    step(state, .5);
    assert.ok(Math.abs(state.angles.z) <= .025);
    assert.ok(Math.abs(state.orientation.length() - 1) < 1e-9);
  }
});

test("depth zones cover the continuous world without gaps", () => {
  for (let i = 0; i < depthZones.length; i++) {
    const zone = depthZones[i];
    assert.equal(getDepthZone(depthToWorldY(zone.minDepth)), zone);
    assert.equal(zone.minDepth, i ? depthZones[i - 1].maxDepth : 0);
  }
  assert.equal(depthZones.at(-1).maxDepth, verticalWorldDepth);
  assert.equal(depthToWorldY(1000), -verticalWorldDepth);
  assert.equal(getDepthZone(-verticalWorldDepth), depthZones.at(-1));
});

import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { advanceSwim, createSwimState, setSwimInput, setSwimTarget, swimSettings } from "../components/ocean/swimBehavior.ts";
import { createMovementInput, joystickMovement, setMovementKey, setTouchMovement } from "../components/ocean/movementInput.ts";
import { avoidEncounter, encounterDistance, encounterPersonalSpace, whaleEncounterFootprint } from "../components/ocean/encounters/encounterAvoidance.ts";
import { avoidFishSchool, fishEncounter } from "../components/ocean/encounters/fishEncounter.ts";

function player(x, y) {
  const state = createSwimState();
  state.worldPosition.set(fishEncounter.position.x + x, fishEncounter.position.y + y, fishEncounter.position.z);
  state.position.copy(state.worldPosition);
  return state;
}
function frame(state, dt) { advanceSwim(state, dt, swimSettings, 7.2, () => .5, 0, avoidFishSchool); }
function outsideSchool(state) {
  const rx = fishEncounter.collisionHalfSize.x + whaleEncounterFootprint.x + encounterPersonalSpace;
  const ry = fishEncounter.collisionHalfSize.y + whaleEncounterFootprint.y + encounterPersonalSpace;
  return Math.hypot((state.worldPosition.x - fishEncounter.position.x) / rx, (state.worldPosition.y - fishEncounter.position.y) / ry);
}

test("the local school bubble never blocks the open water above, below or beside it", () => {
  for (const [x, y] of [[0, 6], [0, -6], [11, 0], [-11, 0], [8, 5], [-8, -5]]) {
    const velocity = new Vector3(-Math.sign(x) * 3, -Math.sign(y) * 5.2, 0);
    const expected = velocity.clone();
    avoidFishSchool(player(x, y).worldPosition, velocity);
    assert.deepEqual(velocity, expected, `open water at ${x},${y} must not contain an invisible wall`);
  }
  assert.ok(fishEncounter.collisionHalfSize.x < fishEncounter.radius);
  assert.ok(fishEncounter.collisionHalfSize.y < fishEncounter.radius);
});

test("approaches from every side avoid the local ellipse without changing speed or acceleration", () => {
  for (const fps of [20, 30, 60, 120]) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const x = Math.cos(angle), y = Math.sin(angle);
      const state = player(x * 18, y * 18);
      setSwimInput(state, -x, -y);
      let canInteract = false, sideways = 0;
      for (let i = 0; i < 8 * fps; i++) {
        const before = state.worldPosition.clone(), velocity = state.velocity.clone();
        frame(state, 1 / fps);
        assert.ok(outsideSchool(state) >= 1, `${fps} FPS, angle ${angle}: whale entered the local school ellipse`);
        assert.ok(state.worldPosition.distanceTo(before) <= swimSettings.interactionSwimSpeed / fps + 1e-9);
        assert.ok(state.velocity.distanceTo(velocity) <= Math.max(swimSettings.acceleration, swimSettings.deceleration) / fps + 1e-9);
        canInteract ||= encounterDistance(state.worldPosition, fishEncounter.position) <= fishEncounter.radius;
        sideways = Math.max(sideways, Math.abs((state.worldPosition.x - fishEncounter.position.x) * -y + (state.worldPosition.y - fishEncounter.position.y) * x));
      }
      assert.ok(canInteract, "invitation is reachable before collision steering begins");
      assert.ok(sideways > 1, "head-on input glides around the school");
    }
  }
});

test("outward and tangential input remain unchanged near the bubble", () => {
  for (const velocity of [new Vector3(0, 5.2, 0), new Vector3(5.2, 0, 0), new Vector3(-5.2, 0, 0)]) {
    const expected = velocity.clone();
    avoidFishSchool(player(0, 3.8).worldPosition, velocity);
    assert.deepEqual(velocity, expected);
  }
  const state = player(0, 3.8);
  setSwimInput(state, 0, 1);
  for (let i = 0; i < 60; i++) frame(state, 1 / 60);
  assert.ok(Math.abs(state.travelSpeed - swimSettings.interactionSwimSpeed) < 1e-9);
});

test("keyboard, joystick, and click movement share local avoidance", () => {
  const keyInput = createMovementInput(), touchInput = createMovementInput();
  setMovementKey(keyInput, "s", true);
  const stick = joystickMovement(0, 36);
  setTouchMovement(touchInput, stick.x, stick.y);
  const keyboard = player(0, 18), touch = player(0, 18);
  setSwimInput(keyboard, keyInput.x, keyInput.y);
  setSwimInput(touch, touchInput.x, touchInput.y);
  for (let i = 0; i < 600; i++) { frame(keyboard, 1 / 60); frame(touch, 1 / 60); }
  assert.deepEqual(touch.worldPosition, keyboard.worldPosition);
  const click = player(0, 12);
  setSwimTarget(click, new Vector3(fishEncounter.position.x, fishEncounter.position.y, fishEncounter.position.z));
  for (let i = 0; i < 900; i++) {
    frame(click, 1 / 60);
    assert.ok(outsideSchool(click) >= 1);
  }
});

test("local avoidance accepts another creature's ellipse and player footprint", () => {
  const desired = new Vector3(-3, 0, 0);
  avoidEncounter({ x: 106.5, y: -100 }, desired, { x: 100, y: -100 }, { x: 4, y: 1 }, { x: 2, y: 2 });
  assert.ok(desired.x > -3 && desired.y > 0);
  const far = new Vector3(-3, 0, 0);
  avoidEncounter({ x: 120, y: -100 }, far, { x: 100, y: -100 }, { x: 4, y: 1 }, { x: 2, y: 2 });
  assert.deepEqual(far, new Vector3(-3, 0, 0));
});

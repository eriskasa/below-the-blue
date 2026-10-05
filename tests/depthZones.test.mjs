import assert from "node:assert/strict";
import test from "node:test";
import { Color } from "three";
import { createDepthState, depthZones, getDepthZone, updateDepthState, verticalWorldDepth, worldYToDepth } from "../components/ocean/depth.ts";
import { createDepthVisuals, updateDepthVisuals } from "../components/ocean/depthVisuals.ts";
import { advanceSwim, createSwimState, setSwimInput, swimSettings } from "../components/ocean/swimBehavior.ts";
import { whaleColors } from "../components/ocean/ui/preferences.ts";

test("zone lookup uses exact contiguous ranges, including every boundary and the floor", () => {
  assert.deepEqual(depthZones.map(zone => [zone.minDepth, zone.maxDepth]), [
    [0, 15], [15, 40], [40, 80], [80, 130], [130, 190], [190, 260], [260, 330], [330, 350],
  ]);
  for (const [index, zone] of depthZones.entries()) {
    assert.equal(getDepthZone(-zone.minDepth), zone);
    assert.equal(getDepthZone(-(zone.maxDepth - .001)), zone);
    assert.equal(getDepthZone(-zone.maxDepth), depthZones[Math.min(index + 1, depthZones.length - 1)]);
    assert.equal(zone.futureDifficulty, index);
  }
  assert.equal(worldYToDepth(10), 0);
  assert.equal(worldYToDepth(-1000), verticalWorldDepth);
});

test("a continuous dive discovers every zone once, brakes at the floor, and ascends normally", () => {
  for (const fps of [30, 60, 120]) {
    const swim = createSwimState();
    const depth = createDepthState();
    const discoveries = [];
    let lastDiscovery = null;
    const step = () => {
      advanceSwim(swim, 1 / fps, swimSettings, 7.2, () => .5);
      updateDepthState(depth, swim.worldPosition.y);
      assert.equal(depth.currentDepth, worldYToDepth(swim.worldPosition.y));
      assert.equal(depth.currentZone, getDepthZone(swim.worldPosition.y));
      assert.equal(depth.zoneDifficulty, depth.currentZone.futureDifficulty);
      assert.ok(depth.currentDepth <= verticalWorldDepth);
      if (depth.discovery !== lastDiscovery) {
        discoveries.push(depth.discovery.zone.id);
        lastDiscovery = depth.discovery;
      }
    };
    setSwimInput(swim, 0, -1);
    const seconds = Math.ceil(verticalWorldDepth / swimSettings.interactionSwimSpeed) + 3;
    let slowedBeforeFloor = false;
    for (let frame = 0; frame < seconds * fps; frame++) {
      step();
      const remaining = verticalWorldDepth - depth.currentDepth;
      if (remaining > 0 && remaining < .2 && swim.travelSpeed < swimSettings.interactionSwimSpeed * .8) slowedBeforeFloor = true;
    }
    assert.ok(slowedBeforeFloor, "the existing brake slows before the numerical floor guard");
    assert.equal(depth.currentDepth, verticalWorldDepth);
    assert.equal(swim.travelSpeed, 0);
    assert.deepEqual(discoveries, depthZones.slice(1).map(zone => zone.id));
    setSwimInput(swim, 0, 1);
    for (let frame = 0; frame < seconds * fps; frame++) step();
    assert.equal(depth.currentZone.id, "surface");
    assert.ok(depth.currentDepth < 2);
    assert.equal(discoveries.length, depthZones.length - 1, "ascending does not replay discoveries");
  }
});

test("boundary oscillation never repeats a title; a fresh session can discover again", () => {
  const state = createDepthState();
  for (const zone of depthZones.slice(1)) {
    updateDepthState(state, -zone.minDepth);
    const discovery = state.discovery;
    assert.equal(discovery.zone, zone);
    assert.equal(discovery.depth, zone.minDepth);
    for (let i = 0; i < 20; i++) {
      updateDepthState(state, -zone.minDepth + .01);
      updateDepthState(state, -zone.minDepth - .01);
      assert.equal(state.discovery, discovery);
    }
  }
  const fresh = createDepthState();
  assert.equal(fresh.discovery, null);
  updateDepthState(fresh, -depthZones[1].minDepth);
  assert.equal(fresh.discovery.sequence, 1);
});

test("surface uniforms stay exact and background colors remain continuous at every boundary", () => {
  const visuals = createDepthVisuals();
  for (const y of [1.1, 0, -1.4, -depthZones[0].maxDepth]) {
    updateDepthVisuals(visuals, y);
    assert.deepEqual(visuals.top, new Color("#226b94"));
    assert.deepEqual(visuals.bottom, new Color("#215d86"));
    assert.equal(visuals.intensity, 1);
    assert.equal(visuals.gradientOffset, 0);
  }
  for (const zone of depthZones) {
    const before = createDepthVisuals(), at = createDepthVisuals(), after = createDepthVisuals();
    updateDepthVisuals(before, -zone.maxDepth + .0001);
    updateDepthVisuals(at, -zone.maxDepth);
    updateDepthVisuals(after, -zone.maxDepth - .0001);
    assert.ok(at.top.clone().sub(new Color(zone.topColor)).toArray().every(value => Math.abs(value) < 1e-12));
    assert.ok(at.bottom.clone().sub(new Color(zone.bottomColor)).toArray().every(value => Math.abs(value) < 1e-12));
    for (const key of ["top", "bottom"]) {
      for (const channel of ["r", "g", "b"]) {
        assert.ok(Math.abs(before[key][channel] - after[key][channel]) < 1e-8, `${zone.id}: color boundary`);
      }
    }
    assert.ok(Math.abs(before.intensity - after.intensity) < 1e-8);
    assert.ok(Math.abs(before.gradientOffset - after.gradientOffset) < .001);
  }
});

test("all whale swatches retain ample luminance against the deepest background", () => {
  const floor = createDepthVisuals();
  updateDepthVisuals(floor, -verticalWorldDepth);
  const luminance = color => color.r * .2126 + color.g * .7152 + color.b * .0722;
  // Conservative lower bound from the unchanged whale shader's broad lighting,
  // including its existing distance blend at the longest tested portrait framing.
  const background = Math.max(luminance(floor.top), luminance(floor.bottom)) + .018 * floor.intensity;
  for (const color of whaleColors) {
    const whale = new Color(color.value).multiplyScalar(.65 * Math.exp(-160 * .0015));
    assert.ok(luminance(whale) > background * 5, `${color.name} must stay readable`);
  }
  assert.ok(luminance(floor.bottom) > 0, "the floor is never pure black");
});

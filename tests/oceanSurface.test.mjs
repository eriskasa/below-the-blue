import assert from "node:assert/strict";
import test from "node:test";
import { advanceWaves, createWaveState, oceanBounds, oceanSettings, sampleWaterHeight } from "../components/ocean/waves.ts";

test("the wave boundary stays below the backdrop cap and stays flat at the sky boundary", () => {
  const water = createWaveState();
  let peak = 0;
  let trough = 0;
  for (let frame = 0; frame < 120 * 30; frame++) {
    advanceWaves(water, 1 / 30, () => .5);
    for (let x = -50; x <= 50; x += 2) {
      const height = sampleWaterHeight(x, oceanBounds.nearZ, water);
      assert.ok(Number.isFinite(height));
      assert.ok(Math.abs(height) < oceanBounds.backdropTop);
      peak = Math.max(peak, height);
      trough = Math.min(trough, height);
      assert.equal(Math.abs(sampleWaterHeight(x, oceanBounds.farZ, water)), 0);
    }
  }
  assert.ok(peak > .15 && trough < -.15, "preserve visible displacement rather than hiding the seam with flat water");
  assert.equal(oceanBounds.nearZ, -14 + .5, "the cutaway front and surface edge must meet");
  assert.ok(oceanBounds.farZ > -60 + .5, "the surface must stop in front of the sky geometry");
});

test("the rendered mesh samples smooth broad curves without steep creases", () => {
  const state = { ...createWaveState(), time: 17, progress: .5, strength: oceanSettings.swellAmplitude };
  const spacing = oceanBounds.width / oceanBounds.widthSegments;
  let steepest = 0;
  let curvature = 0;
  for (let x = -70; x < 70; x += spacing) {
    for (let z = oceanBounds.farZ; z <= oceanBounds.nearZ; z += 1) {
      const left = sampleWaterHeight(x - spacing, z, state);
      const center = sampleWaterHeight(x, z, state);
      const right = sampleWaterHeight(x + spacing, z, state);
      steepest = Math.max(steepest, Math.abs(right - left) / (2 * spacing));
      curvature = Math.max(curvature, Math.abs(left - 2 * center + right) / (spacing * spacing));
    }
  }
  assert.ok(steepest < .05, `excessive slope ${steepest}`);
  assert.ok(curvature < .012, `sharp curvature ${curvature}`);
});

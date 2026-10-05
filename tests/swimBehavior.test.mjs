import assert from "node:assert/strict";
import test from "node:test";
import { advanceSwim, createSwimState, swimSettings } from "../components/ocean/swimBehavior.ts";

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function simulate(seconds, fps, seed, limit = 7.2) {
  const state = createSwimState();
  const random = seededRandom(seed);
  const visits = [];
  let previousBehavior = state.behavior;
  let lastPhase = 0;
  let maxStep = 0;
  let maxTurn = 0;
  let peakHead = -Infinity;
  let crossings = 0;
  let emerged = false;
  let lastPosition = state.position.clone();
  let lastOrientation = state.orientation.clone();
  for (let i = 0; i < seconds * fps; i++) {
    advanceSwim(state, 1 / fps, swimSettings, limit, random);
    if (state.behavior !== previousBehavior) {
      visits.push({ behavior: state.behavior, at: state.time });
      previousBehavior = state.behavior;
    }
    assert.ok(Number.isFinite(state.position.length()));
    assert.ok(Math.abs(state.position.x) <= limit + .001);
    assert.ok(state.position.y > -5 && state.position.y < -.7);
    assert.ok(state.position.z > -4.5 && state.position.z < 4);
    assert.ok(state.phase > lastPhase, "swimming must continue during every behavior");
    assert.ok(Math.abs(state.orientation.length() - 1) < .00001);
    maxStep = Math.max(maxStep, state.position.distanceTo(lastPosition));
    maxTurn = Math.max(maxTurn, state.orientation.angleTo(lastOrientation));
    peakHead = Math.max(peakHead, state.head.y);
    if (!emerged && state.head.y > .035) {
      assert.equal(state.behavior, "surface", "ordinary swimming should stay below the waterline");
      crossings++; emerged = true;
    }
    if (emerged && state.head.y < -.07) emerged = false;
    lastPhase = state.phase;
    lastPosition.copy(state.position);
    lastOrientation.copy(state.orientation);
  }
  return { state, visits, maxStep, maxTurn, peakHead, crossings };
}

test("twenty minutes stay bounded, smooth, varied, and return to cruising", () => {
  for (const limit of [3.5, 7.2]) {
    const run = simulate(1200, 60, 42, limit);
    const seen = new Set(run.visits.map(({ behavior }) => behavior));
    for (const name of ["cruise", "quicken", "edge", "dive", "rise", "foreground", "turn", "surface"]) {
      assert.ok(seen.has(name), `missing ${name}`);
    }
    assert.ok(run.maxStep < .05, `position step ${run.maxStep}`);
    assert.ok(run.maxTurn < .075, `orientation step ${run.maxTurn}`);
    for (let i = 1; i < run.visits.length; i++) {
      assert.ok(run.visits[i - 1].behavior === "cruise" || run.visits[i].behavior === "cruise");
    }
    const surfaces = run.visits.filter(({ behavior }) => behavior === "surface");
    for (let i = 1; i < surfaces.length; i++) assert.ok(surfaces[i].at - surfaces[i - 1].at >= 65);
    assert.ok(run.peakHead > .035, "the head must actually break the waterline");
    assert.ok(run.crossings >= surfaces.length, "surface visits must reach the waterline");
  }
});

test("timing varies by seed and movement is stable across frame rates", () => {
  const fast = simulate(60, 60, 17);
  const slow = simulate(60, 30, 17);
  const other = simulate(60, 60, 91);
  assert.ok(fast.state.position.distanceTo(slow.state.position) < .1);
  assert.notDeepEqual(fast.visits, other.visits);
  assert.ok(fast.visits.filter(({ behavior }) => behavior !== "cruise").length >= 2);
});

test("returning from a suspended tab does not jump the animal", () => {
  const state = createSwimState();
  const random = seededRandom(3);
  advanceSwim(state, 1 / 60, swimSettings, 7.2, random);
  const before = state.position.clone();
  const time = state.time;
  advanceSwim(state, 120, swimSettings, 7.2, random);
  assert.ok(state.position.distanceTo(before) < .05);
  assert.ok(state.time - time <= .050001);
});

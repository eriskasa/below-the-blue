import assert from "node:assert/strict";
import test from "node:test";
import { defaultProgress, parseProgress, readProgress, writeProgress, resetProgress, progressStorageKey } from "../components/ocean/progress/progress.ts";
import { createExplorationProgress } from "../components/ocean/progress/explorationProgress.ts";
import { travelDepths, travelDestination } from "../components/ocean/progress/travel.ts";
import { relocateWhale } from "../components/ocean/progress/relocation.ts";
import { createDepthState, depthZones, getDepthZone, updateDepthState } from "../components/ocean/depth.ts";
import { createFishEncounter, fishEncounter } from "../components/ocean/encounters/fishEncounter.ts";
import { createPuzzlePresentation } from "../components/ocean/encounters/puzzlePresentation.ts";
import { encounterDistance } from "../components/ocean/encounters/encounterAvoidance.ts";
import { createSwimState, advanceSwim, swimSettings } from "../components/ocean/swimBehavior.ts";

function memory(data) {
  let raw = data === undefined ? null : JSON.stringify(data), writes = 0;
  return {
    getItem(key) { assert.equal(key, progressStorageKey); return raw; },
    setItem(key, value) { assert.equal(key, progressStorageKey); raw = value; writes++; },
    removeItem(key) { assert.equal(key, progressStorageKey); raw = null; },
    get writes() { return writes; },
  };
}
function session(storage = memory()) {
  let now = 0;
  const depth = createDepthState(), encounter = createFishEncounter(() => .999);
  const presentation = createPuzzlePresentation(encounter);
  const progress = createExplorationProgress(depth, encounter, presentation, () => now);
  progress.prepare(storage);
  progress.acknowledgeRelocation();
  return { depth, encounter, presentation, progress, storage,
    move(x, meters, elapsed = 16) {
      now += elapsed;
      updateDepthState(depth, -meters);
      progress.observe({ x, y: -meters }, true);
    },
  };
}

test("fresh and corrupted saves default safely; valid saves clamp, filter and deduplicate", () => {
  for (const raw of [null, "broken", "null", "[]", "{}", JSON.stringify({ ...defaultProgress(), version: 99 }),
    JSON.stringify({ ...defaultProgress(), playerPosition: { x: "2", depth: 60 } }),
    '{"version":1,"playerPosition":{"x":1e999,"depth":60},"discoveredZones":[],"completedEncounters":[]}',
    JSON.stringify({ ...defaultProgress(), playerPosition: { x: 0, depth: null } })]) {
    assert.deepEqual(parseProgress(raw), defaultProgress());
  }
  const data = parseProgress(JSON.stringify({ ...defaultProgress(), playerPosition: { x: 900, depth: 999 }, discoveredZones: ["sunlit", "sunlit", "removed"], completedEncounters: ["fish-school", "unknown"] }));
  assert.deepEqual(data.playerPosition, { x: 120, depth: 350 });
  assert.deepEqual(data.discoveredZones, ["surface", "sunlit"]);
  assert.deepEqual(data.completedEncounters, ["fish-school"]);
  assert.deepEqual(parseProgress(JSON.stringify({ ...defaultProgress(), playerPosition: { x: -999, depth: -80 } })).playerPosition, { x: -120, depth: 0 });
  const broken = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
  assert.deepEqual(readProgress(broken), defaultProgress());
  assert.doesNotThrow(() => { writeProgress(broken, data); resetProgress(broken); });
});

test("fresh players only unlock Surface; physical discovery persists individually with the existing title", () => {
  const s = session();
  assert.deepEqual(s.progress.getSnapshot().discoveredZones, ["surface"]);
  assert.equal(s.progress.requestTravel("abyss"), false);
  for (let i = 1; i < depthZones.length; i++) {
    const zone = depthZones[i];
    s.move(38, zone.minDepth + 1);
    assert.equal(s.depth.discovery.zone.id, zone.id);
    assert.deepEqual(readProgress(s.storage).discoveredZones, depthZones.slice(0, i + 1).map(zone => zone.id));
  }
  const returned = session(s.storage);
  const title = returned.depth.discovery;
  returned.move(38, 25);
  assert.equal(returned.depth.discovery, title, "discovery titles never replay for previously discovered zones");
  assert.equal(returned.depth.currentZone.id, "sunlit");
});

test("writes are throttled, stationary frames are free, exit flush saves the latest position", () => {
  const s = session();
  s.move(1, 2);
  for (let i = 0; i < 100; i++) s.move(2 + i / 100, 2);
  assert.equal(s.storage.writes, 1);
  s.move(8, 3, 2000);
  assert.equal(s.storage.writes, 2);
  for (let i = 0; i < 200; i++) s.move(8, 3);
  assert.equal(s.storage.writes, 2);
  s.move(9, 4, 1);
  s.progress.flush();
  assert.deepEqual(readProgress(s.storage).playerPosition, { x: 9, depth: 4 });
  const depth = createDepthState(), encounter = createFishEncounter();
  const restored = createExplorationProgress(depth, encounter, createPuzzlePresentation(encounter));
  restored.prepare(s.storage);
  assert.deepEqual(restored.getRelocation(), { x: 9, depth: 4 });
  assert.equal(depth.currentDepth, 4, "position prepared before Start Exploring");
  resetProgress(s.storage);
  assert.deepEqual(readProgress(s.storage), defaultProgress());
});

test("travel only targets discoveries, stays covered until relocation and checkpoints arrival", () => {
  const s = session();
  s.move(0, 25);
  assert.equal(s.progress.requestTravel("blue-depths"), false);
  assert.equal(s.progress.requestTravel("surface"), true);
  assert.equal(s.progress.getSnapshot().travelPhase, "outgoing");
  assert.equal(s.progress.getRelocation(), null, "do not teleport during fade-out");
  assert.equal(s.progress.requestTravel("sunlit"), false, "no overlapping travel");
  s.progress.covered();
  assert.equal(s.progress.getSnapshot().travelPhase, "covered");
  assert.deepEqual(s.progress.getRelocation(), { x: 0, depth: 2 });
  s.progress.finishTravel();
  assert.equal(s.progress.getSnapshot().travelPhase, "covered");
  s.progress.acknowledgeRelocation();
  assert.equal(s.progress.getSnapshot().travelPhase, "incoming");
  assert.equal(s.progress.getSnapshot().currentZone, "surface");
  assert.deepEqual(readProgress(s.storage).playerPosition, { x: 0, depth: 2 });
  s.progress.finishTravel();
  assert.equal(s.progress.getSnapshot().travelPhase, "idle");
  assert.deepEqual(s.progress.getSnapshot().discoveredZones, ["surface", "sunlit"]);
});

test("all configured arrivals stay inside their zone, away from boundaries and fish triggers", () => {
  for (const zone of depthZones) {
    for (const x of [-120, -9, 0, 3, 100, 120]) {
      const destination = travelDestination(zone.id, x);
      assert.equal(destination.depth, travelDepths[zone.id]);
      assert.equal(getDepthZone(-destination.depth).id, zone.id);
      assert.ok(Math.abs(destination.x) < 120);
      assert.ok(destination.depth > zone.minDepth && destination.depth < zone.maxDepth);
      assert.ok(encounterDistance({ x: destination.x, y: -destination.depth }, fishEncounter.position) > fishEncounter.radius);
      if (x === 100) assert.equal(destination.x, x);
    }
  }
});

test("relocation clears motion, preserves world X and stays at depth when controls resume", () => {
  const motion = createSwimState();
  motion.velocity.set(4, -5, 0);
  motion.interacting = true;
  relocateWhale(motion, { x: 91, depth: 295 });
  assert.equal(motion.worldOffset, 91);
  assert.equal(motion.position.x, 0);
  assert.equal(motion.worldPosition.x, 91);
  assert.equal(motion.relocationRevision, 1);
  for (let i = 0; i < 60; i++) advanceSwim(motion, 1 / 60, swimSettings, 7.2);
  assert.equal(motion.worldPosition.y, -295);
  assert.equal(motion.worldPosition.x, 91);
});

test("puzzle entry, play, success and exit transitions block travel; invitations dismiss safely", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const s = session();
  const disconnect = s.presentation.connect();
  t.after(disconnect);
  s.encounter.proximity(0);
  assert.equal(s.progress.requestTravel("surface"), true);
  assert.equal(s.encounter.getSnapshot().stage, "idle");
  s.progress.covered(); s.progress.acknowledgeRelocation(); s.progress.finishTravel();
  s.encounter.proximity(100); s.encounter.proximity(0); s.encounter.play();
  assert.equal(s.progress.requestTravel("surface"), false);
  t.mock.timers.tick(600);
  s.encounter.start();
  assert.equal(s.progress.requestTravel("surface"), false);
  t.mock.timers.tick(5000);
  for (const fish of [0, 1, 2]) { s.encounter.selectFish(fish); t.mock.timers.tick(220); }
  assert.equal(s.encounter.getSnapshot().stage, "celebration");
  assert.equal(s.progress.requestTravel("surface"), false);
  s.encounter.leave();
  assert.equal(s.progress.requestTravel("surface"), false, "exit transition still owns controls");
  t.mock.timers.tick(600);
  assert.equal(s.progress.requestTravel("surface"), true);
});

test("finishing the actual fish sequence persists completion and restores familiar replay", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const s = session();
  const disconnect = s.progress.connectEncounter();
  t.after(disconnect);
  s.move(10, 27);
  s.encounter.proximity(0); s.encounter.play(); s.encounter.start();
  t.mock.timers.tick(5000);
  for (const fish of [0, 1, 2]) { s.encounter.selectFish(fish); t.mock.timers.tick(220); }
  t.mock.timers.tick(fishEncounter.timing.celebration);
  t.mock.timers.tick(fishEncounter.timing.message);
  assert.equal(s.encounter.getSnapshot().completed, true);
  assert.deepEqual(readProgress(s.storage).completedEncounters, ["fish-school"]);
  const restored = session(s.storage);
  assert.equal(restored.encounter.getSnapshot().completed, true);
  assert.equal(restored.encounter.getSnapshot().replayable, true);
  restored.encounter.proximity(0); restored.encounter.play();
  assert.equal(restored.encounter.getSnapshot().stage, "instruction");
  restored.encounter.leave();
  assert.equal(restored.encounter.getSnapshot().completed, true);
});

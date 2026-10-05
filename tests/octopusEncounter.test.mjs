import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { createOctopusEncounter, octopusEncounter, patternRounds, avoidOctopus } from "../components/ocean/encounters/octopusEncounter.ts";
import { createFishEncounter } from "../components/ocean/encounters/fishEncounter.ts";
import { createPuzzlePresentation } from "../components/ocean/encounters/puzzlePresentation.ts";
import { createExplorationProgress } from "../components/ocean/progress/explorationProgress.ts";
import { defaultProgress, parseProgress, progressStorageKey } from "../components/ocean/progress/progress.ts";
import { travelDestination } from "../components/ocean/progress/travel.ts";
import { createDepthState, getDepthZone } from "../components/ocean/depth.ts";
import { createSwimState, setSwimInput, advanceSwim, swimSettings } from "../components/ocean/swimBehavior.ts";
import { encounterDistance, encounterPersonalSpace, whaleEncounterFootprint } from "../components/ocean/encounters/encounterAvoidance.ts";

function setup(t) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const encounter = createOctopusEncounter();
  const presentation = createPuzzlePresentation(encounter);
  t.after(presentation.connect());
  encounter.proximity(0); encounter.play();
  t.mock.timers.tick(600);
  return { encounter, presentation, tick: ms => t.mock.timers.tick(ms) };
}
function solve(s) {
  for (const [i, round] of patternRounds.entries()) {
    assert.equal(s.encounter.getSnapshot().round, i);
    s.encounter.choose(round.correctAnswer);
    s.tick(i === 2 ? octopusEncounter.timing.celebration : octopusEncounter.timing.correct);
  }
}

test("three exact configured patterns, choices and per-round hints", () => {
  assert.equal(patternRounds.length, 3);
  assert.deepEqual(patternRounds.map(r => r.sequence), [
    ["Blue", "Purple", "Blue", "Purple"], ["Aqua", "Aqua", "Coral", "Aqua", "Aqua", "Coral"], ["Purple", "Blue", "Seafoam", "Purple", "Blue"],
  ]);
  assert.deepEqual(patternRounds.map(r => r.correctAnswer), ["Blue", "Aqua", "Seafoam"]);
  assert.deepEqual(patternRounds.map(r => r.hint), ["Look for what repeats.", "Try grouping the pearls together.", "Follow the colors from the beginning."]);
  assert.equal(getDepthZone(octopusEncounter.position.y).id, "blue-depths");
});

test("entry locks exploration, wrong answers retry the same round, three correct answers return control", t => {
  const s = setup(t);
  assert.equal(s.presentation.getSnapshot().phase, "active");
  for (const [i, round] of patternRounds.entries()) {
    s.encounter.toggleHint(); assert.equal(s.encounter.getSnapshot().hintOpen, true);
    s.encounter.choose(round.choices.find(color => color !== round.correctAnswer));
    assert.equal(s.encounter.getSnapshot().stage, "retry");
    s.encounter.choose(round.correctAnswer);
    assert.equal(s.encounter.getSnapshot().round, i, "answers cannot bypass feedback");
    s.tick(octopusEncounter.timing.retry);
    assert.equal(s.encounter.getSnapshot().stage, "repeat");
    s.encounter.choose(round.correctAnswer);
    assert.equal(s.encounter.getSnapshot().stage, "celebration");
    assert.equal(s.encounter.getSnapshot().hintOpen, false);
    assert.equal(s.presentation.getSnapshot().phase, "active");
    s.tick(i === 2 ? octopusEncounter.timing.celebration : octopusEncounter.timing.correct);
  }
  assert.equal(s.encounter.getSnapshot().stage, "message");
  s.tick(octopusEncounter.timing.message);
  assert.equal(s.encounter.getSnapshot().completed, true);
  assert.equal(s.presentation.getSnapshot().phase, "leaving");
  s.tick(600);
  assert.equal(s.presentation.getSnapshot().phase, "exploration");
});

test("Close cancels every round and pending correct/retry/success callback", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const roundIndex of [0, 1, 2]) {
    for (const feedback of ["none", "retry", "correct"]) {
      const e = createOctopusEncounter(); e.proximity(0); e.play();
      for (let i = 0; i < roundIndex; i++) { e.choose(patternRounds[i].correctAnswer); t.mock.timers.tick(octopusEncounter.timing.correct); }
      if (feedback !== "none") e.choose(feedback === "correct" ? patternRounds[roundIndex].correctAnswer : patternRounds[roundIndex].choices.find(color => color !== patternRounds[roundIndex].correctAnswer));
      e.leave(); t.mock.timers.tick(60000);
      assert.equal(e.getSnapshot().stage, "idle"); assert.equal(e.getSnapshot().completed, false);
      e.proximity(0); assert.equal(e.getSnapshot().stage, "idle", "dismissed until swimming away");
      e.proximity(100); e.proximity(0); e.play(); assert.equal(e.getSnapshot().round, 0);
      e.leave();
    }
  }
});

test("completion joins the existing save, restores familiar replay, and blocks travel throughout the puzzle", t => {
  const s = setup(t), fish = createFishEncounter(), fishPresentation = createPuzzlePresentation(fish);
  let raw = JSON.stringify({ ...defaultProgress(), completedEncounters: ["fish-school"] });
  const storage = { getItem: () => raw, setItem(key, value) { assert.equal(key, progressStorageKey); raw = value; }, removeItem() {} };
  const progress = createExplorationProgress(createDepthState(), fish, fishPresentation, undefined, [{ id: octopusEncounter.id, encounter: s.encounter, presentation: s.presentation }]);
  progress.prepare(storage);
  t.after(progress.connectEncounter());
  assert.equal(progress.requestTravel("surface"), false);
  solve(s); s.tick(octopusEncounter.timing.message);
  assert.equal(progress.requestTravel("surface"), false, "return transition still owns controls");
  s.tick(600);
  assert.deepEqual(parseProgress(raw).completedEncounters, ["fish-school", "octopus-pattern-01"]);
  const restored = createOctopusEncounter();
  const restoredPresentation = createPuzzlePresentation(restored);
  const returned = createExplorationProgress(createDepthState(), createFishEncounter(), fishPresentation, undefined, [{ id: octopusEncounter.id, encounter: restored, presentation: restoredPresentation }]);
  returned.prepare(storage);
  assert.equal(restored.getSnapshot().completed, true); assert.equal(restored.getSnapshot().replayable, true);
  restored.proximity(0); assert.equal(restored.getSnapshot().stage, "invitation"); restored.play();
  solve({ encounter: restored, tick: s.tick });
  assert.equal(restored.getSnapshot().stage, "idle", "replay skips the first-completion message");
  assert.equal(restored.getSnapshot().completed, true);
});

test("octopus ellipse permits close approaches from every direction and leaves open water unchanged", () => {
  const center = octopusEncounter.position;
  const rx = octopusEncounter.collisionHalfSize.x + whaleEncounterFootprint.x + encounterPersonalSpace;
  const ry = octopusEncounter.collisionHalfSize.y + whaleEncounterFootprint.y + encounterPersonalSpace;
  for (const fps of [30, 60, 120]) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const x = Math.cos(angle), y = Math.sin(angle), state = createSwimState();
      state.worldPosition.set(center.x + x * 16, center.y + y * 16, center.z); state.position.copy(state.worldPosition);
      setSwimInput(state, -x, -y);
      let invited = false;
      for (let frame = 0; frame < fps * 7; frame++) {
        advanceSwim(state, 1 / fps, swimSettings, 7.2, () => .5, 0, avoidOctopus);
        assert.ok(Math.hypot((state.worldPosition.x - center.x) / rx, (state.worldPosition.y - center.y) / ry) >= 1);
        invited ||= encounterDistance(state.worldPosition, center) <= octopusEncounter.radius;
      }
      assert.ok(invited);
    }
  }
  for (const [x, y] of [[10, 0], [-10, 0], [0, 7], [0, -7]]) {
    const velocity = new Vector3(-Math.sign(x) * 3, -Math.sign(y) * 3, 0), original = velocity.clone();
    avoidOctopus(new Vector3(center.x + x, center.y + y, center.z), velocity);
    assert.deepEqual(velocity, original);
  }
  for (const x of [-120, -8, 0, 7, 120]) {
    const arrival = travelDestination("blue-depths", x);
    assert.equal(arrival.depth, 60);
    assert.ok(encounterDistance({ x: arrival.x, y: -arrival.depth }, center) > octopusEncounter.radius);
  }
});

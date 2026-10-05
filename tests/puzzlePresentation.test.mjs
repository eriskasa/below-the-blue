import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as three from "three";
import * as framing from "../components/ocean/encounters/puzzleFraming.ts";
import * as presentationModule from "../components/ocean/encounters/puzzlePresentation.ts";
import { createFishEncounter, fishEncounter } from "../components/ocean/encounters/fishEncounter.ts";

function clock(t) {
  let now = 0, nextId = 0;
  const timers = new Map();
  t.mock.method(globalThis, "setTimeout", (callback, delay) => {
    const id = ++nextId;
    timers.set(id, { at: now + delay, callback });
    return id;
  });
  t.mock.method(globalThis, "clearTimeout", id => timers.delete(id));
  return {
    now: () => now,
    pending: () => timers.size,
    advance(ms) {
      const until = now + ms;
      while (timers.size) {
        const [id, timer] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (timer.at > until) break;
        now = timer.at;
        timers.delete(id);
        timer.callback();
      }
      now = until;
    },
  };
}

const watchDuration = fishEncounter.timing.lead + fishEncounter.fishCount * (fishEncounter.timing.glow + fishEncounter.timing.gap);

test("Play centers before the sequence, success stays centered, and return finishes before exploration", t => {
  const time = clock(t);
  const encounter = createFishEncounter(() => .999);
  const presentation = presentationModule.createPuzzlePresentation(encounter, time.now);
  t.after(presentation.connect());
  const phase = () => presentation.getSnapshot().phase;
  encounter.proximity(0);
  assert.equal(phase(), "exploration");
  encounter.play();
  assert.equal(phase(), "entering");
  time.advance(599);
  assert.equal(phase(), "entering");
  assert.equal(encounter.getSnapshot().highlightedFish, null);
  time.advance(1);
  assert.equal(phase(), "active");
  encounter.start();
  time.advance(watchDuration);
  for (let index = 0; index < 3; index++) {
    encounter.selectFish(index);
    time.advance(fishEncounter.timing.selection);
  }
  assert.equal(encounter.getSnapshot().stage, "celebration");
  assert.equal(phase(), "active");
  time.advance(fishEncounter.timing.celebration);
  assert.equal(encounter.getSnapshot().stage, "message");
  assert.equal(phase(), "active");
  time.advance(fishEncounter.timing.message);
  assert.equal(encounter.getSnapshot().completed, true);
  assert.equal(phase(), "leaving");
  time.advance(600);
  assert.equal(phase(), "exploration");
  encounter.proximity(fishEncounter.radius + 1);
  encounter.proximity(0);
  encounter.play();
  assert.equal(phase(), "entering", "replay uses the same presentation");
  encounter.leave();
  time.advance(600);
  assert.equal(phase(), "exploration");
  assert.equal(encounter.getSnapshot().completed, true);
});

test("close during entry or an active sequence cancels old callbacks and cannot complete the puzzle", t => {
  const time = clock(t);
  for (const started of [false, true]) {
    const encounter = createFishEncounter(() => .999);
    const presentation = presentationModule.createPuzzlePresentation(encounter, time.now);
    const disconnect = presentation.connect();
    encounter.proximity(0);
    encounter.play();
    time.advance(started ? 600 : 180);
    if (started) encounter.start();
    encounter.leave();
    assert.equal(presentation.getSnapshot().phase, "leaving");
    assert.equal(time.pending(), 1, "only the presentation return timer survives Close");
    time.advance(599);
    assert.equal(presentation.getSnapshot().phase, "leaving");
    time.advance(60000);
    assert.equal(presentation.getSnapshot().phase, "exploration");
    assert.equal(encounter.getSnapshot().stage, "idle");
    assert.equal(encounter.getSnapshot().completed, false);
    assert.equal(time.pending(), 0);
    disconnect();
  }
});

test("presentation disconnect cancels its transition timer", t => {
  const time = clock(t);
  const encounter = createFishEncounter();
  const presentation = presentationModule.createPuzzlePresentation(encounter, time.now);
  const disconnect = presentation.connect();
  encounter.proximity(0);
  encounter.play();
  assert.equal(time.pending(), 1);
  disconnect();
  assert.equal(time.pending(), 0);
});

// Run the actual fish's R3F frame callback with real Three.js transforms and
// projection. No substitute HTML creatures or mock projection mathematics.
function mountFish(index, encounter, presentation) {
  let frame;
  const refs = [];
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/ocean/encounters/FishSchool.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const dependencies = {
    react: {
      useRef: current => { const ref = { current }; refs.push(ref); return ref; },
      useMemo: fn => fn(), useEffect() {}, useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "@react-three/drei": { Html: "Html" },
    "@react-three/fiber": { useFrame: fn => { frame = fn; }, useThree: fn => fn({ gl: {} }) },
    three,
    "../movementInput": {}, "../swimBehavior": {},
    "./fishEncounter": { fishEncounter }, "./encounterAvoidance": {}, "./EncounterUI": {},
    "./puzzlePresentation": presentationModule, "./puzzleFraming": framing,
    "./FishSchool.module.css": { default: {} },
    "../ui/PuzzleSurface": { PuzzleSurface: "PuzzleSurface" },
  };
  new Function("require", "exports", code)(name => {
    assert.ok(name in dependencies, `unexpected dependency ${name}`);
    return dependencies[name];
  }, exports);
  const motion = { current: { worldOffset: 2 } };
  const children = exports.FishSchool({ encounter, presentation, motion, input: {} }).props.children[0];
  refs.length = 0;
  children[index].type(children[index].props);
  const group = refs[0].current = new three.Group();
  group.add(new three.Group(), new three.Group());
  for (const i of [1, 2, 3]) refs[i].current = new three.MeshBasicMaterial();
  return { group, frame: (camera, size) => frame({ camera, size }, 1 / 60) };
}

test("real fish stay centered across desktop, portrait, landscape, camera motion, and success", t => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  for (const [width, height] of [[1440, 900], [1280, 720], [320, 568], [390, 844], [667, 375], [844, 390], [568, 280], [812, 320]]) {
    now = 0;
    const camera = new three.PerspectiveCamera(22, width / height, .1, 250);
    camera.position.set(3, -24, Math.max(60, 47 / (width / height)));
    camera.lookAt(0, -25, -3);
    camera.updateMatrixWorld();
    const size = { width, height };
    const panelWidth = Math.min(560, width - 32), panelHeight = Math.min(480, height - 32);
    const cap = height <= 480 ? 64 : 104;
    const area = { left: (width - panelWidth) / 2 + 20, top: (height - panelHeight) / 2 + cap, width: panelWidth - 40, height: panelHeight - cap * 2 };
    let snapshot = { phase: "exploration", startedAt: 0 }, stage = "idle";
    const presentation = { getSnapshot: () => snapshot, getArea: () => ({ getBoundingClientRect: () => area }), getTargets: () => null };
    const encounter = { getSnapshot: () => ({ stage, highlightedFish: null }) };
    const fish = [0, 1, 2].map(index => mountFish(index, encounter, presentation));
    fish.forEach(fish => fish.frame(camera, size));
    const original = fish.map(fish => fish.group.position.clone());
    snapshot = { phase: "entering", startedAt: now };
    stage = "instruction";
    fish.forEach((fish, index) => {
      fish.frame(camera, size);
      assert.ok(fish.group.position.distanceTo(original[index]) < 1e-9, "entry cannot teleport");
    });
    now = 300;
    fish.forEach((fish, index) => {
      fish.frame(camera, size);
      assert.ok(fish.group.position.distanceTo(original[index]) > 1, "fish visibly travel during entry");
    });
    now = 600;
    snapshot = { phase: "active", startedAt: now };
    for (const nextStage of ["instruction", "watching", "repeat", "retry", "celebration", "message"]) {
      stage = nextStage;
      camera.position.x += .15;
      camera.lookAt(0, -25, -3);
      camera.updateMatrixWorld();
      fish.forEach(fish => fish.frame(camera, size));
      const screen = fish.map(fish => fish.group.position.clone().project(camera));
      assert.ok(Math.abs(screen.reduce((sum, p) => sum + p.x, 0) / 3) < 1e-9, `${width}×${height}: horizontal center`);
      assert.ok(Math.abs(screen.reduce((sum, p) => sum + p.y, 0) / 3) < 1e-9, `${width}×${height}: vertical center`);
      for (let i = 0; i < 3; i++) {
        assert.ok(Math.abs(screen[i].x) < .8 && Math.abs(screen[i].y) < .8);
        for (let j = i + 1; j < 3; j++) {
          assert.ok(Math.hypot((screen[i].x - screen[j].x) * width / 2, (screen[i].y - screen[j].y) * height / 2) >= 64, "comfortable, separate touch targets");
        }
      }
    }
    // Rotate/resize an already active puzzle without remounting its creatures.
    size.width = height;
    size.height = width;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    const rotatedWidth = Math.min(560, size.width - 32), rotatedHeight = Math.min(480, size.height - 32);
    const rotatedCap = size.height <= 480 ? 64 : 104;
    Object.assign(area, { left: (size.width - rotatedWidth) / 2 + 20, top: (size.height - rotatedHeight) / 2 + rotatedCap, width: rotatedWidth - 40, height: rotatedHeight - rotatedCap * 2 });
    fish.forEach(fish => fish.frame(camera, size));
    const rotated = fish.map(fish => fish.group.position.clone().project(camera));
    assert.ok(Math.abs(rotated.reduce((sum, p) => sum + p.x, 0) / 3) < 1e-9);
    assert.ok(Math.abs(rotated.reduce((sum, p) => sum + p.y, 0) / 3) < 1e-9);
    const centered = fish.map(fish => fish.group.position.clone());
    snapshot = { phase: "leaving", startedAt: now };
    stage = "idle";
    fish.forEach((fish, index) => {
      fish.frame(camera, size);
      assert.ok(fish.group.position.distanceTo(centered[index]) < 1e-9, "exit cannot teleport");
    });
    now += 600;
    fish.forEach((fish, index) => {
      fish.frame(camera, size);
      assert.ok(Math.abs(fish.group.position.x - (fishEncounter.position.x - 2 + (index - 1) * 1.9)) < 1e-9);
      assert.ok(Math.abs(fish.group.position.y - fishEncounter.position.y) <= .45);
      assert.equal(fish.group.scale.x, 1);
    });
  }
});

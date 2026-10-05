import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Exercise the real components and event handlers without a WebGL renderer.
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../components/ocean/${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const require = name => {
    if (name in dependencies) return dependencies[name];
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
    if (name.endsWith(".module.css")) return { default: {} };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  new Function("require", "exports", code)(require, exports);
  return exports;
}

test("welcome traps focus and ignores Escape, outside presses, and repeated starts during exit", () => {
  let starts = 0, exits = 0, focuses = 0, prevented = 0;
  const { WelcomeOverlay } = load("ui/WelcomeOverlay.tsx", {
    react: { useRef: () => ({ current: { focus: () => focuses++ } }), useEffect: effect => effect() },
  });
  const render = leaving => WelcomeOverlay({ leaving, onStart: () => starts++, onExited: () => exits++ });
  const overlay = render(false);
  assert.equal(focuses, 1);
  assert.equal(overlay.props.role, "dialog");
  assert.equal(overlay.props["aria-modal"], "true");
  const key = key => ({ key, preventDefault: () => prevented++, stopPropagation() {} });
  overlay.props.onKeyDown(key("Escape"));
  overlay.props.onKeyDown(key("Tab"));
  assert.equal(prevented, 2);
  const outside = {};
  overlay.props.onPointerDown({ target: outside, currentTarget: outside, preventDefault: () => prevented++ });
  assert.equal(starts, 0);
  assert.equal(exits, 0);
  const button = overlay.props.children.props.children.find(child => child.type === "button");
  assert.equal(button.props.type, "button", "native button retains Enter/Space activation");
  button.props.onClick();
  assert.equal(starts, 1);
  const leaving = render(true);
  leaving.props.children.props.children.find(child => child.type === "button").props.onClick();
  assert.equal(starts, 1);
  leaving.props.onAnimationEnd({ target: {}, currentTarget: outside });
  assert.equal(exits, 0, "card entrance cannot finish the overlay exit");
  leaving.props.onAnimationEnd({ target: outside, currentTarget: outside });
  assert.equal(exits, 1);
});

test("the entire game stays inert through exit, then enables and receives focus", t => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  t.after(() => { globalThis.window = previousWindow; globalThis.document = previousDocument; });
  let phase = "welcome", audioStarts = 0, focused = 0;
  const canvas = { focus: () => focused++ };
  const { default: Experience } = load("Experience.tsx", {
    "next/dynamic": { default: () => "Scene" },
    react: {
      Component: class {},
      useRef: value => ({ current: value === null ? { querySelector: () => canvas } : value }),
      useState: initial => typeof initial === "function" ? [initial()] : [phase, next => { phase = next; }],
      useEffect: effect => effect(),
      useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    },
    "./progress/explorationProgress": { createExplorationProgress: () => ({
      getSnapshot: () => ({ ready: true, travelPhase: "idle" }), prepare() {}, connectEncounter: () => () => {}, flush() {},
    }) },
    "./progress/progress": { browserProgressStorage: () => undefined },
    "./ui/DepthTravel": { DepthTravel: "DepthTravel", TravelFade: "TravelFade" },
    "./movementInput": { createMovementInput: () => ({}) },
    "./depth": { createDepthState: () => ({}) },
    "./TouchJoystick": { TouchJoystick: "TouchJoystick" },
    "./ui/ExperienceControls": { ExperienceControls: "ExperienceControls" },
    "./ui/usePreferences": { usePreferences: () => [{ volume: 38, muted: false, color: "blue" }, () => {}] },
    "./ui/preferences": { whaleColors: [{ value: "blue" }] },
    "./ui/DepthOverlay": { DepthOverlay: "DepthOverlay" },
    "./encounters/fishEncounter": { createFishEncounter: () => ({}), fishEncounter: { content: {} } },
    "./encounters/octopusEncounter": { createOctopusEncounter: () => ({}), octopusEncounter: { id: "octopus-pattern-01" } },
    "./encounters/OctopusUI": { OctopusUI: "OctopusUI" },
    "./encounters/EncounterUI": { EncounterUI: "EncounterUI" },
    "./encounters/puzzlePresentation": { createPuzzlePresentation: () => ({ getSnapshot: () => ({ phase: "exploration" }), connect: () => () => {} }) },
    "./ui/PuzzleFocus": { PuzzleFocus: "PuzzleFocus" },
    "./ui/WelcomeOverlay": { WelcomeOverlay: "WelcomeOverlay" },
    "./ui/useAmbience": { useAmbience: () => ({ failed: false, start: () => audioStarts++ }) },
  });
  const initial = Experience().props.children;
  assert.equal(initial[0].props.inert, true);
  assert.equal(initial[0].props["aria-hidden"], true);
  assert.equal(initial[0].props.children[0].props.children.props.gameStarted, false);
  assert.equal(initial[2].props.leaving, false);
  initial[2].props.onStart();
  assert.equal(audioStarts, 1, "audio is requested synchronously by Start Exploring");
  const exiting = Experience().props.children;
  assert.equal(exiting[0].props.inert, true);
  assert.equal(exiting[2].props.leaving, true);
  exiting[2].props.onExited();
  const playing = Experience().props.children;
  assert.equal(playing[0].props.inert, false);
  assert.equal(playing[0].props["aria-hidden"], false);
  assert.equal(playing[0].props.children[0].props.children.props.gameStarted, true);
  assert.equal(playing[2], false);
  assert.equal(focused, 1);
});

test("scene leaves waves running but mounts movement and fish encounters only after start", () => {
  const frames = [];
  let motionEnabled, waves = 0, locked = false;
  const { default: Scene } = load("Scene.tsx", {
    react: { useRef: current => ({ current }), useSyncExternalStore: () => ({ phase: locked ? "active" : "exploration", ready: true, travelPhase: "idle" }), Suspense: "Suspense" },
    "@react-three/fiber": { Canvas: "Canvas", useFrame: callback => frames.push(callback) },
    "@react-three/drei": { useProgress: () => ({ active: false }) },
    three: { NoToneMapping: 0 },
    "./Environment": { Environment: "Environment" },
    "./Whale": { Whale: "Whale" },
    "./SwimMotion": { useSwimMotion: (_settings, _water, _steer, enabled) => {
      motionEnabled = enabled;
      return { current: { worldOffset: 0 } };
    } },
    "./Camera": { Camera: "Camera" },
    "./WaterInteraction": { WaterInteraction: "WaterInteraction" },
    "./SwimInteraction": { SwimInteraction: "SwimInteraction" },
    "./waves": { createWaveState: () => ({}), advanceWaves: () => waves++ },
    "./DepthTracker": { DepthTracker: "DepthTracker" },
    "./progress/ProgressTracker": { ProgressTracker: "ProgressTracker" },
    "./encounters/OctopusSchool": { OctopusSchool: "OctopusSchool" },
    "./encounters/octopusEncounter": { avoidOctopus() {} },
    "./encounters/FishSchool": { FishSchool: "FishSchool" },
    "./encounters/fishEncounter": { avoidFishSchool: () => {} },
  });
  const render = gameStarted => {
    const world = Scene({ gameStarted, encounter: {}, presentation: {}, progress: {}, octopus: {}, octopusPresentation: {} }).props.children[0].props.children[0];
    return world.type(world.props).props.children.filter(Boolean).map(child => child.type);
  };
  const welcome = render(false);
  assert.equal(motionEnabled, false);
  assert.ok(!welcome.includes("SwimInteraction"));
  assert.ok(!welcome.includes("FishSchool"));
  frames[0]({}, .016);
  assert.equal(waves, 1);
  const playing = render(true);
  assert.equal(motionEnabled, true);
  assert.ok(playing.includes("SwimInteraction"));
  assert.ok(playing.includes("FishSchool"));
  locked = true;
  assert.ok(!render(true).includes("SwimInteraction"), "existing encounter movement lock remains intact");
});

test("whale simulation cannot advance before start and resumes afterwards", () => {
  let frame, advances = 0;
  const { useSwimMotion } = load("SwimMotion.ts", {
    react: { useRef: current => ({ current }) },
    "@react-three/fiber": { useFrame: callback => { frame = callback; } },
    three: { MathUtils: { clamp: value => value } },
    "./waves": { sampleWaterHeight: () => 0 },
    "./swimBehavior": {
      createSwimState: () => ({ head: { x: 0, z: 0 }, worldOffset: 0 }),
      advanceSwim: () => advances++,
    },
  });
  const view = { viewport: { getCurrentViewport: () => ({ width: 20 }) } };
  useSwimMotion({}, { current: {} }, undefined, false);
  frame(view, .016);
  assert.equal(advances, 0);
  useSwimMotion({}, { current: {} }, undefined, true);
  frame(view, .016);
  assert.equal(advances, 1);
});

test("ambience ignores background gestures until explicitly started and preserves volume", t => {
  const listeners = {}, calls = [], cleanup = [];
  const previous = globalThis.window;
  globalThis.window = {
    addEventListener: (name, callback) => { listeners[name] = callback; },
    removeEventListener: name => { delete listeners[name]; },
  };
  t.after(() => { cleanup.forEach(fn => fn()); globalThis.window = previous; });
  const { useAmbience } = load("ui/useAmbience.ts", {
    react: {
      useRef: current => ({ current }), useState: value => [value, () => {}],
      useEffect: effect => { const dispose = effect(); if (dispose) cleanup.push(dispose); },
    },
    "./ambience": {
      ambienceUrl: "/existing.mp3",
      createAmbiencePlayer: () => ({ start: () => calls.push("start"), setVolume: value => calls.push(value), dispose() {} }),
    },
  });
  const audio = useAmbience(38, false);
  listeners.pointerdown({ isTrusted: true });
  listeners.pointerup({ isTrusted: true });
  listeners.keydown({ isTrusted: true });
  assert.deepEqual(calls, [.38]);
  audio.start();
  assert.deepEqual(calls, [.38, "start"]);
});

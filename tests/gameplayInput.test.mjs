import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as inputModule from "../components/ocean/movementInput.ts";

function eventSurface() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
}

function dom(t) {
  const original = new Map(["window", "document", "HTMLElement"].map(key => [key, globalThis[key]]));
  const cleanups = [];
  class Element {
    constructor(joystick = false) { this.joystick = joystick; }
    hasAttribute(name) { return name === "data-movement-control" && this.joystick; }
  }
  globalThis.HTMLElement = Element;
  globalThis.window = eventSurface();
  globalThis.document = { ...eventSurface(), body: new Element(), hidden: false };
  t.after(() => {
    for (const cleanup of cleanups) cleanup();
    for (const [key, value] of original) globalThis[key] = value;
  });
  return { canvas: new Element(), ui: new Element(), joystick: new Element(true), cleanups };
}

test("keyboard adapter handles focus, opposite keys, repeats, blur, and hidden tabs", t => {
  const { canvas, ui, joystick } = dom(t);
  const input = inputModule.createMovementInput();
  const cleanup = inputModule.bindMovementKeyboard(canvas, input);
  const key = (name, pressed = true, target = canvas, modifiers = {}) => {
    let prevented = false;
    window.listeners.get(pressed ? "keydown" : "keyup")({ key: name, target, preventDefault() { prevented = true; }, ...modifiers });
    return prevented;
  };
  assert.equal(key("w"), true);
  const revision = input.revision;
  key("w");
  assert.equal(input.revision, revision, "key repeat does not restart motion");
  key("s"); assert.equal(input.y, 0);
  key("s", false); assert.equal(input.y, 1);
  key("w", false); assert.equal(input.y, 0);
  assert.equal(key("ArrowDown", true, ui), false, "future UI retains arrow keys");
  assert.equal(key("a", true, canvas, { ctrlKey: true }), false);
  assert.equal(key("d", true, document.body), true);
  assert.equal(input.x, 1);
  document.listeners.get("focusin")({ target: ui });
  assert.equal(input.x, 0);
  key("ArrowLeft", true, joystick); assert.equal(input.x, -1);
  window.listeners.get("blur")(); assert.equal(input.x, 0);
  key("s"); document.hidden = true;
  document.listeners.get("visibilitychange")(); assert.equal(input.y, 0);
  cleanup();
  assert.equal(window.listeners.size, 0);
  assert.equal(document.listeners.size, 0);
});

function mountJoystick(t) {
  const { cleanups } = dom(t);
  const input = { current: inputModule.createMovementInput() };
  const slots = [], effects = [];
  let cursor = 0, mounted = false;
  const code = ts.transpileModule(readFileSync(new URL("../components/ocean/TouchJoystick.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const runtimeRequire = name => {
    if (name === "./movementInput") return inputModule;
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
    if (name === "react") return {
      useRef: value => slots[cursor++] ??= { current: value },
      useState: value => {
        const slot = cursor++;
        slots[slot] ??= value;
        return [slots[slot], next => { slots[slot] = next; }];
      },
      useEffect: effect => { if (!mounted) effects.push(effect); },
    };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function("require", "exports", code)(runtimeRequire, exports);
  const render = () => {
    cursor = 0;
    const tree = exports.TouchJoystick({ input });
    if (!mounted) { mounted = true; for (const effect of effects) cleanups.push(effect()); }
    return tree.props;
  };
  const captured = new Set();
  const element = {
    getBoundingClientRect: () => ({ left: 16, top: 300, width: 112, height: 112 }),
    setPointerCapture: id => captured.add(id),
    hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id),
  };
  const event = (x, y, id = 1) => ({ currentTarget: element, clientX: 72 + x, clientY: 356 + y, pointerId: id, button: 0, preventDefault() {}, stopPropagation() {} });
  return { input: input.current, render, event, captured };
}

test("the real thumb control supports analog 360° movement and releases outside its bounds", t => {
  const { input, render, event, captured } = mountJoystick(t);
  render().onPointerDown(event(0, 0));
  assert.equal(captured.has(1), true);
  assert.equal(render()["data-active"], true);
  render().onPointerMove(event(18, 0));
  assert.ok(input.x > .4 && input.x < .5);
  assert.equal(input.y, 0);
  for (let degrees = 0; degrees < 360; degrees += 30) {
    const angle = degrees * Math.PI / 180;
    render().onPointerMove(event(Math.cos(angle) * 80, Math.sin(angle) * 80));
    assert.ok(Math.abs(input.x - Math.cos(angle)) < 1e-9);
    assert.ok(Math.abs(input.y + Math.sin(angle)) < 1e-9);
  }
  const previous = [input.x, input.y];
  render().onPointerDown(event(-36, 0, 2));
  render().onPointerMove(event(-36, 0, 2));
  assert.deepEqual([input.x, input.y], previous, "another finger cannot take over");
  render().onPointerUp(event(300, 300));
  assert.equal(captured.size, 0);
  assert.equal(input.x, 0); assert.equal(input.y, 0);
  assert.equal(render()["data-active"], false);
});

test("cancellation, lost capture, resize, and tab changes cannot leave the thumb control moving", t => {
  const { input, render, event } = mountJoystick(t);
  for (const stop of [
    () => render().onPointerCancel(event(0, 36)),
    () => render().onLostPointerCapture(event(0, 36)),
    () => window.listeners.get("resize")(),
    () => window.listeners.get("blur")(),
    () => { document.hidden = true; document.listeners.get("visibilitychange")(); },
  ]) {
    render().onPointerDown(event(0, 36));
    assert.equal(input.y, -1);
    stop();
    assert.equal(input.y, 0);
    assert.equal(render()["data-active"], false);
  }
});

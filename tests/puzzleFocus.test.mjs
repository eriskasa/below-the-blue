import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("the real focus wrapper disables background UI and releases an existing joystick capture", t => {
  const originalElement = globalThis.Element;
  class Element {
    held = new Set([7]);
    released = [];
    hasPointerCapture(id) { return this.held.has(id); }
    releasePointerCapture(id) { this.held.delete(id); this.released.push(id); }
  }
  globalThis.Element = Element;
  t.after(() => { globalThis.Element = originalElement; });

  const effects = [], refs = [];
  let cursor = 0;
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../components/ocean/ui/PuzzleFocus.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const require = name => {
    if (name === "react") return {
      useRef: current => refs[cursor++] ??= { current },
      useEffect: callback => effects.push(callback),
    };
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
    if (name.endsWith(".module.css")) return { default: {} };
    throw new Error(`Unexpected focus dependency: ${name}`);
  };
  new Function("require", "exports", code)(require, exports);
  const controls = { type: "existing-controls" };
  const render = focusMode => {
    cursor = 0;
    const result = exports.PuzzleFocus({ focusMode, children: controls });
    effects.splice(0).forEach(effect => effect());
    return result.props.children;
  };

  const normal = render(false);
  assert.equal(normal[0].props.inert, false);
  assert.equal(normal[0].props["aria-hidden"], false);
  assert.equal(normal[1].props["data-focused"], false);
  assert.equal(normal[0].props.children, controls);

  const joystick = new Element();
  normal[0].props.onGotPointerCaptureCapture({ target: joystick, pointerId: 7 });
  const active = render(true);
  assert.deepEqual(joystick.released, [7], "a second finger pressing Play releases the held joystick");
  assert.equal(active[0].props.inert, true, "hidden controls cannot receive pointer or keyboard input");
  assert.equal(active[0].props["aria-hidden"], true);
  assert.equal(active[1].props["data-focused"], true);
  render(true);
  assert.deepEqual(joystick.released, [7], "hint updates do not release capture again");

  const restored = render(false);
  assert.equal(restored[0].props.inert, false);
  assert.equal(restored[0].props["aria-hidden"], false);
  assert.equal(restored[1].props["data-focused"], false);
  assert.equal(restored[0].props.children, controls, "controls are preserved, not unmounted and reset");
});

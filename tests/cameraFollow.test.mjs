import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as three from "three";
import * as follow from "../components/ocean/cameraFollow.ts";
import { advanceSwim, createSwimState, setSwimInput, swimSettings } from "../components/ocean/swimBehavior.ts";
import * as waves from "../components/ocean/waves.ts";
import { relocateWhale } from "../components/ocean/progress/relocation.ts";
import { travelDepths } from "../components/ocean/progress/travel.ts";
import { createDepthVisuals, updateDepthVisuals } from "../components/ocean/depthVisuals.ts";
import { underwaterBackdropDepth, verticalWorldDepth } from "../components/ocean/depth.ts";

// Exercise the actual camera component with its real perspective projection.
function mountCamera(motion, size) {
  const camera = new three.PerspectiveCamera(22, size.width / size.height, .1, 250);
  camera.position.set(0, 1.1, 60);
  const pointer = new three.Vector2();
  let update;
  const code = ts.transpileModule(readFileSync(new URL("../components/ocean/Camera.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  const require = name => {
    if (name === "three") return three;
    if (name === "./cameraFollow") return follow;
    if (name === "./waves") return waves;
    if (name === "react") return { useRef: current => ({ current }) };
    if (name === "@react-three/fiber") return { useThree: select => select({ size }), useFrame: callback => { update = callback; } };
    throw new Error(`Unexpected import ${name}`);
  };
  new Function("require", "exports", code)(require, exports);
  exports.Camera({ motion });
  return { camera, frame(dt) { update({ camera, pointer }, dt); camera.updateMatrixWorld(); } };
}

test("desktop and phone portrait/landscape keep dives visible and return to the surface framing", () => {
  for (const [width, height] of [[1440, 900], [320, 568], [375, 667], [390, 844], [430, 932], [667, 375], [844, 390], [932, 430]]) {
    const motion = { current: createSwimState() };
    const { camera, frame } = mountCamera(motion, { width, height });
    for (let i = 0; i < 600; i++) frame(1 / 60); // Existing responsive camera distance settles.
    const surfaceY = camera.position.y, surfaceZ = camera.position.z;
    setSwimInput(motion.current, 0, -1);
    const diveFrames = Math.ceil((verticalWorldDepth / swimSettings.interactionSwimSpeed + 3) * 60);
    for (let i = 0; i < diveFrames; i++) {
      advanceSwim(motion.current, 1 / 60, swimSettings, 7.2, () => .5);
      frame(1 / 60);
      const screen = motion.current.position.clone().project(camera);
      assert.ok(screen.y > -.62 && screen.y < .5, `${width}×${height}: whale left the gameplay region (${screen.y})`);
      assert.ok(Math.abs(screen.x) < .1);
    }
    assert.ok(new three.Vector3(0, 0, -13.5).project(camera).y > 1, "the surface moves offscreen");
    assert.equal(motion.current.worldPosition.y, -verticalWorldDepth);
    assert.ok(new three.Vector3(0, -underwaterBackdropDepth, -13.5).project(camera).y < -1, "the extended backdrop covers the bottom of the screen");
    setSwimInput(motion.current, 0, 1);
    for (let i = 0; i < diveFrames + 60; i++) {
      advanceSwim(motion.current, 1 / 60, swimSettings, 7.2, () => .5);
      frame(1 / 60);
    }
    assert.ok(Math.abs(camera.position.y - surfaceY) < .3);
    assert.ok(Math.abs(camera.position.z - surfaceZ) < .5);
    assert.ok(Math.abs(new three.Vector3(0, 0, -13.5).project(camera).y) < .15);
  }
});

test("the distant waterline leaves the viewport once the gameplay view is underwater", () => {
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    const motion = { current: createSwimState() };
    const { camera, frame } = mountCamera(motion, { width, height });
    const stages = [1.4, 8, 28, 40, 1.4];
    let surfaceProjection;
    for (const depth of stages) {
      motion.current.position.y = -depth;
      for (let i = 0; i < 600; i++) frame(1 / 60);
      const waterline = new three.Vector3(0, 0, waves.oceanBounds.nearZ).project(camera).y;
      const ray = new three.Raycaster();
      ray.setFromCamera(new three.Vector2(0, 1), camera);
      const distance = (motion.current.position.z - ray.ray.origin.z) / ray.ray.direction.z;
      const gameplayTop = ray.ray.at(distance, new three.Vector3()).y;
      if (depth === 1.4) {
        assert.ok(Math.abs(waterline) < .02, "preserve the existing surface composition");
        if (surfaceProjection !== undefined) assert.ok(Math.abs(waterline - surfaceProjection) < 1e-5, "return restores surface framing");
        surfaceProjection = waterline;
      }
      if (gameplayTop < 0) assert.ok(waterline > 1, `${width}×${height} at depth ${depth}: underwater gameplay still exposes sky above the distant waterline (${waterline})`);
    }
  }
});


test("restore and travel synchronize the camera and palette on the first frame at every destination", () => {
  for (const [width, height] of [[1440, 900], [320, 568], [390, 844], [844, 390]]) {
    const motion = { current: createSwimState() };
    const { camera, frame } = mountCamera(motion, { width, height });
    for (const depth of [...Object.values(travelDepths), 350, 2]) {
      relocateWhale(motion.current, { x: 87, depth });
      frame(1 / 60);
      const firstY = camera.position.y;
      const visuals = createDepthVisuals();
      updateDepthVisuals(visuals, firstY);
      const firstColor = visuals.top.clone();
      const screen = motion.current.position.clone().project(camera);
      assert.ok(screen.y > -.62 && screen.y < .5, `${width}×${height}: immediate whale framing at ${depth}m`);
      if (depth >= 60) assert.ok(new three.Vector3(0, 0, waves.oceanBounds.nearZ).project(camera).y > 1, "no sky or waterline flash at depth");
      for (let i = 0; i < 120; i++) frame(1 / 60);
      assert.ok(Math.abs(camera.position.y - firstY) < 1e-8, "no long camera catch-up after relocation");
      updateDepthVisuals(visuals, camera.position.y);
      assert.deepEqual(visuals.top, firstColor, "correct palette from the first rendered frame");
    }
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { changeVolume, defaultPreferences, parsePreferences, toggleMute } from "../components/ocean/ui/preferences.ts";
import { createAmbiencePlayer, prepareAmbienceLoop } from "../components/ocean/ui/ambience.ts";

test("mute and zero volume remember the last audible level across a reload", () => {
  const audible = changeVolume(defaultPreferences, 38);
  for (const silent of [toggleMute(audible), changeVolume(audible, 0)]) {
    assert.equal(silent.muted, true);
    const restored = toggleMute(parsePreferences(JSON.stringify({ ...silent, color: "#85d4da" })));
    assert.equal(restored.volume, 38);
    assert.equal(restored.muted, false);
    assert.equal(restored.color, "#85d4da");
  }
  assert.equal(changeVolume(toggleMute(audible), 62).muted, false);
});

test("corrupt or outdated stored preferences fall back to usable values", () => {
  for (const stored of [null, "{broken", "null", "false"]) {
    assert.deepEqual(parsePreferences(stored), defaultPreferences);
  }
  const restored = parsePreferences('{"volume":-12,"lastVolume":0,"color":"not-a-color"}');
  assert.equal(restored.volume, 0);
  assert.equal(restored.color, defaultPreferences.color);
  assert.equal(toggleMute(restored).volume, 75);
});

function audioBuffer() {
  const channels = [new Float32Array(4000), new Float32Array(4000)];
  for (let channel = 0; channel < channels.length; channel++) {
    for (let i = 0; i < 4000; i++) channels[channel][i] = Math.sin(i * .01 + channel);
  }
  return { length: 4000, sampleRate: 1000, duration: 4, numberOfChannels: 2, getChannelData: channel => channels[channel] };
}

test("loop join is continuous on both channels without changing the rest of the track", () => {
  const buffer = audioBuffer();
  const before = [buffer.getChannelData(0).slice(), buffer.getChannelData(1).slice()];
  const end = Math.round(prepareAmbienceLoop(buffer) * buffer.sampleRate);
  assert.ok(end > 0 && end < buffer.length);
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    assert.ok(Math.abs(samples[end - 1] - samples[0]) < .011, "wrap is no larger than an ordinary sample step");
    assert.deepEqual(samples.subarray(250), before[channel].subarray(250));
    assert.ok(Math.max(...samples) <= 1 && Math.min(...samples) >= -1, "join cannot introduce clipping");
  }
});

test("audio unlocks synchronously, starts once, ramps gain, and cleans up", async t => {
  const previousContext = globalThis.AudioContext;
  const calls = [];
  const buffer = audioBuffer();
  const gain = { gain: { value: 1, setTargetAtTime: (...args) => calls.push(["gain", ...args]) }, connect() {}, disconnect() {} };
  const source = { connect() {}, start() { calls.push(["start"]); }, stop() { calls.push(["stop"]); }, disconnect() {} };
  globalThis.AudioContext = class {
    currentTime = 12;
    state = "running";
    createGain() { return gain; }
    resume() { calls.push(["resume"]); return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve(buffer); }
    createBufferSource() { return source; }
    close() { calls.push(["close"]); return Promise.resolve(); }
  };
  t.after(() => { globalThis.AudioContext = previousContext; });
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
  const errors = [];
  const player = createAmbiencePlayer("/test.mp3", failed => errors.push(failed));
  player.setVolume(.38);
  assert.equal(calls.length, 0, "audio remains locked before interaction");
  const started = player.start();
  assert.equal(calls[0][0], "resume", "resume runs inside the original gesture");
  await player.start();
  await started;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(call => call[0] === "start").length, 1);
  assert.equal(source.loop, true);
  assert.equal(source.buffer, buffer);
  assert.equal(source.loopEnd, 3.75);
  assert.equal(gain.gain.value, 0, "first sound fades in from silence");
  assert.deepEqual(calls.find(call => call[0] === "gain"), ["gain", .38, 12, .045]);
  player.setVolume(0);
  player.setVolume(.38);
  assert.deepEqual(calls.at(-1), ["gain", .38, 12, .045]);
  player.dispose();
  assert.deepEqual(calls.slice(-2), [["stop"], ["close"]]);
  assert.ok(!errors.includes(true));
});

import assert from "node:assert/strict";
import test from "node:test";
import { createFishEncounter, fishEncounter } from "../components/ocean/encounters/fishEncounter.ts";
import { encounterLocksMovement, encounterRequestsFocus } from "../components/ocean/encounters/encounter.ts";

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
function start(encounter) {
  encounter.proximity(fishEncounter.radius);
  encounter.play();
  encounter.start();
}
function solve(encounter, time) {
  // This deterministic RNG keeps the shuffled order at 0, 1, 2.
  for (let fish = 0; fish < fishEncounter.fishCount; fish++) {
    encounter.selectFish(fish);
    time.advance(fishEncounter.timing.selection);
  }
}

test("focus starts at Play and stays through instruction, hints, retry, and success including replay", t => {
  const time = clock(t);
  const encounter = createFishEncounter(() => .999);
  const focused = () => encounterRequestsFocus(encounter.getSnapshot().stage);
  assert.equal(focused(), false);
  encounter.proximity(0);
  assert.equal(focused(), false, "invitation leaves the scene untouched");
  encounter.play();
  assert.equal(focused(), true, "Play enters puzzle mode before the sequence begins");
  encounter.start();
  assert.equal(focused(), true);
  encounter.toggleHint();
  assert.equal(focused(), true);
  time.advance(watchDuration);
  assert.equal(focused(), true, "answering stays focused");
  encounter.selectFish(2);
  assert.equal(encounter.getSnapshot().stage, "retry");
  assert.equal(focused(), true);
  time.advance(fishEncounter.timing.retry + watchDuration);
  solve(encounter, time);
  assert.equal(focused(), true, "success remains in the centered puzzle area");
  time.advance(fishEncounter.timing.celebration + fishEncounter.timing.message);
  assert.equal(focused(), false);
  encounter.proximity(fishEncounter.radius + 1);
  start(encounter);
  assert.equal(focused(), true, "replay focuses again");
  encounter.leave();
  assert.equal(focused(), false);
  assert.equal(time.pending(), 0);
});

test("entry only invites; Play only instructs; nothing runs until Start", t => {
  const time = clock(t);
  const encounter = createFishEncounter(() => .999);
  encounter.proximity(fishEncounter.radius + 1);
  assert.equal(encounter.getSnapshot().stage, "idle");
  encounter.proximity(fishEncounter.radius);
  assert.equal(encounter.getSnapshot().stage, "invitation");
  encounter.start();
  assert.equal(encounter.getSnapshot().stage, "invitation", "Start cannot bypass Play");
  assert.equal(time.pending(), 0);
  assert.equal(encounterLocksMovement(encounter.getSnapshot().stage), false);
  encounter.play();
  time.advance(60000);
  assert.equal(encounter.getSnapshot().stage, "instruction");
  assert.equal(encounterLocksMovement(encounter.getSnapshot().stage), true);
  assert.equal(time.pending(), 0);
  encounter.start();
  assert.equal(encounterLocksMovement(encounter.getSnapshot().stage), true);
  assert.equal(encounter.getSnapshot().highlightedFish, null);
  time.advance(fishEncounter.timing.lead - 1);
  assert.equal(encounter.getSnapshot().highlightedFish, null, "instructions fade before the first glow");
  time.advance(1);
  assert.equal(encounter.getSnapshot().highlightedFish, 0);
  encounter.leave();
});

test("dismissal stays dismissed inside the radius and becomes available on re-entry", t => {
  clock(t);
  const encounter = createFishEncounter();
  encounter.proximity(fishEncounter.radius);
  encounter.leave();
  for (let i = 0; i < 100; i++) encounter.proximity(fishEncounter.radius - 1);
  assert.equal(encounter.getSnapshot().stage, "idle");
  assert.equal(encounter.getSnapshot().completed, false);
  encounter.proximity(fishEncounter.radius + .01);
  encounter.proximity(fishEncounter.radius);
  assert.equal(encounter.getSnapshot().stage, "invitation");
  encounter.play();
  encounter.proximity(fishEncounter.radius + 1);
  assert.equal(encounter.getSnapshot().stage, "instruction", "puzzle mode cannot be dismissed by a proximity update");
  encounter.leave();
});

test("hint toggles preserve the active sequence and partially entered answer", t => {
  const time = clock(t);
  const encounter = createFishEncounter(() => .999);
  start(encounter);
  const pending = time.pending();
  encounter.toggleHint();
  assert.equal(encounter.getSnapshot().hintOpen, true);
  assert.equal(time.pending(), pending);
  time.advance(watchDuration);
  assert.equal(encounter.getSnapshot().stage, "repeat");
  encounter.selectFish(0);
  time.advance(fishEncounter.timing.selection);
  encounter.toggleHint();
  encounter.toggleHint();
  encounter.selectFish(1);
  time.advance(fishEncounter.timing.selection);
  encounter.selectFish(2);
  assert.equal(encounter.getSnapshot().stage, "celebration");
  encounter.leave();
});

test("wrong answers replay the same sequence without accepting early or double selections", t => {
  const time = clock(t);
  const encounter = createFishEncounter(() => .999);
  start(encounter);
  encounter.selectFish(0);
  assert.equal(encounter.getSnapshot().stage, "watching");
  time.advance(watchDuration);
  encounter.selectFish(2);
  assert.equal(encounter.getSnapshot().stage, "retry");
  time.advance(fishEncounter.timing.retry + watchDuration);
  encounter.selectFish(0);
  encounter.selectFish(1);
  time.advance(fishEncounter.timing.selection);
  assert.equal(encounter.getSnapshot().stage, "repeat");
  encounter.selectFish(1);
  time.advance(fishEncounter.timing.selection);
  encounter.selectFish(2);
  assert.equal(encounter.getSnapshot().stage, "celebration");
  encounter.leave();
});

test("Leave cancels every active phase and can never complete later", t => {
  const time = clock(t);
  for (const phase of ["watching", "repeat", "retry", "celebration", "message"]) {
    const encounter = createFishEncounter(() => .999);
    start(encounter);
    if (phase !== "watching") time.advance(watchDuration);
    if (phase === "retry") encounter.selectFish(2);
    if (phase === "celebration" || phase === "message") solve(encounter, time);
    if (phase === "message") time.advance(fishEncounter.timing.celebration);
    assert.equal(encounter.getSnapshot().stage, phase);
    encounter.leave();
    assert.equal(time.pending(), 0);
    time.advance(60000);
    assert.deepEqual(encounter.getSnapshot(), { stage: "idle", highlightedFish: null, hintOpen: false, completed: false, replayable: true });
    assert.equal(encounterLocksMovement(encounter.getSnapshot().stage), false);
    encounter.proximity(0);
    assert.equal(encounter.getSnapshot().stage, "idle");
    encounter.proximity(fishEncounter.radius + 1);
    encounter.proximity(0);
    assert.equal(encounter.getSnapshot().stage, "invitation");
  }
});

test("all-fish celebration and peaceful message finish before returning control", t => {
  const time = clock(t);
  const encounter = createFishEncounter(() => .999);
  start(encounter);
  time.advance(watchDuration);
  solve(encounter, time);
  assert.equal(encounter.getSnapshot().stage, "celebration");
  assert.equal(encounter.getSnapshot().completed, false);
  time.advance(fishEncounter.timing.celebration);
  assert.equal(encounter.getSnapshot().stage, "message");
  assert.equal(encounterLocksMovement(encounter.getSnapshot().stage), true);
  time.advance(fishEncounter.timing.message);
  assert.equal(encounter.getSnapshot().stage, "idle");
  assert.equal(encounter.getSnapshot().completed, true);
  assert.equal(encounterLocksMovement(encounter.getSnapshot().stage), false);
  assert.equal(time.pending(), 0);
  for (let i = 0; i < 100; i++) encounter.proximity(0);
  assert.equal(encounter.getSnapshot().stage, "idle", "success cannot immediately reopen the invitation");
  encounter.proximity(fishEncounter.radius + 1);
  encounter.proximity(0);
  assert.equal(encounter.getSnapshot().stage, "invitation", "completed school can be played again");
});

test("replays preserve first completion, skip its message, and require another exit before rearming", t => {
  const time = clock(t);
  const encounter = createFishEncounter(() => .999);
  let messages = 0, previous = "idle";
  encounter.subscribe(() => {
    const stage = encounter.getSnapshot().stage;
    if (stage === "message" && previous !== stage) messages++;
    previous = stage;
  });
  start(encounter);
  time.advance(watchDuration);
  solve(encounter, time);
  time.advance(fishEncounter.timing.celebration + fishEncounter.timing.message);
  assert.equal(messages, 1);
  for (let replay = 0; replay < 2; replay++) {
    encounter.proximity(fishEncounter.radius + 1);
    encounter.proximity(0);
    assert.equal(encounter.getSnapshot().stage, "invitation");
    encounter.play();
    encounter.start();
    assert.equal(encounter.getSnapshot().completed, true);
    assert.equal(encounter.getSnapshot().replayable, true);
    time.advance(watchDuration);
    solve(encounter, time);
    assert.equal(encounter.getSnapshot().stage, "celebration");
    time.advance(fishEncounter.timing.celebration);
    assert.equal(encounter.getSnapshot().stage, "idle");
    assert.equal(encounter.getSnapshot().completed, true);
    assert.equal(messages, 1);
    assert.equal(time.pending(), 0);
    for (let i = 0; i < 100; i++) encounter.proximity(0);
    assert.equal(encounter.getSnapshot().stage, "idle");
  }
  encounter.proximity(fishEncounter.radius + 1);
  start(encounter);
  encounter.leave();
  time.advance(60000);
  assert.equal(encounter.getSnapshot().completed, true, "abandoning a replay never erases progression");
  assert.equal(messages, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createTrackerRequestGate } from "../../apps/web/app/(app)/worker/tracker/sections/trackerRequestGate.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("only the most recent request can publish when responses arrive in reverse order", async () => {
  const gate = createTrackerRequestGate();
  const first = deferred();
  const second = deferred();
  const rendered = [];
  const query = (pending) => {
    const id = gate.begin();
    return pending.promise.then((rows) => {
      if (gate.isCurrent(id)) rendered.push(rows);
    });
  };
  const p1 = query(first);
  const p2 = query(second);
  second.resolve(["current-month"]);
  await p2;
  first.resolve(["stale-week"]);
  await p1;
  assert.deepEqual(rendered, [["current-month"]]);
});

test("range switch invalidates a response before the next effect begins", async () => {
  const gate = createTrackerRequestGate();
  const first = deferred();
  const rendered = [];
  const id = gate.begin();
  const request = first.promise.then((value) => {
    if (gate.isCurrent(id)) rendered.push(value);
  });
  gate.invalidate(); // synchronous onChange
  first.resolve("stale");
  await request;
  assert.deepEqual(rendered, []);
  const nextId = gate.begin();
  assert.ok(gate.isCurrent(nextId));
});

test("unmount cleanup invalidates an outstanding request", () => {
  const gate = createTrackerRequestGate();
  const id = gate.begin();
  gate.invalidate();
  assert.equal(gate.isCurrent(id), false);
});

test("old errors and loading completion cannot overwrite current request state", async () => {
  const gate = createTrackerRequestGate();
  const old = deferred();
  const current = deferred();
  const states = [];
  const run = (pending) => {
    const id = gate.begin();
    return pending.promise.then(
      () => { if (gate.isCurrent(id)) states.push("ready"); },
      () => { if (gate.isCurrent(id)) states.push("error"); },
    ).finally(() => { if (gate.isCurrent(id)) states.push("not-loading"); });
  };
  const p1 = run(old);
  const p2 = run(current);
  old.reject(new Error("obsolete offline failure"));
  await p1;
  current.resolve();
  await p2;
  assert.deepEqual(states, ["ready", "not-loading"]);
});

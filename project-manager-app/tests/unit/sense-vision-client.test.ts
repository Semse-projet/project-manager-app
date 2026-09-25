import test from "node:test";
import assert from "node:assert/strict";
import {
  createFrameSampler,
  createResultStabilizer,
  fitWithin,
  pickVoice,
  presentGate,
} from "../../apps/web/lib/sense-vision/live-loop.ts";

// Sense Vision — live-camera client logic.
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §4 P14/P15, §9.

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("sampler keeps at most one request in flight and drops ticks while busy (P14)", async () => {
  const pending = deferred<string>();
  let captures = 0;
  const results: string[] = [];
  const sampler = createFrameSampler({
    capture: () => ++captures,
    analyze: () => pending.promise,
    onResult: (r) => results.push(r),
    onError: () => assert.fail("no error expected"),
  });

  const first = sampler.tick();
  assert.equal(sampler.inFlight, true);
  assert.equal(await sampler.tick(), "busy");
  assert.equal(await sampler.tick(), "busy");
  assert.equal(captures, 1, "busy ticks must not even capture a frame");
  assert.equal(sampler.dropped, 2);

  pending.resolve("emt-coupling");
  assert.equal(await first, "sent");
  assert.deepEqual(results, ["emt-coupling"]);
  assert.equal(sampler.inFlight, false);
});

test("sampler reports errors, recovers, and skips when there is no frame yet", async () => {
  let fail = true;
  const errors: unknown[] = [];
  const results: number[] = [];
  let frame: number | null = null;
  const sampler = createFrameSampler({
    capture: () => frame,
    analyze: async (f: number) => {
      if (fail) throw new Error("timeout");
      return f;
    },
    onResult: (r) => results.push(r),
    onError: (e) => errors.push(e),
  });
  assert.equal(await sampler.tick(), "no-frame");
  frame = 7;
  assert.equal(await sampler.tick(), "sent");
  assert.equal(errors.length, 1);
  fail = false;
  await sampler.tick();
  assert.deepEqual(results, [7]);
});

test("stopped sampler ignores late results and new ticks", async () => {
  const pending = deferred<string>();
  const results: string[] = [];
  const sampler = createFrameSampler({
    capture: () => 1,
    analyze: () => pending.promise,
    onResult: (r) => results.push(r),
    onError: () => undefined,
  });
  const running = sampler.tick();
  sampler.stop();
  pending.resolve("late");
  await running;
  assert.deepEqual(results, []);
  assert.equal(await sampler.tick(), "stopped");
});

test("stabilizer needs 2 of the last 3 readings before switching label (P15)", () => {
  const s = createResultStabilizer();
  assert.equal(s.push({ key: "emt-coupling", confidence: 0.82 }).key, undefined);
  assert.deepEqual(s.push({ key: "emt-coupling", confidence: 0.84 }), { key: "emt-coupling", changed: true });
  // one noisy frame does not flip the label
  assert.deepEqual(s.push({ key: "emt-connector", confidence: 0.81 }), { key: "emt-coupling", changed: false });
  assert.deepEqual(s.push({ key: "emt-connector", confidence: 0.83 }), { key: "emt-connector", changed: true });
});

test("stabilizer accepts a single very confident reading immediately", () => {
  const s = createResultStabilizer();
  assert.deepEqual(s.push({ key: "fish-tape", confidence: 0.95 }), { key: "fish-tape", changed: true });
});

test("a single empty frame does not blank a stable result; repeated empties do", () => {
  const s = createResultStabilizer();
  s.push({ key: "drill", confidence: 0.95 });
  assert.equal(s.push({ key: null, confidence: 0 }).key, "drill");
  assert.deepEqual(s.push({ key: null, confidence: 0 }), { key: null, changed: true });
  s.reset();
  assert.equal(s.current, undefined);
});

test("fitWithin downsizes by longest edge and never upsizes", () => {
  assert.deepEqual(fitWithin(4032, 3024, 1024), { width: 1024, height: 768 });
  assert.deepEqual(fitWithin(1080, 1920, 1024), { width: 576, height: 1024 });
  assert.deepEqual(fitWithin(640, 480, 1024), { width: 640, height: 480 });
  assert.deepEqual(fitWithin(0, 480, 1024), { width: 0, height: 0 });
});

test("pickVoice prefers an exact locale, then the language, else null", () => {
  const voices = [{ lang: "es-MX" }, { lang: "en-GB" }, { lang: "en-US" }];
  assert.equal(pickVoice(voices, "en-US")?.lang, "en-US");
  assert.equal(pickVoice(voices, "es-ES")?.lang, "es-MX");
  assert.equal(pickVoice([{ lang: "fr-FR" }], "en-US"), null);
});

test("decision gate drives what the camera screen shows (Jev pilot, J9)", () => {
  const alts = [{}, {}];
  assert.deepEqual(presentGate({ status: "uncertain", gate: { action: "ACCEPT_RESULT" }, alternatives: alts }).scan, "identified");
  const show = presentGate({ status: "uncertain", gate: { action: "SHOW_ALTERNATIVES" }, alternatives: alts });
  assert.equal(show.scan, "uncertain");
  assert.equal(show.showAlternatives, true);
  const retry = presentGate({ status: "uncertain", gate: { action: "RETRY_SCAN" }, alternatives: alts });
  assert.equal(retry.showObject, false, "a rescan request hides the tentative object");
  assert.ok(retry.hint);
  assert.equal(presentGate({ status: "unknown", gate: { action: "UNKNOWN" }, alternatives: [] }).scan, "unknown");
  assert.equal(presentGate({ status: "unknown", gate: { action: "ESCALATE_MODEL" }, alternatives: [] }).showObject, false);
  assert.equal(presentGate({ status: "uncertain", gate: { action: "ASK_USER" }, alternatives: [] }).showAlternatives, false);
});

test("responses without a gate fall back to the recognition status", () => {
  assert.equal(presentGate({ status: "recognized", alternatives: [] }).scan, "identified");
  assert.equal(presentGate({ status: "uncertain", alternatives: [{}] }).showAlternatives, true);
  assert.equal(presentGate({ status: "unknown", alternatives: [] }).showObject, false);
});

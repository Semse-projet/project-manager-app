import test from "node:test";
import assert from "node:assert/strict";
import {
  computeTrackerElapsedSeconds,
  mergeTrackerNotes,
  toTrackerSessionView,
  trimTrackerNotes,
} from "../src/modules/field-ops/tracker-session.ts";

test("computeTrackerElapsedSeconds accumulates wall clock time while session is running", () => {
  const resumedAt = new Date(Date.now() - 65_000);
  const elapsed = computeTrackerElapsedSeconds({
    accumulatedSeconds: 15,
    status: "RUNNING",
    resumedAt,
  }, new Date());

  assert.ok(elapsed >= 80);
});

test("toTrackerSessionView preserves job linkage and serializes timestamps", () => {
  const startedAt = new Date("2026-04-09T13:00:00.000Z");
  const view = toTrackerSessionView({
    id: "sess_1",
    tenantId: "tnt_1",
    orgId: "org_1",
    jobId: "job_1",
    createdBy: "usr_1",
    status: "PAUSED",
    startedAt,
    resumedAt: null,
    pausedAt: new Date("2026-04-09T14:00:00.000Z"),
    stoppedAt: null,
    accumulatedSeconds: 3600,
    notes: "Pausa para materiales",
    createdAt: startedAt,
    updatedAt: startedAt,
    job: {
      id: "job_1",
      title: "Instalación split",
      status: "IN_PROGRESS",
    },
  });

  assert.equal(view.job.title, "Instalación split");
  assert.equal(view.elapsedSeconds, 3600);
  assert.equal(view.startedAt, "2026-04-09T13:00:00.000Z");
});

test("computeTrackerElapsedSeconds returns accumulated seconds when not running", () => {
  assert.equal(
    computeTrackerElapsedSeconds({ accumulatedSeconds: 120, status: "PAUSED", resumedAt: null }, new Date()),
    120
  );
  assert.equal(
    computeTrackerElapsedSeconds({ accumulatedSeconds: 60, status: "RUNNING", resumedAt: null }, new Date()),
    60
  );
});

test("mergeTrackerNotes keeps previous note when new input is blank", () => {
  assert.equal(mergeTrackerNotes("nota previa", "   "), "nota previa");
  assert.equal(mergeTrackerNotes(null, "  nueva nota "), "nueva nota");
  assert.equal(mergeTrackerNotes(undefined, undefined), undefined);
  assert.equal(mergeTrackerNotes(undefined, "  "), undefined);
});

test("trimTrackerNotes returns trimmed string or undefined", () => {
  assert.equal(trimTrackerNotes("  hola  "), "hola");
  assert.equal(trimTrackerNotes(""), undefined);
  assert.equal(trimTrackerNotes("   "), undefined);
  assert.equal(trimTrackerNotes(undefined), undefined);
});

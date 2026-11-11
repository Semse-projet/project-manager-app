import assert from "node:assert/strict";
import test from "node:test";
import { reconcileIntakeEvidenceResults } from "../../apps/api/src/modules/smart-intake/smart-intake-evidence-results.ts";

const images = [
  { key: "a.jpg", evidenceStatus: "draft" as const, imageType: "before" },
  { key: "b.jpg", evidenceStatus: "draft" as const, imageType: "damage" },
];

test("never claims attachment on rejected Evidence registration", () => {
  const results = reconcileIntakeEvidenceResults(images, [
    { status: "rejected", reason: new Error("Project link missing") },
    { status: "fulfilled", value: { id: "ev_2" } },
  ]);
  assert.equal(results.attachedEvidenceCount, 1);
  assert.equal(results.failedEvidence, 1);
  assert.deepEqual(results.images.map(x => x.evidenceStatus), ["draft", "attached_to_job"]);
  assert.deepEqual(results.images.map(x => x.key), ["a.jpg", "b.jpg"]);
  assert.equal(images[0].evidenceStatus, "draft", "input must remain unchanged");
});

test("all failures keep all images draft; no false success", () => {
  const results = reconcileIntakeEvidenceResults(images, [
    { status: "rejected", reason: new Error("404") },
    { status: "rejected", reason: new Error("403") },
  ]);
  assert.deepEqual(results.images.map(x => x.evidenceStatus), ["draft", "draft"]);
  assert.equal(results.attachedEvidenceCount, 0);
  assert.equal(results.failedEvidence, 2);
});

test("all successes mark precisely all images attached", () => {
  const results = reconcileIntakeEvidenceResults(images, [
    { status: "fulfilled", value: { id: "e1" } },
    { status: "fulfilled", value: { id: "e2" } },
  ]);
  assert.equal(results.attachedEvidenceCount, 2);
  assert.equal(results.failedEvidence, 0);
  assert.deepEqual(results.images.map(x => x.evidenceStatus), ["attached_to_job", "attached_to_job"]);
});

test("mismatched outcomes fail closed instead of asserting a partial result", () => {
  assert.throws(() => reconcileIntakeEvidenceResults(images, [
    { status: "fulfilled", value: {} },
  ]), /must match/);
  assert.deepEqual(reconcileIntakeEvidenceResults([], []), {
    images: [], attachedEvidenceCount: 0, failedEvidence: 0,
  });
});

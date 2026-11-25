import test from "node:test";
import assert from "node:assert/strict";
import {
  assertWorkerDoesNotWriteEvidenceVolume,
  pathTouchesEvidenceVolume,
} from "../../apps/worker/src/modules/developer-runtime/evidence-volume-guard.mjs";

const env = {
  SEMSE_STORAGE_ROOT: "/data/semse-storage",
  SEMSE_MULTIPART_STORAGE_ROOT: "/data/semse-storage/multipart",
};

test("worker writes under the evidence volume fail closed and repo writes do not", () => {
  assert.equal(pathTouchesEvidenceVolume("/data/semse-storage/zone/original.jpg", env), true);
  assert.equal(pathTouchesEvidenceVolume("/data/semse-storage/multipart/part.bin", env), true);
  assert.equal(pathTouchesEvidenceVolume("/data/other", env), true);
  assert.equal(pathTouchesEvidenceVolume("/tmp/semse-repo/apps/worker/notes.txt", env), false);

  assert.throws(
    () => assertWorkerDoesNotWriteEvidenceVolume("/data/semse-storage/zone/original.jpg", env),
    (error) => error.reason === "worker_evidence_volume_write_refused" && error.retryable === true,
  );
  assert.doesNotThrow(() => assertWorkerDoesNotWriteEvidenceVolume(
    "/tmp/semse-repo/apps/worker/notes.txt",
    env,
  ));
});

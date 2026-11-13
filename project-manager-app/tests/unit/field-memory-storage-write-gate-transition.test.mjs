import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("T-008 transition service uses same FOR UPDATE gate row as admission", () => {
  const source = read("../../apps/api/src/infrastructure/storage/storage-write-gate-transition.service.ts");
  const admission = read("../../apps/api/src/infrastructure/storage/storage-write-gate-coordinator.ts");
  for (const text of [source, admission]) {
    assert.match(text, /FROM "StorageWriteGate"/);
    assert.match(text, /FOR UPDATE/);
    assert.match(text, /\$transaction/);
  }
  assert.match(source, /StorageWriteOperation/);
  assert.match(source, /resolveStorageWriteGateTransition/);
  assert.match(source, /StorageWriteGateAudit/);
  assert.match(source, /nextEpoch/);
  assert.match(source, /ABORT_DRAIN/);
});

test("transition audit is atomic with phase update and migration is additive", () => {
  const sql = read("../../packages/db/prisma/migrations/20261016150000_storage_write_gate_audit/migration.sql");
  assert.match(sql, /CREATE TABLE "StorageWriteGateAudit"/);
  assert.match(sql, /FOREIGN KEY \("scope"\)/);
  assert.doesNotMatch(sql, /INSERT INTO "StorageWriteGate"/);
  assert.doesNotMatch(sql, /DELETE FROM|TRUNCATE/);
  const schema = read("../../packages/db/prisma/schema.prisma");
  assert.match(schema, /model StorageWriteGateAudit \{/);
  assert.match(schema, /audits\s+StorageWriteGateAudit\[\]/);
});

test("control plane is wired with production OPEN-canary but production mutations blocked", () => {
  const module = read("../../apps/api/src/infrastructure/storage/storage.module.ts");
  const mode = read("../../apps/api/src/infrastructure/storage/storage-write-gate-mode.ts");
  const control = read("../../apps/api/src/infrastructure/storage/storage-write-gate-control.service.ts");
  assert.match(module, /StorageWriteGateTransitionService/);
  assert.match(module, /StorageWriteGateControlService/);
  assert.match(mode, /SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE/);
  assert.match(mode, /level === "observe"/);
  assert.match(mode, /level === "provision"/);
  assert.match(mode, /Production storage write gate control is not armed/);
  assert.match(control, /assertControlPlane\("mutate"\)/);
});

test("reopening fences stale tickets and invalidates writer coverage", () => {
  const source = read("../../apps/api/src/infrastructure/storage/storage-write-gate-transition.service.ts");
  assert.match(source, /input.action === "THAW"/);
  assert.match(source, /input.action === "ABORT_DRAIN"/);
  assert.match(source, /const beginningDrain = input\.action === "BEGIN_DRAIN"/);
  assert.match(source, /reopening \|\| beginningDrain \? null : gate\.coverageDigest/);
  assert.match(source, /const enteringFrozen = input\.action === "MARK_FROZEN"/);
  assert.match(source, /reopening \|\| beginningDrain \|\| enteringFrozen \? null : gate\.recoveryWindowDigest/);
  assert.match(source, /recoveryWindowClosed: gate\.recoveryWindowDigest !== null/);
  assert.match(source, /"coverageDigest" = \$\{nextCoverageDigest\}/);
  assert.match(source, /"recoveryWindowDigest" = \$\{nextRecoveryWindowDigest\}/);
});

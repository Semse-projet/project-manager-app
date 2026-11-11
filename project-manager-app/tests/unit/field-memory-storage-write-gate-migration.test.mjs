import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");

test("T-008 migrations declare a serialized durable gate and a ticket ledger", () => {
  const sql = read("../../packages/db/prisma/migrations/20261016130000_storage_write_gate_phase1/migration.sql");
  for (const table of ["StorageWriteGate", "StorageWriteOperation"]) {
    assert.match(sql, new RegExp('CREATE TABLE "' + table + '"'));
  }
  assert.match(sql, /CHECK \("phase" IN \('OPEN', 'DRAINING', 'FROZEN'\)\)/);
  assert.match(sql, /CHECK \("state" IN \('ACTIVE', 'COMPLETED', 'FAILED_CLEAN'\)\)/);
  assert.match(sql, /FOREIGN KEY \("scope"\)/);
  assert.doesNotMatch(sql, /INSERT INTO "StorageWriteGate"/, "no implicit OPEN in a migration");
  const schema = read("../../packages/db/prisma/schema.prisma");
  assert.match(schema, /model StorageWriteGate \{/);
  assert.match(schema, /model StorageWriteOperation \{/);
});

test("T-008 coordinator must serialize admission and drain on a DB row lock", () => {
  const source = read("../../apps/api/src/infrastructure/storage/storage-write-gate-coordinator.ts");
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /\$transaction/);
  assert.match(source, /assertStorageWriteAdmission/);
  assert.match(source, /"ACTIVE"/);
  assert.match(source, /DRAINING/);
  assert.match(source, /StorageWriteGateBlockedError/);
  assert.doesNotMatch(source, /setTimeout|setInterval|Date\.now\(\).*ACTIVE/, "no silent lease expiry");
});

test("T-008 control plane remains additive, staged and explicit", () => {
  const module = read("../../apps/api/src/infrastructure/storage/storage.module.ts");
  const storage = read("../../apps/api/src/infrastructure/storage/storage.service.ts");
  const mode = read("../../apps/api/src/infrastructure/storage/storage-write-gate-mode.ts");
  const control = read("../../apps/api/src/infrastructure/storage/storage-write-gate-control.service.ts");
  const migration = read("../../packages/db/prisma/migrations/20261017150000_storage_write_gate_control_plane/migration.sql");
  assert.match(module, /StorageWriteGateCoordinator/);
  assert.match(module, /StorageWriteOperationBoundary/);
  assert.match(module, /StorageWriteGateTransitionService/);
  assert.match(module, /StorageWriteGateControlService/);
  assert.match(storage, /storageWriteGateRuntimeEnabled/);
  assert.match(mode, /SEMSE_STORAGE_WRITE_GATE_MODE/);
  assert.match(mode, /mode === "off"/, "default off stays backward compatible");
  assert.match(mode, /mode === "staging"/);
  assert.match(mode, /mode === "production"/);
  assert.match(mode, /SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE/);
  assert.match(mode, /level === "observe"/);
  assert.match(mode, /level === "provision"/);
  assert.match(mode, /Production storage write gate control is not armed/);
  assert.match(control, /assertControlPlane\("observe"\)/);
  assert.match(control, /assertControlPlane\("provision"\)/);
  assert.match(control, /assertControlPlane\("mutate"\)/);
  assert.match(migration, /RECOVERED_FENCED/);
  assert.match(migration, /StorageWriteGateAudit_scope_idempotency_uniq/);
  assert.doesNotMatch(migration, /INSERT INTO "StorageWriteGate"/, "migration never provisions OPEN");
});

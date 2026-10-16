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

test("T-008 S3a wires admission only behind staging opt-in, not administrative freeze", () => {
  const module = read("../../apps/api/src/infrastructure/storage/storage.module.ts");
  const storage = read("../../apps/api/src/infrastructure/storage/storage.service.ts");
  assert.match(module, /StorageWriteGateCoordinator/);
  assert.match(module, /StorageWriteOperationBoundary/);
  assert.doesNotMatch(module, /StorageWriteGateTransitionService/, "no operator transition service can be exposed");
  assert.match(storage, /SEMSE_STORAGE_WRITE_GATE_MODE/);
  assert.match(storage, /mode === "off"/, "default off stays backward compatible");
  assert.match(storage, /mode !== "staging"/, "only staging opt-in is available");
  assert.match(storage, /isProductionStorage\(process\.env\)/, "both NODE_ENV and Railway production markers block partial enforcement");
  assert.match(storage, /this\.storeUngated\(input, \(\) => boundary\.beforePublish\(ticket\)\)/);
  assert.match(storage, /return this\.deleteUngated\(key\)/);
});

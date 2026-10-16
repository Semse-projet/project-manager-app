import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("T-008 S2 remains durable infrastructure only and does not activate production writers", async () => {
  const writers = [
    "apps/api/src/infrastructure/storage/storage.service.ts",
    "apps/api/src/modules/evidence/evidence.controller.ts",
    "apps/api/src/modules/browser-agent/browser-agent.service.ts",
  ];

  for (const file of writers) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /StorageWriteGateCoordinator/,
      `${file} must remain unwired in S2`,
    );
  }
});

test("S2 coordinator stays framework-neutral until S3 runtime wiring", async () => {
  const source = await readFile(
    "apps/api/src/infrastructure/storage/storage-write-gate-coordinator.service.ts",
    "utf8",
  );

  assert.doesNotMatch(source, /@Injectable\s*\(/);
  assert.doesNotMatch(source, /from ["']@nestjs\/common["']/);
  assert.match(source, /import type \{ PrismaService \}/);
  assert.match(source, /TransactionIsolationLevel\.Serializable/);
  assert.match(source, /FOR UPDATE/);
});

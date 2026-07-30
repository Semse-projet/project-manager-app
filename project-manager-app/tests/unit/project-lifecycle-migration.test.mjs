import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../packages/db/prisma/migrations/20260728000000_project_lifecycle_projection/migration.sql",
  import.meta.url,
);
const evidenceTimestampMigrationUrl = new URL(
  "../../packages/db/prisma/migrations/20260729000000_evidence_updated_at_for_lifecycle_projection/migration.sql",
  import.meta.url,
);
const evidenceCanonicalMigrationUrl = new URL(
  "../../packages/db/prisma/migrations/20260721000000_evidence_canonical_fase1/migration.sql",
  import.meta.url,
);
const evidenceRepairMigrationUrl = new URL(
  "../../packages/db/prisma/migrations/20260730010000_repair_evidence_canonical_schema/migration.sql",
  import.meta.url,
);

test("project lifecycle migration matches the checksum already applied in production", async () => {
  const sql = await readFile(migrationUrl);
  const checksum = createHash("sha256").update(sql).digest("hex");

  assert.equal(
    checksum,
    "1616b63c7c44bfa0526e5ce2e4857565c9375b6c48eed5ed1b3a7389832f6699",
  );
});

test("evidence timestamp migration adds the source clock required by lifecycle CAS", async () => {
  const sql = await readFile(evidenceTimestampMigrationUrl, "utf8");

  assert.match(sql, /ALTER TABLE "Evidence"/);
  assert.match(
    sql,
    /ADD COLUMN "updatedAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/,
  );
});

test("canonical evidence migration preserves the checksum recorded in production", async () => {
  const sql = await readFile(evidenceCanonicalMigrationUrl);
  const checksum = createHash("sha256").update(sql).digest("hex");

  assert.equal(
    checksum,
    "1da12a3ba11d06258f943637905bc463a53395dc9a96c4e4393b9d444a61ab56",
  );
});

test("evidence repair migration converges a legacy production table", async () => {
  const sql = await readFile(evidenceRepairMigrationUrl, "utf8");

  for (const column of [
    "tenantId",
    "entityType",
    "entityId",
    "farmId",
    "mediaType",
    "title",
    "notes",
    "fileUrl",
    "capturedById",
  ]) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS "${column}"`));
  }

  assert.match(sql, /SET "tenantId" = project\."tenantId"/);
  assert.match(sql, /WHERE evidence\."projectId" = project\.id/);
  assert.match(sql, /WHERE "tenantId" IS NULL/);
  assert.match(sql, /ALTER COLUMN "tenantId" SET NOT NULL/);
  assert.match(sql, /Evidence_tenantId_fkey/);
  assert.match(sql, /Evidence_farmId_fkey/);
  assert.match(sql, /Evidence_tenantId_createdAt_idx/);
  assert.match(sql, /Evidence_tenantId_entityType_entityId_idx/);
  assert.match(sql, /Evidence_tenantId_farmId_idx/);
});

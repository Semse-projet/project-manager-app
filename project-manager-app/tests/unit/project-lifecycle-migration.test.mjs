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

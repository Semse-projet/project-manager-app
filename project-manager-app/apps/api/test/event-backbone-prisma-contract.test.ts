import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { Prisma } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const migrationPath = path.join(
  repoRoot,
  "packages/db/prisma/migrations/20260712000000_f1_event_backbone/migration.sql",
);

function model(name: string) {
  return Prisma.dmmf.datamodel.models.find((entry) => entry.name === name);
}

test("F1 Prisma contract: outbox and consumption models are generated", () => {
  const outbox = model("DomainOutboxEvent");
  const consumption = model("DomainEventConsumption");

  assert.ok(outbox, "DomainOutboxEvent must exist in Prisma DMMF");
  assert.ok(consumption, "DomainEventConsumption must exist in Prisma DMMF");

  const outboxFields = new Set(outbox.fields.map((field) => field.name));
  for (const field of [
    "eventId",
    "eventType",
    "version",
    "envelopeVersion",
    "tenantId",
    "orgId",
    "module",
    "entityType",
    "entityId",
    "actorType",
    "actorId",
    "correlationId",
    "causationId",
    "idempotencyKey",
    "schemaRef",
    "payloadJson",
    "metadataJson",
    "traceContextJson",
    "occurredAt",
    "recordedAt",
    "status",
    "attempts",
    "maxAttempts",
    "nextAttemptAt",
    "lockedAt",
    "lockExpiresAt",
    "lockedBy",
    "publishedAt",
    "lastError",
    "replayCount",
  ]) {
    assert.ok(outboxFields.has(field), `DomainOutboxEvent.${field} must exist`);
  }

  const consumptionFields = new Set(
    consumption.fields.map((field) => field.name),
  );
  for (const field of [
    "eventId",
    "tenantId",
    "consumerName",
    "status",
    "attempts",
    "maxAttempts",
    "startedAt",
    "completedAt",
    "nextAttemptAt",
    "lastError",
    "resultJson",
    "replayCount",
  ]) {
    assert.ok(
      consumptionFields.has(field),
      `DomainEventConsumption.${field} must exist`,
    );
  }

  assert.ok(
    outbox.uniqueFields.some(
      (fields) =>
        fields.length === 2 &&
        fields[0] === "tenantId" &&
        fields[1] === "idempotencyKey",
    ),
    "outbox must enforce tenant-scoped idempotency",
  );
  assert.ok(
    consumption.uniqueFields.some(
      (fields) =>
        fields.length === 2 &&
        fields[0] === "eventId" &&
        fields[1] === "consumerName",
    ),
    "consumption must enforce one receipt per event and consumer",
  );
});

test("F1 Prisma contract: delivery enums expose only approved lifecycle states", () => {
  const outboxEnum = Prisma.dmmf.datamodel.enums.find(
    (entry) => entry.name === "DomainOutboxStatus",
  );
  const consumptionEnum = Prisma.dmmf.datamodel.enums.find(
    (entry) => entry.name === "DomainConsumptionStatus",
  );

  assert.deepEqual(
    outboxEnum?.values.map((value) => value.name),
    ["PENDING", "CLAIMED", "PUBLISHED", "FAILED", "DEAD_LETTER"],
  );
  assert.deepEqual(
    consumptionEnum?.values.map((value) => value.name),
    ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "DEAD_LETTER"],
  );
});

test("F1 migration contract: SQL is additive, indexed and tenant constrained", () => {
  const sql = readFileSync(migrationPath, "utf8");

  assert.match(sql, /CREATE TYPE "DomainOutboxStatus"/);
  assert.match(sql, /CREATE TYPE "DomainConsumptionStatus"/);
  assert.match(sql, /CREATE TABLE "DomainOutboxEvent"/);
  assert.match(sql, /CREATE TABLE "DomainEventConsumption"/);
  assert.match(sql, /DomainOutboxEvent_tenantId_idempotencyKey_key/);
  assert.match(sql, /DomainEventConsumption_eventId_consumerName_key/);
  assert.match(sql, /DomainOutboxEvent_status_nextAttemptAt_recordedAt_idx/);
  assert.match(sql, /DomainOutboxEvent_tenantId_fkey/);
  assert.match(sql, /DomainEventConsumption_tenantId_fkey/);
  assert.doesNotMatch(sql, /DROP\s+(TABLE|TYPE|COLUMN)/i);
});

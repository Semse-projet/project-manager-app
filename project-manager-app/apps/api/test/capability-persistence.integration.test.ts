import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";

import { CapabilitiesRepository } from "../src/modules/capabilities/capabilities.repository.ts";

const prisma = new PrismaClient();
const dbTest = process.env.DATABASE_URL ? test : test.skip;
const PLAN_DIGEST = "a".repeat(64);
const MANIFEST_DIGEST = "b".repeat(64);

function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function createFixture() {
  const tenantId = uniqueId("tenant_cp_f4");
  const orgId = uniqueId("org_cp_f4");
  const userId = uniqueId("user_cp_f4");
  const workspaceId = uniqueId("workspace_cp_f4");

  await prisma.tenant.create({
    data: { id: tenantId, slug: uniqueId("slug"), name: "Control Plane F4" },
  });
  await prisma.org.create({
    data: { id: orgId, tenantId, type: "admin", name: "Control Plane F4" },
  });
  await prisma.user.create({
    data: { id: userId, email: `${uniqueId("cp_f4")}@example.test` },
  });
  const definition = await prisma.capabilityDefinition.create({
    data: {
      name: uniqueId("capability"),
      version: "1.0.0",
      publisher: "semse",
      manifestJson: { apiVersion: "semse.io/v1", kind: "Capability" },
      manifestDigest: MANIFEST_DIGEST,
    },
  });
  const target = await prisma.capabilityRuntimeTarget.create({
    data: {
      tenantId,
      workspaceId,
      kind: "COMPOSE",
      name: "local-compose",
      configRef: "secret://control-plane/f4/local-compose",
    },
  });
  const installation = await prisma.capabilityInstallation.create({
    data: {
      tenantId,
      orgId,
      workspaceId,
      capabilityName: definition.name,
      definitionId: definition.id,
      runtimeTargetId: target.id,
      desiredVersion: definition.version,
    },
  });

  return {
    tenantId,
    orgId,
    userId,
    workspaceId,
    definitionId: definition.id,
    targetId: target.id,
    installationId: installation.id,
  };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function cleanupFixture(fixture: Fixture): Promise<void> {
  await prisma.capabilityInstallation.updateMany({
    where: { tenantId: fixture.tenantId },
    data: { lastOperationId: null },
  });
  await prisma.capabilityExecutionReceipt.deleteMany({
    where: { operation: { tenantId: fixture.tenantId } },
  });
  await prisma.capabilityOperationApproval.deleteMany({
    where: { tenantId: fixture.tenantId },
  });
  await prisma.capabilityOperation.deleteMany({
    where: { tenantId: fixture.tenantId },
  });
  await prisma.capabilityInstallation.deleteMany({
    where: { tenantId: fixture.tenantId },
  });
  await prisma.capabilityRuntimeTarget.deleteMany({
    where: { tenantId: fixture.tenantId },
  });
  await prisma.capabilityDefinition.deleteMany({
    where: { id: fixture.definitionId },
  });
  await prisma.auditLog.deleteMany({ where: { tenantId: fixture.tenantId } });
  await prisma.domainEventConsumption.deleteMany({
    where: { tenantId: fixture.tenantId },
  });
  await prisma.domainOutboxEvent.deleteMany({
    where: { tenantId: fixture.tenantId },
  });
  await prisma.org.deleteMany({ where: { id: fixture.orgId } });
  await prisma.tenant.deleteMany({ where: { id: fixture.tenantId } });
  await prisma.user.deleteMany({ where: { id: fixture.userId } });
}

function operationInput(fixture: Fixture, idempotencyKey: string) {
  return {
    tenantId: fixture.tenantId,
    workspaceId: fixture.workspaceId,
    installationId: fixture.installationId,
    intent: "ACTIVATE" as const,
    risk: "LOW" as const,
    idempotencyKey,
    policyDecisionJson: { decision: "allow" },
    planJson: { steps: [{ id: "observe" }, { id: "apply" }] },
    planDigest: PLAN_DIGEST,
    correlationId: uniqueId("correlation"),
    requestedByType: "USER" as const,
    requestedById: fixture.userId,
    configurationRevision: 1,
  };
}

after(async () => prisma.$disconnect());

dbTest("T-040/T-042: PostgreSQL catalog contains the complete additive F4 contract", async () => {
  const tables = [
    "CapabilityDefinition",
    "CapabilityRuntimeTarget",
    "CapabilityInstallation",
    "CapabilityOperation",
    "CapabilityOperationApproval",
    "CapabilityExecutionReceipt",
  ];
  const enums = [
    "CapabilityDefinitionStatus",
    "CapabilityActorType",
    "CapabilityRuntimeTargetKind",
    "CapabilityRuntimeTargetStatus",
    "CapabilityDesiredState",
    "CapabilityObservedState",
    "CapabilityOperationIntent",
    "CapabilityRisk",
    "CapabilityApprovalMode",
    "CapabilityApprovalStatus",
    "CapabilityReceiptStatus",
  ];
  const tableRows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    tables,
  );
  const enumRows = await prisma.$queryRawUnsafe<Array<{ typname: string }>>(
    `SELECT typname FROM pg_type WHERE typtype = 'e' AND typname = ANY($1::text[])`,
    enums,
  );
  const foreignKeys = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) AS count
       FROM pg_constraint constraint_row
       JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
      WHERE constraint_row.contype = 'f'
        AND table_row.relname = ANY($1::text[])`,
    tables,
  );
  const checks = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) AS count
       FROM pg_constraint constraint_row
       JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
      WHERE constraint_row.contype = 'c'
        AND table_row.relname = ANY($1::text[])`,
    tables,
  );
  const nonPrimaryIndexes = await prisma.$queryRawUnsafe<
    Array<{ count: bigint }>
  >(
    `SELECT COUNT(*) AS count
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
        AND indexname NOT LIKE '%_pkey'`,
    tables,
  );
  const partialDeciderIndex = await prisma.$queryRawUnsafe<
    Array<{ definition: string }>
  >(
    `SELECT pg_get_indexdef(index_row.indexrelid) AS definition
       FROM pg_index index_row
       JOIN pg_class index_class ON index_class.oid = index_row.indexrelid
      WHERE index_class.relname = 'CapabilityOperationApproval_operationId_decidedByUserId_key'`,
  );

  assert.equal(tableRows.length, tables.length);
  assert.equal(enumRows.length, enums.length);
  assert.equal(Number(foreignKeys[0]?.count), 15);
  assert.equal(Number(checks[0]?.count), 16);
  assert.equal(Number(nonPrimaryIndexes[0]?.count), 24);
  assert.match(partialDeciderIndex[0]?.definition ?? "", /WHERE.*decidedByUserId.*IS NOT NULL/i);
});

dbTest("T-043/T-044: tenant-scoped list and claim queries use their composite indexes", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const repository = new CapabilitiesRepository(prisma);
  const operation = await repository.createOperation(
    operationInput(fixture, uniqueId("idem_explain")),
  );
  await repository.recordObservation({
    tenantId: fixture.tenantId,
    workspaceId: fixture.workspaceId,
    operationId: operation.id,
    configurationRevision: 1,
    observationJson: { currentState: "absent" },
    actorType: "SYSTEM",
    actorId: "observer_f4",
  });

  const plans = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
    const claim = await tx.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
      `EXPLAIN (FORMAT TEXT)
       SELECT "id"
         FROM "CapabilityOperation"
        WHERE "tenantId" = $1
          AND "status" = 'PLANNED'::"CapabilityObservedState"
          AND "nextAttemptAt" <= $2
        ORDER BY "nextAttemptAt"
        LIMIT 1`,
      fixture.tenantId,
      new Date(),
    );
    const list = await tx.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
      `EXPLAIN (FORMAT TEXT)
       SELECT "id"
         FROM "CapabilityInstallation"
        WHERE "tenantId" = $1
          AND "workspaceId" = $2
          AND "observedState" = 'PLANNED'::"CapabilityObservedState"`,
      fixture.tenantId,
      fixture.workspaceId,
    );
    return {
      claim: claim.map((row) => row["QUERY PLAN"]).join("\n"),
      list: list.map((row) => row["QUERY PLAN"]).join("\n"),
    };
  });

  assert.match(
    plans.claim,
    /CapabilityOperation_tenantId_status_nextAttemptAt_lockExpir/i,
  );
  assert.match(
    plans.list,
    /CapabilityInstallation_tenantId_workspaceId_observedState_idx/i,
  );
});

dbTest("T-015/CP-005: concurrent idempotent requests create one durable operation", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const firstRepository = new CapabilitiesRepository(prisma);
  const secondRepository = new CapabilitiesRepository(prisma);
  const input = operationInput(fixture, uniqueId("idem_cp005"));

  const [first, second] = await Promise.all([
    firstRepository.createOperation(input),
    secondRepository.createOperation(input),
  ]);

  assert.equal(first.id, second.id);
  assert.equal(
    await prisma.capabilityOperation.count({
      where: { tenantId: fixture.tenantId, idempotencyKey: input.idempotencyKey },
    }),
    1,
  );
  assert.equal(
    await prisma.domainOutboxEvent.count({
      where: { tenantId: fixture.tenantId, entityId: first.id },
    }),
    1,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { tenantId: fixture.tenantId, entityId: first.id },
    }),
    1,
  );
});

dbTest("T-015/CP-006: concurrent reconcilers cannot lease one installation/target twice", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const repository = new CapabilitiesRepository(prisma);
  const first = await repository.createOperation(
    operationInput(fixture, uniqueId("idem_cp006_a")),
  );
  const second = await repository.createOperation(
    operationInput(fixture, uniqueId("idem_cp006_b")),
  );
  await repository.recordObservation({
    tenantId: fixture.tenantId,
    workspaceId: fixture.workspaceId,
    operationId: first.id,
    configurationRevision: 1,
    observationJson: { currentState: "absent" },
    actorType: "SYSTEM",
    actorId: "observer_f4",
  });
  await repository.recordObservation({
    tenantId: fixture.tenantId,
    workspaceId: fixture.workspaceId,
    operationId: second.id,
    configurationRevision: 1,
    observationJson: { currentState: "absent" },
    actorType: "SYSTEM",
    actorId: "observer_f4",
  });

  const now = new Date();
  const [claimsA, claimsB] = await Promise.all([
    new CapabilitiesRepository(prisma).claimNext({
      tenantId: fixture.tenantId,
      reconcilerId: "reconciler_a",
      batchSize: 2,
      leaseMs: 30_000,
      now,
    }),
    new CapabilitiesRepository(prisma).claimNext({
      tenantId: fixture.tenantId,
      reconcilerId: "reconciler_b",
      batchSize: 2,
      leaseMs: 30_000,
      now,
    }),
  ]);

  assert.equal(claimsA.length + claimsB.length, 1);
  const leased = await prisma.capabilityOperation.findMany({
    where: {
      tenantId: fixture.tenantId,
      lockedBy: { not: null },
      lockExpiresAt: { gt: now },
    },
  });
  assert.equal(leased.length, 1);
});

dbTest("T-015/CP-011: operation, installation state, AuditLog and outbox roll back together", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const repository = new CapabilitiesRepository(prisma);
  const input = operationInput(fixture, uniqueId("idem_cp011"));
  const reservedOutboxKey = `capability-operation:${input.idempotencyKey}:created`;

  await prisma.domainOutboxEvent.create({
    data: {
      eventId: randomUUID(),
      eventType: "capability.operation_requested.v1",
      version: 1,
      envelopeVersion: 2,
      tenantId: fixture.tenantId,
      orgId: fixture.orgId,
      module: "control-plane",
      entityType: "CapabilityOperation",
      entityId: "reserved_collision",
      actorType: "system",
      actorId: "fault-injection",
      correlationId: uniqueId("correlation"),
      idempotencyKey: reservedOutboxKey,
      schemaRef: "semse://schemas/capability.operation_requested.v1",
      payloadJson: { faultInjection: true },
      occurredAt: new Date(),
    },
  });

  await assert.rejects(repository.createOperation(input));
  assert.equal(
    await prisma.capabilityOperation.count({
      where: { tenantId: fixture.tenantId, idempotencyKey: input.idempotencyKey },
    }),
    0,
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { tenantId: fixture.tenantId, action: "capability.operation.created" },
    }),
    0,
  );
  assert.deepEqual(
    await prisma.capabilityInstallation.findUnique({
      where: { id: fixture.installationId },
      select: { observedState: true, lastOperationId: true },
    }),
    { observedState: "PENDING", lastOperationId: null },
  );
});

dbTest("T-015/CP-012: material transitions retain actor, digest and revision in audit", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const repository = new CapabilitiesRepository(prisma);
  const operation = await repository.createOperation(
    operationInput(fixture, uniqueId("idem_cp012")),
  );

  const audit = await prisma.auditLog.findFirstOrThrow({
    where: {
      tenantId: fixture.tenantId,
      entityId: operation.id,
      action: "capability.operation.created",
    },
  });
  const evidence = audit.afterJson as Record<string, unknown>;
  assert.equal(evidence.planDigest, PLAN_DIGEST);
  assert.equal(evidence.configurationRevision, 1);
  assert.deepEqual(evidence.actor, { type: "USER", id: fixture.userId });
});

dbTest("T-044/T-046: observe-before-apply and unique receipts survive retries", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const repository = new CapabilitiesRepository(prisma);
  const operation = await repository.createOperation(
    operationInput(fixture, uniqueId("idem_observe")),
  );

  assert.deepEqual(
    await repository.claimNext({
      tenantId: fixture.tenantId,
      reconcilerId: "reconciler_before_observation",
      leaseMs: 10_000,
    }),
    [],
  );
  assert.equal(
    await repository.recordObservation({
      tenantId: fixture.tenantId,
      workspaceId: fixture.workspaceId,
      operationId: operation.id,
      configurationRevision: 1,
      observationJson: { currentState: "absent" },
      actorType: "SYSTEM",
      actorId: "observer_f4",
    }),
    true,
  );

  const claimed = await repository.claimNext({
    tenantId: fixture.tenantId,
    reconcilerId: "reconciler_after_observation",
    leaseMs: 10_000,
  });
  assert.equal(claimed.length, 1);

  const startedAt = new Date();
  const completedAt = new Date(startedAt.getTime() + 50);
  const receiptInput = {
    operationId: operation.id,
    stepId: "observe",
    adapterKind: "COMPOSE" as const,
    status: "SUCCEEDED" as const,
    outputJsonRedacted: { health: "ready" },
    startedAt,
    completedAt,
  };
  const receiptA = await repository.recordReceipt(receiptInput);
  const receiptB = await repository.recordReceipt(receiptInput);
  assert.equal(receiptA.id, receiptB.id);
  assert.equal(
    await prisma.capabilityExecutionReceipt.count({
      where: { operationId: operation.id, stepId: "observe" },
    }),
    1,
  );
});

dbTest("T-046: an expired lease becomes BLOCKED and is never silently adopted", async (t) => {
  const fixture = await createFixture();
  t.after(async () => cleanupFixture(fixture));
  const repository = new CapabilitiesRepository(prisma);
  const operation = await repository.createOperation(
    operationInput(fixture, uniqueId("idem_expiry")),
  );
  await repository.recordObservation({
    tenantId: fixture.tenantId,
    workspaceId: fixture.workspaceId,
    operationId: operation.id,
    configurationRevision: 1,
    observationJson: { currentState: "absent" },
    actorType: "SYSTEM",
    actorId: "observer_f4",
  });
  const claimAt = new Date();
  assert.equal(
    (
      await repository.claimNext({
        tenantId: fixture.tenantId,
        reconcilerId: "expired_reconciler",
        leaseMs: 10_000,
        now: claimAt,
      })
    ).length,
    1,
  );

  assert.equal(
    await repository.reconcileExpiredLeases({
      tenantId: fixture.tenantId,
      reconcilerId: "recovery_reconciler",
      now: new Date(claimAt.getTime() + 60_000),
    }),
    1,
  );
  assert.deepEqual(
    await prisma.capabilityOperation.findUnique({
      where: { id: operation.id },
      select: { status: true, lockedBy: true, lockExpiresAt: true },
    }),
    { status: "BLOCKED", lockedBy: null, lockExpiresAt: null },
  );
  assert.equal(
    await prisma.auditLog.count({
      where: {
        tenantId: fixture.tenantId,
        entityId: operation.id,
        action: "capability.operation.lease-expired",
      },
    }),
    1,
  );
});

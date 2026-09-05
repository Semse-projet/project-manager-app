import test from "node:test";
import assert from "node:assert/strict";

import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";
import { ProjectLifecycleProjectionEventProducer } from "../dist/modules/domain-events/project-lifecycle-projection-event-producer.service.js";
import { EvidenceRepository } from "../dist/modules/evidence/evidence.repository.js";

function makeHarness(
  options: { failOutbox?: boolean; failLifecycleOutbox?: boolean } = {},
) {
  const evidenceRows: Array<Record<string, unknown>> = [];
  const outboxRows: Array<Record<string, unknown>> = [];

  const prisma = {
    project: {
      findFirst: async () => ({
        id: "project_1",
        jobId: "job_1",
        assignedProOrgId: "org_pro_1",
        job: { clientOrgId: "org_client_1" },
      }),
    },
    evidence: {
      create: async () => {
        throw new Error("Evidence writes must use the transaction client");
      },
      findFirst: async () => null,
    },
    domainOutboxEvent: {
      findUnique: async () => null,
    },
    $transaction: async (
      callback: (tx: Record<string, any>) => Promise<unknown>,
    ) => {
      const stagedEvidence: Array<Record<string, unknown>> = [];
      const stagedOutbox: Array<Record<string, unknown>> = [];
      const tx = {
        evidence: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            const row = {
              id: "evidence_1",
              ...data,
              createdAt: new Date("2026-07-12T12:00:00.000Z"),
            };
            stagedEvidence.push(row);
            return row;
          },
        },
        domainOutboxEvent: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            if (
              options.failOutbox ||
              (
                options.failLifecycleOutbox &&
                data.eventType === "project.lifecycle-source-changed.v1"
              )
            ) {
              throw new Error("simulated outbox failure");
            }
            stagedOutbox.push(data);
            return data;
          },
        },
      };

      const result = await callback(tx);
      evidenceRows.push(...stagedEvidence);
      outboxRows.push(...stagedOutbox);
      return result;
    },
  };

  const actorContext = { ensureActorContext: async () => undefined };
  const outboxRepository = new OutboxRepository();
  const repository = new EvidenceRepository(
    prisma as never,
    actorContext as never,
    outboxRepository,
    new ProjectLifecycleProjectionEventProducer(
      prisma as never,
      outboxRepository,
    ),
  );

  return { repository, evidenceRows, outboxRows };
}

const command = {
  tenantId: "tenant_1",
  orgId: "org_pro_1",
  userId: "user_pro_1",
  roles: ["PRO"],
  requestId: "request_1",
  projectId: "project_1",
  key: "tenants/tenant_1/evidence/project_1/photo.jpg",
  kind: "PHOTO" as const,
};

test("F1-B producer: Evidence and outbox commit through one transaction", async () => {
  const harness = makeHarness();

  const evidence = await harness.repository.create(command);

  assert.equal(evidence.id, "evidence_1");
  assert.equal(harness.evidenceRows.length, 1);
  assert.equal(harness.outboxRows.length, 1);
  assert.equal(harness.outboxRows[0]?.eventType, "evidence.uploaded.v1");
  assert.equal(harness.outboxRows[0]?.entityId, "evidence_1");
  assert.equal(
    harness.outboxRows[0]?.idempotencyKey,
    "evidence.uploaded.v1:request_1",
  );
});

test("F1-B producer: an outbox failure rolls back the Evidence write", async () => {
  const harness = makeHarness({ failOutbox: true });

  await assert.rejects(
    harness.repository.create(command),
    /simulated outbox failure/,
  );

  assert.equal(harness.evidenceRows.length, 0);
  assert.equal(harness.outboxRows.length, 0);
});

test("F1-B producer: no queue or network dependency participates in registration", async () => {
  const harness = makeHarness();
  const forbiddenQueue = {
    add: async () => {
      throw new Error("queue must not be called by the producer");
    },
  };

  await harness.repository.create({ ...command, forbiddenQueue } as never);

  assert.equal(harness.evidenceRows.length, 1);
  assert.equal(harness.outboxRows.length, 1);
});

test("F1-B producer: invalid requestId fails before any transaction write", async () => {
  const harness = makeHarness();

  await assert.rejects(
    harness.repository.create({ ...command, requestId: "   " }),
    /requestId must contain 1 to 255 characters/,
  );

  assert.equal(harness.evidenceRows.length, 0);
  assert.equal(harness.outboxRows.length, 0);
});

test("F3 Evidence source and lifecycle invalidation commit atomically", async () => {
  const previous = {
    projection: process.env.SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED,
    tenants: process.env.SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS,
    events: process.env.SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED,
  };
  process.env.SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED = "true";
  process.env.SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS = "tenant_1";
  process.env.SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED = "true";

  try {
    const harness = makeHarness();
    await harness.repository.create(command);
    assert.deepEqual(
      harness.outboxRows.map((row) => row.eventType),
      [
        "evidence.uploaded.v1",
        "project.lifecycle-source-changed.v1",
      ],
    );

    const failing = makeHarness({ failLifecycleOutbox: true });
    await assert.rejects(
      () => failing.repository.create(command),
      /simulated outbox failure/,
    );
    assert.equal(failing.evidenceRows.length, 0);
    assert.equal(failing.outboxRows.length, 0);
  } finally {
    restoreEnvironment(
      "SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED",
      previous.projection,
    );
    restoreEnvironment(
      "SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS",
      previous.tenants,
    );
    restoreEnvironment(
      "SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED",
      previous.events,
    );
  }
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

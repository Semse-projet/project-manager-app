import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  PROJECT_LIFECYCLE_SOURCE_CHANGED_V1_SCHEMA_REF,
  projectLifecycleSourceChangedV1EventSchema,
} from "@semse/schemas";
import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import {
  DomainEventConsumerService,
  PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
} from "../dist/modules/domain-events/domain-event-consumer.service.js";
import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";
import {
  ProjectLifecycleProjectionEventProducer,
  isProjectLifecycleEventsEnabled,
} from "../dist/modules/domain-events/project-lifecycle-projection-event-producer.service.js";

const previousEnvironment = {
  projection: process.env.SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED,
  tenants: process.env.SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS,
  events: process.env.SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED,
  consumers: process.env.SEMSE_EVENT_CONSUMERS_ENABLED,
  consumerAllowlist: process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST,
  eventTypes: process.env.SEMSE_EVENT_TYPE_ALLOWLIST,
};

test.after(() => {
  restore("SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED", previousEnvironment.projection);
  restore("SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS", previousEnvironment.tenants);
  restore("SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED", previousEnvironment.events);
  restore("SEMSE_EVENT_CONSUMERS_ENABLED", previousEnvironment.consumers);
  restore("SEMSE_EVENT_CONSUMER_ALLOWLIST", previousEnvironment.consumerAllowlist);
  restore("SEMSE_EVENT_TYPE_ALLOWLIST", previousEnvironment.eventTypes);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function enableLifecycleEvents() {
  process.env.SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED = "true";
  process.env.SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS = "tenant_1";
  process.env.SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED = "true";
}

test("F3 event producer stays default-off and tenant allowlisted", () => {
  assert.equal(isProjectLifecycleEventsEnabled("tenant_1", {}), false);
  assert.equal(
    isProjectLifecycleEventsEnabled("tenant_1", {
      SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED: "true",
      SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS: "tenant_1",
      SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED: "true",
    }),
    true,
  );
  assert.equal(
    isProjectLifecycleEventsEnabled("tenant_2", {
      SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED: "true",
      SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS: "tenant_1",
      SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED: "true",
    }),
    false,
  );
});

test("F3 producer writes the canonical lifecycle invalidation envelope", async () => {
  enableLifecycleEvents();
  const writes: Array<Record<string, unknown>> = [];
  const prisma = {
    domainOutboxEvent: {
      async create({ data }: { data: Record<string, unknown> }) {
        writes.push(data);
        return data;
      },
    },
  };
  const producer = new ProjectLifecycleProjectionEventProducer(
    prisma as never,
    new OutboxRepository(),
  );

  const result = await producer.record(prisma as never, {
    tenantId: "tenant_1",
    orgId: "org_1",
    projectId: "project_1",
    sourceEventType: "project.status.updated",
    sourceEntityType: "Project",
    sourceEntityId: "project_1",
    actorType: "user",
    actorId: "user_1",
    correlationId: "request_1",
  });

  assert.equal(result, "created");
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.eventType, "project.lifecycle-source-changed.v1");
  assert.equal(
    writes[0]?.schemaRef,
    PROJECT_LIFECYCLE_SOURCE_CHANGED_V1_SCHEMA_REF,
  );
  assert.deepEqual(writes[0]?.payloadJson, {
    projectId: "project_1",
    sourceEventType: "project.status.updated",
    sourceEntityType: "Project",
    sourceEntityId: "project_1",
  });
  assert.match(
    String(writes[0]?.idempotencyKey),
    /^project-lifecycle-source:project\.status\.updated:Project:project_1:request_1$/,
  );
});

test("F3 canonical event rejects a project/entity mismatch", () => {
  const now = new Date().toISOString();
  assert.equal(
    projectLifecycleSourceChangedV1EventSchema.safeParse({
      eventId: randomUUID(),
      eventType: "project.lifecycle-source-changed.v1",
      version: 1,
      envelopeVersion: 2,
      occurredAt: now,
      recordedAt: now,
      tenantId: "tenant_1",
      orgId: "org_1",
      module: "projects",
      entityType: "Project",
      entityId: "project_wrong",
      actor: { type: "system", id: "test" },
      correlationId: "request_1",
      idempotencyKey: "request_1",
      schemaRef: PROJECT_LIFECYCLE_SOURCE_CHANGED_V1_SCHEMA_REF,
      payload: {
        projectId: "project_1",
        sourceEventType: "risk.project.calculated",
        sourceEntityType: "ProjectRiskScore",
        sourceEntityId: "risk_1",
      },
    }).success,
    false,
  );
});

test("F3 consumer rebuilds once and treats duplicate delivery as a no-op receipt", async () => {
  process.env.SEMSE_EVENT_CONSUMERS_ENABLED = "true";
  process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST =
    PROJECT_LIFECYCLE_PROJECTION_CONSUMER;
  process.env.SEMSE_EVENT_TYPE_ALLOWLIST =
    "project.lifecycle-source-changed.v1";

  const eventId = randomUUID();
  const now = new Date("2026-07-30T12:00:00.000Z");
  let receipt:
    | {
        id: string;
        eventId: string;
        tenantId: string;
        consumerName: string;
        status: "PENDING" | "PROCESSING" | "COMPLETED";
        attempts: number;
        maxAttempts: number;
        resultJson: unknown;
      }
    | undefined;
  let auditCount = 0;
  let rebuildCount = 0;
  const transaction = {
    async $executeRaw() {
      receipt ??= {
        id: "receipt_1",
        eventId,
        tenantId: "tenant_1",
        consumerName: PROJECT_LIFECYCLE_PROJECTION_CONSUMER,
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
        resultJson: null,
      };
      return 1;
    },
    async $queryRaw() {
      return receipt ? [receipt] : [];
    },
    domainEventConsumption: {
      async update({ data }: { data: Record<string, unknown> }) {
        Object.assign(receipt!, data);
        return receipt;
      },
    },
    auditLog: {
      async create() {
        auditCount += 1;
      },
    },
  };
  const prisma = {
    domainOutboxEvent: {
      async findUnique() {
        return {
          eventId,
          eventType: "project.lifecycle-source-changed.v1",
          version: 1,
          envelopeVersion: 2,
          tenantId: "tenant_1",
          orgId: "org_1",
          module: "projects",
          entityType: "Project",
          entityId: "project_1",
          actorType: "system",
          actorId: "test",
          correlationId: "request_1",
          causationId: null,
          idempotencyKey: "request_1",
          schemaRef: PROJECT_LIFECYCLE_SOURCE_CHANGED_V1_SCHEMA_REF,
          payloadJson: {
            projectId: "project_1",
            sourceEventType: "risk.project.calculated",
            sourceEntityType: "ProjectRiskScore",
            sourceEntityId: "risk_1",
          },
          metadataJson: null,
          traceContextJson: null,
          occurredAt: now,
          recordedAt: now,
          status: "PUBLISHED",
          attempts: 1,
          maxAttempts: 5,
          nextAttemptAt: now,
          lockedAt: null,
          lockExpiresAt: null,
          lockedBy: null,
          publishedAt: now,
          lastError: null,
          replayCount: 0,
        };
      },
    },
    domainEventConsumption: {
      async findUnique() {
        return receipt
          ? { status: receipt.status, resultJson: receipt.resultJson }
          : null;
      },
    },
    async $transaction(callback: (tx: typeof transaction) => Promise<unknown>) {
      return callback(transaction);
    },
  };
  const projectsRepository = {
    async rebuildLifecycleProjection() {
      rebuildCount += 1;
      return {
        effect: "updated" as const,
        revision: `project-lifecycle.v1:${"a".repeat(64)}`,
        sourceUpdatedAt: now.toISOString(),
      };
    },
  };
  const consumer = new DomainEventConsumerService(
    prisma as never,
    new MetricsService(),
    projectsRepository as never,
  );

  const first = await consumer.process(eventId);
  const duplicate = await consumer.process(eventId);

  assert.equal(first.effect, "updated");
  assert.equal(first.projectId, "project_1");
  assert.equal(duplicate.duplicate, true);
  assert.equal(rebuildCount, 1);
  assert.equal(auditCount, 1);
  assert.equal(receipt?.status, "COMPLETED");
  assert.equal(receipt?.attempts, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  BID_ACCEPTED_V1_SCHEMA_REF,
  BID_CREATED_V1_SCHEMA_REF,
  BID_REJECTED_V1_SCHEMA_REF,
  bidAcceptedV1EventSchema,
  bidCreatedV1EventSchema,
  bidRejectedV1EventSchema,
  JOB_CREATED_V1_SCHEMA_REF,
  JOB_PREFERRED_PROFESSIONAL_SELECTED_V1_SCHEMA_REF,
  JOB_STATUS_CHANGED_V1_SCHEMA_REF,
  jobCreatedV1EventSchema,
  jobPreferredProfessionalSelectedV1EventSchema,
  jobStatusChangedV1EventSchema,
} from "@semse/schemas";
import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";
import {
  DomainEventConsumerService,
  JOBS_BIDS_PROJECTION_CONSUMER,
} from "../dist/modules/domain-events/domain-event-consumer.service.js";

const now = new Date().toISOString();

function baseEnvelope(overrides: Record<string, unknown>) {
  return {
    eventId: randomUUID(),
    version: 1,
    envelopeVersion: 2,
    occurredAt: now,
    recordedAt: now,
    tenantId: "tenant_1",
    orgId: "org_1",
    actor: { type: "user", id: "user_1" },
    correlationId: "request_1",
    idempotencyKey: "request_1",
    ...overrides,
  };
}

test("job.created.v1 accepts a valid canonical event and rejects a job/entity mismatch", () => {
  const valid = jobCreatedV1EventSchema.safeParse(
    baseEnvelope({
      eventType: "job.created.v1",
      module: "jobs",
      entityType: "Job",
      entityId: "job_1",
      schemaRef: JOB_CREATED_V1_SCHEMA_REF,
      payload: { jobId: "job_1", clientOrgId: "org_client_1", title: "Kitchen remodel", scope: "full" },
    }),
  );
  assert.equal(valid.success, true);

  const mismatch = jobCreatedV1EventSchema.safeParse(
    baseEnvelope({
      eventType: "job.created.v1",
      module: "jobs",
      entityType: "Job",
      entityId: "job_wrong",
      schemaRef: JOB_CREATED_V1_SCHEMA_REF,
      payload: { jobId: "job_1", clientOrgId: "org_client_1", title: "Kitchen remodel", scope: "full" },
    }),
  );
  assert.equal(mismatch.success, false);
});

test("job.status_changed.v1 accepts a valid canonical event", () => {
  const valid = jobStatusChangedV1EventSchema.safeParse(
    baseEnvelope({
      eventType: "job.status_changed.v1",
      module: "jobs",
      entityType: "Job",
      entityId: "job_1",
      schemaRef: JOB_STATUS_CHANGED_V1_SCHEMA_REF,
      payload: { jobId: "job_1", fromStatus: "POSTED", toStatus: "ACCEPTED" },
    }),
  );
  assert.equal(valid.success, true);
});

test("job.preferred_professional_selected.v1 accepts a valid canonical event (reserved name, no producer wired yet)", () => {
  const valid = jobPreferredProfessionalSelectedV1EventSchema.safeParse(
    baseEnvelope({
      eventType: "job.preferred_professional_selected.v1",
      module: "jobs",
      entityType: "Job",
      entityId: "job_1",
      schemaRef: JOB_PREFERRED_PROFESSIONAL_SELECTED_V1_SCHEMA_REF,
      payload: {
        jobId: "job_1",
        preferredProfessionalUserId: "usr_pro_1",
        preferredProfessionalDisplayName: "Jane Pro",
        preferredProfessionalPublicSlug: null,
      },
    }),
  );
  assert.equal(valid.success, true);
});

test("bid.created.v1, bid.accepted.v1 and bid.rejected.v1 accept valid canonical events and reject a bid/entity mismatch", () => {
  const created = bidCreatedV1EventSchema.safeParse(
    baseEnvelope({
      eventType: "bid.created.v1",
      module: "bids",
      entityType: "Bid",
      entityId: "bid_1",
      schemaRef: BID_CREATED_V1_SCHEMA_REF,
      payload: { bidId: "bid_1", jobId: "job_1", proOrgId: "org_pro_1", professionalUserId: "usr_pro_1", amount: 4500, etaDays: 10 },
    }),
  );
  assert.equal(created.success, true);

  const accepted = bidAcceptedV1EventSchema.safeParse(
    baseEnvelope({
      eventType: "bid.accepted.v1",
      module: "bids",
      entityType: "Bid",
      entityId: "bid_1",
      schemaRef: BID_ACCEPTED_V1_SCHEMA_REF,
      payload: { bidId: "bid_1", jobId: "job_1", proOrgId: "org_pro_1" },
    }),
  );
  assert.equal(accepted.success, true);

  const rejected = bidRejectedV1EventSchema.safeParse(
    baseEnvelope({
      eventType: "bid.rejected.v1",
      module: "bids",
      entityType: "Bid",
      entityId: "bid_2",
      schemaRef: BID_REJECTED_V1_SCHEMA_REF,
      payload: { bidId: "bid_2", jobId: "job_1", proOrgId: "org_pro_2", reason: "competing_bid_accepted" },
    }),
  );
  assert.equal(rejected.success, true);

  const mismatch = bidAcceptedV1EventSchema.safeParse(
    baseEnvelope({
      eventType: "bid.accepted.v1",
      module: "bids",
      entityType: "Bid",
      entityId: "bid_wrong",
      schemaRef: BID_ACCEPTED_V1_SCHEMA_REF,
      payload: { bidId: "bid_1", jobId: "job_1", proOrgId: "org_pro_1" },
    }),
  );
  assert.equal(mismatch.success, false);
});

function fakeStoredEvent(overrides: Record<string, unknown>) {
  return {
    eventId: overrides.eventId as string,
    version: 1,
    envelopeVersion: 2,
    tenantId: "tenant_1",
    orgId: "org_1",
    actorType: "user",
    actorId: "user_1",
    correlationId: "request_1",
    causationId: null,
    idempotencyKey: "request_1",
    metadataJson: null,
    traceContextJson: null,
    occurredAt: new Date(),
    recordedAt: new Date(),
    status: "PUBLISHED",
    attempts: 1,
    maxAttempts: 5,
    nextAttemptAt: new Date(),
    lockedAt: null,
    lockExpiresAt: null,
    lockedBy: null,
    publishedAt: new Date(),
    lastError: null,
    replayCount: 0,
    ...overrides,
  };
}

test("jobs-bids-projection.v1 consumer rebuilds once per event and treats duplicate delivery as a no-op receipt", async () => {
  process.env.SEMSE_EVENT_CONSUMERS_ENABLED = "true";
  process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST = JOBS_BIDS_PROJECTION_CONSUMER;
  process.env.SEMSE_EVENT_TYPE_ALLOWLIST = "job.status_changed.v1";

  const eventId = randomUUID();
  const storedEvent = fakeStoredEvent({
    eventId,
    eventType: "job.status_changed.v1",
    module: "jobs",
    entityType: "Job",
    entityId: "job_1",
    schemaRef: JOB_STATUS_CHANGED_V1_SCHEMA_REF,
    payloadJson: { jobId: "job_1", fromStatus: "POSTED", toStatus: "ACCEPTED" },
  });

  let receipt: Record<string, unknown> | undefined;
  let auditCount = 0;
  let rebuildCount = 0;
  const transaction = {
    async $executeRaw() {
      receipt ??= {
        id: "receipt_1",
        eventId,
        tenantId: "tenant_1",
        consumerName: JOBS_BIDS_PROJECTION_CONSUMER,
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
        return storedEvent;
      },
    },
    domainEventConsumption: {
      async findUnique() {
        return receipt ? { status: receipt.status, resultJson: receipt.resultJson } : null;
      },
    },
    async $transaction(callback: (tx: typeof transaction) => Promise<unknown>) {
      return callback(transaction);
    },
  };
  const jobsRepository = {
    async rebuildJobsBidsProjection() {
      rebuildCount += 1;
      return {
        effect: "updated" as const,
        revision: `jobs-bids.v1:${"b".repeat(64)}`,
        sourceUpdatedAt: new Date().toISOString(),
      };
    },
  };
  const consumer = new DomainEventConsumerService(
    prisma as never,
    new MetricsService(),
    undefined,
    jobsRepository as never,
  );

  const first = await consumer.process(eventId);
  const duplicate = await consumer.process(eventId);

  assert.equal(first.consumer, JOBS_BIDS_PROJECTION_CONSUMER);
  assert.equal(first.effect, "updated");
  assert.equal(first.jobId, "job_1");
  assert.equal(duplicate.duplicate, true);
  assert.equal(rebuildCount, 1);
  assert.equal(auditCount, 1);
  assert.equal(receipt?.status, "COMPLETED");
});

test("jobs-bids-projection.v1 consumer completes as disabled without persisting when the tenant/persist flags are off", async () => {
  process.env.SEMSE_EVENT_CONSUMERS_ENABLED = "true";
  process.env.SEMSE_EVENT_CONSUMER_ALLOWLIST = JOBS_BIDS_PROJECTION_CONSUMER;
  process.env.SEMSE_EVENT_TYPE_ALLOWLIST = "bid.created.v1";

  const eventId = randomUUID();
  const storedEvent = fakeStoredEvent({
    eventId,
    eventType: "bid.created.v1",
    module: "bids",
    entityType: "Bid",
    entityId: "bid_1",
    schemaRef: BID_CREATED_V1_SCHEMA_REF,
    payloadJson: { bidId: "bid_1", jobId: "job_1", proOrgId: "org_pro_1", professionalUserId: "usr_pro_1", amount: 4500, etaDays: 10 },
  });

  let receipt: Record<string, unknown> | undefined;
  const transaction = {
    async $executeRaw() {
      receipt ??= {
        id: "receipt_1",
        eventId,
        tenantId: "tenant_1",
        consumerName: JOBS_BIDS_PROJECTION_CONSUMER,
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
        /* still audited even when disabled */
      },
    },
  };
  const prisma = {
    domainOutboxEvent: { async findUnique() { return storedEvent; } },
    domainEventConsumption: {
      async findUnique() {
        return receipt ? { status: receipt.status, resultJson: receipt.resultJson } : null;
      },
    },
    async $transaction(callback: (tx: typeof transaction) => Promise<unknown>) {
      return callback(transaction);
    },
  };
  // Feature flags unset on purpose — rebuildJobsBidsProjection itself
  // returns "disabled" for a tenant outside the canary allowlist.
  const jobsRepository = {
    async rebuildJobsBidsProjection() {
      return { effect: "disabled" as const };
    },
  };
  const consumer = new DomainEventConsumerService(
    prisma as never,
    new MetricsService(),
    undefined,
    jobsRepository as never,
  );

  const result = await consumer.process(eventId);
  assert.equal(result.effect, "disabled");
  assert.equal(receipt?.status, "COMPLETED");
});

import assert from "node:assert/strict";
import test from "node:test";
import { semseEventSchema } from "@semse/schemas";
import { buildDisputeResolvedEvent } from "../src/modules/disputes/disputes.events.ts";

test("dispute.resolved lleva un efecto financiero explícito y satisface el contrato canónico", () => {
  const event = buildDisputeResolvedEvent({
    tenantId: "tenant_1",
    disputeId: "dispute_1",
    jobId: "job_1",
    resolvedById: "user_ops",
    resolution: "Liberar fondos al profesional",
    resolutionType: "pro_favor",
    occurredAt: "2026-07-17T12:00:00.000Z",
  });

  assert.equal(semseEventSchema.safeParse(event).success, true);
  assert.deepEqual(event, {
    type: "dispute.resolved",
    meta: {
      tenantId: "tenant_1",
      correlationId: "dispute:dispute_1:resolved",
      actorId: "user_ops",
      actorType: "user",
      occurredAt: "2026-07-17T12:00:00.000Z",
      version: 1,
    },
    payload: {
      disputeId: "dispute_1",
      jobId: "job_1",
      resolvedById: "user_ops",
      resolutionType: "pro_favor",
      resolution: "Liberar fondos al profesional",
    },
    triggers: ["trust-match", "risk", "notification", "audit"],
  });
});

test("los eventos de evidencia y revisión de disputas están registrados", () => {
  const meta = {
    tenantId: "tenant_1",
    correlationId: "correlation_1",
    actorId: "user_1",
    actorType: "user" as const,
    occurredAt: "2026-07-17T12:00:00.000Z",
    version: 1 as const,
  };

  assert.equal(semseEventSchema.safeParse({
    type: "dispute.evidence_submitted",
    meta,
    payload: {
      disputeId: "dispute_1",
      jobId: "job_1",
      projectId: "project_1",
      submittedById: "user_1",
      evidenceIds: ["evidence_1"],
      totalEvidenceCount: 1,
    },
    triggers: [],
  }).success, true);

  assert.equal(semseEventSchema.safeParse({
    type: "dispute.under_review",
    meta,
    payload: {
      disputeId: "dispute_1",
      jobId: "job_1",
      projectId: "project_1",
      assigneeUserId: "ops_1",
      evidenceCount: 1,
    },
    triggers: [],
  }).success, true);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  EVIDENCE_UPLOADED_V1_SCHEMA_REF,
  evidenceUploadedV1EventSchema,
  semseDomainEventV2Schema,
  toLegacySemseEventV1,
} from "@semse/schemas";

function validEvidenceEvent() {
  return {
    eventId: "e71e3522-f8f4-4729-a390-0509d7ad3d95",
    eventType: "evidence.uploaded.v1",
    version: 1,
    envelopeVersion: 2,
    occurredAt: "2026-07-12T12:00:00.000Z",
    recordedAt: "2026-07-12T12:00:00.100Z",
    tenantId: "tenant_1",
    orgId: "org_pro_1",
    module: "evidence",
    entityType: "Evidence",
    entityId: "ev_1",
    actor: { type: "user", id: "usr_pro_1" },
    correlationId: "req_evidence_1",
    idempotencyKey: "evidence.uploaded.v1:ev_1",
    schemaRef: EVIDENCE_UPLOADED_V1_SCHEMA_REF,
    traceContext: {
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    },
    payload: {
      evidenceId: "ev_1",
      projectId: "project_1",
      jobId: "job_1",
      milestoneId: "milestone_1",
      uploaderId: "usr_pro_1",
      kind: "PHOTO",
      bucketKey: "tenants/tenant_1/evidence/project_1/photo.jpg",
      checksum: "a".repeat(64),
      capturedAt: "2026-07-12T11:59:00.000Z",
      geo: { lat: 25.7617, lng: -80.1918 },
    },
    metadata: { source: "web" },
  } as const;
}

test("F1 contract: evidence.uploaded.v1 accepts the canonical envelope", () => {
  const parsed = evidenceUploadedV1EventSchema.parse(validEvidenceEvent());
  assert.equal(parsed.eventType, "evidence.uploaded.v1");
  assert.equal(parsed.version, 1);
  assert.equal(parsed.envelopeVersion, 2);
  assert.equal(parsed.payload.evidenceId, parsed.entityId);
});

test("F1 contract: generic v2 rejects eventType/version mismatch", () => {
  const input = {
    ...validEvidenceEvent(),
    eventType: "evidence.uploaded.v2",
    version: 1,
  };

  const parsed = semseDomainEventV2Schema.safeParse(input);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.ok(
      parsed.error.issues.some((issue) => issue.path.join(".") === "version"),
    );
  }
});

test("F1 contract: occurredAt cannot be later than recordedAt", () => {
  const input = {
    ...validEvidenceEvent(),
    occurredAt: "2026-07-12T12:00:01.000Z",
    recordedAt: "2026-07-12T12:00:00.000Z",
  };

  const parsed = evidenceUploadedV1EventSchema.safeParse(input);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.ok(
      parsed.error.issues.some(
        (issue) => issue.path.join(".") === "occurredAt",
      ),
    );
  }
});

test("F1 contract: rejects empty tenant, org, actor and idempotency fields", () => {
  const input = {
    ...validEvidenceEvent(),
    tenantId: "",
    orgId: "",
    actor: { type: "user", id: "" },
    idempotencyKey: "",
  };

  const parsed = evidenceUploadedV1EventSchema.safeParse(input);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => issue.path.join("."));
    assert.ok(paths.includes("tenantId"));
    assert.ok(paths.includes("orgId"));
    assert.ok(paths.includes("actor.id"));
    assert.ok(paths.includes("idempotencyKey"));
  }
});

test("F1 privacy: payload is strict and rejects signedUrl or token fields", () => {
  const input = {
    ...validEvidenceEvent(),
    payload: {
      ...validEvidenceEvent().payload,
      signedUrl: "https://storage.example/signed-secret",
      token: "secret",
    },
  };

  assert.equal(evidenceUploadedV1EventSchema.safeParse(input).success, false);
});

test("F1 contract: Evidence entity and payload IDs must match", () => {
  const input = {
    ...validEvidenceEvent(),
    entityId: "ev_other",
  };

  const parsed = evidenceUploadedV1EventSchema.safeParse(input);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.ok(
      parsed.error.issues.some((issue) => issue.path.join(".") === "entityId"),
    );
  }
});

test("F1 compatibility: v2 Evidence maps to the existing v1 event without losing trace context", () => {
  const parsed = evidenceUploadedV1EventSchema.parse(validEvidenceEvent());
  const legacy = toLegacySemseEventV1(parsed);

  assert.equal(legacy.type, "evidence.uploaded");
  assert.equal(legacy.meta.tenantId, parsed.tenantId);
  assert.equal(legacy.meta.correlationId, parsed.correlationId);
  assert.equal(legacy.meta.actorId, parsed.actor.id);
  assert.equal(legacy.meta.actorType, parsed.actor.type);
  assert.equal(legacy.meta.occurredAt, parsed.occurredAt);
  assert.equal(legacy.payload.evidenceId, parsed.payload.evidenceId);
  assert.deepEqual(legacy.triggers, ["evidence-coach", "audit"]);
});

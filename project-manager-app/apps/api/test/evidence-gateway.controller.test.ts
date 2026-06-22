import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { EvidenceGatewayController } from "../dist/modules/evidence-gateway/evidence-gateway.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_eg_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_1",
      userId: "usr_worker_1",
      roles: ["PRO"],
    },
    raw: { on: () => {} },
    ...overrides,
  };
}

const STUB_UPLOAD_RESULT = {
  evidenceId: "ev_1",
  projectId: "proj_1",
  kind: "PHOTO",
  bucketKey: "s3://bucket/ev_1.jpg",
  status: "received",
  uploadedAt: new Date().toISOString(),
};

const STUB_MILESTONE_STATUS = {
  milestoneId: "ms_1",
  projectId: "proj_1",
  evidenceCount: 5,
  passedCount: 4,
  failedCount: 1,
  overallStatus: "review_required",
};

const STUB_EVIDENCE_ITEMS = [
  { evidenceId: "ev_1", kind: "PHOTO", analysis: { blurScore: 0.2 } },
  { evidenceId: "ev_2", kind: "PHOTO", analysis: { blurScore: 0.15 } },
];

// ── Permission declarations ───────────────────────────────────────────────────

test("evidence-gateway controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["uploadEvidence",                "evidence:write"],
    ["getMilestoneValidationStatus",  "evidence:read"],
    ["getPassedEvidence",             "evidence:read"],
    ["getFailedEvidence",             "evidence:read"],
    ["getPendingEvidence",            "evidence:read"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, EvidenceGatewayController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── uploadEvidence ────────────────────────────────────────────────────────────

test("evidence-gateway controller: uploadEvidence validates input and returns result", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new EvidenceGatewayController({
    async uploadEvidence(opts: Record<string, unknown>) {
      calls.push(opts);
      return STUB_UPLOAD_RESULT;
    },
    async validateEvidenceAsync() {},
    async getMilestoneValidationStatus() { return STUB_MILESTONE_STATUS; },
    async getPassedEvidence() { return []; },
    async getFailedEvidence() { return []; },
    async getPendingEvidence() { return []; },
  } as never);

  const body = {
    projectId: "proj_1",
    milestoneId: "ms_1",
    kind: "PHOTO",
    bucketKey: "s3://bucket/ev_1.jpg",
    metadataJson: { capturedAt: "2026-06-21T10:00:00Z" },
  };
  const result = await controller.uploadEvidence(makeReq() as never, body);
  assert.equal(result.requestId, "req_eg_1");
  assert.equal(result.data.evidenceId, "ev_1");
  assert.equal(calls[0]?.projectId, "proj_1");
  assert.equal(calls[0]?.uploadedById, "usr_worker_1");
  assert.equal(calls[0]?.kind, "PHOTO");
});

test("evidence-gateway controller: uploadEvidence defaults kind to PHOTO when not provided", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new EvidenceGatewayController({
    async uploadEvidence(opts: Record<string, unknown>) {
      calls.push(opts);
      return STUB_UPLOAD_RESULT;
    },
    async validateEvidenceAsync() {},
    async getMilestoneValidationStatus() { return STUB_MILESTONE_STATUS; },
    async getPassedEvidence() { return []; },
    async getFailedEvidence() { return []; },
    async getPendingEvidence() { return []; },
  } as never);

  await controller.uploadEvidence(makeReq() as never, { projectId: "proj_1", bucketKey: "s3://..." });
  assert.equal(calls[0]?.kind, "PHOTO");
});

// ── getMilestoneValidationStatus ──────────────────────────────────────────────

test("evidence-gateway controller: getMilestoneValidationStatus routes params to service", async () => {
  const calls: unknown[] = [];
  const controller = new EvidenceGatewayController({
    async uploadEvidence() { return STUB_UPLOAD_RESULT; },
    async validateEvidenceAsync() {},
    async getMilestoneValidationStatus(projectId: string, milestoneId: string) {
      calls.push([projectId, milestoneId]);
      return { ...STUB_MILESTONE_STATUS, milestoneId };
    },
    async getPassedEvidence() { return []; },
    async getFailedEvidence() { return []; },
    async getEvidenceAnalysis() { return {}; },
  } as never);

  const result = await controller.getMilestoneValidationStatus(makeReq() as never, "proj_abc", "ms_xyz");
  assert.deepEqual(calls[0], ["proj_abc", "ms_xyz"]);
  assert.equal(result.data.milestoneId, "ms_xyz");
});

// ── getPassedEvidence ─────────────────────────────────────────────────────────

test("evidence-gateway controller: getPassedEvidence returns items with count", async () => {
  const controller = new EvidenceGatewayController({
    async uploadEvidence() { return STUB_UPLOAD_RESULT; },
    async validateEvidenceAsync() {},
    async getMilestoneValidationStatus() { return STUB_MILESTONE_STATUS; },
    async getPassedEvidence(projectId: string) {
      return projectId === "proj_1" ? STUB_EVIDENCE_ITEMS : [];
    },
    async getFailedEvidence() { return []; },
    async getEvidenceAnalysis() { return {}; },
  } as never);

  const result = await controller.getPassedEvidence(makeReq() as never, "proj_1");
  assert.equal(result.data.count, 2);
  assert.equal(result.data.items.length, 2);
});

// ── getFailedEvidence ─────────────────────────────────────────────────────────

test("evidence-gateway controller: getFailedEvidence returns items with count", async () => {
  const FAILED_ITEMS = [
    { evidenceId: "ev_bad_1", kind: "PHOTO", failureReason: "Motion blur detected" },
  ];

  const controller = new EvidenceGatewayController({
    async uploadEvidence() { return STUB_UPLOAD_RESULT; },
    async validateEvidenceAsync() {},
    async getMilestoneValidationStatus() { return STUB_MILESTONE_STATUS; },
    async getPassedEvidence() { return []; },
    async getFailedEvidence() { return FAILED_ITEMS; },
    async getEvidenceAnalysis() { return {}; },
  } as never);

  const result = await controller.getFailedEvidence(makeReq() as never, "proj_1");
  assert.equal(result.data.count, 1);
  assert.ok(result.data.items[0]?.failureReason);
});

// ── Safe route ID validation ──────────────────────────────────────────────────


test("evidence-gateway controller: getPendingEvidence returns items with count", async () => {
  const PENDING_ITEMS = [
    { evidenceId: "ev_pending_1", kind: "PHOTO", status: "validating" },
  ];

  const controller = new EvidenceGatewayController({
    async uploadEvidence() { return STUB_UPLOAD_RESULT; },
    async validateEvidenceAsync() {},
    async getMilestoneValidationStatus() { return STUB_MILESTONE_STATUS; },
    async getPassedEvidence() { return []; },
    async getFailedEvidence() { return []; },
    async getPendingEvidence() { return PENDING_ITEMS; },
  } as never);

  const result = await controller.getPendingEvidence(makeReq() as never, "proj_1");
  assert.equal(result.data.count, 1);
  assert.equal(result.data.items[0]?.status, "validating");
});

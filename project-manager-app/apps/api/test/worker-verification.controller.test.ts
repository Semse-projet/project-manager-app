import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { WorkerVerificationController } from "../dist/modules/worker-verification/worker-verification.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_wv_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_1",
      userId: "usr_worker_1",
      roles: ["PRO"],
    },
    ...overrides,
  };
}

const STUB_VERIFICATION_STATE = {
  workerId: "worker_1",
  status: "pending",
  verificationType: "DID_SIGNATURE",
  challenge: "challenge_123abc",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const STUB_VERIFICATION_HISTORY = [
  { id: "v_1", status: "verified", completedAt: new Date().toISOString() },
  { id: "v_2", status: "failed", failedAt: new Date().toISOString() },
];

// ── Permission declarations ───────────────────────────────────────────────────

test("worker-verification controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["initiateVerification",   "worker:write"],
    ["submitDidSignature",     "worker:write"],
    ["getVerificationStatus",  "worker:read"],
    ["getVerificationHistory", "worker:read"],
    ["listUnverifiedWorkers",  "worker:read"],
    ["getVerificationStats",   "worker:read"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, WorkerVerificationController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── initiateVerification ──────────────────────────────────────────────────────

test("worker-verification controller: initiateVerification returns challenge state", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new WorkerVerificationController({
    async initiateVerification(opts: Record<string, unknown>) {
      calls.push(opts);
      return STUB_VERIFICATION_STATE;
    },
    async submitDidSignature() { return STUB_VERIFICATION_STATE; },
    async getVerificationStatus() { return STUB_VERIFICATION_STATE; },
    async getVerificationHistory() { return STUB_VERIFICATION_HISTORY; },
    async listUnverifiedWorkers() { return []; },
    async getVerificationStats() { return {}; },
  } as never);

  const result = await controller.initiateVerification(makeReq() as never, "worker_1");
  assert.equal(result.requestId, "req_wv_1");
  assert.equal(result.data.status, "pending");
  assert.ok(result.data.challenge);
  assert.equal(calls[0]?.workerId, "worker_1");
  assert.equal(calls[0]?.tenantId, "tenant_1");
  assert.equal(calls[0]?.verificationType, "DID_SIGNATURE");
});

// ── submitDidSignature ────────────────────────────────────────────────────────

test("worker-verification controller: submitDidSignature routes signature and key", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new WorkerVerificationController({
    async initiateVerification() { return STUB_VERIFICATION_STATE; },
    async submitDidSignature(workerId: string, tenantId: string, sig: string, key: string, ...rest: unknown[]) {
      calls.push({ workerId, tenantId, sig, key, rest });
      return { ...STUB_VERIFICATION_STATE, status: "verified" };
    },
    async getVerificationStatus() { return STUB_VERIFICATION_STATE; },
    async getVerificationHistory() { return STUB_VERIFICATION_HISTORY; },
    async listUnverifiedWorkers() { return []; },
    async getVerificationStats() { return {}; },
  } as never);

  const body = { didSignature: "sig_abc123", didPublicKey: "key_xyz789" };
  const result = await controller.submitDidSignature(makeReq() as never, "worker_1", body);
  assert.equal(result.data.status, "verified");
  assert.equal(calls[0]?.workerId, "worker_1");
  assert.equal(calls[0]?.sig, "sig_abc123");
  assert.equal(calls[0]?.key, "key_xyz789");
});

// ── getVerificationStatus ─────────────────────────────────────────────────────

test("worker-verification controller: getVerificationStatus returns current state", async () => {
  const calls: string[] = [];
  const controller = new WorkerVerificationController({
    async initiateVerification() { return STUB_VERIFICATION_STATE; },
    async submitDidSignature() { return STUB_VERIFICATION_STATE; },
    async getVerificationStatus(workerId: string) {
      calls.push(workerId);
      return { ...STUB_VERIFICATION_STATE, workerId };
    },
    async getVerificationHistory() { return STUB_VERIFICATION_HISTORY; },
    async listUnverifiedWorkers() { return []; },
    async getVerificationStats() { return {}; },
  } as never);

  const result = await controller.getVerificationStatus(makeReq() as never, "worker_abc");
  assert.equal(result.data.workerId, "worker_abc");
  assert.equal(calls[0], "worker_abc");
});

// ── getVerificationHistory ────────────────────────────────────────────────────

test("worker-verification controller: getVerificationHistory returns list of attempts", async () => {
  const controller = new WorkerVerificationController({
    async initiateVerification() { return STUB_VERIFICATION_STATE; },
    async submitDidSignature() { return STUB_VERIFICATION_STATE; },
    async getVerificationStatus() { return STUB_VERIFICATION_STATE; },
    async getVerificationHistory() { return STUB_VERIFICATION_HISTORY; },
    async listUnverifiedWorkers() { return []; },
    async getVerificationStats() { return {}; },
  } as never);

  const result = await controller.getVerificationHistory(makeReq() as never, "worker_1");
  assert.ok(Array.isArray(result.data));
  assert.equal(result.data.length, 2);
});

// ── listUnverifiedWorkers ─────────────────────────────────────────────────────

test("worker-verification controller: listUnverifiedWorkers returns count and list", async () => {
  const STUB_WORKERS = [
    { workerId: "w1", email: "w1@example.com", unverifiedSince: new Date().toISOString() },
    { workerId: "w2", email: "w2@example.com", unverifiedSince: new Date().toISOString() },
  ];

  const controller = new WorkerVerificationController({
    async initiateVerification() { return STUB_VERIFICATION_STATE; },
    async submitDidSignature() { return STUB_VERIFICATION_STATE; },
    async getVerificationStatus() { return STUB_VERIFICATION_STATE; },
    async getVerificationHistory() { return STUB_VERIFICATION_HISTORY; },
    async listUnverifiedWorkers(tenantId: string) {
      return tenantId === "tenant_1" ? STUB_WORKERS : [];
    },
    async getVerificationStats() { return {}; },
  } as never);

  const result = await controller.listUnverifiedWorkers(makeReq() as never);
  assert.equal(result.data.count, 2);
  assert.equal(result.data.workers.length, 2);
});

// ── getVerificationStats ──────────────────────────────────────────────────────

test("worker-verification controller: getVerificationStats returns aggregated metrics", async () => {
  const STUB_STATS = {
    tenantId: "tenant_1",
    totalWorkers: 50,
    verifiedCount: 45,
    pendingCount: 3,
    failedCount: 2,
    verificationRate: 0.9,
  };

  const controller = new WorkerVerificationController({
    async initiateVerification() { return STUB_VERIFICATION_STATE; },
    async submitDidSignature() { return STUB_VERIFICATION_STATE; },
    async getVerificationStatus() { return STUB_VERIFICATION_STATE; },
    async getVerificationHistory() { return STUB_VERIFICATION_HISTORY; },
    async listUnverifiedWorkers() { return []; },
    async getVerificationStats() { return STUB_STATS; },
  } as never);

  const result = await controller.getVerificationStats(makeReq() as never);
  assert.equal(result.data.verificationRate, 0.9);
  assert.equal(result.data.verifiedCount, 45);
});

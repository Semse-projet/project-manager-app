import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { WorkerVerificationService } from "../dist/modules/worker-verification/worker-verification.service.js";

// C10 — User rows are global; a worker belongs to a tenant only through a
// Membership in one of its orgs. status/history/verify/sign took a bare
// workerId, so any worker:read/write holder of any tenant could read or
// drive another tenant's workers. History also returned a synthetic
// "verified" entry for every id (fabricated success).

function build() {
  const calls: string[] = [];
  const repository = {
    // worker_1 is a member of tenant_1 only.
    async getWorkerInTenant(workerId: string, tenantId: string) {
      calls.push(`lookup:${workerId}:${tenantId}`);
      return workerId === "worker_1" && tenantId === "tenant_1"
        ? { id: "worker_1", verificationStatus: "unverified" }
        : null;
    },
    async storeDidSignature() { calls.push("store"); },
    async createVerificationLog() { calls.push("log"); },
    async verifyDidSignature() { return false; },
    async markPendingIfUnverified() { return false; },
    async markVerified() { return false; },
  };
  return { service: new WorkerVerificationService(repository as never), calls };
}

test("status/history: worker of another tenant is not found (no existence oracle)", async () => {
  const { service } = build();
  await assert.rejects(service.getVerificationStatus("worker_1", "tenant_2"), NotFoundException);
  await assert.rejects(service.getVerificationHistory("worker_1", "tenant_2"), NotFoundException);
  await assert.rejects(service.getVerificationStatus("ghost", "tenant_1"), NotFoundException);
});

test("status: owning tenant reads the state", async () => {
  const { service } = build();
  const state = await service.getVerificationStatus("worker_1", "tenant_1");
  assert.equal(state.workerId, "worker_1");
});

test("history is honest: real User.verificationStatus, no fabricated verified entry", async () => {
  const { service } = build();
  const history = await service.getVerificationHistory("worker_1", "tenant_1");
  assert.equal(history.overallStatus, "unverified");
  assert.deepEqual(history.verifications, []);
  assert.equal(history.historyAvailable, false);
});

test("verify/sign: foreign tenant cannot initiate or sign, and nothing is stored", async () => {
  const { service, calls } = build();
  await assert.rejects(
    service.initiateVerification({ workerId: "worker_1", tenantId: "tenant_2", actor: { userId: "worker_1", roles: [] }, verificationType: "DID_SIGNATURE" } as never),
    NotFoundException,
  );
  await assert.rejects(service.submitDidSignature("worker_1", "tenant_2", "sig", "pub", { userId: "worker_1", roles: [] }), NotFoundException);
  assert.ok(!calls.includes("store") && !calls.includes("log"));
});

test("verify: owning tenant can initiate", async () => {
  const { service } = build();
  const state = await service.initiateVerification({ workerId: "worker_1", tenantId: "tenant_1", actor: { userId: "worker_1", roles: [] }, verificationType: "DID_SIGNATURE" } as never);
  assert.equal(state.status, "pending");
});

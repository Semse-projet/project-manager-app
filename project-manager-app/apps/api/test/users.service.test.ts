import test from "node:test";
import assert from "node:assert/strict";
import { UsersService } from "../dist/modules/users/users.service.js";

function createService() {
  const calls = {
    audit: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
  };

  const repository = {
    async findUserById() {
      return {
        id: "usr_target",
        email: "target@semse.dev",
        status: "pending",
        verificationStatus: "unverified",
        trustScore: 0.4,
        riskLevel: "medium",
        flags: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      };
    },
    async updateUserStatus(input: Record<string, unknown>) {
      calls.updates.push(input);
      return {
        id: "usr_target",
        email: "target@semse.dev",
        status: String(input.status ?? "active"),
        verificationStatus: "unverified",
        trustScore: 0.4,
        riskLevel: "medium",
        flags: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      };
    },
  };

  const auditService = {
    async append(input: Record<string, unknown>) {
      calls.audit.push(input);
    },
  };

  const domainEventBus = {};

  return {
    service: new UsersService(repository as never, auditService as never, domainEventBus as never),
    calls,
  };
}

test("users service updates status for OPS admins and audits the change", async () => {
  const { service, calls } = createService();

  const updated = await service.updateUserStatus({
    tenantId: "tnt_test",
    orgId: "org_test",
    userId: "usr_admin",
    roles: ["OPS_ADMIN"],
    targetUserId: "usr_target",
    status: "active",
    requestId: "req_test",
  });

  assert.equal(updated.status, "active");
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.audit.length, 1);
  assert.equal(calls.audit[0]?.action, "user.status.update");
  assert.deepEqual(calls.audit[0]?.beforeJson, { status: "pending" });
  assert.deepEqual(calls.audit[0]?.afterJson, { status: "active" });
});

test("users service rejects status updates for non-admin actors", async () => {
  const { service, calls } = createService();

  await assert.rejects(
    () =>
      service.updateUserStatus({
        tenantId: "tnt_test",
        orgId: "org_test",
        userId: "usr_pro",
        roles: ["PRO"],
        targetUserId: "usr_target",
        status: "suspended",
        requestId: "req_test",
      }),
    /Cannot update user status/,
  );

  assert.equal(calls.updates.length, 0);
  assert.equal(calls.audit.length, 0);
});

// ── Verification requests (AUDIT_REMEDIATION_PLAN.md 2.28) ────────────────────

function createServiceWithWorkspaceMemory() {
  const stored = new Map<string, { id: string; body?: string }>();
  const workspaceMemory = {
    async append(record: { id: string; body?: string }) {
      stored.set(record.id, record);
      return record;
    },
    async query(input: { workspaceId: string; tags?: string[] }) {
      return Array.from(stored.values()).filter((r) => r.id.includes(input.workspaceId));
    },
    async queryAcrossTenant() {
      return Array.from(stored.values()).filter((r) => JSON.parse(r.body ?? "{}").status === "pending");
    },
  };
  const repository = {
    async findUserById() { return { id: "usr_target", verificationStatus: "unverified" }; },
    async verifyUser(input: Record<string, unknown>) {
      return { id: input.targetUserId, verificationStatus: "verified" };
    },
  };
  const auditService = { async append() { /* no-op */ } };
  const domainEventBus = { async emit() { /* no-op */ } };
  const service = new UsersService(repository as never, auditService as never, domainEventBus as never, workspaceMemory as never);
  return { service, workspaceMemory };
}

void test("requestVerification queues a pending request for the requester's own account", async () => {
  const { service } = createServiceWithWorkspaceMemory();

  const result = await service.requestVerification({
    tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"],
    targetUserId: "usr_pro", verificationType: "id_document",
  });

  assert.equal(result.status, "pending");
  assert.equal(result.verificationType, "id_document");
});

void test("requestVerification rejects requesting verification for someone else", async () => {
  const { service } = createServiceWithWorkspaceMemory();

  await assert.rejects(
    () => service.requestVerification({
      tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"],
      targetUserId: "usr_other", verificationType: "id_document",
    }),
    /Cannot request verification/,
  );
});

void test("listVerificationRequests rejects non-admin actors", async () => {
  const { service } = createServiceWithWorkspaceMemory();

  await assert.rejects(
    () => service.listVerificationRequests({ tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"] }),
    /Cannot view verification requests/,
  );
});

void test("reviewVerificationRequest rejects non-admin actors", async () => {
  const { service } = createServiceWithWorkspaceMemory();

  await assert.rejects(
    () => service.reviewVerificationRequest({
      tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"],
      targetUserId: "usr_pro", verificationType: "id_document", decision: "approved", requestId: "req_1",
    }),
    /Cannot review verification requests/,
  );
});

void test("reviewVerificationRequest 404s when there's no matching pending request", async () => {
  const { service } = createServiceWithWorkspaceMemory();

  await assert.rejects(
    () => service.reviewVerificationRequest({
      tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"],
      targetUserId: "usr_nobody", verificationType: "id_document", decision: "approved", requestId: "req_1",
    }),
  );
});

void test("an approved review shows up in listVerificationRequests as no longer pending, and a rejected one never verifies the user", async () => {
  const { service } = createServiceWithWorkspaceMemory();

  await service.requestVerification({
    tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"],
    targetUserId: "usr_pro", verificationType: "id_document",
  });

  const pendingBefore = await service.listVerificationRequests({ tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"] });
  assert.equal(pendingBefore.length, 1);
  assert.equal(pendingBefore[0].userId, "usr_pro");

  const review = await service.reviewVerificationRequest({
    tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"],
    targetUserId: "usr_pro", verificationType: "id_document", decision: "approved", requestId: "req_1",
  });
  assert.equal(review.status, "approved");

  const pendingAfter = await service.listVerificationRequests({ tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"] });
  assert.equal(pendingAfter.length, 0, "the same deterministic id should be overwritten, not duplicated, once reviewed");
});

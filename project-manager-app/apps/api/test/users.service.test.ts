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

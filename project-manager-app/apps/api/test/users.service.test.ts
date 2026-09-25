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
    async findMembershipsByUser(input: Record<string, unknown>) {
      calls.updates.push({ findMembershipsByUser: input });
      return [
        {
          userId: String(input.targetUserId),
          orgId: "org_client",
          roleId: "role_client",
          status: "ACTIVE",
          org: { id: "org_client", name: "Org Cliente", type: "client" },
          role: { id: "role_client", key: "CLIENT", name: "Cliente" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          userId: String(input.targetUserId),
          orgId: "org_pro",
          roleId: "role_pro",
          status: "ACTIVE",
          org: { id: "org_pro", name: "Org Profesional", type: "pro" },
          role: { id: "role_pro", key: "PRO", name: "Profesional" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ];
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

// ── Capabilities (docs/specs/core/universal-identity-multi-role.spec.md) ──────

test("getMyCapabilities returns the actor's own memberships, mapped to role/orgId/status", async () => {
  const { service } = createService();

  const capabilities = await service.getMyCapabilities({
    tenantId: "tnt_test",
    orgId: "org_client",
    userId: "usr_multi",
    roles: ["CLIENT"],
  });

  // status: docs/specs/core/org-membership-status.spec.md — surfaced
  // alongside role/orgId, not filtered here (read-only endpoint).
  assert.deepEqual(capabilities, [
    { role: "CLIENT", orgId: "org_client", status: "ACTIVE", verifiedAt: null },
    { role: "PRO", orgId: "org_pro", status: "ACTIVE", verifiedAt: null },
  ]);
});

test("getMyCapabilities requests memberships scoped to the actor's own userId and tenant, not an arbitrary target", async () => {
  const { service, calls } = createService();

  await service.getMyCapabilities({
    tenantId: "tnt_test",
    orgId: "org_client",
    userId: "usr_multi",
    roles: ["CLIENT"],
  });

  const call = calls.updates.find((c) => "findMembershipsByUser" in c) as
    | { findMembershipsByUser: Record<string, unknown> }
    | undefined;
  assert.ok(call, "expected findMembershipsByUser to be called");
  assert.equal(call.findMembershipsByUser.tenantId, "tnt_test");
  assert.equal(call.findMembershipsByUser.targetUserId, "usr_multi");
  assert.equal(call.findMembershipsByUser.userId, "usr_multi");
});

// ── Verification requests (AUDIT_REMEDIATION_PLAN.md 2.28) ────────────────────

function createServiceWithWorkspaceMemory(options: { attestationFails?: boolean } = {}) {
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
  const attestations: Array<Record<string, unknown>> = [];
  const verifyUserCalls: Array<Record<string, unknown>> = [];
  const repository = {
    async findUserById() { return { id: "usr_target", verificationStatus: "unverified" }; },
    async verifyUser(input: Record<string, unknown>) {
      verifyUserCalls.push(input);
      return { id: input.targetUserId, verificationStatus: "verified" };
    },
    async createIdentityAttestation(input: Record<string, unknown>) {
      if (options.attestationFails) {
        throw new Error("SEMSE_ATTESTATION_PRIVATE_KEY and SEMSE_ATTESTATION_KEY_ID must be configured in production");
      }
      const record = { id: `att_${attestations.length + 1}`, createdAt: new Date(), ...input };
      attestations.push(record);
      return record;
    },
    async getLatestIdentityAttestation(tenantId: string, userId: string) {
      return attestations.filter((a) => a.tenantId === tenantId && a.userId === userId).at(-1) ?? null;
    },
  };
  const auditService = { async append() { /* no-op */ } };
  const domainEventBus = { async emit() { /* no-op */ } };
  const service = new UsersService(repository as never, auditService as never, domainEventBus as never, workspaceMemory as never);
  return { service, workspaceMemory, attestations, verifyUserCalls };
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

// ── Identity attestation (AUDIT_REMEDIATION_PLAN.md 0.9 / G-PRO-04) ───────────
// A separate verifier (OPS_ADMIN) signs, never the user being verified —
// see docs/specs/core/identity-attestation.spec.md.

void test("approving an id_document review produces a signed identity attestation", async () => {
  const { service, attestations } = createServiceWithWorkspaceMemory();

  await service.requestVerification({
    tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"],
    targetUserId: "usr_pro", verificationType: "id_document",
  });

  await service.reviewVerificationRequest({
    tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"],
    targetUserId: "usr_pro", verificationType: "id_document", decision: "approved", requestId: "req_1",
  });

  assert.equal(attestations.length, 1);
  assert.equal(attestations[0]?.tenantId, "tnt");
  assert.equal(attestations[0]?.userId, "usr_pro");
  assert.equal(attestations[0]?.verifiedByUserId, "usr_admin", "the admin who reviewed signs, not the worker");
  assert.equal(attestations[0]?.verificationType, "id_document");
  assert.ok(typeof attestations[0]?.signature === "string" && (attestations[0]?.signature as string).length > 0);
  assert.ok(typeof attestations[0]?.keyId === "string" && (attestations[0]?.keyId as string).length > 0);
});

// F04 (SEMSEproject_Auditoria_2026-09-11.md): a signing/persistence failure
// must never leave the user marked verified without a backing attestation.
void test("a failed attestation blocks verifyUser and leaves the request pending, not approved", async () => {
  const { service, verifyUserCalls } = createServiceWithWorkspaceMemory({ attestationFails: true });

  await service.requestVerification({
    tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"],
    targetUserId: "usr_pro", verificationType: "id_document",
  });

  await assert.rejects(
    () => service.reviewVerificationRequest({
      tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"],
      targetUserId: "usr_pro", verificationType: "id_document", decision: "approved", requestId: "req_1",
    }),
    /SEMSE_ATTESTATION_PRIVATE_KEY/,
  );

  assert.equal(verifyUserCalls.length, 0, "verifyUser must not run when the attestation failed");

  const pending = await service.listVerificationRequests({ tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"] });
  assert.equal(pending.length, 1, "the request must still read as pending, not silently approved");
});

void test("approving an email/phone review does not produce an identity attestation", async () => {
  const { service, attestations } = createServiceWithWorkspaceMemory();

  await service.requestVerification({
    tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"],
    targetUserId: "usr_pro", verificationType: "phone",
  });

  await service.reviewVerificationRequest({
    tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"],
    targetUserId: "usr_pro", verificationType: "phone", decision: "approved", requestId: "req_1",
  });

  assert.equal(attestations.length, 0, "only id_document is a strong-enough identity claim to sign");
});

void test("rejecting an id_document review does not produce an identity attestation", async () => {
  const { service, attestations } = createServiceWithWorkspaceMemory();

  await service.requestVerification({
    tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"],
    targetUserId: "usr_pro", verificationType: "id_document",
  });

  await service.reviewVerificationRequest({
    tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"],
    targetUserId: "usr_pro", verificationType: "id_document", decision: "rejected", requestId: "req_1",
  });

  assert.equal(attestations.length, 0);
});

void test("getIdentityAttestation lets a user read their own attestation", async () => {
  const { service } = createServiceWithWorkspaceMemory();

  await service.requestVerification({
    tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"],
    targetUserId: "usr_pro", verificationType: "id_document",
  });
  await service.reviewVerificationRequest({
    tenantId: "tnt", orgId: "org", userId: "usr_admin", roles: ["OPS_ADMIN"],
    targetUserId: "usr_pro", verificationType: "id_document", decision: "approved", requestId: "req_1",
  });

  const attestation = await service.getIdentityAttestation(
    { tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"] },
    "usr_pro",
  );

  assert.ok(attestation);
  assert.equal(attestation?.userId, "usr_pro");
});

void test("getIdentityAttestation rejects reading someone else's attestation without OPS_ADMIN", async () => {
  const { service } = createServiceWithWorkspaceMemory();

  await assert.rejects(
    () => service.getIdentityAttestation(
      { tenantId: "tnt", orgId: "org", userId: "usr_pro", roles: ["PRO"] },
      "usr_other",
    ),
    /Cannot read this user/,
  );
});

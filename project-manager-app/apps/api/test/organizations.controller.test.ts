import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { OrganizationsController } from "../dist/modules/organizations/organizations.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_org_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_client_1",
      userId: "usr_admin_1",
      roles: ["OPS_ADMIN"],
    },
    ...overrides,
  };
}

const STUB_ORG = {
  id: "org_client_1",
  tenantId: "tenant_1",
  name: "Acme Construction",
  type: "client",
  memberCount: 3,
};

// ── Permission declarations ───────────────────────────────────────────────────

test("organizations controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["list",    "org:read"],
    ["detail",  "org:read"],
    ["members", "org:members:read"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, OrganizationsController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── list ──────────────────────────────────────────────────────────────────────

test("organizations controller: list returns organizations for tenant", async () => {
  const calls: Record<string, unknown>[] = [];
  const controller = new OrganizationsController({
    async listOrgs(actor: Record<string, unknown>) {
      calls.push(actor);
      return [STUB_ORG];
    },
    async getOrg() { return STUB_ORG; },
    async listMembers() { return []; },
  } as never);

  const result = await controller.list(makeReq() as never);
  assert.equal(result.requestId, "req_org_1");
  assert.ok(Array.isArray(result.data));
  assert.equal(result.data.length, 1);
  assert.equal(calls[0]?.tenantId, "tenant_1");
  assert.equal(calls[0]?.orgId, "org_client_1");
  assert.equal(calls[0]?.userId, "usr_admin_1");
});

// ── detail ────────────────────────────────────────────────────────────────────

test("organizations controller: detail routes orgId param to service", async () => {
  const calls: string[] = [];
  const controller = new OrganizationsController({
    async listOrgs() { return []; },
    async getOrg(_actor: unknown, orgId: string) {
      calls.push(orgId);
      return { ...STUB_ORG, id: orgId };
    },
    async listMembers() { return []; },
  } as never);

  const result = await controller.detail(makeReq() as never, "org_client_1");
  assert.equal(result.data.id, "org_client_1");
  assert.equal(calls[0], "org_client_1");
});

test("organizations controller: detail rejects invalid orgId format", async () => {
  const controller = new OrganizationsController({
    async listOrgs() { return []; },
    async getOrg() { return STUB_ORG; },
    async listMembers() { return []; },
  } as never);

  // orgIdParamSchema validates format — empty string should fail
  await assert.rejects(
    () => controller.detail(makeReq() as never, ""),
    /BadRequestException/
  );
});

// ── members ───────────────────────────────────────────────────────────────────

test("organizations controller: members returns member list for org", async () => {
  const STUB_MEMBERS = [
    { userId: "usr_1", orgId: "org_client_1", role: "owner", joinedAt: new Date().toISOString() },
    { userId: "usr_2", orgId: "org_client_1", role: "member", joinedAt: new Date().toISOString() },
  ];

  const calls: string[] = [];
  const controller = new OrganizationsController({
    async listOrgs() { return []; },
    async getOrg() { return STUB_ORG; },
    async listMembers(_actor: unknown, orgId: string) {
      calls.push(orgId);
      return STUB_MEMBERS;
    },
  } as never);

  const result = await controller.members(makeReq() as never, "org_client_1");
  assert.equal(result.data.length, 2);
  assert.equal(calls[0], "org_client_1");
});

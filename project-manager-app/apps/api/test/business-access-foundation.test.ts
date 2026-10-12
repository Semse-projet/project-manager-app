import test from "node:test";
import assert from "node:assert/strict";
import { ServiceUnavailableException, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { signToken } from "../dist/common/auth-token.js";
import { AuthService } from "../dist/modules/auth/auth.service.js";
import { OrganizationsRepository } from "../dist/modules/organizations/organizations.repository.js";
import { OrganizationsService } from "../dist/modules/organizations/organizations.service.js";

const secret = "dec-r1-private-test-signing-secret-32-chars";
const restore = (key: string, value: string | undefined) => value === undefined ? delete process.env[key] : (process.env[key] = value);
const future = () => new Date(Date.now() + 120_000);
const actor = { userId: "usr_one", tenantId: "tenant_one", orgId: "org_a", roles: ["PRO"], sessionId: "sid_a" };

function token(roles = ["PRO"]) {
  return signToken({ userId: actor.userId, tenantId: actor.tenantId, orgId: actor.orgId, roles, sid: "sid_a", typ: "access" }, secret, 120);
}
function service(repository: Record<string, unknown>) {
  return new AuthService(repository as never, { async append() {} } as never, {} as never, { warn() {}, error() {} } as never);
}
function snapshot(roles = ["PRO"]) {
  return {
    session: { id: "sid_a", userId: actor.userId, orgId: actor.orgId, tenantId: actor.tenantId, roles: ["PRO", "CLIENT"], accessExpiresAt: future(), refreshExpiresAt: future() },
    userStatus: "active",
    activeRoles: roles
  };
}

test("DEC-R1: signed token roles are narrowed to durable active memberships", async () => {
  const original = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    const auth = service({ async findActiveSessionAuthorization() { return snapshot(["PRO"]); } });
    const result = await auth.authenticateRequest({ headers: { authorization: `Bearer ${token(["PRO", "OPS_ADMIN"])}` } });
    assert.deepEqual(result.roles, ["PRO"]);
    assert.equal(result.orgId, "org_a");
    assert.equal(result.sessionId, "sid_a");
  } finally { restore("AUTH_SECRET", original); }
});

test("DEC-R1: missing/revoked session and suspended org grant are denied on next request", async () => {
  const original = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    const revoked = service({ async findActiveSessionAuthorization() { return null; } });
    await assert.rejects(revoked.authenticateRequest({ headers: { authorization: `Bearer ${token()}` } }), UnauthorizedException);
    const suspended = service({ async findActiveSessionAuthorization() { return snapshot([]); } });
    await assert.rejects(suspended.authenticateRequest({ headers: { authorization: `Bearer ${token()}` } }), UnauthorizedException);
  } finally { restore("AUTH_SECRET", original); }
});

test("DEC-R1: database errors and hung resolution fail closed, not claims-only", async () => {
  const original = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    const failed = service({ async findActiveSessionAuthorization() { throw new Error("offline"); } });
    await assert.rejects(failed.authenticateRequest({ headers: { authorization: `Bearer ${token()}` } }), ServiceUnavailableException);
    const hung = service({ async findActiveSessionAuthorization() { return new Promise(() => undefined); } });
    const start = Date.now();
    await assert.rejects(hung.authenticateRequest({ headers: { authorization: `Bearer ${token()}` } }), ServiceUnavailableException);
    assert.ok(Date.now() - start < 2500);
  } finally { restore("AUTH_SECRET", original); }
});

test("DEC-R1: production cannot derive auth from caller-provided identity headers", async () => {
  const originalSecret = process.env.AUTH_SECRET, originalEnv = process.env.NODE_ENV;
  delete process.env.AUTH_SECRET;
  process.env.NODE_ENV = "production";
  try {
    const auth = service({});
    await assert.rejects(auth.authenticateRequest({headers: {"x-user-id":"usr_one","x-org-id":"org_a","x-tenant-id":"tenant_one","x-roles":"OPS_ADMIN"}}), ServiceUnavailableException);
  } finally { restore("AUTH_SECRET", originalSecret); restore("NODE_ENV", originalEnv); }
});

test("DEC-R1: session persistence failure never produces tokens", async () => {
  const original = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    const auth = service({async createSession() { throw new Error("DB unavailable"); }});
    await assert.rejects(auth.issueSession({...actor, requestId:"req_a"}), ServiceUnavailableException);
  } finally { restore("AUTH_SECRET", original); }
});

test("DEC-R1: organizations list is membership-scoped and cannot mutate actor context", async () => {
  const queries: unknown[] = [];
  const prisma = {
    org: {
      async findMany(arg: unknown) { queries.push(arg); return [{id:"org_a",tenantId:"tenant_one",type:"pro",name:"A",createdAt:new Date(),updatedAt:new Date()}]; }
    }
  };
  const repository = new OrganizationsRepository(prisma as never, {async ensureActorContext() { throw new Error("read attempted upsert"); }} as never);
  const records = await repository.findOrgsByTenant(actor);
  assert.equal(records.length, 1);
  assert.deepEqual((queries[0] as {where: Record<string,unknown>}).where, {
    tenantId: actor.tenantId, users: { some: { userId: actor.userId, status: "ACTIVE" } }
  });
});

test("DEC-R1: invisible organization and member list return 404 without side effects", async () => {
  const queries: unknown[] = [];
  const prisma = {
    org: {
      async findFirst(arg: unknown) { queries.push(arg); return null; }
    },
    membership: {async findMany() {throw new Error("members leaked");}}
  };
  const repository = new OrganizationsRepository(prisma as never, {async ensureActorContext() { throw new Error("mutation attempted"); }} as never);
  const organizations = new OrganizationsService(repository, {} as never);
  await assert.rejects(organizations.getOrg(actor, "org_b"), NotFoundException);
  await assert.rejects(organizations.listMembers(actor, "org_b"), NotFoundException);
  assert.equal(queries.length, 2);
});

test("DEC-R1: admin exception retains tenant filter", async () => {
  const queries: unknown[] = [];
  const prisma = {org: {async findMany(arg: unknown) {queries.push(arg);return [];}}};
  const repository = new OrganizationsRepository(prisma as never, {} as never);
  await repository.findOrgsByTenant({...actor, roles:["OPS_ADMIN"]});
  assert.deepEqual((queries[0] as {where: unknown}).where, {tenantId: actor.tenantId});
});

test("DEC-R1: refresh rotation uses compare-and-swap and cannot reuse a consumed token", async () => {
  const { AuthRepository } = await import("../dist/modules/auth/auth.repository.js");
  const operations: Array<Record<string, unknown>> = [];
  const repository = new AuthRepository({
    authSession: {
      async updateMany(query: Record<string, unknown>) {
        operations.push(query);
        return { count: operations.length === 1 ? 1 : 0 };
      }
    }
  } as never);
  const input = {
    sessionId: "sid_a",
    previousRefreshTokenHash: "sha-old",
    refreshTokenHash: "sha-new",
    roles: ["PRO"],
    accessExpiresAt: future(),
    refreshExpiresAt: future()
  };
  const first = await repository.rotateSessionRefreshToken(input);
  const second = await repository.rotateSessionRefreshToken(input);
  assert.equal(first.count, 1);
  assert.equal(second.count, 0);
  assert.deepEqual((operations[0].where as Record<string,unknown>).refreshTokenHash, "sha-old");
  assert.equal((operations[0].where as Record<string,unknown>).status, "ACTIVE");
  assert.equal((operations[0].where as Record<string,unknown>).revokedAt, null);
});

test("DEC-R1: a member of two organizations is permitted in each without changing the active cookie", async () => {
  const queries: unknown[] = [];
  const prisma = {org: {async findFirst(arg: unknown) {
    queries.push(arg);
    return {id:"org_b",tenantId:"tenant_one",type:"pro",name:"B",createdAt:new Date(),updatedAt:new Date()};
  }}};
  const repository = new OrganizationsRepository(prisma as never, {} as never);
  const org = await repository.findOrgById({...actor,targetOrgId:"org_b"});
  assert.equal(org.id, "org_b");
  assert.deepEqual((queries[0] as {where: unknown}).where, {
    id: "org_b",
    tenantId: "tenant_one",
    users: { some: { userId: "usr_one", status: "ACTIVE" } }
  });
});

test("DEC-R1: direct resolveRequestContext denies unsigned production headers", async () => {
  const { resolveRequestContext } = await import("../dist/common/request-context.js");
  const originalSecret = process.env.AUTH_SECRET, originalEnv = process.env.NODE_ENV;
  delete process.env.AUTH_SECRET;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(
      () => resolveRequestContext({headers: {"x-user-id":"usr_one","x-org-id":"org_a","x-tenant-id":"tenant_one","x-roles":"OPS_ADMIN"}}),
      ServiceUnavailableException,
    );
  } finally { restore("AUTH_SECRET", originalSecret); restore("NODE_ENV", originalEnv); }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  acceptRequestFingerprint,
  assertProjectInGrantOrg,
  computeGrantExpiry,
  idempotencyKeyDigest,
  mcpEffectiveRoles,
  rolesCoverScopes,
  terminalAt,
  truncateToUtcDay,
} from "../dist/modules/mcp-consent/mcp-consent.policy.js";
import { McpConsentService } from "../dist/modules/mcp-consent/mcp-consent.service.js";
import { intersectSessionRoles } from "../dist/modules/auth/session-roles.js";
import { hasPermission } from "../dist/common/rbac.js";
import prismaClientPackage from "../../../node_modules/.prisma/client/index.js";
const { Prisma } = prismaClientPackage;

/**
 * S1/D7 fase B — reglas puras y fail-closed del servicio sin base de datos.
 * Spec: docs/specs/platform/semse-mcp-delegated-consent.spec.md (casos D7-xx).
 */

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-26T12:00:00.000Z");
const trust = {
  oauthIssuer: "https://auth.example.invalid/",
  resourceUri: "https://mcp.example.invalid/semse",
  allowedClientIds: ["client-ok"],
  acceptedPolicyVersions: ["p1"],
};

test("D7-22: expiry is min(refresh, 30-day cap, requested) and rejects past or over-cap requests", () => {
  const farRefresh = new Date(now.getTime() + 60 * DAY);
  assert.equal(computeGrantExpiry({ now, refreshExpiresAt: farRefresh }).getTime(), now.getTime() + 30 * DAY);
  const day = new Date(now.getTime() + DAY);
  assert.equal(computeGrantExpiry({ now, refreshExpiresAt: farRefresh, requestedExpiresAt: day }).getTime(), day.getTime());
  const week = new Date(now.getTime() + 7 * DAY);
  assert.equal(computeGrantExpiry({ now, refreshExpiresAt: farRefresh, requestedExpiresAt: week }).getTime(), week.getTime());
  const shortRefresh = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  assert.equal(
    computeGrantExpiry({ now, refreshExpiresAt: shortRefresh, requestedExpiresAt: week }).getTime(),
    shortRefresh.getTime(),
  );
  assert.throws(
    () => computeGrantExpiry({ now, refreshExpiresAt: farRefresh, requestedExpiresAt: new Date(now.getTime() + 31 * DAY) }),
    BadRequestException,
  );
  assert.throws(
    () => computeGrantExpiry({ now, refreshExpiresAt: farRefresh, requestedExpiresAt: new Date(now.getTime() - 1) }),
    BadRequestException,
  );
});

test("Q2: web intersection is unchanged and MCP drops OPS_ADMIN (also via the ADMIN alias)", () => {
  assert.deepEqual(intersectSessionRoles(["CLIENT", "PRO"], ["CLIENT", "PRO"], ["CLIENT"]), ["CLIENT"]);
  assert.deepEqual(intersectSessionRoles(["CLIENT", "PRO"], ["PRO"]), ["PRO"]);
  assert.deepEqual(mcpEffectiveRoles(["CLIENT", "OPS_ADMIN"], ["CLIENT", "OPS_ADMIN"]), ["CLIENT"]);
  assert.deepEqual(mcpEffectiveRoles(["ADMIN"], ["ADMIN"]), []);
  assert.deepEqual(mcpEffectiveRoles(["CLIENT"], []), [], "a role missing from the session snapshot never counts");
});

test("D7-17: WORKER alone does not cover projects:read; PRO does", () => {
  assert.equal(rolesCoverScopes(["WORKER"], ["projects:read"]), false);
  assert.equal(rolesCoverScopes(["PRO", "WORKER"], ["projects:read"]), true);
  assert.equal(rolesCoverScopes(["PRO"], []), false, "empty scope set never authorizes");
});

test("D7-05b: project must belong to the grant org as client or assigned PRO", () => {
  assert.doesNotThrow(() => assertProjectInGrantOrg("org-a", { clientOrgId: "org-a", assignedProOrgId: "org-x" }));
  assert.doesNotThrow(() => assertProjectInGrantOrg("org-a", { clientOrgId: "org-x", assignedProOrgId: "org-a" }));
  assert.throws(
    () => assertProjectInGrantOrg("org-a", { clientOrgId: "org-b", assignedProOrgId: "org-c" }),
    ForbiddenException,
  );
  assert.throws(() => assertProjectInGrantOrg("", { clientOrgId: "", assignedProOrgId: "" }), ForbiddenException);
});

test("Q5: only OPS_ADMIN holds mcp:consents:revoke:tenant", () => {
  assert.equal(hasPermission(["OPS_ADMIN"], "mcp:consents:revoke:tenant"), true);
  for (const role of ["CLIENT", "PRO", "WORKER"]) {
    assert.equal(hasPermission([role], "mcp:consents:revoke:tenant"), false, role);
  }
});

test("D7-03: request fingerprint changes with requested expiry, policy or consent version", () => {
  const base = {
    sessionId: "s1", oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
    scopeSet: ["projects:read"], grantBindingDigest: "b1", policyVersion: "p1", consentVersion: "c1",
  };
  const fp = acceptRequestFingerprint(base);
  assert.equal(acceptRequestFingerprint({ ...base, scopeSet: ["projects:read", "projects:read"] }), fp);
  assert.notEqual(acceptRequestFingerprint({ ...base, requestedExpiresAt: new Date(now.getTime() + DAY) }), fp);
  assert.notEqual(acceptRequestFingerprint({ ...base, policyVersion: "p2" }), fp);
  assert.notEqual(acceptRequestFingerprint({ ...base, consentVersion: "c2" }), fp);
});

test("Q6 helpers: day truncation, terminal moment and tenant-scoped idempotency digest", () => {
  assert.equal(truncateToUtcDay(new Date("2026-10-26T23:59:59.999Z")).toISOString(), "2026-10-26T00:00:00.000Z");
  const expiresAt = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(terminalAt({ revokedAt: null, expiresAt }), expiresAt);
  const revokedAt = new Date("2025-12-01T00:00:00.000Z");
  assert.equal(terminalAt({ revokedAt, expiresAt }), revokedAt);
  assert.notEqual(idempotencyKeyDigest("tenant-a", "key-1"), idempotencyKeyDigest("tenant-b", "key-1"));
  assert.ok(!idempotencyKeyDigest("tenant-a", "key-1").includes("key-1"));
});

function serviceWith(repository, authRepository = {}) {
  return new McpConsentService(repository, authRepository, trust, () => now);
}

const readInput = {
  tenantId: "tenant-a",
  grantBindingDigest: "binding-digest-0001",
  oauthIssuer: trust.oauthIssuer,
  oauthClientId: "client-ok",
  resourceUri: trust.resourceUri,
  scope: "projects:read",
};

test("D7-11: untrusted issuer, client or resource is rejected before any lookup", async () => {
  let lookups = 0;
  const service = serviceWith({ async findByBinding() { lookups += 1; return null; } });
  await assert.rejects(service.authorizeRead({ ...readInput, oauthClientId: "client-evil" }), ForbiddenException);
  await assert.rejects(service.authorizeRead({ ...readInput, oauthIssuer: "https://evil.invalid/" }), ForbiddenException);
  await assert.rejects(service.authorizeRead({ ...readInput, resourceUri: "https://evil.invalid/mcp" }), ForbiddenException);
  assert.equal(lookups, 0);
});

test("D7-09/D7-11: missing, expired, anonymized or non-ACTIVE grants are denied without reading the session", async () => {
  const base = {
    id: "g1", tenantId: "tenant-a", orgId: "org-a", userId: "u1", sessionId: "s1",
    oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
    scopeSet: ["projects:read"], status: "ACTIVE", anonymizedAt: null, policyVersion: "p1",
    expiresAt: new Date(now.getTime() + DAY),
  };
  let sessionReads = 0;
  const authRepository = { async findActiveSessionAuthorization() { sessionReads += 1; return null; } };
  for (const grant of [
    null,
    { ...base, expiresAt: now },
    { ...base, status: "REVOKED" },
    { ...base, status: "PENDING" },
    { ...base, anonymizedAt: now },
    { ...base, userId: null },
    { ...base, oauthClientId: "client-other" },
    { ...base, scopeSet: [] },
    { ...base, policyVersion: "p0-retired" },
  ]) {
    const service = serviceWith({ async findByBinding() { return grant; } }, authRepository);
    await assert.rejects(service.authorizeRead(readInput), UnauthorizedException);
  }
  assert.equal(sessionReads, 0);
});

test("D7-04/D7-08: session of another user/org, inactive user or expired refresh denies", async () => {
  const grant = {
    id: "g1", tenantId: "tenant-a", orgId: "org-a", userId: "u1", sessionId: "s1",
    oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
    scopeSet: ["projects:read"], status: "ACTIVE", anonymizedAt: null, policyVersion: "p1",
    expiresAt: new Date(now.getTime() + DAY),
  };
  const session = {
    userId: "u1", orgId: "org-a", tenantId: "tenant-a", roles: ["CLIENT"],
    refreshExpiresAt: new Date(now.getTime() + DAY),
  };
  const ok = { session, userStatus: "active", activeRoles: ["CLIENT"] };
  const read = (snapshot) =>
    serviceWith({ async findByBinding() { return grant; } }, { async findActiveSessionAuthorization() { return snapshot; } })
      .authorizeRead(readInput);

  assert.deepEqual(await read(ok), { grantId: "g1", tenantId: "tenant-a", orgId: "org-a", userId: "u1", roles: ["CLIENT"] });
  await assert.rejects(read(null), UnauthorizedException);
  await assert.rejects(read({ ...ok, userStatus: "suspended" }), UnauthorizedException);
  await assert.rejects(read({ ...ok, session: { ...session, userId: "u2" } }), UnauthorizedException);
  await assert.rejects(read({ ...ok, session: { ...session, orgId: "org-b" } }), UnauthorizedException);
  await assert.rejects(read({ ...ok, session: { ...session, refreshExpiresAt: now } }), UnauthorizedException);
  await assert.rejects(read({ ...ok, activeRoles: ["WORKER"], session: { ...session, roles: ["WORKER"] } }), ForbiddenException);
  const opsOnly = { ...ok, activeRoles: ["OPS_ADMIN"], session: { ...session, roles: ["OPS_ADMIN"] } };
  await assert.rejects(read(opsOnly), ForbiddenException, "OPS_ADMIN never authorizes the MCP read path");
});


test("D7-10b: combined authority lookups exceeding the 1000ms budget fail closed", async () => {
  let elapsedMs = 0;
  const grant = {
    id: "g-budget", tenantId: "tenant-a", orgId: "org-a", userId: "u1", sessionId: "s1",
    oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
    scopeSet: ["projects:read"], status: "ACTIVE", anonymizedAt: null, policyVersion: "p1",
    expiresAt: new Date(now.getTime() + DAY),
  };
  const authority = {
    session: {
      userId: "u1", orgId: "org-a", tenantId: "tenant-a", roles: ["CLIENT"],
      refreshExpiresAt: new Date(now.getTime() + DAY),
    },
    userStatus: "active", activeRoles: ["CLIENT"],
  };
  const repo = { async findByBinding() { elapsedMs += 600; return grant; } };
  const authRepo = { async findActiveSessionAuthorization() { elapsedMs += 600; return authority; } };
  const svc = new McpConsentService(repo, authRepo, trust, () => now, () => elapsedMs);
  await assert.rejects(svc.authorizeRead(readInput), ServiceUnavailableException);
  assert.equal(elapsedMs, 1200);
});

test("D7-10c: shared budget permits two short authority lookups", async () => {
  let elapsedMs = 0;
  const grant = {
    id: "g-short", tenantId: "tenant-a", orgId: "org-a", userId: "u1", sessionId: "s1",
    oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
    scopeSet: ["projects:read"], status: "ACTIVE", anonymizedAt: null, policyVersion: "p1",
    expiresAt: new Date(now.getTime() + DAY),
  };
  const repo = { async findByBinding() { elapsedMs += 350; return grant; } };
  const authRepo = { async findActiveSessionAuthorization() {
    elapsedMs += 350;
    return {
      session: { userId: "u1", orgId: "org-a", tenantId: "tenant-a", roles: ["CLIENT"],
        refreshExpiresAt: new Date(now.getTime() + DAY) },
      userStatus: "active", activeRoles: ["CLIENT"],
    };
  } };
  const svc = new McpConsentService(repo, authRepo, trust, () => now, () => elapsedMs);
  const result = await svc.authorizeRead(readInput);
  assert.equal(result.grantId, "g-short");
  assert.equal(elapsedMs, 700);
});

test("D7-10: a hanging authority fails closed with 503", async () => {
  const service = serviceWith({ findByBinding: () => new Promise(() => {}) });
  await assert.rejects(service.authorizeRead(readInput), ServiceUnavailableException);
  const broken = serviceWith({ async findByBinding() { throw new Error("db down"); } });
  await assert.rejects(broken.authorizeRead(readInput), ServiceUnavailableException);
});

test("Q5: tenant revocation requires the permission and a known reason", async () => {
  const service = serviceWith({
    async revoke() { throw new Error("must not write without permission"); },
  });
  await assert.rejects(
    service.revokeAsTenantOps({ tenantId: "t", userId: "u", roles: ["CLIENT"] }, "g1", "ops_incident"),
    ForbiddenException,
  );
});

test("§5: malformed acceptance input is a 400 before touching the database", async () => {
  const service = serviceWith({
    async acceptInTransaction() { throw new Error("must not open a transaction"); },
  });
  await assert.rejects(service.accept({ sessionId: "s1" }), BadRequestException);
});

test("D7-10d: acceptance returns 503 on Prisma/PostgreSQL availability failures", async () => {
  const input = {
    sessionId: "s1", oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
    scopeSet: ["projects:read"], grantBindingDigest: "binding-digest-0001",
    policyVersion: "p1", consentVersion: "c1",
  };
  for (const code of ["P1001", "P1002", "P1008", "P1017", "P2024", "P2034"]) {
    const unavailable = new Prisma.PrismaClientKnownRequestError("Consent database unavailable", {
      code, clientVersion: "test",
    });
    const service = new McpConsentService(
      { async acceptInTransaction() { throw unavailable; } }, {}, trust, () => now,
    );
    await assert.rejects(service.accept(input), ServiceUnavailableException, code);
  }
  // A conflict is not an outage: keep the existing 409/idempotency resolution path.
  const unrelated = new Prisma.PrismaClientKnownRequestError("Invalid constraint", {
    code: "P2003", clientVersion: "test",
  });
  const bad = new McpConsentService(
    { async acceptInTransaction() { throw unrelated; } }, {}, trust, () => now,
  );
  await assert.rejects(bad.accept(input), (error) => error === unrelated);
});

test("D7-09: acceptance under a policy version that is not accepted is refused before the database", async () => {
  const service = serviceWith({
    async acceptInTransaction() { throw new Error("must not open a transaction"); },
  });
  await assert.rejects(
    service.accept({
      sessionId: "s1", oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
      scopeSet: ["projects:read"], grantBindingDigest: "binding-digest-0001", policyVersion: "p0-retired", consentVersion: "c1",
    }),
    ForbiddenException,
  );
});

test("D7-09b: a grant or session that expires during the authority lookups is denied", async () => {
  let clockNow = now;
  const grant = {
    id: "g-late", tenantId: "tenant-a", orgId: "org-a", userId: "u1", sessionId: "s1",
    oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
    scopeSet: ["projects:read"], status: "ACTIVE", anonymizedAt: null, policyVersion: "p1",
    expiresAt: new Date(now.getTime() + 100),
  };
  const session = {
    userId: "u1", orgId: "org-a", tenantId: "tenant-a", roles: ["CLIENT"],
    refreshExpiresAt: new Date(now.getTime() + DAY),
  };
  const read = (g, s) => new McpConsentService(
    { async findByBinding() { return g; } },
    { async findActiveSessionAuthorization() { clockNow = new Date(now.getTime() + 700); return { session: s, userStatus: "active", activeRoles: ["CLIENT"] }; } },
    trust, () => clockNow, () => 0,
  ).authorizeRead(readInput);

  await assert.rejects(read(grant, session), UnauthorizedException, "grant expired mid-lookup");
  clockNow = now;
  await assert.rejects(
    read({ ...grant, expiresAt: new Date(now.getTime() + DAY) }, { ...session, refreshExpiresAt: new Date(now.getTime() + 100) }),
    UnauthorizedException,
    "session expired mid-lookup",
  );
});

test("D7-02b: acceptance validates the session expiry with the clock sampled after the locks", async () => {
  let clockNow = now;
  let created = 0;
  const repository = {
    async acceptInTransaction(_sessionId, work) {
      clockNow = new Date(now.getTime() + 500); // waited on FOR SHARE past refreshExpiresAt
      return work({}, {
        session: {
          id: "s1", tenantId: "tenant-a", orgId: "org-a", userId: "u1", roles: ["CLIENT"],
          refreshExpiresAt: new Date(now.getTime() + 100), status: "ACTIVE", revokedAt: null,
        },
        userStatus: "active",
      });
    },
    async activeRolesInTx() { return ["CLIENT"]; },
    async createInTx() { created += 1; return {}; },
  };
  const service = new McpConsentService(repository, {}, trust, () => clockNow);
  await assert.rejects(
    service.accept({
      sessionId: "s1", oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
      scopeSet: ["projects:read"], grantBindingDigest: "binding-digest-0001", policyVersion: "p1", consentVersion: "c1",
    }),
    UnauthorizedException,
  );
  assert.equal(created, 0);
});

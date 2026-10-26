import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import prismaClientPackage from "../../../node_modules/.prisma/client/index.js";
import { AuthRepository } from "../dist/modules/auth/auth.repository.js";
import { ProjectsRepository } from "../dist/modules/projects/projects.repository.js";
import { McpConsentRepository } from "../dist/modules/mcp-consent/mcp-consent.repository.js";
import { McpConsentService } from "../dist/modules/mcp-consent/mcp-consent.service.js";

/**
 * S1/D7 fase B contra PostgreSQL efímero real: tabla McpDelegatedConsent,
 * AuthSession/User/Membership/Project reales. Sin OAuth AS, sin ruta MCP y sin
 * flag: el servicio se instancia a mano. Casos D7-xx de
 * docs/specs/platform/semse-mcp-delegated-consent.spec.md §9.
 */
const { PrismaClient } = prismaClientPackage;
const DAY = 24 * 60 * 60 * 1000;

function requireIsolatedCiPostgres() {
  if (process.env.CI !== "true" || process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_ID) {
    throw new Error("MCP D7 DB fixture can run only on disposable CI");
  }
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5433" || url.pathname !== "/semse") {
    throw new Error("MCP D7 DB fixture requires local PostgreSQL semse:5433");
  }
}

test("MCP D7 phase B — persisted delegated consent against real ephemeral Postgres", async () => {
  requireIsolatedCiPostgres();
  const prefix = "mcp_d7_" + randomUUID().replaceAll("-", "").slice(0, 12);
  const id = (suffix) => prefix + "_" + suffix;
  const db = new PrismaClient();
  let disallowWrites = false;
  const writeCalls = [];
  const reads = new Set(["findFirst", "findUnique", "findMany", "count", "aggregate", "groupBy", "$queryRaw"]);
  const guarded = db.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (disallowWrites && !reads.has(operation)) {
            writeCalls.push(model + "." + operation);
            throw new Error("MCP D7 read attempted DB write");
          }
          return query(args);
        },
      },
    },
  });

  let clockNow = new Date();
  const clock = () => clockNow;
  const trust = {
    oauthIssuer: "https://auth.example.invalid/",
    resourceUri: "https://mcp.example.invalid/semse",
    allowedClientIds: ["client-ok", "client-two"],
  };
  const authRepository = new AuthRepository(guarded);
  const consentRepository = new McpConsentRepository(guarded);
  const service = new McpConsentService(consentRepository, authRepository, trust, clock);
  const projects = new ProjectsRepository(guarded, {
    async ensureActorContext() { throw new Error("bootstrap must never run on S1"); },
  });

  const tenantA = id("tenant_a"), tenantB = id("tenant_b");
  const orgA = id("org_a"), orgB = id("org_b"), orgC = id("org_c"), proA = id("pro_a"), proB = id("pro_b"), proC = id("pro_c");
  const user = { client: id("u_client"), ops: id("u_ops"), mixed: id("u_mixed"), other: id("u_other"), opsB: id("u_ops_b") };
  const sid = { client: id("s_client"), ops: id("s_ops"), mixed: id("s_mixed"), other: id("s_other"), opsB: id("s_ops_b") };
  const jobs = { a: id("job_a"), b: id("job_b"), c: id("job_c") };
  const project = { a: id("project_a"), b: id("project_b"), c: id("project_c") };
  const createdRoles = [];
  const roleIds = {};

  const acceptInput = (sessionId, extra = {}) => {
    const grantBindingDigest = "binding-" + randomUUID();
    return {
      sessionId,
      oauthIssuer: trust.oauthIssuer,
      oauthClientId: "client-ok",
      resourceUri: trust.resourceUri,
      scopeSet: ["projects:read"],
      grantBindingDigest,
      policyVersion: "p1",
      consentVersion: "c1",
      ...extra,
    };
  };
  const readInput = (tenantId, grantBindingDigest, extra = {}) => ({
    tenantId,
    grantBindingDigest,
    oauthIssuer: trust.oauthIssuer,
    oauthClientId: "client-ok",
    resourceUri: trust.resourceUri,
    scope: "projects:read",
    ...extra,
  });
  const readProject = async (ctx, projectId) =>
    projects.findByIdWithoutProvisioning({ ...ctx, projectId });

  try {
    await db.$connect();
    for (const key of ["CLIENT", "OPS_ADMIN", "PRO", "WORKER"]) {
      let role = await db.role.findUnique({ where: { key } });
      if (!role) {
        role = await db.role.create({ data: { key, name: key } });
        createdRoles.push(role.id);
      }
      roleIds[key] = role.id;
    }
    for (const tenant of [tenantA, tenantB]) {
      await db.tenant.create({ data: { id: tenant, slug: tenant, name: "Synthetic MCP D7 tenant" } });
    }
    for (const [org, tenant, type] of [
      [orgA, tenantA, "client"], [orgB, tenantA, "client"], [orgC, tenantB, "client"],
      [proA, tenantA, "pro"], [proB, tenantA, "pro"], [proC, tenantB, "pro"],
    ]) {
      await db.org.create({ data: { id: org, tenantId: tenant, name: "Synthetic MCP D7 org", type } });
    }
    const memberships = [
      [user.client, orgA, ["CLIENT"]],
      [user.ops, orgA, ["CLIENT", "OPS_ADMIN"]],
      [user.mixed, proA, ["PRO", "WORKER"]],
      [user.other, orgB, ["CLIENT"]],
      [user.opsB, orgC, ["OPS_ADMIN"]],
    ];
    for (const [u, org, roles] of memberships) {
      await db.user.create({ data: { id: u, email: u + "@example.invalid", status: "active" } });
      for (const role of roles) {
        await db.membership.create({ data: { userId: u, orgId: org, roleId: roleIds[role], status: "ACTIVE" } });
      }
    }
    const base = Date.now();
    for (const [s, u, tenant, org, roles] of [
      [sid.client, user.client, tenantA, orgA, ["CLIENT"]],
      [sid.ops, user.ops, tenantA, orgA, ["CLIENT", "OPS_ADMIN"]],
      [sid.mixed, user.mixed, tenantA, proA, ["PRO", "WORKER"]],
      [sid.other, user.other, tenantA, orgB, ["CLIENT"]],
      [sid.opsB, user.opsB, tenantB, orgC, ["OPS_ADMIN"]],
    ]) {
      await db.authSession.create({ data: {
        id: s, userId: u, tenantId: tenant, orgId: org, roles, refreshTokenHash: randomUUID(),
        accessExpiresAt: new Date(base + 60_000), refreshExpiresAt: new Date(base + 60 * DAY), status: "ACTIVE",
      } });
    }
    for (const [job, tenant, client, proj, pro] of [
      [jobs.a, tenantA, orgA, project.a, proA],
      [jobs.b, tenantA, orgB, project.b, proB],
      [jobs.c, tenantB, orgC, project.c, proC],
    ]) {
      await db.job.create({ data: { id: job, tenantId: tenant, clientOrgId: client, title: "Synthetic D7", scope: "CI" } });
      await db.project.create({ data: { id: proj, tenantId: tenant, jobId: job, assignedProOrgId: pro } });
    }

    // D7-01: one ACTIVE grant with exact actor/org/resource; 30-day cap applies.
    clockNow = new Date();
    const inputA = acceptInput(sid.client, { idempotencyKey: "idem-key-0001" });
    const grantA = await service.accept(inputA);
    assert.equal(grantA.status, "ACTIVE");
    assert.equal(grantA.tenantId, tenantA);
    assert.equal(grantA.orgId, orgA);
    assert.equal(grantA.userId, user.client);
    assert.equal(grantA.sessionId, sid.client);
    assert.equal(grantA.expiresAt.getTime(), clockNow.getTime() + 30 * DAY, "D7-22: 30-day cap below 60-day refresh");

    // D7-02: parallel acceptance with same key and payload returns the same grant.
    const inputPar = acceptInput(sid.client, { idempotencyKey: "idem-key-0002" });
    const [p1, p2] = await Promise.all([service.accept(inputPar), service.accept(inputPar)]);
    assert.equal(p1.id, p2.id);
    assert.equal(await db.mcpDelegatedConsent.count({ where: { grantBindingDigest: inputPar.grantBindingDigest } }), 1);

    // D7-03: same key with a different payload is a 409 and leaves the grant untouched.
    await assert.rejects(
      service.accept({ ...inputPar, oauthClientId: "client-two", grantBindingDigest: "binding-" + randomUUID() }),
      ConflictException,
    );
    // Same binding digest without idempotency key is also a conflict, never a second grant.
    await assert.rejects(service.accept({ ...acceptInput(sid.client), grantBindingDigest: inputA.grantBindingDigest }), ConflictException);

    // D7-22: requested expiry is honored; over-cap or past is a 400.
    const short = await service.accept(acceptInput(sid.client, { requestedExpiresAt: new Date(clockNow.getTime() + DAY) }));
    assert.equal(short.expiresAt.getTime(), clockNow.getTime() + DAY);
    await assert.rejects(
      service.accept(acceptInput(sid.client, { requestedExpiresAt: new Date(clockNow.getTime() + 31 * DAY) })),
      BadRequestException,
    );

    // D7-17 at acceptance: PRO+WORKER may consent; WORKER-only may not.
    const mixedInput = acceptInput(sid.mixed);
    const mixedGrant = await service.accept(mixedInput);
    assert.equal(mixedGrant.orgId, proA);

    // D7-13: verification and project reads are SELECT-only.
    disallowWrites = true;
    const counts = () => Promise.all([
      db.tenant.count(), db.org.count(), db.user.count(), db.membership.count(),
      db.job.count(), db.project.count(), db.mcpDelegatedConsent.count(),
    ]);
    const before = await counts();
    const ctxA = await service.authorizeRead(readInput(tenantA, inputA.grantBindingDigest));
    assert.deepEqual(ctxA, { grantId: grantA.id, tenantId: tenantA, orgId: orgA, userId: user.client, roles: ["CLIENT"] });
    assert.equal((await readProject(ctxA, project.a)).id, project.a);
    // D7-05: grant of Org A cannot read Org B's project in the same tenant.
    await assert.rejects(readProject(ctxA, project.b), ForbiddenException);
    // D7-06: other tenant's project is a 404 (no existence leak).
    await assert.rejects(readProject(ctxA, project.c), NotFoundException);
    // D7-11: wrong tenant for the binding finds nothing.
    await assert.rejects(service.authorizeRead(readInput(tenantB, inputA.grantBindingDigest)), UnauthorizedException);
    assert.deepEqual(await counts(), before, "D7-13: counts unchanged during reads");
    assert.deepEqual(writeCalls, []);
    disallowWrites = false;

    // D7-05b: a grant consented by a CLIENT+OPS_ADMIN user never inherits the ops override.
    const opsInput = acceptInput(sid.ops);
    await service.accept(opsInput);
    const ctxOps = await service.authorizeRead(readInput(tenantA, opsInput.grantBindingDigest));
    assert.deepEqual(ctxOps.roles, ["CLIENT"]);
    assert.equal((await readProject(ctxOps, project.a)).id, project.a);
    await assert.rejects(readProject(ctxOps, project.b), ForbiddenException, "OPS_ADMIN override must not apply via MCP");

    // D7-17 at read: revoking the PRO membership row leaves WORKER, which has no projects:read.
    const mixedCtx = await service.authorizeRead(readInput(tenantA, mixedInput.grantBindingDigest));
    assert.deepEqual(mixedCtx.roles.sort(), ["PRO", "WORKER"]);
    await db.membership.update({
      where: { userId_orgId_roleId: { userId: user.mixed, orgId: proA, roleId: roleIds.PRO } },
      data: { status: "REVOKED" },
    });
    await assert.rejects(
      service.authorizeRead(readInput(tenantA, mixedInput.grantBindingDigest)),
      ForbiddenException,
    );

    // D7-07: revoking the grant blocks the next call; second revocation is idempotent.
    const revoked = await service.revokeOwn({ tenantId: tenantA, userId: user.client }, grantA.id);
    assert.equal(revoked.status, "REVOKED");
    assert.equal(revoked.revocationReasonCode, "user_requested");
    await assert.rejects(service.authorizeRead(readInput(tenantA, inputA.grantBindingDigest)), UnauthorizedException);
    const again = await service.revokeOwn({ tenantId: tenantA, userId: user.client }, grantA.id);
    assert.equal(again.revokedAt.getTime(), revoked.revokedAt.getTime());
    // Another user cannot see or revoke it.
    await assert.rejects(service.revokeOwn({ tenantId: tenantA, userId: user.other }, grantA.id), NotFoundException);

    // D7-08: revoking the AuthSession blocks a still-ACTIVE grant.
    const otherInput = acceptInput(sid.other);
    const otherGrant = await service.accept(otherInput);
    await db.authSession.update({ where: { id: sid.other }, data: { status: "REVOKED", revokedAt: new Date() } });
    await assert.rejects(service.authorizeRead(readInput(tenantA, otherInput.grantBindingDigest)), UnauthorizedException);
    assert.equal((await db.mcpDelegatedConsent.findUnique({ where: { id: otherGrant.id } })).status, "ACTIVE");

    // D7-19 (v1): OPS_ADMIN revokes inside its tenant only, one at a time, with a reason.
    const opsActorB = { tenantId: tenantB, userId: user.opsB, roles: ["OPS_ADMIN"] };
    await assert.rejects(service.revokeAsTenantOps(opsActorB, otherGrant.id, "ops_incident"), NotFoundException);
    const opsActorA = { tenantId: tenantA, userId: user.ops, roles: ["OPS_ADMIN"] };
    const byOps = await service.revokeAsTenantOps(opsActorA, otherGrant.id, "ops_incident");
    assert.equal(byOps.status, "REVOKED");
    assert.equal(byOps.revokedByUserId, user.ops);
    assert.equal(byOps.revocationReasonCode, "ops_incident");
    assert.equal(typeof service.revokeAllForClient, "undefined", "bulk revocation is v1.1, not v1");

    // D7-09: an ACTIVE grant past expiresAt is denied without writing.
    clockNow = new Date(Date.now() + 2 * DAY);
    disallowWrites = true;
    await assert.rejects(service.authorizeRead(readInput(tenantA, short.grantBindingDigest)), UnauthorizedException);
    disallowWrites = false;
    assert.equal((await db.mcpDelegatedConsent.findUnique({ where: { id: short.id } })).status, "ACTIVE");

    // D7-23: acceptance waits for a concurrent subject-deletion step 1 and then fails closed.
    clockNow = new Date();
    let release;
    let locked;
    const lockedPromise = new Promise((resolve) => { locked = resolve; });
    const deletion = db.$transaction(async (tx) => {
      await tx.authSession.update({ where: { id: sid.client }, data: { status: "REVOKED", revokedAt: new Date() } });
      await tx.user.update({ where: { id: user.client }, data: { status: "deleted" } });
      locked();
      await new Promise((resolve) => { release = resolve; });
    }, { timeout: 15_000 });
    await lockedPromise;
    let settled = false;
    const racing = service.accept(acceptInput(sid.client)).finally(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(settled, false, "acceptance must block on FOR SHARE while deletion holds the rows");
    release();
    await deletion;
    await assert.rejects(racing, UnauthorizedException);

    // D7-21 / D7-24: anonymization by terminal moment, independent of the stored status.
    const stale = await db.mcpDelegatedConsent.create({ data: {
      tenantId: tenantA, orgId: orgA, userId: user.client, sessionId: sid.client,
      oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
      scopeSet: ["projects:read"], grantBindingDigest: "binding-" + randomUUID(), status: "ACTIVE",
      authorizedAt: new Date("2026-01-01T10:11:12Z"), expiresAt: new Date("2026-01-31T10:11:12Z"),
      policyVersion: "p1", consentVersion: "c1", idempotencyKeyDigest: "digest-" + randomUUID(),
    } });
    const recentRevoked = await db.mcpDelegatedConsent.create({ data: {
      tenantId: tenantA, orgId: orgA, userId: user.client, sessionId: sid.client,
      oauthIssuer: trust.oauthIssuer, oauthClientId: "client-ok", resourceUri: trust.resourceUri,
      scopeSet: ["projects:read"], grantBindingDigest: "binding-" + randomUUID(), status: "REVOKED",
      authorizedAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date("2026-01-31T00:00:00Z"),
      revokedAt: new Date("2026-10-20T00:00:00Z"), revokedByUserId: user.client, revocationReasonCode: "user_requested",
      policyVersion: "p1", consentVersion: "c1",
    } });
    clockNow = new Date("2026-10-26T12:00:00Z");
    const anonymized = await service.anonymizeDue(1000);
    assert.ok(anonymized >= 1);
    const after = await db.mcpDelegatedConsent.findUnique({ where: { id: stale.id } });
    assert.equal(after.status, "EXPIRED", "D7-24: ACTIVE past retention is expired in the same write");
    for (const field of ["userId", "sessionId", "grantBindingDigest", "idempotencyKeyDigest", "revokedByUserId"]) {
      assert.equal(after[field], null, field + " must be removed");
    }
    assert.equal(after.expiresAt.toISOString(), "2026-01-31T00:00:00.000Z", "dates truncated to the day");
    assert.equal(after.authorizedAt.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(after.orgId, orgA);
    assert.ok(after.anonymizedAt);
    const notYet = await db.mcpDelegatedConsent.findUnique({ where: { id: recentRevoked.id } });
    assert.equal(notYet.anonymizedAt, null, "revoked 6 days ago: inside the 90-day window by revokedAt");
    assert.equal(notYet.userId, user.client);

    console.log("PASS: MCP D7 phase B — accept/idempotency/expiry, read-only verification, org bound without OPS override, revocation, FOR SHARE vs deletion, retention anonymization (real Postgres).");
  } finally {
    disallowWrites = false;
    try {
      await db.mcpDelegatedConsent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await db.authSession.deleteMany({ where: { id: { in: Object.values(sid) } } });
      await db.project.deleteMany({ where: { id: { in: Object.values(project) } } });
      await db.job.deleteMany({ where: { id: { in: Object.values(jobs) } } });
      await db.membership.deleteMany({ where: { userId: { in: Object.values(user) } } });
      await db.user.deleteMany({ where: { id: { in: Object.values(user) } } });
      await db.org.deleteMany({ where: { id: { in: [orgA, orgB, orgC, proA, proB, proC] } } });
      await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      if (createdRoles.length) await db.role.deleteMany({ where: { id: { in: createdRoles } } });
    } finally {
      await db.$disconnect();
    }
  }
});

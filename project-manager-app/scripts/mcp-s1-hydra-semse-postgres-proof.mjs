/**
 * CI-LAB ONLY. Hydra real introspection -> real SEMSE Postgres membership,
 * AuthSession and Project read. Login + consent binding stays synthetic.
 * Not a NestJS guard, OAuth Resource Server or production implementation.
 */
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import prismaPackage from "../node_modules/.prisma/client/index.js";
import { AuthRepository } from "../apps/api/dist/modules/auth/auth.repository.js";
import { ProjectsRepository } from "../apps/api/dist/modules/projects/projects.repository.js";
import { ProjectsService } from "../apps/api/dist/modules/projects/projects.service.js";
import { projectStatusMcpProjection } from "../apps/api/dist/modules/projects/mcp-project-status.boundary.js";
import { hasPermission } from "../apps/api/dist/common/rbac.js";

const { PrismaClient } = prismaPackage;

function requireEphemeralCi() {
  assert.equal(process.env.CI, "true", "CI-only fixture");
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.equal(Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_ID), false);
  const url = new URL(process.env.DATABASE_URL ?? "http://not-postgres.invalid");
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.port, "5433");
  assert.equal(url.pathname, "/semse");
}

export async function testHydraTokenAgainstRealSemseDatabase({
  token, otherSessionToken, otherSessionId, introspect, consent, userId, sessionId, orgId, tenantId,
  expectedIssuer, expectedClient, expectedAudience
}) {
  requireEphemeralCi();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const id = key => "mcp_poc_" + suffix + "_" + key;
  const otherOrg = id("other_org"), otherPro = id("other_pro");
  const foreignTenant = id("foreign_tenant"), foreignOrg = id("foreign_org"), foreignPro = id("foreign_pro");
  const ownPro = id("own_pro");
  const ownJob = id("own_job"), otherJob = id("other_job"), foreignJob = id("foreign_job");
  const ownProject = id("own_project"), otherProject = id("other_project"), foreignProject = id("foreign_project");
  const roleKey = "CLIENT";
  const db = new PrismaClient();
  const writes = [];
  let enforceReadOnly = false;
  const allowedOperations = new Set(["findFirst", "findUnique", "findMany", "count", "aggregate", "groupBy"]);
  const guardedDb = db.$extends({
    query: { $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (enforceReadOnly && !allowedOperations.has(operation)) {
          writes.push(model + "." + operation);
          throw new Error("Unexpected database write during OAuth-linked status read");
        }
        return query(args);
      }
    } }
  });
  const authRepo = new AuthRepository(guardedDb);
  const projectsRepo = new ProjectsRepository(guardedDb, {
    async ensureActorContext() { throw new Error("Identity provisioning attempted by OAuth-linked read"); }
  });
  const projectsService = new ProjectsService(projectsRepo, {}, {}, {});
  let checks = 0;
  const check = (value, label) => { assert.ok(value, label); checks++; };
  let createdRoleId = null;

  // Future production bridge needs a durable D7 consent; this Map binding is
  // intentionally created only by synthetic login/consent inside Hydra lab.
  async function guardedStatus(projectId, options = {}) {
    const parsed = await introspect(options.token ?? token);
    if (parsed?.active !== true || parsed.iss !== expectedIssuer ||
        parsed.client_id !== expectedClient || parsed.sub !== userId ||
        !(Array.isArray(parsed.aud) ? parsed.aud : [parsed.aud]).includes(expectedAudience) ||
        !String(parsed.scope ?? "").split(/\s+/).includes("projects:read")) {
      throw new Error("OAuth resource token rejected");
    }
    // The session must be vouched for by Hydra's introspected access-token
    // claims, not merely passed alongside that token by the invoking caller.
    // Hydra publishes consent session.access_token attributes under "ext".
    // A missing/foreign binding fails closed before any session/Project read.
    if (typeof parsed.ext?.synthetic_session_binding !== "string" ||
        parsed.ext.synthetic_session_binding !== sessionId) {
      throw new Error("OAuth token session binding rejected");
    }
    if (!consent?.active || consent.user !== userId || consent.sessionId !== sessionId ||
        consent.org !== orgId || consent.clientId !== expectedClient ||
        consent.audience !== expectedAudience || !consent.scope.includes("projects:read")) {
      throw new Error("Synthetic delegated consent rejected");
    }
    // Reads actual AuthSession, User and Membership rows on EVERY invocation.
    const snapshot = await authRepo.findActiveSessionAuthorization(sessionId);
    if (!snapshot || snapshot.userStatus !== "active" ||
        snapshot.session.userId !== userId || snapshot.session.orgId !== orgId ||
        snapshot.session.tenantId !== tenantId ||
        snapshot.session.accessExpiresAt.getTime() <= Date.now() ||
        snapshot.session.refreshExpiresAt.getTime() <= Date.now()) {
      throw new Error("SEMSE session rejected");
    }
    const activeRoles = snapshot.activeRoles.filter(role => snapshot.session.roles.includes(role));
    if (activeRoles.length === 0 || !hasPermission(activeRoles, "projects:read")) {
      throw new Error("SEMSE membership or projects:read rejected");
    }
    // Derive the complete actor exclusively from trusted server-side rows.
    const result = await projectsService.statusForVerifiedActor({
      userId: snapshot.session.userId, orgId: snapshot.session.orgId,
      tenantId: snapshot.session.tenantId, roles: activeRoles, projectId
    });
    return projectStatusMcpProjection(result, "poc_" + suffix);
  }
  try {
    await db.$connect();
    const storedRole = await db.role.findUnique({ where: { key: roleKey } });
    if (!storedRole) {
      const insertedRole = await db.role.create({ data: { key: roleKey, name: roleKey } });
      createdRoleId = insertedRole.id;
    }
    const roleId = storedRole?.id ?? createdRoleId;
    for (const tenant of [tenantId, foreignTenant]) {
      await db.tenant.create({ data: { id: tenant, slug: tenant, name: "MCP CI synthetic" } });
    }
    for (const [org, tenant, type] of [
      [orgId, tenantId, "client"], [ownPro, tenantId, "pro"],
      [otherOrg, tenantId, "client"], [otherPro, tenantId, "pro"],
      [foreignOrg, foreignTenant, "client"], [foreignPro, foreignTenant, "pro"]
    ]) {
      await db.org.create({ data: { id: org, tenantId: tenant, type, name: "MCP CI synthetic" } });
    }
    await db.user.create({ data: { id: userId, email: id("user") + "@example.invalid", status: "active" } });
    await db.membership.create({ data: { userId, orgId, roleId, status: "ACTIVE" } });
    await db.authSession.create({ data: {
      id: sessionId, tenantId, orgId, userId, roles: [roleKey],
      refreshTokenHash: randomUUID(), accessExpiresAt: new Date(Date.now() + 120000),
      refreshExpiresAt: new Date(Date.now() + 300000), status: "ACTIVE"
    } });
    for (const [job, tenant, client, project, pro] of [
      [ownJob, tenantId, orgId, ownProject, ownPro],
      [otherJob, tenantId, otherOrg, otherProject, otherPro],
      [foreignJob, foreignTenant, foreignOrg, foreignProject, foreignPro]
    ]) {
      await db.job.create({ data: { id: job, tenantId: tenant, clientOrgId: client,
        title: "MCP lab synthetic", scope: "Read-only CI verification" } });
      await db.project.create({ data: { id: project, tenantId: tenant,
        jobId: job, assignedProOrgId: pro } });
    }

    enforceReadOnly = true;
    const countsBefore = await Promise.all([
      db.tenant.count(), db.org.count(), db.user.count(), db.job.count(),
      db.project.count(), db.membership.count(), db.authSession.count()
    ]);
    const valid = await guardedStatus(ownProject);
    check(valid.projectId === ownProject && valid.status === "open", "own Project read should work");
    check(Object.keys(valid).sort().join(",") === "correlationId,projectId,status", "D5 allowlist only");
    // Fail if tenant filtering regresses: a cross-tenant ID must look missing,
    // not merely fail the independent same-tenant organization ownership guard.
    await assert.rejects(guardedStatus(otherProject), ForbiddenException); checks++;
    await assert.rejects(guardedStatus(foreignProject), NotFoundException); checks++;
    await assert.rejects(guardedStatus(ownProject, { token: "invalid.invalid" })); checks++;

    // Both tokens come from REAL Hydra, with identical principal/client/scope/
    // audience but different consent-time session bindings. Token B must never
    // borrow a valid AuthSession selected for token A.
    check(typeof otherSessionToken === "string" && otherSessionToken !== token &&
      typeof otherSessionId === "string" && otherSessionId !== sessionId,
      "Missing distinct-session Hydra token for regression");
    const otherProbe = await introspect(otherSessionToken);
    check(otherProbe.active === true && otherProbe.sub === userId &&
      otherProbe.iss === expectedIssuer && otherProbe.client_id === expectedClient &&
      (Array.isArray(otherProbe.aud) ? otherProbe.aud : [otherProbe.aud]).includes(expectedAudience) &&
      String(otherProbe.scope ?? "").split(/\s+/).includes("projects:read"),
      "Second token must share principal, client, audience and scope");
    check(otherProbe.ext?.synthetic_session_binding === otherSessionId,
      "Second Hydra token did not carry its distinct session binding");
    await assert.rejects(guardedStatus(ownProject, { token: otherSessionToken }),
      /OAuth token session binding rejected/); checks++;
    check(writes.length === 0, "No database write attempted during reads");
    const countsAfter = await Promise.all([
      db.tenant.count(), db.org.count(), db.user.count(), db.job.count(),
      db.project.count(), db.membership.count(), db.authSession.count()
    ]);
    check(JSON.stringify(countsBefore) === JSON.stringify(countsAfter), "Row counts stable");

    // Operator-controlled state changes, never writes from delegated read.
    enforceReadOnly = false;
    await db.membership.update({
      where: { userId_orgId_roleId: { userId, orgId, roleId } },
      data: { status: "SUSPENDED" }
    });
    enforceReadOnly = true;
    await assert.rejects(guardedStatus(ownProject)); checks++;
    enforceReadOnly = false;
    await db.membership.update({
      where: { userId_orgId_roleId: { userId, orgId, roleId } },
      data: { status: "ACTIVE" }
    });
    enforceReadOnly = true;
    check((await guardedStatus(ownProject)).projectId === ownProject, "Restored membership read");
    consent.active = false;
    await assert.rejects(guardedStatus(ownProject)); checks++;
    consent.active = true;
    enforceReadOnly = false;
    await db.authSession.update({ where: { id: sessionId }, data: {
      status: "REVOKED", revokedAt: new Date()
    } });
    enforceReadOnly = true;
    await assert.rejects(guardedStatus(ownProject)); checks++;
    check(writes.length === 0, "All delegated reads remained read-only");
    console.log("PASS: Hydra OAuth token introspection + actual SEMSE Postgres AuthSession/Membership/Project isolation/revocation/no writes (" + checks + " linked checks).");
    console.log("LIMIT: OAuth-to-SEMSE consent binding is in-memory synthetic; no MCP HTTP host, durable grant or production guard.");
  } finally {
    enforceReadOnly = false;
    try {
      await db.authSession.deleteMany({ where: { id: sessionId } });
      await db.project.deleteMany({ where: { id: { in: [ownProject, otherProject, foreignProject] } } });
      await db.job.deleteMany({ where: { id: { in: [ownJob, otherJob, foreignJob] } } });
      await db.membership.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.org.deleteMany({ where: { id: { in: [orgId, ownPro, otherOrg, otherPro, foreignOrg, foreignPro] } } });
      await db.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenant] } } });
      if (createdRoleId) await db.role.delete({ where: { id: createdRoleId } });
    } finally {
      await db.$disconnect();
    }
  }
}

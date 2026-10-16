import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import prismaClientPackage from "../../../node_modules/.prisma/client/index.js";
import { AuthRepository } from "../dist/modules/auth/auth.repository.js";
import { AuthService } from "../dist/modules/auth/auth.service.js";
import { ProjectsRepository } from "../dist/modules/projects/projects.repository.js";
import { ProjectsService } from "../dist/modules/projects/projects.service.js";
import { signToken } from "../dist/common/auth-token.js";
import { hasPermission } from "../dist/common/rbac.js";

/**
 * DB-backed prerequisite for MCP S1. This exercises REAL SEMSE AuthSession,
 * User, Membership, Project/Job Prisma records in an ephemeral CI PostgreSQL.
 * OAuth AS, token introspection and MCP HTTP transport are NOT wired here.
 *
 * The normal REST path and all production settings are unchanged.
 * A new MCP endpoint must not be added until D2 is approved.
 */
const { PrismaClient } = prismaClientPackage;

function requireIsolatedCiPostgres() {
  if (process.env.CI !== "true" || process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_ID) {
    throw new Error("MCP S1 DB fixture can run only on disposable CI");
  }
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.port !== "5433" || url.pathname !== "/semse") {
    throw new Error("MCP S1 DB fixture requires local PostgreSQL semse:5433");
  }
}

test("MCP S1 P0 — current SEMSE session, membership, tenant and Project policy in real ephemeral Postgres", async () => {
  requireIsolatedCiPostgres();
  const prefix = "mcp_s1_" + randomUUID().replaceAll("-", "").slice(0, 16);
  const id = (suffix) => prefix + "_" + suffix;
  const db = new PrismaClient();
  let disallowWrites = false;
  const writeCalls = [];
  const allowedReads = new Set(["findFirst", "findUnique", "findMany", "count", "aggregate", "groupBy"]);
  const readOnlyClient = db.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (disallowWrites && !allowedReads.has(operation)) {
            writeCalls.push(model + "." + operation);
            throw new Error("MCP S1 read attempted DB write");
          }
          return query(args);
        }
      }
    }
  });
  const tenantA = id("tenant_a"), tenantB = id("tenant_b");
  const clientA = id("client_a"), clientB = id("client_b"), clientC = id("client_c");
  const proA = id("pro_a"), proB = id("pro_b"), proC = id("pro_c");
  const userA = id("user_a"), userB = id("user_b"), userC = id("user_c");
  const sidA = id("sid_a"), sidB = id("sid_b"), sidC = id("sid_c");
  const jobA = id("job_a"), jobB = id("job_b"), jobC = id("job_c");
  const projectA = id("project_a"), projectB = id("project_b"), projectC = id("project_c");
  const secret = "ephemeral-mcp-s1-test-signing-secret-" + randomUUID();
  const oldSecret = process.env.AUTH_SECRET;
  const role = "CLIENT";
  let newRoleId = null;

  const token = (userId, tenantId, orgId, sid) => signToken({
    userId, tenantId, orgId, roles: ["CLIENT", "OPS_ADMIN"],
    sid, typ: "access"
  }, secret, 120);
  const auth = new AuthService(
    new AuthRepository(readOnlyClient),
    { async append() { throw new Error("read must not audit-write"); } },
    {}, {}
  );
  const repository = new ProjectsRepository(readOnlyClient, {
    async ensureActorContext() { throw new Error("bootstrap must never run on S1"); }
  });
  const service = new ProjectsService(repository, {}, {}, {});

  async function readProject(bearer, target, forgedHeaders = {}) {
    const ctx = await auth.authenticateRequest({
      headers: { authorization: "Bearer " + bearer, ...forgedHeaders }
    });
    assert.ok(hasPermission(ctx.roles, "projects:read"), "SEMSE RBAC permission is mandatory");
    return service.statusForVerifiedActor({ ...ctx, projectId: target });
  }

  const bearerA = token(userA, tenantA, clientA, sidA);
  const bearerB = token(userB, tenantA, clientB, sidB);
  const bearerC = token(userC, tenantB, clientC, sidC);

  try {
    await db.$connect();
    const roleRecord = await db.role.findUnique({ where: { key: role } });
    if (!roleRecord) {
      const newRole = await db.role.create({ data: { key: role, name: role } });
      newRoleId = newRole.id;
    }
    const roleId = roleRecord?.id ?? newRoleId;
    for (const tenant of [tenantA, tenantB]) {
      await db.tenant.create({ data: { id: tenant, slug: tenant, name: "Synthetic MCP tenant" } });
    }
    for (const [org, tenant, type] of [
      [clientA, tenantA, "client"], [clientB, tenantA, "client"],
      [clientC, tenantB, "client"], [proA, tenantA, "pro"],
      [proB, tenantA, "pro"], [proC, tenantB, "pro"]
    ]) {
      await db.org.create({ data: { id: org, tenantId: tenant, name: "Synthetic MCP org", type } });
    }
    for (const [user, org] of [[userA, clientA], [userB, clientB], [userC, clientC]]) {
      await db.user.create({ data: {
        id: user, email: user + "@example.invalid", status: "active"
      } });
      await db.membership.create({ data: { userId: user, orgId: org, roleId, status: "ACTIVE" } });
    }
    const now = Date.now();
    for (const [sid, user, tenant, org] of [
      [sidA, userA, tenantA, clientA],
      [sidB, userB, tenantA, clientB],
      [sidC, userC, tenantB, clientC]
    ]) {
      await db.authSession.create({ data: {
        id: sid, userId: user, tenantId: tenant, orgId: org,
        roles: ["CLIENT"], refreshTokenHash: randomUUID(),
        accessExpiresAt: new Date(now + 120_000),
        refreshExpiresAt: new Date(now + 300_000),
        status: "ACTIVE"
      } });
    }
    for (const [job, tenant, client, project, pro] of [
      [jobA, tenantA, clientA, projectA, proA],
      [jobB, tenantA, clientB, projectB, proB],
      [jobC, tenantB, clientC, projectC, proC],
    ]) {
      await db.job.create({ data: { id: job, tenantId: tenant, clientOrgId: client,
        title: "Synthetic MCP Project", scope: "Synthetic CI read security" } });
      await db.project.create({ data: { id: project, tenantId: tenant,
        jobId: job, assignedProOrgId: pro } });
    }

    // The only operations permitted in this phase are Prisma SELECTs.
    disallowWrites = true;
    const beforeCounts = await Promise.all([
      db.tenant.count(), db.org.count(), db.user.count(),
      db.job.count(), db.project.count(), db.membership.count()
    ]);
    process.env.AUTH_SECRET = secret;

    const valid = await readProject(bearerA, projectA, {
      "x-tenant-id": tenantB, "x-org-id": clientB, "x-roles": "OPS_ADMIN"
    });
    assert.deepEqual(valid, { projectId: projectA, status: "open" });
    await assert.rejects(readProject(bearerA, projectB), ForbiddenException);
    await assert.rejects(readProject(bearerA, projectC), NotFoundException);
    assert.deepEqual(await readProject(bearerB, projectB), { projectId: projectB, status: "open" });
    await assert.rejects(readProject(bearerC, projectA), NotFoundException);
    const resolved = await auth.authenticateRequest({ headers: {
      authorization: "Bearer " + bearerA, "x-roles": "OPS_ADMIN" } });
    assert.deepEqual(resolved.roles, ["CLIENT"], "persisted membership must narrow forged signed token roles");
    assert.equal(resolved.tenantId, tenantA);
    assert.equal(resolved.orgId, clientA);
    assert.ok(!writeCalls.length, "zero writes allowed during S1 status reads");
    const afterCounts = await Promise.all([
      db.tenant.count(), db.org.count(), db.user.count(),
      db.job.count(), db.project.count(), db.membership.count()
    ]);
    assert.deepEqual(afterCounts, beforeCounts, "all entity counts unchanged during reads");

    // Operator changes below are setup mutations, NEVER calls from the read path.
    disallowWrites = false;
    await db.membership.update({ where: {
      userId_orgId_roleId: { userId: userA, orgId: clientA, roleId }
    }, data: { status: "SUSPENDED" } });
    disallowWrites = true;
    await assert.rejects(readProject(bearerA, projectA), UnauthorizedException);
    disallowWrites = false;
    await db.membership.update({ where: {
      userId_orgId_roleId: { userId: userA, orgId: clientA, roleId }
    }, data: { status: "ACTIVE" } });
    await db.job.update({ where: { id: jobA }, data: { deletedAt: new Date() } });
    disallowWrites = true;
    await assert.rejects(readProject(bearerA, projectA), NotFoundException);
    disallowWrites = false;
    await db.job.update({ where: { id: jobA }, data: { deletedAt: null } });
    await db.authSession.update({ where: { id: sidA },
      data: { status: "REVOKED", revokedAt: new Date() } });
    disallowWrites = true;
    await assert.rejects(readProject(bearerA, projectA), UnauthorizedException);
    assert.deepEqual(writeCalls, [], "all S1 reads side-effect free");
    console.log("PASS: real Postgres SEMSE AuthSession / ACTIVE Membership / tenant + org ownership / revocation / no-write (synthetic fixtures).");
    console.log("LIMIT: internal signed SEMSE JWT only; not OAuth token, Hydra introspection, persisted consent or live MCP server.");
  } finally {
    disallowWrites = false;
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
    // CI database is ephemeral; fixtures still cleaned in dependency order.
    try {
      await db.authSession.deleteMany({ where: { id: { in: [sidA, sidB, sidC] } } });
      await db.project.deleteMany({ where: { id: { in: [projectA, projectB, projectC] } } });
      await db.job.deleteMany({ where: { id: { in: [jobA, jobB, jobC] } } });
      await db.membership.deleteMany({ where: { userId: { in: [userA, userB, userC] } } });
      await db.user.deleteMany({ where: { id: { in: [userA, userB, userC] } } });
      await db.org.deleteMany({ where: { id: { in: [clientA, clientB, clientC, proA, proB, proC] } } });
      await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      if (newRoleId) await db.role.delete({ where: { id: newRoleId } });
    } finally {
      await db.$disconnect();
    }
  }
});

/**
 * P0 #974 / PR #987 — real PostgreSQL document-grant transaction coverage.
 * Only transient fixtures on the ephemeral API Integration database.
 * The project resolver is a synthetic verified-participants fixture; this
 * test proves SQL grant/audit atomicity, not end-to-end project authorization.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, "packages/db/.env") });

// Refuse to run write-capable fixtures against an arbitrary DATABASE_URL.
// GitHub Actions supplies a disposable local PostgreSQL 16 on port 5433.
// Local runs require an explicit opt-in and a named throwaway database.
const dbUrl = process.env.DATABASE_URL;
const dbTarget = dbUrl ? new URL(dbUrl) : null;
const dbName = dbTarget?.pathname.replace(/^\//, "") ?? "";
const loopback = dbTarget?.hostname === "127.0.0.1" || dbTarget?.hostname === "localhost";
const ciIsolatedDb = process.env.GITHUB_ACTIONS === "true" &&
  dbTarget?.hostname === "127.0.0.1" && dbTarget?.port === "5433" && dbName === "semse";
const localIsolatedDb = process.env.SEMSE_PROMETEO_ISOLATED_DB_TEST === "1" &&
  loopback && /^semse_(?:test|qa|p0)(?:_|$)/.test(dbName);
if (dbUrl && !ciIsolatedDb && !localIsolatedDb) {
  throw new Error("P0 grant integration test refuses a non-isolated database target");
}
const integrationTest = dbUrl ? test : test.skip;
const fixtureId = (suffix: string) => "p0_grant_" + suffix + "_" + randomUUID().replaceAll("-", "").slice(0, 20);

integrationTest("P0: real DB grant/revoke is idempotent, auditable and scoped to project participants", async () => {
  const previousFlag = process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED;
  process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED = "true";
  const { PrismaService } = await import("../dist/infrastructure/prisma/prisma.service.js");
  const { PrometeoDocumentGrantService } = await import("../dist/modules/prometeo/prometeo-document-grant.service.js");
  const prisma = new PrismaService({ getOrThrow: (key: string) => process.env[key] } as never);
  await prisma.$connect();

  const tenantId = fixtureId("tenant"), foreignTenantId = fixtureId("foreign");
  const ownerOrgId = fixtureId("owner"), recipientOrgId = fixtureId("recipient");
  const strangerOrgId = fixtureId("stranger"), projectId = fixtureId("project");
  const userId = fixtureId("user"), documentId = fixtureId("document");
  const owner = { tenantId, orgId: ownerOrgId, userId, roles: ["CLIENT"] };
  const resolver = {
    async resolveProjectScope(tenant: string, project: string) {
      assert.equal(tenant, tenantId);
      assert.equal(project, projectId);
      return { clientOrgId: ownerOrgId, assignedProOrgId: recipientOrgId };
    },
  };
  const service = new PrometeoDocumentGrantService(prisma, resolver as never);
  try {
    await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Prometeo P0 grant QA" } });
    await prisma.tenant.create({ data: { id: foreignTenantId, slug: foreignTenantId, name: "Foreign tenant P0" } });
    await prisma.org.createMany({ data: [
      { id: ownerOrgId, tenantId, type: "CLIENT", name: "Owner QA" },
      { id: recipientOrgId, tenantId, type: "PRO", name: "Recipient QA" },
      { id: strangerOrgId, tenantId, type: "CLIENT", name: "Stranger QA" },
    ] });
    await prisma.user.create({ data: { id: userId, email: userId + "@qa.semse.invalid" } });
    await prisma.prometeoDocument.create({ data: {
      id: documentId, tenantId, orgId: ownerOrgId, projectId,
      title: "Synthetic private document", sourceType: "text", status: "indexed",
      uploadedById: userId, metadataJson: { visibility: "project_private" },
    } });

    for (const blocked of [
      { actor: { ...owner, tenantId: foreignTenantId }, recipient: recipientOrgId, status: 404 },
      { actor: { ...owner, orgId: strangerOrgId }, recipient: recipientOrgId, status: 403 },
      { actor: owner, recipient: strangerOrgId, status: 403 },
      { actor: owner, recipient: ownerOrgId, status: 403 },
    ]) {
      await assert.rejects(
        () => service.grant(blocked.actor as never, documentId, blocked.recipient, "negative"),
        (error: any) => error.getStatus?.() === blocked.status,
      );
    }
    assert.equal(await prisma.prometeoDocumentGrant.count({ where: { documentId } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, entityType: "PrometeoDocumentGrant" } }), 0);

    // An untrusted/nonexistent actorId cannot leave an unaudited grant committed.
    const forged = { ...owner, userId: fixtureId("no_user") };
    await assert.rejects(
      () => service.grant(forged as never, documentId, recipientOrgId, "audit-must-roll-back"),
      "audit FK rejection must abort the whole document-share transaction",
    );
    assert.equal(await prisma.prometeoDocumentGrant.count({ where: { documentId } }), 0);

    const first = await service.grant(owner as never, documentId, recipientOrgId, "grant-1");
    assert.equal(first.tenantId, tenantId);
    assert.equal(first.projectId, projectId);
    const repeated = await service.grant(owner as never, documentId, recipientOrgId, "grant-duplicate");
    assert.equal(repeated.id, first.id, "identical active grant is idempotent");
    assert.equal(await prisma.auditLog.count({ where: { tenantId, entityId: first.id,
      action: "prometeo.document_share_granted" } }), 1, "duplicate grants must not duplicate audit");

    // Revocation must not succeed without a durable audit write.
    await assert.rejects(
      () => service.revoke(forged as never, documentId, recipientOrgId, "audit-revoke-rollback"),
      "audit FK rejection must roll back revokedAt",
    );
    const active = await prisma.prometeoDocumentGrant.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(active.revokedAt, null);

    await service.revoke(owner as never, documentId, recipientOrgId, "revoke-1");
    const revoked = await prisma.prometeoDocumentGrant.findUniqueOrThrow({ where: { id: first.id } });
    assert.ok(revoked.revokedAt);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, entityId: first.id,
      action: "prometeo.document_share_revoked" } }), 1);
    await assert.rejects(
      () => service.revoke(owner as never, documentId, recipientOrgId, "revoke-again"),
      (error: any) => error.getStatus?.() === 404,
    );
    const renewed = await service.grant(owner as never, documentId, recipientOrgId, "regrant");
    assert.equal(renewed.id, first.id, "regrant revives only the scoped grant");
    assert.equal(renewed.revokedAt, null);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, entityId: first.id,
      action: "prometeo.document_share_granted" } }), 2, "regrant is separately audited");
  } finally {
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    if (previousFlag === undefined) delete process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED;
    else process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED = previousFlag;
  }
});

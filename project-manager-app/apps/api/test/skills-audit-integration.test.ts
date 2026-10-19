/**
 * Codex BO-12 P1: live PostgreSQL transaction rollback, including AuditLog.
 * Uses only temporary synthetic rows and is skipped without DATABASE_URL.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, "packages/db/.env") });
const dbTest = process.env.DATABASE_URL ? test : test.skip;

const unique = (part: string) => `bo12_${part}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

dbTest("BO-12: PostgreSQL rolls back skill attestation AND written audit row when audit fails", async () => {
  const { PrismaService } = await import("../dist/infrastructure/prisma/prisma.service.js");
  const { ActorContextService } = await import("../dist/infrastructure/persistence/actor-context.service.js");
  const { AuditService } = await import("../dist/infrastructure/audit/audit.service.js");
  const { SkillsService } = await import("../dist/modules/professional-skills/skills.service.js");

  const prisma = new PrismaService({ getOrThrow: (key: string) => process.env[key] } as never);
  await prisma.$connect();
  const tenantId = unique("tenant"), orgId = unique("org"), userId = unique("user");
  const actor = { tenantId, orgId, userId, roles: ["WORKER"] };
  const previousFlag = process.env.SEMSE_SKILLS_ENABLED;
  process.env.SEMSE_SKILLS_ENABLED = "true";
  const actorContext = new ActorContextService(prisma);
  const audit = new AuditService(prisma, actorContext);
  let failOn: string | undefined;
  // Insert an AuditLog inside the real Prisma transaction, then deliberately
  // throw: PostgreSQL must undo BOTH the attestation change and AuditLog row.
  const injectedAudit = {
    async append(entry: Parameters<AuditService["append"]>[0], tx?: Parameters<AuditService["append"]>[1]) {
      assert.ok(tx, "Mutations must pass their active Prisma transaction to AuditService");
      await audit.append(entry, tx);
      if (entry.action === failOn) throw new Error("synthetic_bo12_audit_failure");
    },
  };
  const skills = new SkillsService(prisma, injectedAudit as never);
  try {
    await actorContext.ensureActorContext(actor);
    await prisma.skillExperience.create({ data: {
      tenantId, orgId, userId, trade: "electricidad",
      sourceType: "BO12_TEST", sourceId: unique("source"), status: "CONFIRMED",
      reviewedByUserId: userId, decidedAt: new Date(),
    } });

    failOn = "skill_attestation.created";
    await assert.rejects(
      () => skills.createAttestation(actor, unique("failed_create"), { consent: true }),
      /synthetic_bo12_audit_failure/,
    );
    assert.equal(await prisma.skillAttestation.count({ where: { userId } }), 0,
      "failed audit must not persist an attestation with an undisclosed one-time token");
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "skill_attestation.created" } }), 0,
      "failed transaction must also revert the inserted audit row");

    failOn = undefined;
    const issued = await skills.createAttestation(actor, unique("valid_create"), { consent: true });
    assert.ok(issued.token);
    assert.equal(await prisma.skillAttestation.count({ where: { userId } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "skill_attestation.created" } }), 1);

    failOn = "skill_attestation.revoked";
    await assert.rejects(
      () => skills.revokeAttestation(actor, issued.attestationId, unique("failed_revoke")),
      /synthetic_bo12_audit_failure/,
    );
    const unchanged = await prisma.skillAttestation.findUniqueOrThrow({ where: { id: issued.attestationId } });
    assert.equal(unchanged.status, "ACTIVE");
    assert.equal(unchanged.revokedAt, null);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "skill_attestation.revoked" } }), 0);

    failOn = undefined;
    await skills.revokeAttestation(actor, issued.attestationId, unique("valid_revoke"));
    assert.equal((await prisma.skillAttestation.findUniqueOrThrow({ where: { id: issued.attestationId } })).status, "REVOKED");
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "skill_attestation.revoked" } }), 1);
  } finally {
    if (previousFlag === undefined) delete process.env.SEMSE_SKILLS_ENABLED;
    else process.env.SEMSE_SKILLS_ENABLED = previousFlag;
    await prisma.skillAttestation.deleteMany({ where: { userId } });
    await prisma.skillExperience.deleteMany({ where: { userId, tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.org.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
});

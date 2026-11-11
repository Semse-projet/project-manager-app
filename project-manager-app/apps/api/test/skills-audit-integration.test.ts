/**
 * BO-12 / Codex P1: verify domain mutations and their AuditLog row commit
 * atomically against the isolated migrated PostgreSQL 16 CI database.
 * Fixtures are synthetic and cannot run when DATABASE_URL is absent.
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
const id = (tag: string) => `bo12_${tag}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

dbTest("BO-12: PostgreSQL rolls back experience, attestation and revocation if AuditLog insert fails", async () => {
  const { PrismaService } = await import("../dist/infrastructure/prisma/prisma.service.js");
  const { ActorContextService } = await import("../dist/infrastructure/persistence/actor-context.service.js");
  const { AuditService } = await import("../dist/infrastructure/audit/audit.service.js");
  const { SkillsService } = await import("../dist/modules/professional-skills/skills.service.js");
  const prisma = new PrismaService({ getOrThrow: (k: string) => process.env[k] } as never);
  await prisma.$connect();

  const tenantId = id("tenant");
  const orgId = id("org");
  const supervisorId = id("supervisor");
  const workerId = id("worker");
  const roleId = id("role");
  const roleKey = id("workerrole");
  const crewId = id("crew");
  const allocationId = id("allocation");
  const taskId = id("task");
  const trigger = id("trigger");
  const fn = id("auditfn");
  const previousFlag = process.env.SEMSE_SKILLS_ENABLED;
  process.env.SEMSE_SKILLS_ENABLED = "true";
  let functionCreated = false;
  let triggerCreated = false;

  async function addFailingAuditTrigger(action: string) {
    assert.match(action, /^skill_(experience|attestation)\.[a-z_]+$/);
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION "${fn}"() RETURNS trigger AS $bo12$
       BEGIN
         IF NEW."tenantId" = '${tenantId}' AND NEW."action" = '${action}' THEN
           RAISE EXCEPTION 'synthetic_bo12_audit_failure';
         END IF;
         RETURN NEW;
       END; $bo12$ LANGUAGE plpgsql`
    );
    functionCreated = true;
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog"
       FOR EACH ROW EXECUTE FUNCTION "${fn}"()`
    );
    triggerCreated = true;
  }

  async function removeFailingAuditTrigger() {
    if (triggerCreated) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
      triggerCreated = false;
    }
    if (functionCreated) {
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);
      functionCreated = false;
    }
  }

  const actor = { tenantId, orgId, userId: supervisorId, roles: ["WORKER"] };
  const worker = { tenantId, orgId, userId: workerId, roles: ["WORKER"] };
  try {
    await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "BO-12 isolated audit fixture" } });
    await prisma.org.create({ data: { id: orgId, tenantId, name: "BO-12 Org", type: "client" } });
    await prisma.user.createMany({
      data: [
        { id: supervisorId, email: `${supervisorId}@semse.local` },
        { id: workerId, email: `${workerId}@semse.local` }
      ]
    });
    await prisma.role.create({ data: { id: roleId, key: roleKey, name: "Test worker" } });
    await prisma.membership.create({
      data: { userId: supervisorId, orgId, roleId, status: "ACTIVE" }
    });
    await prisma.crew.create({
      data: { id: crewId, tenantId, orgId, name: "Temporary crew",
        supervisorUserId: supervisorId, createdBy: supervisorId, status: "ACTIVE" }
    });
    await prisma.taskAllocation.create({
      data: { id: allocationId, tenantId, orgId, taskId, crewId,
        userId: workerId, assignedByUserId: supervisorId, status: "SUBMITTED" }
    });

    const svc = new SkillsService(prisma, new AuditService(prisma, new ActorContextService(prisma)));
    const confirm = { decision: "CONFIRM" as const, trade: "electricidad" };

    await prisma.crew.update({ where: { id: crewId }, data: { status: "ARCHIVED" } });
    await assert.rejects(() => svc.reviewAllocation(actor, allocationId, id("archived"), confirm),
      (e: any) => e.getStatus?.() === 404);
    await prisma.crew.update({ where: { id: crewId }, data: { status: "ACTIVE" } });

    await addFailingAuditTrigger("skill_experience.confirmed");
    await assert.rejects(() => svc.reviewAllocation(actor, allocationId, id("review"), confirm),
      /synthetic_bo12_audit_failure/);
    assert.equal(await prisma.skillExperience.count({ where: { sourceId: allocationId } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "skill_experience.confirmed" } }), 0);
    await removeFailingAuditTrigger();

    await svc.reviewAllocation(actor, allocationId, id("review_retry"), confirm);
    assert.equal(await prisma.skillExperience.count({ where: { sourceId: allocationId } }), 1);

    await addFailingAuditTrigger("skill_attestation.created");
    await assert.rejects(() => svc.createAttestation(worker, id("attestation"), { consent: true }),
      /synthetic_bo12_audit_failure/);
    assert.equal(await prisma.skillAttestation.count({ where: { userId: workerId } }), 0);
    await removeFailingAuditTrigger();

    const issued = await svc.createAttestation(worker, id("retry"), { consent: true });
    const saved = await prisma.skillAttestation.findUniqueOrThrow({ where: { id: issued.attestationId } });
    assert.equal(saved.status, "ACTIVE");
    assert.notEqual(saved.tokenHash, issued.token, "never persist the plaintext one-time token");

    await addFailingAuditTrigger("skill_attestation.revoked");
    await assert.rejects(() => svc.revokeAttestation(worker, issued.attestationId, id("revoke")),
      /synthetic_bo12_audit_failure/);
    const active = await prisma.skillAttestation.findUniqueOrThrow({ where: { id: issued.attestationId } });
    assert.equal(active.status, "ACTIVE");
    assert.equal(active.revokedAt, null);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "skill_attestation.revoked" } }), 0);
    await removeFailingAuditTrigger();

    await svc.revokeAttestation(worker, issued.attestationId, id("revoke_retry"));
    assert.equal((await prisma.skillAttestation.findUniqueOrThrow({
      where: { id: issued.attestationId }
    })).status, "REVOKED");
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "skill_attestation.revoked" } }), 1);
  } finally {
    await removeFailingAuditTrigger();
    await prisma.skillAttestation.deleteMany({ where: { userId: workerId } });
    await prisma.skillExperience.deleteMany({ where: { sourceId: allocationId } });
    await prisma.taskAllocation.deleteMany({ where: { id: allocationId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.role.deleteMany({ where: { id: roleId } });
    await prisma.user.deleteMany({ where: { id: { in: [supervisorId, workerId] } } });
    if (previousFlag === undefined) delete process.env.SEMSE_SKILLS_ENABLED;
    else process.env.SEMSE_SKILLS_ENABLED = previousFlag;
    await prisma.$disconnect();
  }
});

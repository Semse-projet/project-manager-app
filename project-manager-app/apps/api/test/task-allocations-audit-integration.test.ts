/**
 * BO-10 S0b: real isolated PostgreSQL proof that batch allocations and AuditLog
 * commit or roll back together. Never use a production DATABASE_URL for this test.
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
const uniqueId = (part: string) => `bo10_${part}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

dbTest("S0B-PG-01: PostgreSQL rolls back the entire two-worker batch when its second audit fails", async () => {
  const { PrismaService } = await import("../dist/infrastructure/prisma/prisma.service.js");
  const { ActorContextService } = await import("../dist/infrastructure/persistence/actor-context.service.js");
  const { AuditService } = await import("../dist/infrastructure/audit/audit.service.js");
  const { TaskAllocationsService } = await import("../dist/modules/organizations/task-allocations.service.js");
  const prisma = new PrismaService({ getOrThrow: (key: string) => process.env[key] } as never);
  await prisma.$connect();
  const tenantId = uniqueId("tenant");
  const orgId = uniqueId("org");
  const supervisorId = uniqueId("supervisor");
  const workerA = uniqueId("worker_a");
  const workerB = uniqueId("worker_b");
  const crewId = uniqueId("crew");
  const taskId = uniqueId("task");
  const fn = uniqueId("auditfn");
  const trigger = uniqueId("audittr");
  const originalFlag = process.env.SEMSE_TASK_ALLOCATION_ENABLED;
  process.env.SEMSE_TASK_ALLOCATION_ENABLED = "true";
  let createdRoleId: string | null = null;
  let installedFunction = false;
  let installedTrigger = false;

  async function clearFailureTrigger(): Promise<void> {
    if (installedTrigger) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
      installedTrigger = false;
    }
    if (installedFunction) {
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);
      installedFunction = false;
    }
  }

  try {
    const existingRole = await prisma.role.findUnique({ where: { key: "WORKER" } });
    const role = existingRole ?? await prisma.role.create({
      data: { id: uniqueId("role"), key: "WORKER", name: "Worker" }
    });
    if (!existingRole) createdRoleId = role.id;
    await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Isolated BO-10 fixture" } });
    await prisma.org.create({ data: { id: orgId, tenantId, name: "BO-10 test org", type: "client" } });
    await prisma.user.createMany({ data: [supervisorId, workerA, workerB].map((id) => ({
      id, email: `${id}@semse.local`
    })) });
    await prisma.membership.createMany({ data: [supervisorId, workerA, workerB].map((userId) => ({
      userId, orgId, roleId: role.id, status: "ACTIVE"
    })) });
    await prisma.crew.create({ data: {
      id: crewId, tenantId, orgId, name: "Isolated crew", supervisorUserId: supervisorId,
      createdBy: supervisorId, status: "ACTIVE"
    } });
    await prisma.crewMember.createMany({ data: [workerA, workerB].map((userId) => ({
      crewId, userId, status: "ACTIVE", addedBy: supervisorId
    })) });
    await prisma.jobTask.create({ data: {
      id: taskId, tenantId, orgId, createdBy: supervisorId,
      title: "Hab. 205 — Reparar pared", entityType: "Crew", entityId: crewId
    } });
    const svc = new TaskAllocationsService(prisma, new AuditService(prisma, new ActorContextService(prisma)));
    const actor = { tenantId, userId: supervisorId, roles: ["WORKER"] };
    // The trigger is scoped to this isolated tenant and the BO-10 assignment action.
    // On the second AuditLog INSERT, the first row is visible inside the same tx.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${fn}"() RETURNS trigger AS $bo10$
      BEGIN
        IF NEW."tenantId" = '${tenantId}' AND NEW."action" = 'crew_task.created'
        THEN
          RAISE EXCEPTION 'synthetic_bo10_creation_audit_failure';
        END IF;
        IF NEW."tenantId" = '${tenantId}' AND NEW."action" = 'task_allocation.assigned' AND
          (SELECT COUNT(*) FROM "AuditLog" WHERE "tenantId" = '${tenantId}'
           AND "action" = 'task_allocation.assigned') >= 1
        THEN
          RAISE EXCEPTION 'synthetic_bo10_second_audit_failure';
        END IF;
        RETURN NEW;
      END; $bo10$ LANGUAGE plpgsql`);
    installedFunction = true;
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "${fn}"()`);
    installedTrigger = true;

    await assert.rejects(
      svc.createCrewTask(actor, crewId, uniqueId("create_failure"), { title: "Hab. 999 — Pintar pared" }),
      /synthetic_bo10_creation_audit_failure/
    );
    assert.equal(await prisma.jobTask.count({ where: { tenantId, title: "Hab. 999 — Pintar pared" } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "crew_task.created" } }), 0);

    await assert.rejects(
      svc.assign(actor, crewId, taskId, uniqueId("failure"), [workerA, workerB]),
      /synthetic_bo10_second_audit_failure/
    );
    assert.equal(await prisma.taskAllocation.count({ where: { taskId } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "task_allocation.assigned" } }), 0);
    await clearFailureTrigger();

    const assigned = await svc.assign(actor, crewId, taskId, uniqueId("success"), [workerA, workerB]);
    assert.equal(assigned.length, 2);
    assert.equal(await prisma.taskAllocation.count({ where: { taskId } }), 2);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, action: "task_allocation.assigned" } }), 2);
  } finally {
    await clearFailureTrigger();
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.taskAllocation.deleteMany({ where: { taskId } });
    await prisma.jobTask.deleteMany({ where: { id: taskId } });
    await prisma.crewMember.deleteMany({ where: { crewId } });
    await prisma.crew.deleteMany({ where: { id: crewId } });
    await prisma.membership.deleteMany({ where: { orgId } });
    await prisma.org.deleteMany({ where: { id: orgId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: [supervisorId, workerA, workerB] } } });
    if (createdRoleId) await prisma.role.deleteMany({ where: { id: createdRoleId } });
    if (originalFlag === undefined) delete process.env.SEMSE_TASK_ALLOCATION_ENABLED;
    else process.env.SEMSE_TASK_ALLOCATION_ENABLED = originalFlag;
    await prisma.$disconnect();
  }
});

/**
 * S0 — guard de mutaciones de FreeProject contra PostgreSQL real
 * (docs/specs/labor/free-project-mutation-guard.spec.md §9).
 *
 * Verifica lo que un fake no puede: los `where` reales (createdBy,
 * jobAssignmentWhere relacional, deletedAt) y que si el insert de AuditLog
 * falla dentro de la transacción la conversión NO queda escrita. Datos
 * sintéticos en un tenant propio que se borra al final. Se salta sin
 * DATABASE_URL.
 */
import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", "..", "..", "packages/db/.env") });

const dbTest = process.env.DATABASE_URL ? test : test.skip;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function httpStatus(expected: number) {
  return (error: unknown) => {
    const status = (error as { getStatus?: () => number }).getStatus?.();
    assert.equal(status, expected, `expected HTTP ${expected}, got ${String(status)}: ${String(error)}`);
    return true;
  };
}

dbTest("S0: ownership, destino y audit transaccional de FreeProject sobre PostgreSQL", async () => {
  const { LaborEngineRepository } = await import("../dist/modules/labor-engine/labor-engine.repository.js");
  const { LaborEngineService } = await import("../dist/modules/labor-engine/labor-engine.service.js");
  const { LaborEngineController } = await import("../dist/modules/labor-engine/labor-engine.controller.js");
  const { ActorContextService } = await import("../dist/infrastructure/persistence/actor-context.service.js");

  const prisma = new PrismaClient();
  const repository = new LaborEngineRepository(prisma as never, new ActorContextService(prisma as never));
  const service = new LaborEngineService(repository as never, {} as never);
  const controller = new LaborEngineController(service as never, {} as never);

  const tenantId = uid("ten_s0");
  const orgId = uid("org_s0");
  const clientOrgId = uid("org_client_s0");
  const owner = uid("owner_s0");
  const peer = uid("peer_s0");
  const failTrigger = `s0_fail_audit_${Date.now().toString(36)}`;
  const req = (userId: string) => ({
    headers: { "x-request-id": uid("req_s0") },
    authContext: { tenantId, orgId, userId, roles: ["WORKER"] },
  });

  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "S0 synthetic" } });
  for (const id of [owner, peer]) await prisma.user.create({ data: { id, email: `${id}@s0-guard.test` } });
  await prisma.org.create({ data: { id: orgId, tenantId, type: "pro", name: "S0 pro org" } });
  await prisma.org.create({ data: { id: clientOrgId, tenantId, type: "client", name: "S0 client org" } });

  const jobBase = { tenantId, clientOrgId, title: "S0 synthetic job", scope: "synthetic" };
  const assignedJob = await prisma.job.create({ data: { ...jobBase, id: uid("job_assigned") } });
  const unassignedJob = await prisma.job.create({ data: { ...jobBase, id: uid("job_unassigned") } });
  const deletedJob = await prisma.job.create({ data: { ...jobBase, id: uid("job_deleted"), deletedAt: new Date() } });
  for (const jobId of [assignedJob.id, deletedJob.id]) {
    await prisma.bid.create({
      data: { jobId, proOrgId: orgId, professionalUserId: owner, amount: 100, etaDays: 1, status: "ACCEPTED" },
    });
  }

  const mkProject = (name: string) => prisma.freeProject.create({
    data: { id: uid("fp_s0"), tenantId, createdBy: owner, name, status: "active" },
  });
  const project = await mkProject("S0 synthetic project");
  const rollbackProject = await mkProject("S0 rollback project");
  const hours = await prisma.timeEntry.create({
    data: {
      tenantId, orgId, createdBy: owner, freeProjectId: project.id, mode: "manual", purpose: "personal",
      startedAt: new Date("2026-10-14T08:00:00Z"), endedAt: new Date("2026-10-14T16:30:00Z"), durationMinutes: 510,
    },
  });

  try {
    // N1: otra persona del mismo tenant y org → 404, sin cambios.
    await assert.rejects(controller.updateFreeProject(req(peer) as never, project.id, { name: "otro" }), httpStatus(404));
    await assert.rejects(controller.archiveFreeProject(req(peer) as never, project.id), httpStatus(404));
    await assert.rejects(
      controller.convertFreeProject(req(peer) as never, project.id, { jobId: assignedJob.id }),
      httpStatus(404),
    );
    let row = await prisma.freeProject.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(row.name, "S0 synthetic project");
    assert.equal(row.status, "active");
    assert.equal(row.convertedJobId, null);

    // N5/N6/N8 con SQL real: inexistente, eliminado y no asignado → 403.
    for (const jobId of [uid("job_missing"), deletedJob.id, unassignedJob.id]) {
      await assert.rejects(controller.convertFreeProject(req(owner) as never, project.id, { jobId }), httpStatus(403));
    }
    row = await prisma.freeProject.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(row.status, "active");
    assert.equal(row.convertedJobId, null);

    // P1: conversión legítima, con su AuditLog.
    const converted = await controller.convertFreeProject(req(owner) as never, project.id, { jobId: assignedJob.id });
    assert.equal((converted.data as { status: string }).status, "converted");
    const audits = await prisma.auditLog.findMany({ where: { tenantId, entityId: project.id } });
    assert.equal(audits.length, 1);
    assert.equal(audits[0]!.action, "free_project.converted");

    // Rollback real: el insert de AuditLog falla dentro de la transacción.
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION ${failTrigger}() RETURNS trigger AS $$
      BEGIN
        IF NEW."tenantId" = '${tenantId}' AND NEW."entityId" = '${rollbackProject.id}' THEN
          RAISE EXCEPTION 's0 forced audit failure';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER ${failTrigger} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${failTrigger}()`,
    );
    await assert.rejects(
      controller.convertFreeProject(req(owner) as never, rollbackProject.id, { jobId: assignedJob.id }),
      /s0 forced audit failure/,
    );
    const rolledBack = await prisma.freeProject.findUniqueOrThrow({ where: { id: rollbackProject.id } });
    assert.equal(rolledBack.status, "active", "la transición no debe quedar escrita sin su audit");
    assert.equal(rolledBack.convertedJobId, null);
    assert.equal(await prisma.auditLog.count({ where: { tenantId, entityId: rollbackProject.id } }), 0);

    // Horas registradas intactas.
    const hoursAfter = await prisma.timeEntry.findUniqueOrThrow({ where: { id: hours.id } });
    assert.equal(hoursAfter.durationMinutes, 510);
    assert.equal(hoursAfter.freeProjectId, project.id);
    assert.equal(hoursAfter.createdBy, owner);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${failTrigger} ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${failTrigger}()`);
    await prisma.job.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: [owner, peer] } } });
    await prisma.$disconnect();
  }
});

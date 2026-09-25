/**
 * T-051 — Espejo AgroFarmTask → JobTask(domain="agro") y tenant de la finca.
 *
 * E2E por HTTP contra Postgres real (controllers reales de AgroModule + RbacGuard
 * global) y backfill de la migración 20260925150000 sobre datos preparados.
 * Se salta sin DATABASE_URL.
 */
import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", "..", "..", "packages/db/.env") });

const dbTest = process.env.DATABASE_URL ? test : test.skip;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function buildApp() {
  delete process.env.AUTH_SECRET;
  const { Module } = await import("@nestjs/common");
  const { APP_GUARD, NestFactory } = await import("@nestjs/core");
  const { ConfigModule } = await import("@nestjs/config");
  const { FastifyAdapter } = await import("@nestjs/platform-fastify");
  const { PrismaModule } = await import("../dist/infrastructure/prisma/prisma.module.js");
  const { AgroModule } = await import("../dist/modules/agro/agro.module.js");
  const { RbacGuard } = await import("../dist/common/rbac.guard.js");
  const { HttpExceptionFilter } = await import("../dist/common/http-exception.filter.js");
  const { SemseLoggerService } = await import("../dist/infrastructure/observability/semse-logger.service.js");

  class AgroJobTaskMirrorE2EModule {}
  Module({
    imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AgroModule],
    providers: [{ provide: APP_GUARD, useClass: RbacGuard }],
  })(AgroJobTaskMirrorE2EModule);

  const app = await NestFactory.create(AgroJobTaskMirrorE2EModule, new FastifyAdapter(), { logger: false });
  app.useGlobalFilters(new HttpExceptionFilter(app.get(SemseLoggerService)));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}


dbTest("agro T-051: tasks of a farm with tenant are mirrored into JobTask(domain=agro)", async () => {
  const prisma = new PrismaClient();
  const app = await buildApp();
  const fastify = app.getHttpAdapter().getInstance();
  const tenantId = uid("ten");
  const users = { owner: uid("owner"), worker: uid("worker") };
  const farmIds: string[] = [];

  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Agro T-051" } });
  for (const id of Object.values(users)) await prisma.user.create({ data: { id, email: `${id}@agro-t051.test` } });

  const call = async (as: keyof typeof users, method: string, url: string, payload?: unknown, tenant = tenantId) => {
    const res = await fastify.inject({
      method: method as any,
      url,
      headers: {
        "x-user-id": users[as], "x-tenant-id": tenant, "x-org-id": "org_t051",
        "x-roles": as === "owner" ? "CLIENT" : "WORKER", "content-type": "application/json",
      },
      ...(payload !== undefined && { payload: JSON.stringify(payload) }),
    });
    const body = res.body ? JSON.parse(res.body) : null;
    return { status: res.statusCode, data: body?.data, body };
  };

  try {
    // ── Tenant de la finca: el de la sesión, solo si existe ─────────────────
    const farm = await call("owner", "POST", "/v1/agro/farms", { name: "Granja T-051" });
    assert.equal(farm.status, 201, JSON.stringify(farm.body));
    const farmId = farm.data.farm.id;
    farmIds.push(farmId);
    assert.equal(farm.data.farm.tenantId, tenantId);
    const loose = await call("owner", "POST", "/v1/agro/farms", { name: "Sin tenant" }, uid("ten_missing"));
    assert.equal(loose.status, 201, "unknown session tenant must not break farm creation");
    farmIds.push(loose.data.farm.id);
    assert.equal(loose.data.farm.tenantId, null);

    // ── Alta: espejo en la misma transacción ────────────────────────────────
    assert.equal((await call("owner", "POST", `/v1/agro/farms/${farmId}/members`, { userId: users.worker, role: "WORKER" })).status, 201);
    const created = await call("owner", "POST", `/v1/agro/farms/${farmId}/tasks`, {
      title: "Vacunar lote 3", type: "VACCINATION", priority: "HIGH", assignedToId: users.worker, targetType: "GENERAL",
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const task = created.data.task;
    assert.equal(task.jobTaskId, `agrotask_${task.id}`);
    let mirror = await prisma.jobTask.findUnique({ where: { id: task.jobTaskId } });
    assert.ok(mirror, "JobTask mirror created");
    assert.equal(mirror!.tenantId, tenantId);
    assert.equal(mirror!.domain, "agro");
    assert.equal(mirror!.farmId, farmId);
    assert.equal(mirror!.status, "pending");
    assert.equal(mirror!.priority, "high");
    assert.equal(mirror!.taskType, "VACCINATION");
    assert.equal(mirror!.assignedTo, users.worker);
    assert.equal(mirror!.createdBy, users.owner);
    assert.equal(mirror!.sourceTool, "agro_farm_task");

    // ── Transiciones y edición se reflejan ──────────────────────────────────
    assert.equal((await call("worker", "POST", `/v1/agro/tasks/${task.id}/start`, {})).status, 201);
    mirror = await prisma.jobTask.findUnique({ where: { id: task.jobTaskId } });
    assert.equal(mirror!.status, "in_progress");
    assert.ok(mirror!.startedAt);
    assert.equal((await call("owner", "PATCH", `/v1/agro/tasks/${task.id}`, { priority: "URGENT", title: "Vacunar lote 3 (urgente)" })).status, 200);
    mirror = await prisma.jobTask.findUnique({ where: { id: task.jobTaskId } });
    assert.equal(mirror!.priority, "urgent");
    assert.equal(mirror!.title, "Vacunar lote 3 (urgente)");
    assert.equal((await call("worker", "POST", `/v1/agro/tasks/${task.id}/complete`, {})).status, 201);
    mirror = await prisma.jobTask.findUnique({ where: { id: task.jobTaskId } });
    assert.equal(mirror!.status, "done");
    assert.ok(mirror!.completedAt);

    // ── Sync offline: alta y cierre también se reflejan ─────────────────────
    const at = new Date().toISOString();
    const sync = await call("worker", "POST", "/v1/agro/sync/events", { events: [
      { clientEventId: uid("e"), farmId, action: "farm_task.create", payload: { title: "Revisar bebederos", type: "WATER_CHECK" }, occurredAt: at },
    ] });
    // El trabajador no crea tareas (política T-050): FAILED y sin espejo.
    assert.equal(sync.data.results[0].status, "FAILED");
    const ownerSync = await call("owner", "POST", "/v1/agro/sync/events", { events: [
      { clientEventId: uid("e"), farmId, action: "farm_task.create", payload: { title: "Revisar bebederos", type: "WATER_CHECK" }, occurredAt: at },
    ] });
    assert.equal(ownerSync.data.results[0].status, "SYNCED", JSON.stringify(ownerSync.body));
    const offline = await prisma.agroFarmTask.findFirstOrThrow({ where: { farmId, title: "Revisar bebederos" } });
    assert.equal(offline.jobTaskId, `agrotask_${offline.id}`);
    const done = await call("worker", "POST", "/v1/agro/sync/events", { events: [
      { clientEventId: uid("e"), farmId, action: "farm_task.complete", payload: { taskId: offline.id }, occurredAt: at },
    ] });
    assert.equal(done.data.results[0].status, "SYNCED", JSON.stringify(done.body));
    assert.equal((await prisma.jobTask.findUnique({ where: { id: offline.jobTaskId! } }))!.status, "done");

    // ── Finca sin tenant: sin espejo, como antes ────────────────────────────
    const looseTask = await call("owner", "POST", `/v1/agro/farms/${loose.data.farm.id}/tasks`, { title: "x", type: "OTHER" }, uid("ten_missing"));
    assert.equal(looseTask.status, 201);
    assert.equal(looseTask.data.task.jobTaskId, null);

    // ── "Buscar → relacionar": sin duplicados por el espejo ─────────────────
    const open = await call("owner", "POST", `/v1/agro/farms/${farmId}/tasks`, { title: "Abierta", type: "OTHER" });
    const { AgroTaskRefResolver } = await import("../dist/modules/agro/agro-task-ref.resolver.js");
    const listed = await app.get(AgroTaskRefResolver).listOpen(farmId);
    assert.deepEqual(listed.map((t: any) => `${t.source}:${t.id}`), [`AGRO_FARM_TASK:${open.data.task.id}`]);
    // La referencia JOB_TASK al espejo sigue resolviendo.
    const viaMirror = await app.get(AgroTaskRefResolver).resolve(farmId, { source: "JOB_TASK", id: open.data.task.jobTaskId });
    assert.equal(viaMirror.title, "Abierta");
  } finally {
    await prisma.jobTask.deleteMany({ where: { tenantId } });
    await prisma.agroFarm.deleteMany({ where: { id: { in: farmIds } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
    await prisma.$disconnect();
  }
});

/** Sentencias de backfill de la migración (todo lo que sigue a "-- Backfill 1"). */
function backfillStatements(): string[] {
  const sql = readFileSync(
    path.resolve(__dirname, "..", "..", "..", "packages/db/prisma/migrations/20260925150000_agro_farm_tenant_jobtask_bridge/migration.sql"),
    "utf8",
  );
  return sql.slice(sql.indexOf("-- Backfill 1"))
    .split(";")
    .map((stmt) => stmt.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim())
    .filter(Boolean);
}

dbTest("agro T-051: migration backfill assigns unambiguous tenants and mirrors tasks idempotently", async () => {
  const prisma = new PrismaClient();
  const t1 = uid("ten"), t2 = uid("ten");
  const single = uid("owner"), multi = uid("owner");
  const roleKey = uid("role");
  const ids = { farmA: uid("farm"), farmB: uid("farm"), orgs: [uid("org"), uid("org")] };
  try {
    for (const id of [t1, t2]) await prisma.tenant.create({ data: { id, slug: id, name: id } });
    for (const id of [single, multi]) await prisma.user.create({ data: { id, email: `${id}@agro-t051.test` } });
    const role = await prisma.role.create({ data: { key: roleKey, name: "Agro test" } });
    await prisma.org.create({ data: { id: ids.orgs[0], tenantId: t1, type: "CLIENT", name: "Org 1" } });
    await prisma.org.create({ data: { id: ids.orgs[1], tenantId: t2, type: "CLIENT", name: "Org 2" } });
    await prisma.membership.createMany({ data: [
      { userId: single, orgId: ids.orgs[0], roleId: role.id },
      { userId: multi, orgId: ids.orgs[0], roleId: role.id },
      { userId: multi, orgId: ids.orgs[1], roleId: role.id },
    ] });
    await prisma.agroFarm.create({ data: { id: ids.farmA, ownerId: single, name: "Una sola org" } });
    await prisma.agroFarm.create({ data: { id: ids.farmB, ownerId: multi, name: "Dos tenants" } });
    const taskA = await prisma.agroFarmTask.create({ data: { farmId: ids.farmA, title: "Pesar", type: "WEIGHING", status: "BLOCKED", priority: "LOW" } });
    await prisma.agroFarmTask.create({ data: { farmId: ids.farmB, title: "Limpiar", type: "CLEANING" } });

    for (let run = 0; run < 2; run++) {
      for (const stmt of backfillStatements()) await prisma.$executeRawUnsafe(stmt);
    }

    assert.equal((await prisma.agroFarm.findUnique({ where: { id: ids.farmA } }))!.tenantId, t1);
    assert.equal((await prisma.agroFarm.findUnique({ where: { id: ids.farmB } }))!.tenantId, null, "ambiguous owner keeps no tenant");
    const a = await prisma.agroFarmTask.findUnique({ where: { id: taskA.id } });
    assert.equal(a!.jobTaskId, `agrotask_${taskA.id}`);
    const mirrors = await prisma.jobTask.findMany({ where: { farmId: { in: [ids.farmA, ids.farmB] } } });
    assert.equal(mirrors.length, 1, "one mirror per task, even after running twice");
    assert.equal(mirrors[0].status, "blocked");
    assert.equal(mirrors[0].priority, "low");
    assert.equal(mirrors[0].createdBy, single);
  } finally {
    await prisma.jobTask.deleteMany({ where: { tenantId: { in: [t1, t2] } } });
    await prisma.agroFarm.deleteMany({ where: { id: { in: [ids.farmA, ids.farmB] } } });
    await prisma.membership.deleteMany({ where: { userId: { in: [single, multi] } } });
    await prisma.org.deleteMany({ where: { id: { in: ids.orgs } } });
    await prisma.role.deleteMany({ where: { key: roleKey } });
    await prisma.user.deleteMany({ where: { id: { in: [single, multi] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [t1, t2] } } });
    await prisma.$disconnect();
  }
});

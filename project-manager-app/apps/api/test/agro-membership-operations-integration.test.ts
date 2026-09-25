/**
 * T-050 — Los servicios Agro existentes (tareas, animales, evidencia,
 * inventario, dashboard, sync offline) respetan la membresía de finca.
 *
 * E2E por HTTP contra Postgres real: controllers reales de AgroModule + RbacGuard
 * global + filtro de errores de producción. Se salta sin DATABASE_URL.
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

  class AgroMembershipE2EModule {}
  Module({
    imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AgroModule],
    providers: [{ provide: APP_GUARD, useClass: RbacGuard }],
  })(AgroMembershipE2EModule);

  const app = await NestFactory.create(AgroMembershipE2EModule, new FastifyAdapter(), { logger: false });
  app.useGlobalFilters(new HttpExceptionFilter(app.get(SemseLoggerService)));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

dbTest("agro T-050: farm members operate existing Agro services according to their farm role", async () => {
  const prisma = new PrismaClient();
  const app = await buildApp();
  const fastify = app.getHttpAdapter().getInstance();

  const tenantId = uid("ten");
  const users = { owner: uid("owner"), sup: uid("sup"), worker: uid("worker"), vet: uid("vet"), stranger: uid("stranger") };
  const roles: Record<keyof typeof users, string> = { owner: "CLIENT", sup: "WORKER", worker: "WORKER", vet: "PRO", stranger: "WORKER" };
  let farmId = "";

  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Agro T-050" } });
  for (const id of Object.values(users)) await prisma.user.create({ data: { id, email: `${id}@agro-t050.test` } });

  const call = async (as: keyof typeof users, method: string, url: string, payload?: unknown) => {
    const res = await fastify.inject({
      method: method as any,
      url,
      headers: {
        "x-user-id": users[as], "x-tenant-id": tenantId, "x-org-id": "org_t050", "x-roles": roles[as],
        "content-type": "application/json",
      },
      ...(payload !== undefined && { payload: JSON.stringify(payload) }),
    });
    const body = res.body ? JSON.parse(res.body) : null;
    return { status: res.statusCode, data: body?.data, body };
  };

  try {
    // ── Setup: finca del propietario + miembros ─────────────────────────────
    const farm = await call("owner", "POST", "/v1/agro/farms", { name: "Granja T-050" });
    assert.equal(farm.status, 201, JSON.stringify(farm.body));
    farmId = farm.data.farm.id;
    for (const [who, role] of [["sup", "SUPERVISOR"], ["worker", "WORKER"], ["vet", "VETERINARIAN"]] as const) {
      assert.equal((await call("owner", "POST", `/v1/agro/farms/${farmId}/members`, { userId: users[who], role })).status, 201);
    }
    const unitA = await prisma.agroFarmUnit.create({ data: { farmId, name: "Corral 1", type: "CORRAL" } });
    const unitB = await prisma.agroFarmUnit.create({ data: { farmId, name: "Corral 2", type: "CORRAL" } });
    const pig = await prisma.agroAnimal.create({ data: { farmId, species: "PIG", tagCode: "C-1", currentUnitId: unitA.id } });
    const feed = await prisma.agroInventoryItem.create({ data: { farmId, name: "Concentrado", category: "FEED", unit: "KG" } });
    const group = await prisma.agroAnimalGroup.create({ data: { farmId, name: "Lote 1", species: "PIG", count: 10 } });

    // ── Lectura: miembros sí, ajenos no (404, no se revela la finca) ────────
    const myFarms = await call("worker", "GET", "/v1/agro/farms");
    const listed = myFarms.data.farms.find((f: any) => f.id === farmId);
    assert.equal(listed?.viewerRole, "WORKER", "member farms appear in the farm list with the viewer role");
    for (const url of [`/v1/agro/farms/${farmId}`, `/v1/agro/farms/${farmId}/units`, `/v1/agro/farms/${farmId}/animals`, `/v1/agro/farms/${farmId}/tasks`, `/v1/agro/farms/${farmId}/inventory/items`]) {
      assert.equal((await call("worker", "GET", url)).status, 200, `worker GET ${url}`);
      assert.equal((await call("stranger", "GET", url)).status, 404, `stranger GET ${url}`);
    }

    // ── Estructura y finanzas: siguen reservadas ────────────────────────────
    assert.equal((await call("worker", "PATCH", `/v1/agro/farms/${farmId}`, { name: "Hack" })).status, 403, "worker cannot edit farm (agro:write)");
    assert.equal((await call("sup", "GET", `/v1/agro/farms/${farmId}/costs`)).status, 403, "costs stay owner-only");
    assert.equal((await call("owner", "GET", `/v1/agro/farms/${farmId}/costs`)).status, 200);

    // ── Tareas ──────────────────────────────────────────────────────────────
    assert.equal((await call("worker", "POST", `/v1/agro/farms/${farmId}/tasks`, { title: "x", type: "FEEDING" })).status, 403, "worker cannot create tasks");
    const toStranger = await call("sup", "POST", `/v1/agro/farms/${farmId}/tasks`, { title: "x", type: "FEEDING", assignedToId: users.stranger });
    assert.equal(toStranger.status, 400, "assignee must be a farm member");
    const mine = await call("sup", "POST", `/v1/agro/farms/${farmId}/tasks`, { title: "Alimentar corral 1", type: "FEEDING", assignedToId: users.worker });
    assert.equal(mine.status, 201, JSON.stringify(mine.body));
    const supTask = await call("sup", "POST", `/v1/agro/farms/${farmId}/tasks`, { title: "Revisar bebederos", type: "WATER_CHECK", assignedToId: users.sup });
    const openTask = await call("sup", "POST", `/v1/agro/farms/${farmId}/tasks`, { title: "Limpiar corral 2", type: "CLEANING" });
    const syncTask = await call("sup", "POST", `/v1/agro/farms/${farmId}/tasks`, { title: "Pesar lote", type: "WEIGHING", assignedToId: users.worker });
    const otherSyncTask = await call("sup", "POST", `/v1/agro/farms/${farmId}/tasks`, { title: "Vacunar", type: "VACCINATION", assignedToId: users.vet });

    assert.equal((await call("worker", "POST", `/v1/agro/tasks/${mine.data.task.id}/start`, {})).status, 201, "worker starts own task");
    assert.equal((await call("worker", "POST", `/v1/agro/tasks/${mine.data.task.id}/complete`, {})).status, 201, "worker completes own task");
    assert.equal((await call("worker", "POST", `/v1/agro/tasks/${supTask.data.task.id}/start`, {})).status, 403, "worker cannot run someone else's task");
    assert.equal((await call("worker", "POST", `/v1/agro/tasks/${openTask.data.task.id}/start`, {})).status, 201, "worker may take unassigned tasks");
    assert.equal((await call("worker", "POST", `/v1/agro/tasks/${openTask.data.task.id}/cancel`, {})).status, 403, "cancel is supervision");
    assert.equal((await call("sup", "POST", `/v1/agro/tasks/${openTask.data.task.id}/cancel`, { reason: "duplicada" })).status, 201);
    assert.equal((await call("stranger", "POST", `/v1/agro/tasks/${supTask.data.task.id}/start`, {})).status, 404);

    // ── Animales ────────────────────────────────────────────────────────────
    assert.equal((await call("worker", "POST", `/v1/agro/animals/${pig.id}/move`, { targetUnitId: unitB.id })).status, 201, "worker moves animals");
    assert.equal((await call("worker", "POST", `/v1/agro/animals/${pig.id}/weigh`, { weight: 42.5 })).status, 201, "worker weighs animals");
    assert.equal((await call("worker", "POST", `/v1/agro/animals/${pig.id}/status`, { status: "DEAD" })).status, 403, "status change is supervision/vet");
    assert.equal((await call("vet", "POST", `/v1/agro/animals/${pig.id}/status`, { status: "INACTIVE", reason: "cuarentena" })).status, 201);

    // ── Evidencia ───────────────────────────────────────────────────────────
    const supEv = await call("sup", "POST", `/v1/agro/farms/${farmId}/evidence`, { entityType: "ANIMAL", entityId: pig.id, mediaType: "NOTE", note: "Revisado" });
    assert.equal(supEv.status, 201, JSON.stringify(supEv.body));
    const workerEv = await call("worker", "POST", `/v1/agro/farms/${farmId}/evidence`, { entityType: "ANIMAL", entityId: pig.id, mediaType: "NOTE", note: "Pesado" });
    assert.equal(workerEv.status, 201);
    assert.equal((await call("worker", "PATCH", `/v1/agro/evidence/${supEv.data.evidence.id}`, { title: "x" })).status, 403, "worker cannot edit others' evidence");
    assert.equal((await call("worker", "PATCH", `/v1/agro/evidence/${workerEv.data.evidence.id}`, { title: "Pesaje C-1" })).status, 200, "worker edits own evidence");

    // ── Inventario ──────────────────────────────────────────────────────────
    assert.equal((await call("worker", "POST", `/v1/agro/farms/${farmId}/inventory/consume`, { itemId: feed.id, quantity: 5 })).status, 201, "worker records consumption");
    assert.equal((await call("worker", "POST", `/v1/agro/farms/${farmId}/inventory/consume`, { itemId: feed.id, quantity: 5, unitCost: 2 })).status, 403, "costed movements are supervision");
    assert.equal((await call("worker", "POST", `/v1/agro/farms/${farmId}/inventory/movements`, { itemId: feed.id, movementType: "IN", quantity: 100 })).status, 403, "stock entries are supervision");
    assert.equal((await call("sup", "POST", `/v1/agro/farms/${farmId}/inventory/movements`, { itemId: feed.id, movementType: "IN", quantity: 100 })).status, 201);

    // ── Dashboard: miembros sí, sin datos económicos ────────────────────────
    const workerDash = await call("worker", "GET", `/v1/agro/farms/${farmId}/dashboard`);
    assert.equal(workerDash.status, 200, JSON.stringify(workerDash.body));
    assert.equal(workerDash.data.dashboard?.monthCostSummary ?? workerDash.data.monthCostSummary, null);
    const ownerDash = await call("owner", "GET", `/v1/agro/farms/${farmId}/dashboard`);
    assert.notEqual(ownerDash.data.dashboard?.monthCostSummary ?? ownerDash.data.monthCostSummary, null);

    // ── Sync offline con la misma política ──────────────────────────────────
    const at = new Date().toISOString();
    const sync = await call("worker", "POST", "/v1/agro/sync/events", { events: [
      { clientEventId: uid("e"), farmId, action: "farm_task.complete", payload: { taskId: syncTask.data.task.id }, occurredAt: at },
      { clientEventId: uid("e"), farmId, action: "farm_task.complete", payload: { taskId: otherSyncTask.data.task.id }, occurredAt: at },
      { clientEventId: uid("e"), farmId, action: "farm_task.create", payload: { title: "offline" }, occurredAt: at },
      { clientEventId: uid("e"), farmId, action: "animal.weigh", payload: { animalId: pig.id, weight: 43 }, occurredAt: at },
    ] });
    assert.equal(sync.status, 201, JSON.stringify(sync.body));
    assert.deepEqual(sync.data.results.map((r: any) => r.status), ["SYNCED", "FAILED", "FAILED", "SYNCED"]);
    assert.match(sync.data.results[2].error, /Forbidden/);
    assert.equal((await prisma.agroFarmTask.findUnique({ where: { id: otherSyncTask.data.task.id } }))?.status, "PENDING", "someone else's task untouched");
    const strangerSync = await call("stranger", "POST", "/v1/agro/sync/events", { events: [
      { clientEventId: uid("e"), farmId, action: "animal.weigh", payload: { animalId: pig.id, weight: 1 }, occurredAt: at },
    ] });
    assert.equal(strangerSync.data.results[0].status, "FAILED");

    // ── Lectura por id: antes no comprobaba la finca (IDOR previo) ──────────
    for (const url of [
      `/v1/agro/animals/${pig.id}`, `/v1/agro/animal-groups/${group.id}`, `/v1/agro/tasks/${mine.data.task.id}`,
      `/v1/agro/evidence/${supEv.data.evidence.id}`, `/v1/agro/inventory/items/${feed.id}`,
    ]) {
      assert.equal((await call("stranger", "GET", url)).status, 404, `stranger GET ${url}`);
      assert.equal((await call("worker", "GET", url)).status, 200, `worker GET ${url}`);
    }

    // ── El propietario conserva todo ────────────────────────────────────────
    assert.equal((await call("owner", "PATCH", `/v1/agro/farms/${farmId}`, { notes: "ok" })).status, 200);
    assert.equal((await call("owner", "POST", `/v1/agro/tasks/${supTask.data.task.id}/cancel`, {})).status, 201);
  } finally {
    if (farmId) await prisma.agroFarm.deleteMany({ where: { id: farmId } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
    await prisma.$disconnect();
  }
});

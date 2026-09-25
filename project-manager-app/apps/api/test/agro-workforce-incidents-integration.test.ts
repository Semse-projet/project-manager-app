/**
 * E2E de API contra Postgres real (Agro Workforce + IncidentOps).
 *
 * Levanta una app Nest mínima con los controllers reales de AgroModule, el
 * RbacGuard global y el filtro de errores de producción, y ejercita por HTTP
 * (fastify.inject) los 10 pasos esenciales del spec:
 *   1 crear trabajador Agro · 2 asignar rol · 3 agregar capacidad ·
 *   4 verificar con evidencia · 5 crear incidencia desde móvil/API ·
 *   6 adjuntar evidencia · 7 relacionar animal/grupo · 8 relacionar JobTask ·
 *   9 resolver · 10 confirmar audit trail.
 *
 * Se salta sin DATABASE_URL (igual que el resto de *-integration.test.ts).
 * La auth es por headers x-user-id/x-roles (AUTH_SECRET sin definir).
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

  class AgroE2EModule {}
  // Sin sintaxis de decorador: --experimental-strip-types no la soporta.
  Module({
    imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AgroModule],
    providers: [{ provide: APP_GUARD, useClass: RbacGuard }],
  })(AgroE2EModule);

  const app = await NestFactory.create(AgroE2EModule, new FastifyAdapter(), { logger: false });
  app.useGlobalFilters(new HttpExceptionFilter(app.get(SemseLoggerService)));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

dbTest("agro E2E: workforce verification + incident lifecycle over HTTP with audit trail", async (t) => {
  const prisma = new PrismaClient();
  const app = await buildApp();
  const fastify = app.getHttpAdapter().getInstance();

  const tenantId = uid("ten");
  const users = {
    owner: uid("owner"), sup: uid("sup"), worker: uid("worker"), vet: uid("vet"), stranger: uid("stranger"),
  };
  let farmId = "";
  let jobTaskId = "";

  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Agro E2E" } });
  for (const id of Object.values(users)) {
    await prisma.user.create({ data: { id, email: `${id}@agro-e2e.test` } });
  }

  const call = async (as: keyof typeof users, roles: string, method: string, url: string, payload?: unknown) => {
    const res = await fastify.inject({
      method: method as any,
      url,
      headers: {
        "x-user-id": users[as], "x-tenant-id": tenantId, "x-org-id": "org_agro_e2e", "x-roles": roles,
        "content-type": "application/json",
      },
      ...(payload !== undefined && { payload: JSON.stringify(payload) }),
    });
    const body = res.body ? JSON.parse(res.body) : null;
    return { status: res.statusCode, data: body?.data, body };
  };

  try {
    // ── 1. Finca + trabajador Agro (membresía) ────────────────────────────────
    const farm = await call("owner", "CLIENT", "POST", "/v1/agro/farms", { name: "Granja E2E", operationType: "LIVESTOCK" });
    assert.equal(farm.status, 201, JSON.stringify(farm.body));
    farmId = farm.data.farm.id;
    const group = await prisma.agroAnimalGroup.create({ data: { farmId, name: "Lote 15", species: "PIG", count: 12 } });
    const unit = await prisma.agroFarmUnit.create({ data: { farmId, name: "Corral 8", type: "CORRAL" } });

    for (const [who, role] of [["sup", "SUPERVISOR"], ["worker", "WORKER"], ["vet", "VETERINARIAN"]] as const) {
      const r = await call("owner", "CLIENT", "POST", `/v1/agro/farms/${farmId}/members`, { userId: users[who], role, displayName: who });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    const ghost = await call("owner", "CLIENT", "POST", `/v1/agro/farms/${farmId}/members`, { userId: "no_such_user", role: "WORKER" });
    assert.equal(ghost.status, 404);
    const badRole = await call("owner", "CLIENT", "POST", `/v1/agro/farms/${farmId}/members`, { userId: users.worker, role: "KING" });
    assert.equal(badRole.status, 400, "invalid body is a 400, not a 500");
    const memberships = await call("worker", "WORKER", "GET", "/v1/agro/memberships");
    assert.equal(memberships.data.memberships[0].farm.id, farmId);

    // Catálogo sembrado por la migración
    const catalog = await call("worker", "WORKER", "GET", "/v1/agro/workforce/catalog");
    assert.equal(catalog.status, 200);
    assert.ok(catalog.data.roles.some((r: any) => r.key === "porcicultor"));
    const handling = catalog.data.capabilities.find((c: any) => c.key === "lechones_alimentacion");
    assert.equal(handling.parent.key, "lechones_manejo", "hierarchy seeded");
    const catalogAsWorker = await call("worker", "WORKER", "POST", "/v1/agro/workforce/catalog/capabilities", { key: "x_y", name: "x", category: "OTHER" });
    assert.equal(catalogAsWorker.status, 403, "catalog admin is OPS_ADMIN only");

    // ── 2. Asignar rol de oficio ─────────────────────────────────────────────
    const role = await call("sup", "PRO", "POST", `/v1/agro/farms/${farmId}/workers/${users.worker}/roles`, { role: "porcicultor", isPrimary: true });
    assert.equal(role.status, 201, JSON.stringify(role.body));

    // ── 3. Agregar capacidad (autodeclarada) ─────────────────────────────────
    const declared = await call("worker", "WORKER", "POST", `/v1/agro/farms/${farmId}/workers/me/capabilities`, { capability: "lechones_manejo", level: "INTERMEDIATE" });
    assert.equal(declared.status, 201, JSON.stringify(declared.body));
    const wcId = declared.data.workerCapability.id;
    assert.equal(declared.data.workerCapability.status, "SELF_REPORTED");

    // ── 4. Verificar con evidencia ───────────────────────────────────────────
    const selfVerify = await call("worker", "WORKER", "POST", `/v1/agro/farms/${farmId}/worker-capabilities/${wcId}/verify`, { result: "APPROVED", method: "DIRECT_OBSERVATION" });
    assert.equal(selfVerify.status, 403, "WORKER lacks agro:workforce:verify");
    const ev = await call("sup", "PRO", "POST", `/v1/agro/farms/${farmId}/worker-capabilities/${wcId}/evidence`, { mediaType: "PHOTO", fileUrl: "https://example.test/lechones.jpg", title: "Manejo en maternidad" });
    assert.equal(ev.status, 201, JSON.stringify(ev.body));
    const noEvidence = await call("sup", "PRO", "POST", `/v1/agro/farms/${farmId}/worker-capabilities/${wcId}/verify`, { result: "APPROVED", method: "DIRECT_OBSERVATION" });
    assert.equal(noEvidence.status, 400);
    const verified = await call("sup", "PRO", "POST", `/v1/agro/farms/${farmId}/worker-capabilities/${wcId}/verify`, {
      result: "APPROVED", method: "DIRECT_OBSERVATION", levelAssessed: "ADVANCED", evidenceIds: [ev.data.evidence.id], notes: "Observado 3 turnos",
    });
    assert.equal(verified.status, 201, JSON.stringify(verified.body));
    assert.equal(verified.data.workerCapability.status, "VERIFIED");
    assert.equal(verified.data.verification.verifierFarmRole, "SUPERVISOR");

    // Capacidad profesional: el supervisor no puede, la veterinaria sí
    const vacc = await call("worker", "WORKER", "POST", `/v1/agro/farms/${farmId}/workers/me/capabilities`, { capability: "vacunacion_aplicacion" });
    const vaccEv = await call("vet", "PRO", "POST", `/v1/agro/farms/${farmId}/worker-capabilities/${vacc.data.workerCapability.id}/evidence`, { mediaType: "DOCUMENT", fileUrl: "https://example.test/cert.pdf" });
    const supVacc = await call("sup", "PRO", "POST", `/v1/agro/farms/${farmId}/worker-capabilities/${vacc.data.workerCapability.id}/verify`, { result: "APPROVED", method: "CERTIFICATE", evidenceIds: [vaccEv.data.evidence.id] });
    assert.equal(supVacc.status, 403);
    const vetVacc = await call("vet", "PRO", "POST", `/v1/agro/farms/${farmId}/worker-capabilities/${vacc.data.workerCapability.id}/verify`, { result: "APPROVED", method: "CERTIFICATE", evidenceIds: [vaccEv.data.evidence.id] });
    assert.equal(vetVacc.status, 201, JSON.stringify(vetVacc.body));
    assert.ok(vetVacc.data.workerCapability.expiresAt, "validityDays sets expiry");

    const profile = await call("sup", "PRO", "GET", `/v1/agro/farms/${farmId}/workers/${users.worker}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.data.roles[0].role.key, "porcicultor");
    const cap = profile.data.capabilities.find((c: any) => c.capability.key === "lechones_manejo");
    assert.equal(cap.status, "VERIFIED");
    assert.equal(cap.level, "ADVANCED");
    assert.equal(cap.lastVerification.verifierId, users.sup);
    assert.equal(cap.verifications[0].evidence[0].id, ev.data.evidence.id);
    const matrixAsWorker = await call("worker", "WORKER", "GET", `/v1/agro/farms/${farmId}/workforce/matrix`);
    assert.deepEqual(matrixAsWorker.data.workers.map((w: any) => w.userId), [users.worker]);
    const strangerProfile = await call("stranger", "WORKER", "GET", `/v1/agro/farms/${farmId}/workers/${users.worker}`);
    assert.equal(strangerProfile.status, 404, "non-members cannot see the farm");

    // ── 5. Incidencia desde móvil/API ────────────────────────────────────────
    const report = {
      type: "ANIMAL_INJURY", title: "Cerdito con herida en el cachete", source: "MOBILE", clientEventId: uid("evt"),
      farmUnitId: unit.id, evidence: [{ mediaType: "NOTE", note: "Visto al alimentar" }],
    };
    const created = await call("worker", "WORKER", "POST", `/v1/agro/farms/${farmId}/incidents`, report);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const incidentId = created.data.incident.id;
    assert.equal(created.data.incident.severityConfirmed, false);
    const retry = await call("worker", "WORKER", "POST", `/v1/agro/farms/${farmId}/incidents`, report);
    assert.equal(retry.data.duplicate, true, "offline retry is idempotent");
    assert.equal(retry.data.incident.id, incidentId);

    // ── 6. Adjuntar evidencia ────────────────────────────────────────────────
    const photo = await call("worker", "WORKER", "POST", `/v1/agro/incidents/${incidentId}/evidence`, { mediaType: "PHOTO", fileUrl: "https://example.test/herida.jpg" });
    assert.equal(photo.status, 201, JSON.stringify(photo.body));
    const audioNoFile = await call("worker", "WORKER", "POST", `/v1/agro/incidents/${incidentId}/evidence`, { mediaType: "AUDIO" });
    assert.equal(audioNoFile.status, 400);

    // ── 7. Relacionar grupo + clasificar ────────────────────────────────────
    const workerTriage = await call("worker", "WORKER", "PATCH", `/v1/agro/incidents/${incidentId}`, { severity: "HIGH" });
    assert.equal(workerTriage.status, 403);
    const classified = await call("sup", "PRO", "PATCH", `/v1/agro/incidents/${incidentId}`, { animalGroupId: group.id, severity: "HIGH", severityReason: "Herida abierta" });
    assert.equal(classified.status, 200, JSON.stringify(classified.body));
    assert.equal(classified.data.incident.animalGroup.name, "Lote 15");
    assert.equal(classified.data.incident.severityConfirmed, true);
    const triaged = await call("sup", "PRO", "POST", `/v1/agro/incidents/${incidentId}/transition`, { to: "TRIAGED" });
    assert.equal(triaged.status, 201, JSON.stringify(triaged.body));

    // ── 8. Relacionar JobTask canónica (domain = agro) ──────────────────────
    const jobTask = await prisma.jobTask.create({
      data: { tenantId, title: "Curar lechón lote 15", createdBy: users.sup, domain: "agro", vertical: "agro", farmId, taskType: "TREATMENT", status: "pending" },
    });
    jobTaskId = jobTask.id;
    const linked = await call("sup", "PRO", "POST", `/v1/agro/incidents/${incidentId}/task`, { task: { source: "JOB_TASK", id: jobTask.id } });
    assert.equal(linked.status, 201, JSON.stringify(linked.body));
    const foreignTask = await call("sup", "PRO", "POST", `/v1/agro/incidents/${incidentId}/task`, { task: { source: "AGRO_FARM_TASK", id: "nope" } });
    assert.equal(foreignTask.status, 404);

    // ── 9. Resolver (responsable) y cerrar (supervisión) ────────────────────
    const assigned = await call("sup", "PRO", "POST", `/v1/agro/incidents/${incidentId}/assign`, { assignedToId: users.worker });
    assert.equal(assigned.status, 201);
    await call("vet", "PRO", "POST", `/v1/agro/incidents/${incidentId}/comments`, { body: "Lesión superficial; limpiar y revisar en 48 h", kind: "ASSESSMENT" });
    const supAssess = await call("sup", "PRO", "POST", `/v1/agro/incidents/${incidentId}/comments`, { body: "x", kind: "ASSESSMENT" });
    assert.equal(supAssess.status, 403);
    assert.equal((await call("worker", "WORKER", "POST", `/v1/agro/incidents/${incidentId}/transition`, { to: "IN_PROGRESS" })).status, 201);
    assert.equal((await call("worker", "WORKER", "POST", `/v1/agro/incidents/${incidentId}/transition`, { to: "RESOLVED" })).status, 400);
    const resolved = await call("worker", "WORKER", "POST", `/v1/agro/incidents/${incidentId}/transition`, { to: "RESOLVED", resolution: "Limpieza, spray cicatrizante y separación del lote" });
    assert.equal(resolved.status, 201);
    assert.equal((await call("worker", "WORKER", "POST", `/v1/agro/incidents/${incidentId}/transition`, { to: "CLOSED" })).status, 403);
    const closed = await call("sup", "PRO", "POST", `/v1/agro/incidents/${incidentId}/transition`, { to: "CLOSED" });
    assert.equal(closed.data.incident.status, "CLOSED");
    const jumped = await call("sup", "PRO", "POST", `/v1/agro/incidents/${incidentId}/transition`, { to: "TRIAGED" });
    assert.equal(jumped.status, 409);

    // ── 10. Audit trail ─────────────────────────────────────────────────────
    const detail = await call("worker", "WORKER", "GET", `/v1/agro/incidents/${incidentId}`);
    assert.equal(detail.status, 200);
    const actions = detail.data.timeline.map((e: any) => e.action);
    for (const expected of [
      "incident.created", "incident.evidence_added", "incident.severity_changed", "incident.relations_changed",
      "incident.triaged", "incident.task_linked", "incident.assigned", "incident.assessment_added",
      "incident.started", "incident.resolved", "incident.closed",
    ]) {
      assert.ok(actions.includes(expected), `timeline missing ${expected}: ${actions.join(", ")}`);
    }
    assert.equal(detail.data.relatedTask.source, "JOB_TASK");
    assert.equal(detail.data.evidence.length, 2, "note + photo");
    assert.equal(detail.data.incident.animalGroup.id, group.id);

    const capAudit = await prisma.agroAuditEvent.findMany({ where: { farmId, entityType: "AgroWorkerCapability", entityId: wcId }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(capAudit.map((e) => e.action), ["capability.declared", "capability.verified"]);
    assert.equal(capAudit[1].actorId, users.sup);
    const summary = await call("sup", "PRO", "GET", `/v1/agro/farms/${farmId}/incidents/summary`);
    assert.equal(summary.data.byStatus.CLOSED, 1);
    const search = await call("sup", "PRO", "GET", `/v1/agro/farms/${farmId}/incidents?q=cachete&status=CLOSED`);
    assert.equal(search.data.incidents.length, 1);
  } finally {
    if (jobTaskId) await prisma.jobTask.deleteMany({ where: { id: jobTaskId } });
    const ids = Object.values(users);
    await prisma.agroCapabilityVerification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.agroWorkerCapability.deleteMany({ where: { userId: { in: ids } } });
    await prisma.agroWorkerRole.deleteMany({ where: { userId: { in: ids } } });
    if (farmId) await prisma.agroFarm.deleteMany({ where: { id: farmId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
    await prisma.$disconnect();
  }
});

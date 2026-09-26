/**
 * T-052 — agro.incident.created/resolved y agro.worker_capability.verified
 * llegan a Notifications (spec docs/specs/agro/agro-domain-events.spec.md).
 *
 * `NotificationsService.handleEvent()` es el consumidor real que
 * `DomainEventBus.emit()` invoca (fire-and-forget) para cualquier evento —
 * el mismo mecanismo ya usado por dispute.opened/resolved. Este test llama a
 * `handleEvent()` directamente contra Postgres real, sin cargar
 * `DomainEventsModule`/`NotificationsModule` (ver
 * agro-domain-events-integration.test.ts para por qué: DomainEventsModule
 * tiene una dependencia circular ESM entre sus propios módulos — Jobs ↔
 * DomainEvents — que solo el árbol completo de AppModule resuelve; cargarlo
 * aislado revienta con "Cannot access 'DomainEventsModule' before
 * initialization" incluso sin Agro de por medio). Construir
 * `NotificationsService` a mano (solo necesita `NotificationsRepository`,
 * el resto son colaboradores `@Optional()`) prueba el código de producción
 * real (`mapEventToNotifications`, no exportado, solo se ejercita a través de
 * `handleEvent`) sin la cadena Agents/AiModels/Matching.
 *
 * E2E contra Postgres real. Se salta sin DATABASE_URL.
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

async function buildNotificationsService() {
  const { ConfigService } = await import("@nestjs/config");
  const { PrismaService } = await import("../dist/infrastructure/prisma/prisma.service.js");
  const { NotificationsRepository } = await import("../dist/modules/notifications/notifications.repository.js");
  const { NotificationsService } = await import("../dist/modules/notifications/notifications.service.js");

  const configService = new ConfigService({ DATABASE_URL: process.env.DATABASE_URL });
  const prisma = new PrismaService(configService);
  const repository = new NotificationsRepository(prisma);
  const service = new NotificationsService(repository);
  return { service, prisma };
}

dbTest("agro T-052: agro.* events map to the right Notification recipient/type via NotificationsService.handleEvent", async () => {
  const { service, prisma } = await buildNotificationsService();

  const tenantId = uid("ten");
  const users = { owner: uid("owner"), worker: uid("worker"), supervisor: uid("sup") };

  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Agro T-052 notifications" } });
  for (const id of Object.values(users)) await prisma.user.create({ data: { id, email: `${id}@agro-t052-notif.test` } });

  try {
    // ── agro.incident.created: notifica al assignee (si difiere del reportante)
    // y al dueño de la finca (si difiere de ambos) ────────────────────────────
    await service.handleEvent({
      tenantId, eventType: "agro.incident.created",
      payload: {
        incidentId: "inc_1", farmId: "farm_1", severity: "HIGH", title: "Vaca renga",
        reportedById: users.worker, assignedToId: users.supervisor, ownerId: users.owner,
      },
    });

    const assignedNotif = await prisma.notification.findFirst({ where: { tenantId, userId: users.supervisor, type: "agro_incident_assigned" } });
    assert.ok(assignedNotif, "assignee must be notified");
    assert.equal((assignedNotif!.payload as any).incidentId, "inc_1");

    const ownerNotif = await prisma.notification.findFirst({ where: { tenantId, userId: users.owner, type: "agro_incident_reported" } });
    assert.ok(ownerNotif, "farm owner must be notified when they are neither reporter nor assignee");

    const reporterSelfNotif = await prisma.notification.findFirst({ where: { tenantId, userId: users.worker } });
    assert.equal(reporterSelfNotif, null, "the reporter must not be notified of their own report");

    // ── agro.incident.resolved: notifica al reportante, no a quien resuelve ──
    await service.handleEvent({
      tenantId, eventType: "agro.incident.resolved",
      payload: { incidentId: "inc_1", farmId: "farm_1", resolvedById: users.supervisor, resolution: "Se atendió al animal", reportedById: users.worker },
    });
    const resolvedNotif = await prisma.notification.findFirst({ where: { tenantId, userId: users.worker, type: "agro_incident_resolved" } });
    assert.ok(resolvedNotif, "reporter must be notified when their incident is resolved");
    assert.equal((resolvedNotif!.payload as any).resolution, "Se atendió al animal");

    const resolverSelfNotif = await prisma.notification.findFirst({ where: { tenantId, userId: users.supervisor, type: "agro_incident_resolved" } });
    assert.equal(resolverSelfNotif, null, "whoever resolves it is not notified of their own resolution");

    // ── agro.incident.resolved: reporter === resolver → sin notificación ─────
    await service.handleEvent({
      tenantId, eventType: "agro.incident.resolved",
      payload: { incidentId: "inc_2", farmId: "farm_1", resolvedById: users.worker, resolution: "Autoresuelto", reportedById: users.worker },
    });
    const selfResolvedCount = await prisma.notification.count({ where: { tenantId, payload: { path: ["incidentId"], equals: "inc_2" } } });
    assert.equal(selfResolvedCount, 0);

    // ── agro.worker_capability.verified: notifica al trabajador, no al verificador ──
    await service.handleEvent({
      tenantId, eventType: "agro.worker_capability.verified",
      payload: { workerCapabilityId: "wc_1", farmId: "farm_1", workerId: users.worker, capabilityKey: "lechones_alimentacion", level: "BASIC", verifiedById: users.supervisor },
    });
    const capNotif = await prisma.notification.findFirst({ where: { tenantId, userId: users.worker, type: "agro_capability_verified" } });
    assert.ok(capNotif, "worker must be notified their capability was verified");
    assert.equal((capNotif!.payload as any).capabilityKey, "lechones_alimentacion");

    const verifierSelfNotif = await prisma.notification.findFirst({ where: { tenantId, userId: users.supervisor, type: "agro_capability_verified" } });
    assert.equal(verifierSelfNotif, null, "the verifier is not notified of their own verification");
  } finally {
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  }
});

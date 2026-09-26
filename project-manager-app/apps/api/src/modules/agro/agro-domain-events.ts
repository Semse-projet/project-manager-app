/**
 * Eventos de dominio `agro.*` (T-052, docs/foundation/EVENT_CATALOG.md §Agro).
 *
 * Sigue el mismo mecanismo ya usado por disputes/jobs/payments/milestones:
 * `DomainEventBus.emit()` (schema legacy sin versión, `packages/schemas/src/
 * domain-events.schema.ts`), no el envelope v2 + `DomainOutboxEvent` (ese
 * track está reservado hoy a evidence/jobs-bids/satellite-webhooks). Es la
 * ruta real por la que Notifications ya consume `dispute.opened/resolved`.
 *
 * `DomainEventBus.emit()` exige `tenantId`/`orgId` no nulos (los usa para
 * auto-provisionar Tenant/Org vía ActorContextService antes de escribir el
 * AuditLog). Agro no tiene concepto de Org — se sintetiza uno estable por
 * finca (`agro:<farmId>`), igual de válido para ActorContextService.ensureOrg
 * que cualquier otro id nuevo (hace upsert, no exige que preexista).
 *
 * Sin tenant en la finca (T-051: `AgroFarm.tenantId` es opcional), no hay
 * evento cruzado — mismo criterio que el espejo a JobTask
 * (agro-jobtask-mirror.ts): `AgroAuditEvent` sigue siendo el único registro.
 */
import type { DomainEventBus } from "../domain-events/domain-event-bus.service.js";

export function agroOrgId(farmId: string): string {
  return `agro:${farmId}`;
}

type FarmContext = { tenantId: string | null; ownerId: string | null };

async function emit(
  bus: DomainEventBus | undefined,
  farmId: string,
  farm: FarmContext | null,
  actorId: string,
  event: { type: string; correlationId: string; payload: Record<string, unknown> },
): Promise<void> {
  if (!bus || !farm?.tenantId) return;
  await bus.emit({
    type: event.type,
    meta: { correlationId: event.correlationId },
    payload: event.payload,
    triggers: ["notification", "audit"],
  }, {
    tenantId: farm.tenantId,
    orgId: agroOrgId(farmId),
    userId: actorId,
    requestId: event.correlationId,
  });
}

export async function emitAgroIncidentCreated(
  bus: DomainEventBus | undefined,
  farm: FarmContext | null,
  actorId: string,
  incident: { id: string; farmId: string; type: string; severity: string; title: string; reportedById: string; assignedToId: string | null },
): Promise<void> {
  await emit(bus, incident.farmId, farm, actorId, {
    type: "agro.incident.created",
    correlationId: `agro-incident:${incident.id}:created`,
    payload: {
      incidentId: incident.id,
      farmId: incident.farmId,
      type: incident.type,
      severity: incident.severity,
      title: incident.title,
      reportedById: incident.reportedById,
      ...(incident.assignedToId && { assignedToId: incident.assignedToId }),
      ...(farm?.ownerId && { ownerId: farm.ownerId }),
    },
  });
}

export async function emitAgroIncidentResolved(
  bus: DomainEventBus | undefined,
  farm: FarmContext | null,
  actorId: string,
  incident: { id: string; farmId: string; resolution: string; reportedById: string; assignedToId: string | null },
): Promise<void> {
  await emit(bus, incident.farmId, farm, actorId, {
    type: "agro.incident.resolved",
    correlationId: `agro-incident:${incident.id}:resolved`,
    payload: {
      incidentId: incident.id,
      farmId: incident.farmId,
      resolvedById: actorId,
      resolution: incident.resolution,
      reportedById: incident.reportedById,
      ...(incident.assignedToId && { assignedToId: incident.assignedToId }),
    },
  });
}

export async function emitAgroWorkerCapabilityVerified(
  bus: DomainEventBus | undefined,
  farm: FarmContext | null,
  actorId: string,
  verification: { workerCapabilityId: string; farmId: string; workerId: string; capabilityKey: string; level: string },
): Promise<void> {
  await emit(bus, verification.farmId, farm, actorId, {
    type: "agro.worker_capability.verified",
    correlationId: `agro-capability:${verification.workerCapabilityId}:verified`,
    payload: {
      workerCapabilityId: verification.workerCapabilityId,
      farmId: verification.farmId,
      workerId: verification.workerId,
      capabilityKey: verification.capabilityKey,
      level: verification.level,
      verifiedById: actorId,
    },
  });
}

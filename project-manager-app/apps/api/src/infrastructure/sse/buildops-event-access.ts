import type { RequestContext } from "../../common/request-context.js";
import { hasPermission } from "../../common/rbac.js";
import { assertChangeOrderLinksAccessible } from "../../modules/change-orders/change-order-resource-access.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { SseEvent } from "./sse-event-bus.service.js";

const EVENT_ACCESS: Record<string, { permission: string; resource: "milestone" | "buildops" | "change-order" | "signal"; key: string }> = {
  "milestone:updated": { permission: "milestones:read", resource: "milestone", key: "milestoneId" },
  "evidence-item:updated": { permission: "evidence:read", resource: "milestone", key: "milestoneId" },
  "evidence-item:reviewed": { permission: "evidence:read", resource: "milestone", key: "milestoneId" },
  "evidence-item:archived": { permission: "evidence:read", resource: "milestone", key: "milestoneId" },
  "evidence-item:replaced": { permission: "evidence:read", resource: "milestone", key: "milestoneId" },
  "change-order:updated": { permission: "change-orders:read", resource: "change-order", key: "changeOrderId" },
  "change-order:applied": { permission: "change-orders:read", resource: "change-order", key: "changeOrderId" },
  "buildops-plan-approved": { permission: "projects:read", resource: "buildops", key: "buildOpsProjectId" },
  "buildops-plan-changes-requested": { permission: "projects:read", resource: "buildops", key: "buildOpsProjectId" },
  "buildops-plan-rejected": { permission: "projects:read", resource: "buildops", key: "buildOpsProjectId" },
  "buildops-plan-unapproved": { permission: "projects:read", resource: "buildops", key: "buildOpsProjectId" },
  "buildops-plan-rerun-completed": { permission: "projects:read", resource: "buildops", key: "buildOpsProjectId" },
  "operational-signal:created": { permission: "ops:dashboard:read", resource: "signal", key: "id" },
};

/** Resolve current ownership from persistence for each event, never from org claims in a payload. */
export async function canReadBuildOpsEvent(
  prisma: PrismaService,
  actor: RequestContext,
  event: SseEvent,
): Promise<boolean> {
  const access = Object.hasOwn(EVENT_ACCESS, event.event) ? EVENT_ACCESS[event.event] : undefined;
  if (!access || !hasPermission(actor.roles, "projects:read") || !hasPermission(actor.roles, access.permission)) return false;
  if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) return false;
  const id = (event.data as Record<string, unknown>)[access.key];
  if (typeof id !== "string" || !id.trim()) return false;

  if (access.resource === "signal") {
    // Operational signals follow the existing ops REST boundary, within this tenant.
    return Boolean(await prisma.operationalSignal.findFirst({
      where: { id, tenantId: actor.tenantId }, select: { id: true },
    }));
  }

  if (access.resource === "change-order") {
    const candidate = await prisma.changeOrderCandidate.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { jobId: true, milestoneId: true, buildOpsProjectId: true },
    });
    if (!candidate) return false;
    if (!actor.roles.includes("OPS_ADMIN")) {
      await assertChangeOrderLinksAccessible(prisma, actor, candidate);
    }
    return true;
  }

  // BuildOps plan events historically carry a BuildOps ID in jobId too;
  // the authoritative identifier is buildOpsProjectId for that event family.
  await assertChangeOrderLinksAccessible(
    prisma, actor,
    access.resource === "milestone" ? { milestoneId: id } : { buildOpsProjectId: id },
  );
  return true;
}

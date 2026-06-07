import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { SemseEvent } from "@semse/schemas";

const MANUAL_EMIT_ALLOWLIST = new Set<SemseEvent["type"]>([
  "risk.flag_raised",
  "risk.recalculated",
  "policy.triggered",
  "agent.action_logged",
  "agent.human_review_requested"
]);

function resolveTenantId(event: SemseEvent): string {
  return event.meta.tenantId;
}

export function assertDomainEventEmittable(input: {
  event: SemseEvent;
  tenantId: string;
  roles: string[];
}) {
  if (!MANUAL_EMIT_ALLOWLIST.has(input.event.type)) {
    throw new ForbiddenException({
      message: "Manual emit not allowed for this domain event type",
      type: input.event.type
    });
  }

  if (resolveTenantId(input.event) !== input.tenantId) {
    throw new BadRequestException({
      message: "Event tenantId must match actor tenant",
      type: input.event.type
    });
  }

  if (input.event.meta.actorType === "system") {
    throw new BadRequestException({
      message: "Manual emit cannot impersonate system actorType",
      type: input.event.type
    });
  }

  if (!input.roles.includes("OPS_ADMIN")) {
    throw new ForbiddenException({
      message: "Manual domain-event emit requires OPS_ADMIN role",
      type: input.event.type
    });
  }
}

export function listManualEmitTypes(): SemseEvent["type"][] {
  return [...MANUAL_EMIT_ALLOWLIST];
}

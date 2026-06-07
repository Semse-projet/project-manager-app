import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { semseEventSchema } from "@semse/schemas";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { AgentTriggerRouter } from "./agent-trigger-router.service.js";

type EmitContext = {
  tenantId: string;
  orgId: string;
  userId: string;
  requestId: string;
};

type RuntimeDomainEvent = {
  type: string;
  meta: { correlationId: string };
  payload: Record<string, unknown>;
  triggers: string[];
};

const MAX_ROUTER_ATTEMPTS = 3;
const RETRY_BASE_MS = 200;

@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly agentTriggerRouter: AgentTriggerRouter,
    private readonly notificationsService: NotificationsService,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
  ) {}

  async emit(event: unknown, context: EmitContext) {
    const parsed = semseEventSchema.parse(event) as RuntimeDomainEvent;

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: context.tenantId,
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "domain.event.emit",
      entityType: "DomainEvent",
      entityId: `${parsed.type}:${parsed.meta.correlationId}`,
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        type: parsed.type,
        meta: parsed.meta,
        triggers: parsed.triggers,
        payload: parsed.payload
      }
    });

    // Fire notifications best-effort — never block the event flow
    void this.notificationsService.handleEvent({
      tenantId: context.tenantId,
      eventType: parsed.type,
      payload: parsed.payload,
    }).catch((error) => {
      this.logger.warn({ eventType: parsed.type, error }, "notification handler error — skipped");
    });

    this.invalidateOperationalContext(parsed, context);

    return this.routeWithRetry(parsed, context);
  }

  private invalidateOperationalContext(parsed: RuntimeDomainEvent, context: EmitContext): void {
    const projectId = typeof parsed.payload.projectId === "string" ? parsed.payload.projectId : undefined;
    this.operationalContext?.invalidateScope({
      tenantId: context.tenantId,
      projectId,
      source: parsed.type,
      reason: "domain event emitted",
    });
  }

  private async routeWithRetry(parsed: RuntimeDomainEvent, context: EmitContext) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ROUTER_ATTEMPTS; attempt++) {
      try {
        return await this.agentTriggerRouter.route(parsed, context);
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ROUTER_ATTEMPTS) {
          const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
          this.logger.warn(
            { eventType: parsed.type, correlationId: parsed.meta.correlationId, attempt, delay },
            "agent trigger router failed, retrying"
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(
      { eventType: parsed.type, correlationId: parsed.meta.correlationId, error: lastError },
      "agent trigger router failed after all retries — event triggers dropped"
    );

    return [];
  }
}

import { Injectable } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { entityIdMatchesExactCorrelation } from "./domain-event-correlation.js";

export type DomainEventAuditRow = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  afterJson: unknown;
  occurredAt: Date;
};

export type DomainEventAgentRunRow = {
  id: string;
  agentType: string;
  triggerType: string;
  status: string;
  correlationId: string;
  workerId: string | null;
  attempts: number;
  maxAttempts: number;
  deadLettered: boolean;
  requiresHumanReview: boolean;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
};

type ActorInput = {
  tenantId: string;
  orgId: string;
  userId: string;
};

@Injectable()
export class DomainEventsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async listDomainEventAuditRows(input: ActorInput & { limit: number }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.auditLog.findMany({
      where: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        action: "domain.event.emit",
        entityType: "DomainEvent"
      },
      orderBy: { occurredAt: "desc" },
      take: input.limit
    }) as Promise<DomainEventAuditRow[]>;
  }

  async listDomainEventAuditRowsByCorrelationId(input: ActorInput & { correlationId: string }) {
    await this.actorContextService.ensureActorContext(input);

    const rows = await this.prisma.$queryRaw<DomainEventAuditRow[]>`
      SELECT id, "actorUserId", action, "entityType", "entityId", "afterJson", "occurredAt"
      FROM "AuditLog"
      WHERE "tenantId" = ${input.tenantId}
        AND "orgId" = ${input.orgId}
        AND action = 'domain.event.emit'
        AND "entityType" = 'DomainEvent'
        AND position(':' in "entityId") > 1
        AND substring("entityId" from position(':' in "entityId") + 1) = ${input.correlationId}
      ORDER BY "occurredAt" ASC
      LIMIT 50
    `;
    return rows.filter((row) => entityIdMatchesExactCorrelation(row.entityId, input.correlationId));
  }

  async listAgentRunsByCorrelationId(input: ActorInput & { correlationId: string }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.agentRun.findMany({
      where: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        correlationId: input.correlationId
      },
      orderBy: { createdAt: "asc" }
    }) as Promise<DomainEventAgentRunRow[]>;
  }

  async listOutboxByCorrelationId(input: ActorInput & { correlationId: string }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.domainOutboxEvent.findMany({
      where: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        correlationId: input.correlationId,
      },
      select: {
        eventId: true,
        eventType: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        replayCount: true,
        recordedAt: true,
        publishedAt: true,
        lastError: true,
      },
      orderBy: [{ recordedAt: "asc" }, { eventId: "asc" }],
    });
  }

  async listConsumptionsByEventIds(input: ActorInput & { eventIds: string[] }) {
    if (input.eventIds.length === 0) {
      return [];
    }
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.domainEventConsumption.findMany({
      where: {
        tenantId: input.tenantId,
        eventId: { in: input.eventIds },
      },
      select: {
        eventId: true,
        consumerName: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        replayCount: true,
        completedAt: true,
        lastError: true,
      },
      orderBy: { consumerName: "asc" },
    });
  }

  async listTimelineRows(input: ActorInput & { correlationId: string; runIds: string[] }) {
    // Agent-run history is authorized by the org-scoped AgentRun IDs already
    // resolved for this actor. Do not also filter these AuditLog rows by
    // AuditLog.orgId: the finalization consumer still writes them without an
    // organization, so an orgId predicate would hide legitimate history.
    // A correlationId alone is not an authorization capability.
    if (input.runIds.length === 0) return [];
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.auditLog.findMany({
      where: {
        tenantId: input.tenantId,
        entityType: "AgentRun",
        entityId: { in: input.runIds }
      },
      orderBy: { occurredAt: "asc" },
      take: 200
    }) as Promise<DomainEventAuditRow[]>;
  }
}

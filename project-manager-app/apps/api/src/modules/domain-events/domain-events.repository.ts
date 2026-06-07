import { Injectable } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

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
        action: "domain.event.emit",
        entityType: "DomainEvent"
      },
      orderBy: { occurredAt: "desc" },
      take: input.limit
    }) as Promise<DomainEventAuditRow[]>;
  }

  async listDomainEventAuditRowsByCorrelationId(input: ActorInput & { correlationId: string }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.auditLog.findMany({
      where: {
        tenantId: input.tenantId,
        action: "domain.event.emit",
        entityType: "DomainEvent",
        entityId: { contains: input.correlationId }
      },
      orderBy: { occurredAt: "asc" },
      take: 50
    }) as Promise<DomainEventAuditRow[]>;
  }

  async listAgentRunsByCorrelationId(input: ActorInput & { correlationId: string }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.agentRun.findMany({
      where: {
        tenantId: input.tenantId,
        correlationId: input.correlationId
      },
      orderBy: { createdAt: "asc" }
    }) as Promise<DomainEventAgentRunRow[]>;
  }

  async listTimelineRows(input: ActorInput & { correlationId: string; runIds: string[] }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.auditLog.findMany({
      where: {
        tenantId: input.tenantId,
        OR: [
          { entityId: { contains: input.correlationId } },
          ...(input.runIds.length > 0 ? [{ entityId: { in: input.runIds } }] : [])
        ]
      },
      orderBy: { occurredAt: "asc" },
      take: 200
    }) as Promise<DomainEventAuditRow[]>;
  }
}

import { Injectable } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type OpsAuditRow = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson?: unknown;
  afterJson: unknown;
  occurredAt: Date;
};

export type OpsAgentRunRow = {
  id: string;
  agentType: string;
  triggerType: string;
  status: string;
  correlationId: string;
  workerId: string | null;
  attempts: number;
  maxAttempts: number;
  deadLettered: boolean;
  inputJson: unknown;
  outputJson: unknown;
  error: string | null;
  startedAt: Date | null;
  heartbeatAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  inputSummary: string | null;
  outputSummary: string | null;
  requiresHumanReview: boolean;
};

export type OpsRiskScoreRow = {
  id: string;
  subjectType: string;
  subjectId: string;
  score: { toNumber(): number } | number;
  modelVersion: string;
  factorsJson: unknown;
  computedAt: Date;
};

export type OpsCountGroupRow = {
  status: string;
  _count: {
    _all: number;
  };
};

export type OpsRecentJobRow = {
  id: string;
  status: string;
};

type ActorInput = {
  tenantId: string;
  orgId: string;
  userId: string;
};

@Injectable()
export class OpsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async listAuditEntries(input: ActorInput & { limit?: number }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.auditLog.findMany({
      where: { tenantId: input.tenantId },
      orderBy: { occurredAt: "desc" },
      take: input.limit ?? 100
    }) as Promise<OpsAuditRow[]>;
  }

  async listAgentRuns(input: ActorInput & {
    correlationId?: string;
    agentType?: string;
    triggerType?: string;
    limit: number;
  }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.agentRun.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.correlationId ? { correlationId: input.correlationId } : {}),
        ...(input.agentType ? { agentType: input.agentType } : {}),
        ...(input.triggerType ? { triggerType: input.triggerType } : {})
      },
      orderBy: { createdAt: "desc" },
      take: input.limit
    }) as Promise<OpsAgentRunRow[]>;
  }

  async listAgentRunsByCorrelationId(input: ActorInput & { correlationId: string }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.agentRun.findMany({
      where: {
        tenantId: input.tenantId,
        correlationId: input.correlationId
      },
      orderBy: { createdAt: "asc" }
    }) as Promise<OpsAgentRunRow[]>;
  }

  async listAuditRowsForRuntimeTrace(input: ActorInput & { correlationId: string; runIds: string[] }) {
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
    }) as Promise<OpsAuditRow[]>;
  }

  async listRiskScores(input: ActorInput & { limit?: number }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.riskScore.findMany({
      where: { tenantId: input.tenantId },
      orderBy: { computedAt: "desc" },
      take: input.limit ?? 50
    }) as Promise<OpsRiskScoreRow[]>;
  }

  async dashboardGroups(input: ActorInput) {
    await this.actorContextService.ensureActorContext(input);

    const [jobs, projects, disputes, agentStatuses, deadLettered, maxAttemptsReached] = await Promise.all([
      this.prisma.job.groupBy({
        by: ["status"],
        where: { tenantId: input.tenantId, deletedAt: null },
        _count: { _all: true }
      }),
      this.prisma.project.groupBy({
        by: ["status"],
        where: { tenantId: input.tenantId },
        _count: { _all: true }
      }),
      this.prisma.dispute.groupBy({
        by: ["status"],
        where: { tenantId: input.tenantId, deletedAt: null },
        _count: { _all: true }
      }),
      this.prisma.agentRun.groupBy({
        by: ["status"],
        where: { tenantId: input.tenantId },
        _count: { _all: true }
      }),
      this.prisma.agentRun.count({
        where: {
          tenantId: input.tenantId,
          deadLettered: true
        }
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "AgentRun"
        WHERE "tenantId" = ${input.tenantId}
          AND "attempts" >= "maxAttempts"
      `
    ]);

    return {
      jobs: jobs as OpsCountGroupRow[],
      projects: projects as OpsCountGroupRow[],
      disputes: disputes as OpsCountGroupRow[],
      agentStatuses: agentStatuses as OpsCountGroupRow[],
      deadLettered,
      maxAttemptsReached
    };
  }

  async listRecentJobsWithProject(input: ActorInput & { limit?: number }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.job.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        project: { isNot: null }
      },
      select: { id: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: input.limit ?? 12
    }) as Promise<OpsRecentJobRow[]>;
  }

  async findAgentRuns(input: ActorInput & {
    correlationId?: string;
    agentType?: string;
    triggerType?: string;
    limit: number;
  }) {
    return this.listAgentRuns(input);
  }

  async findAgentRunsByCorrelationId(input: ActorInput & { correlationId: string }) {
    return this.listAgentRunsByCorrelationId(input);
  }

  async findAuditLogsForTrace(input: ActorInput & { correlationId: string; runIds: string[] }) {
    return this.listAuditRowsForRuntimeTrace(input);
  }

  async findRiskScores(input: ActorInput & { limit?: number }) {
    return this.listRiskScores(input);
  }

  async findAuditLogs(input: ActorInput & { limit?: number }) {
    return this.listAuditEntries(input);
  }

  async retryAgentRun(input: ActorInput & { runId: string }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.agentRun.update({
      where: { id: input.runId },
      data: {
        status: "QUEUED",
        error: null,
        workerId: null,
        startedAt: null,
        heartbeatAt: null,
        endedAt: null
      }
    }) as Promise<OpsAgentRunRow>;
  }

  async requeueAgentRun(input: ActorInput & { runId: string }) {
    await this.actorContextService.ensureActorContext(input);

    return this.prisma.agentRun.update({
      where: { id: input.runId },
      data: {
        status: "QUEUED",
        error: null,
        deadLettered: false,
        workerId: null,
        startedAt: null,
        heartbeatAt: null,
        endedAt: null
      }
    }) as Promise<OpsAgentRunRow>;
  }
}

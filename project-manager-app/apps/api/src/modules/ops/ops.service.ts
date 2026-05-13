import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { OperatorContext } from "@semse/shared";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { AgentQueueService } from "../../infrastructure/queue/agent-queue.service.js";
import { AgentApprovalService } from "../agents/agent-approval.service.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { TrustService } from "../trust/trust.service.js";
import {
  OpsRepository,
  type OpsCountGroupRow,
  type OpsRecentJobRow,
  type OpsRiskScoreRow
} from "./ops.repository.js";

type TrustOverviewSnapshot = Awaited<ReturnType<TrustService["byJob"]>>;

function resolveRequestId(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "n/a";
  }

  const payload = value as { requestId?: unknown };
  return typeof payload.requestId === "string" ? payload.requestId : "n/a";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function resolveEventTypeFromAgentInput(value: unknown): string | undefined {
  const payload = asRecord(value);
  return typeof payload?.eventType === "string" ? payload.eventType : undefined;
}

function resolveAuditTriggers(value: unknown): string[] {
  const payload = asRecord(value);
  const triggers = payload?.triggers;
  return Array.isArray(triggers) ? triggers.filter((entry): entry is string => typeof entry === "string") : [];
}

function resolveAuditPayload(value: unknown): Record<string, unknown> | undefined {
  const payload = asRecord(value);
  return asRecord(payload?.payload);
}

function resolveOperatorContextFromAgentInput(value: unknown): OperatorContext | undefined {
  const payload = asRecord(value);
  const context = asRecord(payload?.operatorContext);
  if (!context) {
    return undefined;
  }

  if (
    typeof context.source !== "string" ||
    typeof context.scope !== "string" ||
    typeof context.operatorId !== "string" ||
    typeof context.tenantId !== "string" ||
    typeof context.orgId !== "string"
  ) {
    return undefined;
  }

  return context as OperatorContext;
}

function summarizeOperatorContext(context: OperatorContext | undefined) {
  if (!context) {
    return undefined;
  }

  return {
    source: context.source,
    scope: context.scope,
    operatorId: context.operatorId,
    workspaceId: context.workspaceId,
    repoId: context.repoId,
    taskId: context.taskId
  };
}

@Injectable()
export class OpsService {
  constructor(
    private readonly opsRepository: OpsRepository,
    private readonly actorContextService: ActorContextService,
    private readonly auditService: AuditService,
    private readonly trustService: TrustService,
    private readonly agentQueueService: AgentQueueService,
    private readonly agentApprovalService: AgentApprovalService,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository,
    private readonly prisma: PrismaService
  ) {}

  async audit(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    limit?: number;
  }) {
    const entries = await this.opsRepository.listAuditEntries(input);

    return entries.map((entry) => ({
      id: entry.id,
      actorUserId: entry.actorUserId ?? "system",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      requestId: resolveRequestId(entry.afterJson),
      timestamp: entry.occurredAt.toISOString()
    }));
  }

  async agentRuntime(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    correlationId?: string;
    eventType?: string;
    agentType?: string;
    status?: string;
    triggerType?: string;
    workspaceId?: string;
    operatorId?: string;
    memoryTag?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const runs = await this.opsRepository.listAgentRuns({
      ...input,
      limit: take
    });

    const filteredRunsByRuntime = runs.filter((run) => {
      if (input.eventType && resolveEventTypeFromAgentInput(run.inputJson) !== input.eventType) {
        return false;
      }

      if (input.status && run.status.toLowerCase() !== input.status.toLowerCase()) {
        return false;
      }

      const operatorContext = resolveOperatorContextFromAgentInput(run.inputJson);
      if (input.workspaceId && operatorContext?.workspaceId !== input.workspaceId) {
        return false;
      }

      if (input.operatorId && operatorContext?.operatorId !== input.operatorId) {
        return false;
      }

      return true;
    });

    const filteredRuns = input.memoryTag
      ? (
          await Promise.all(
            filteredRunsByRuntime.map(async (run) => {
              const operatorContext = resolveOperatorContextFromAgentInput(run.inputJson);
              if (!operatorContext?.workspaceId) {
                return null;
              }

              const memory = await this.workspaceMemoryRepository.query({
                tenantId: input.tenantId,
                orgId: input.orgId,
                workspaceId: operatorContext.workspaceId,
                runId: run.id,
                tags: [input.memoryTag as string]
              });

              return memory.length > 0 ? run : null;
            })
          )
        ).filter((run): run is (typeof filteredRunsByRuntime)[number] => run !== null)
      : filteredRunsByRuntime;

    return {
      total: filteredRuns.length,
      filters: {
        correlationId: input.correlationId,
        eventType: input.eventType,
        agentType: input.agentType,
        status: input.status,
        triggerType: input.triggerType,
        workspaceId: input.workspaceId,
        operatorId: input.operatorId,
        memoryTag: input.memoryTag,
        limit: take
      },
      items: filteredRuns.map((run) => ({
        id: run.id,
        correlationId: run.correlationId,
        eventType: resolveEventTypeFromAgentInput(run.inputJson),
        agentType: run.agentType,
        triggerType: run.triggerType.toLowerCase(),
        status: run.status.toLowerCase(),
        workerId: run.workerId ?? undefined,
        attempts: run.attempts,
        maxAttempts: run.maxAttempts,
        deadLettered: run.deadLettered,
        inputSummary: run.inputSummary ?? undefined,
        outputSummary: run.outputSummary ?? undefined,
        operatorContext: summarizeOperatorContext(resolveOperatorContextFromAgentInput(run.inputJson)),
        requiresHumanReview: run.requiresHumanReview,
        error: run.error ?? undefined,
        startedAt: run.startedAt?.toISOString(),
        heartbeatAt: run.heartbeatAt?.toISOString(),
        endedAt: run.endedAt?.toISOString(),
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString()
      }))
    };
  }

  async agentRuntimeTrace(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    correlationId: string;
  }) {
    const typedRuns = await this.opsRepository.listAgentRunsByCorrelationId(input);
    const runIds = typedRuns.map((run) => run.id);
    const auditRows = await this.opsRepository.listAuditRowsForRuntimeTrace({
      ...input,
      runIds
    });

    const typedAuditRows = auditRows.filter((entry) => {
      if (entry.action === "domain.event.emit" && entry.entityId.includes(input.correlationId)) {
        return true;
      }

      if (entry.entityType !== "AgentRun") {
        return false;
      }

      return typedRuns.some((run) => run.id === entry.entityId);
    });

    const primaryEvent = typedAuditRows.find((entry) => entry.action === "domain.event.emit");
    const primaryEventJson = primaryEvent ? asRecord(primaryEvent.afterJson) : undefined;
    const workspaceMemory = (
      await Promise.all(
        typedRuns.map(async (run) => {
          const operatorContext = resolveOperatorContextFromAgentInput(run.inputJson);
          if (!operatorContext?.workspaceId) {
            return [];
          }

          return this.workspaceMemoryRepository.query({
            tenantId: input.tenantId,
            orgId: input.orgId,
            workspaceId: operatorContext.workspaceId,
            runId: run.id,
            kinds: ["run_summary"]
          });
        })
      )
    )
      .flat()
      .map((record) => ({
        id: record.id,
        runId: record.runId,
        kind: record.kind,
        scope: record.scope,
        title: record.title,
        summary: record.summary,
        tags: record.tags,
        updatedAtIso: record.updatedAtIso
      }));

    return {
      correlationId: input.correlationId,
      summary: {
        eventType: typeof primaryEventJson?.type === "string" ? primaryEventJson.type : undefined,
        triggerCount: typedRuns.length,
        queued: typedRuns.filter((run) => run.status === "QUEUED").length,
        running: typedRuns.filter((run) => run.status === "RUNNING").length,
        completed: typedRuns.filter((run) => run.status === "COMPLETED").length,
        failed: typedRuns.filter((run) => run.status === "FAILED").length
      },
      event: primaryEvent
        ? {
            auditId: primaryEvent.id,
            action: primaryEvent.action,
            entityId: primaryEvent.entityId,
            eventType: typeof primaryEventJson?.type === "string" ? primaryEventJson.type : undefined,
            triggers: resolveAuditTriggers(primaryEvent.afterJson),
            payload: resolveAuditPayload(primaryEvent.afterJson),
            requestId: resolveRequestId(primaryEvent.afterJson),
            timestamp: primaryEvent.occurredAt.toISOString()
          }
        : undefined,
      runs: typedRuns.map((run) => ({
        id: run.id,
        agentType: run.agentType,
        triggerType: run.triggerType.toLowerCase(),
        eventType: resolveEventTypeFromAgentInput(run.inputJson),
        status: run.status.toLowerCase(),
        workerId: run.workerId ?? undefined,
        attempts: run.attempts,
        maxAttempts: run.maxAttempts,
        deadLettered: run.deadLettered,
        inputSummary: run.inputSummary ?? undefined,
        outputSummary: run.outputSummary ?? undefined,
        operatorContext: summarizeOperatorContext(resolveOperatorContextFromAgentInput(run.inputJson)),
        requiresHumanReview: run.requiresHumanReview,
        error: run.error ?? undefined,
        startedAt: run.startedAt?.toISOString(),
        heartbeatAt: run.heartbeatAt?.toISOString(),
        endedAt: run.endedAt?.toISOString(),
        createdAt: run.createdAt.toISOString(),
          updatedAt: run.updatedAt.toISOString()
      })),
      workspaceMemory,
      timeline: typedAuditRows.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        requestId: resolveRequestId(entry.afterJson),
        timestamp: entry.occurredAt.toISOString()
      }))
    };
  }

  async riskScores(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    limit?: number;
  }) {
    const scores = await this.opsRepository.listRiskScores(input);

    return scores.map((score: OpsRiskScoreRow) => ({
      id: score.id,
      subjectType: score.subjectType,
      subjectId: score.subjectId,
      score: Number(score.score),
      modelVersion: score.modelVersion,
      factors: score.factorsJson,
      computedAt: score.computedAt.toISOString()
    }));
  }

  async dashboard(input: {
    tenantId: string;
    orgId: string;
    userId: string;
  }) {
    const { jobs: jobRows, projects: projectRows, disputes: disputeRows, agentStatuses: agentStatusRows, deadLettered, maxAttemptsReached } =
      await this.opsRepository.dashboardGroups(input);

    const jobCount = (status: string) => jobRows.find((entry: OpsCountGroupRow) => entry.status === status)?._count._all ?? 0;
    const projectCount = (status: string) =>
      projectRows.find((entry: OpsCountGroupRow) => entry.status === status)?._count._all ?? 0;
    const disputeCount = (status: string) =>
      disputeRows.find((entry: OpsCountGroupRow) => entry.status === status)?._count._all ?? 0;
    const agentCount = (status: string) =>
      agentStatusRows.find((entry: OpsCountGroupRow) => entry.status === status)?._count._all ?? 0;

    return {
      jobs: {
        total: jobRows.reduce((sum: number, entry: OpsCountGroupRow) => sum + entry._count._all, 0),
        published: jobCount("PUBLISHED"),
        awarded: jobCount("AWARDED"),
        posted: jobCount("POSTED"),
        reserved: jobCount("RESERVED"),
        accepted: jobCount("ACCEPTED"),
        inProgress: jobCount("IN_PROGRESS"),
        review: jobCount("REVIEW"),
        dispute: jobCount("DISPUTE"),
        completed: jobCount("COMPLETED"),
        cancelled: jobCount("CANCELLED")
      },
      projects: {
        total: projectRows.reduce((sum: number, entry: OpsCountGroupRow) => sum + entry._count._all, 0),
        open: projectCount("OPEN"),
        inProgress: projectCount("IN_PROGRESS"),
        blocked: projectCount("BLOCKED"),
        completed: projectCount("COMPLETED"),
        cancelled: projectCount("CANCELLED")
      },
      disputes: {
        total: disputeRows.reduce((sum: number, entry: OpsCountGroupRow) => sum + entry._count._all, 0),
        open: disputeCount("OPEN"),
        assigned: disputeCount("ASSIGNED"),
        resolved: disputeCount("RESOLVED")
      },
      agents: {
        totalRuns: agentStatusRows.reduce((sum: number, entry: OpsCountGroupRow) => sum + entry._count._all, 0),
        queued: agentCount("QUEUED"),
        running: agentCount("RUNNING"),
        failed: agentCount("FAILED"),
        deadLettered,
        maxAttemptsReached: Number(maxAttemptsReached[0]?.count ?? 0n)
      }
    };
  }

  async approvalDecision(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    approvalId: string;
    decision: "approved" | "rejected";
    comment?: string;
    requestId: string;
  }) {
    return this.agentApprovalService.decide(input);
  }

  async trustOverview(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    limit?: number;
  }) {
    await this.actorContextService.ensureActorContext(input);

    const recentJobs = await this.opsRepository.listRecentJobsWithProject(input);

    const snapshots = (await Promise.all(
      recentJobs.map((job: OpsRecentJobRow) =>
        this.trustService.byJob({
          tenantId: input.tenantId,
          orgId: input.orgId,
          userId: input.userId,
          roles: input.roles,
          jobId: job.id
        })
      )
    )) as TrustOverviewSnapshot[];

    const ordered = snapshots
      .sort((left: TrustOverviewSnapshot, right: TrustOverviewSnapshot) => left.score - right.score)
      .map((snapshot: TrustOverviewSnapshot) => ({
        scopeType: snapshot.scopeType,
        scopeId: snapshot.scopeId,
        jobId: snapshot.jobId,
        projectId: snapshot.projectId,
        score: snapshot.score,
        level: snapshot.level,
        flags: snapshot.flags,
        primaryReason: snapshot.reasons[0]?.message ?? "No trust issues detected",
        lastUpdatedAt: snapshot.lastUpdatedAt
      }));

    return {
      total: ordered.length,
      highRisk: ordered.filter((entry: (typeof ordered)[number]) => entry.level === "high").length,
      mediumRisk: ordered.filter((entry: (typeof ordered)[number]) => entry.level === "medium").length,
      lowRisk: ordered.filter((entry: (typeof ordered)[number]) => entry.level === "low").length,
      items: ordered
    };
  }

  async acknowledgeAlert(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    alertId: string;
    requestId: string;
  }) {
    await this.actorContextService.ensureActorContext(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "ops.alert.ack",
      entityType: "OpsAlert",
      entityId: input.alertId,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return {
      alertId: input.alertId,
      status: "acknowledged"
    };
  }

  async executeRunbook(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runbookId: string;
    requestId: string;
  }) {
    await this.actorContextService.ensureActorContext(input);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "ops.runbook.execute",
      entityType: "OpsRunbook",
      entityId: input.runbookId,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return {
      runbookId: input.runbookId,
      status: "executed"
    };
  }

  async reportIncident(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    severity: "watch" | "critical";
    title: string;
    requestId: string;
  }) {
    await this.actorContextService.ensureActorContext(input);

    const incidentId = `incident_${Date.now()}`;

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: `ops.incident.${input.severity}`,
      entityType: "OpsIncident",
      entityId: incidentId,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return {
      incidentId,
      severity: input.severity,
      title: input.title,
      status: "recorded"
    };
  }

  async retryAgentRun(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runId: string;
    requestId: string;
  }) {
    await this.actorContextService.ensureActorContext(input);

    const run = await this.opsRepository.retryAgentRun({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      runId: input.runId
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "ops.agent.retry",
      entityType: "AgentRun",
      entityId: input.runId,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    await this.agentQueueService.enqueueRun({
      runId: run.id,
      tenantId: input.tenantId,
      agentType: run.agentType,
      correlationId: run.correlationId
    });

    return {
      runId: run.id,
      status: run.status.toLowerCase()
    };
  }

  async requeueAgentRun(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    runId: string;
    requestId: string;
  }) {
    await this.actorContextService.ensureActorContext(input);

    const run = await this.opsRepository.requeueAgentRun({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      runId: input.runId
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "ops.agent.requeue",
      entityType: "AgentRun",
      entityId: input.runId,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    await this.agentQueueService.enqueueRun({
      runId: run.id,
      tenantId: input.tenantId,
      agentType: run.agentType,
      correlationId: run.correlationId
    });

    return {
      runId: run.id,
      status: run.status.toLowerCase(),
      deadLettered: run.deadLettered
    };
  }

  async runDedup(): Promise<{ steps: Array<{ table: string; deleted: number }>; totalDeleted: number }> {
    const steps: Array<{ table: string; deleted: number }> = [];

    const runDelete = async (table: string, sql: string): Promise<number> => {
      const result = await this.prisma.$executeRawUnsafe(sql);
      steps.push({ table, deleted: result });
      return result;
    };

    await runDelete("Milestone", `
      DELETE FROM "Milestone" m1
      USING "Milestone" m2
      WHERE m1."projectId" = m2."projectId"
        AND m1."sequence" = m2."sequence"
        AND m1."deletedAt" IS NULL
        AND m2."deletedAt" IS NULL
        AND m1.id > m2.id
    `);

    await runDelete("BuildOpsTask", `
      DELETE FROM "BuildOpsTask" t1
      USING "BuildOpsTask" t2
      WHERE t1."projectId" = t2."projectId"
        AND t1."templateKey" = t2."templateKey"
        AND t1.id > t2.id
    `);

    await runDelete("BuildOpsProject", `
      DELETE FROM "BuildOpsProject" b1
      USING "BuildOpsProject" b2
      WHERE b1."jobId" = b2."jobId"
        AND b1.id > b2.id
    `);

    await runDelete("Evidence", `
      DELETE FROM "Evidence" e1
      USING "Evidence" e2
      WHERE e1."projectId" = e2."projectId"
        AND e1."promotedFromBuildOpsProjectId" = e2."promotedFromBuildOpsProjectId"
        AND e1."bucketKey" = e2."bucketKey"
        AND e1.id > e2.id
    `);

    await runDelete("JobTask", `
      DELETE FROM "JobTask" jt1
      USING "JobTask" jt2
      WHERE jt1."jobId" = jt2."jobId"
        AND jt1."promotedFromBuildOpsTaskId" = jt2."promotedFromBuildOpsTaskId"
        AND jt1.id > jt2.id
    `);

    await runDelete("Project", `
      DELETE FROM "Project" p1
      USING "Project" p2
      WHERE p1."promotedFromBuildOpsProjectId" = p2."promotedFromBuildOpsProjectId"
        AND p1."promotedFromBuildOpsProjectId" IS NOT NULL
        AND p1.id > p2.id
    `);

    const totalDeleted = steps.reduce((s, r) => s + r.deleted, 0);
    return { steps, totalDeleted };
  }
}

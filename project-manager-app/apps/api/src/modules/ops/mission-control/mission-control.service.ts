import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { hasPermission, normalizeRoles } from "../../../common/rbac.js";
import { AuditService } from "../../../infrastructure/audit/audit.service.js";
import { HealthService } from "../../health/health.service.js";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { SseEventBusService } from "../../../infrastructure/sse/sse-event-bus.service.js";
import { OutboxOpsService } from "../../domain-events/outbox-ops.service.js";
import { OperationalSignalsService } from "../../operational-intelligence/operational-signals.service.js";
import { LoopsService } from "../loops.service.js";
import { SystemObserverService } from "../observer.service.js";
import { OpsService } from "../ops.service.js";
import {
  MISSION_CONTROL_RUNBOOKS,
  assertActionAllowedByRunbook,
  decodeMissionControlCursor,
  encodeMissionControlCursor,
  hashMissionControlIntent,
  isMissionControlV2Enabled,
  type MissionControlAction,
  type MissionControlActionInput,
  type MissionControlExceptionsQuery,
  type MissionControlSeverity,
  type MissionControlSource,
  type MissionControlStatus,
} from "./mission-control.policy.js";

type MissionControlActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
  requestId: string;
};

export type MissionControlExceptionItem = {
  exceptionId: string;
  source: MissionControlSource;
  targetType: string;
  targetId: string;
  severity: MissionControlSeverity;
  status: MissionControlStatus;
  title: string;
  summary: string;
  occurredAt: string;
  correlationId: string | null;
  availableActions: MissionControlAction[];
  runbookIds: string[];
  deepLink: string;
};

type ReceiptRow = {
  id: string;
  tenantId: string;
  action: string;
  targetType: string;
  targetId: string;
  status: string;
  dryRun: boolean;
  resultJson: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  correlationId: string;
  incidentId: string | null;
  leaseExpiresAt: Date | null;
  attempts: number;
  intentHash: string;
  createdAt: Date;
  completedAt: Date | null;
};

type AdapterResult = {
  status: "SUCCEEDED" | "NO_OP";
  before?: Record<string, unknown>;
  result: Record<string, unknown>;
  incidentId?: string;
};

const SEVERITY_WEIGHT: Record<MissionControlSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const RECEIPT_LEASE_MS = 30_000;

function normalizeSeverity(value: string | null | undefined): MissionControlSeverity {
  const normalized = value?.toLowerCase();
  if (
    normalized === "critical" ||
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low" ||
    normalized === "info"
  ) {
    return normalized;
  }
  if (normalized === "watch" || normalized === "warning") {
    return "medium";
  }
  return "info";
}

function sanitizeError(error: unknown): { code: string; message: string } {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === "object" && response !== null) {
      const body = response as { code?: unknown; message?: unknown };
      return {
        code: typeof body.code === "string" ? body.code : `HTTP_${error.getStatus()}`,
        message: typeof body.message === "string" ? body.message : error.message,
      };
    }
    return { code: `HTTP_${error.getStatus()}`, message: error.message };
  }
  return {
    code: "MISSION_CONTROL_ADAPTER_UNAVAILABLE",
    message: "The owning module could not complete the requested action",
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "P2002";
}

function toReceiptView(receipt: ReceiptRow) {
  return {
    id: receipt.id,
    status: receipt.status,
    action: receipt.action,
    targetType: receipt.targetType,
    targetId: receipt.targetId,
    incidentId: receipt.incidentId,
    result: receipt.resultJson ?? (
      receipt.errorCode
        ? { code: receipt.errorCode, message: receipt.errorMessage }
        : {}
    ),
    correlationId: receipt.correlationId,
    dryRun: receipt.dryRun,
    attempts: receipt.attempts,
    createdAt: receipt.createdAt.toISOString(),
    completedAt: receipt.completedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class MissionControlService {
  private readonly logger = new Logger(MissionControlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly signals: OperationalSignalsService,
    private readonly loops: LoopsService,
    private readonly outbox: OutboxOpsService,
    private readonly ops: OpsService,
    private readonly health: HealthService,
    private readonly observer: SystemObserverService,
    private readonly sse: SseEventBusService,
  ) {}

  listRunbooks(tenantId: string) {
    this.assertEnabled(tenantId);
    return {
      enabled: true,
      runbooks: MISSION_CONTROL_RUNBOOKS,
    };
  }

  async listExceptions(
    actor: MissionControlActor,
    query: MissionControlExceptionsQuery,
  ) {
    this.assertEnabled(actor.tenantId);
    const sourceErrors: Array<{ source: MissionControlSource; code: string }> = [];

    const load = async (
      source: MissionControlSource,
      operation: () => Promise<MissionControlExceptionItem[]>,
    ): Promise<MissionControlExceptionItem[]> => {
      try {
        return await operation();
      } catch (error) {
        this.logger.warn(
          `Mission Control source '${source}' degraded: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        sourceErrors.push({ source, code: "SOURCE_UNAVAILABLE" });
        return [];
      }
    };

    const chunks = await Promise.all([
      load("signal", () => this.loadSignalExceptions(actor.tenantId)),
      load("event", () => this.loadEventExceptions(actor.tenantId)),
      load("agent_run", () => this.loadAgentRunExceptions(actor.tenantId)),
      load("approval", () => this.loadApprovalExceptions(actor.tenantId)),
      load("loop", () => this.loadLoopExceptions()),
      load("incident", () => this.loadIncidentExceptions(actor.tenantId)),
      load("service_health", () => this.loadServiceHealthExceptions(actor.tenantId)),
      load("worker_queue", () => this.loadWorkerQueueExceptions()),
    ]);

    let items = chunks.flat();
    if (query.status) {
      items = items.filter((item) => item.status === query.status);
    }
    if (query.source) {
      items = items.filter((item) => item.source === query.source);
    }
    if (query.severity) {
      items = items.filter((item) => item.severity === query.severity);
    }
    items.sort((left, right) => {
      const severity = SEVERITY_WEIGHT[right.severity] - SEVERITY_WEIGHT[left.severity];
      if (severity !== 0) return severity;
      const age = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
      if (age !== 0) return age;
      return left.exceptionId.localeCompare(right.exceptionId);
    });

    const counts = {
      total: items.length,
      bySource: Object.fromEntries(
        [...new Set(items.map((item) => item.source))]
          .map((source) => [source, items.filter((item) => item.source === source).length]),
      ),
      bySeverity: Object.fromEntries(
        [...new Set(items.map((item) => item.severity))]
          .map((severity) => [severity, items.filter((item) => item.severity === severity).length]),
      ),
      byStatus: Object.fromEntries(
        [...new Set(items.map((item) => item.status))]
          .map((status) => [status, items.filter((item) => item.status === status).length]),
      ),
    };

    const offset = decodeMissionControlCursor(query.cursor);
    const page = items.slice(offset, offset + query.limit);
    const nextOffset = offset + page.length;
    return {
      enabled: true,
      items: page,
      nextCursor: nextOffset < items.length ? encodeMissionControlCursor(nextOffset) : null,
      counts,
      sourceErrors,
      generatedAt: new Date().toISOString(),
    };
  }

  async executeAction(
    actor: MissionControlActor,
    input: MissionControlActionInput,
  ) {
    this.assertEnabled(actor.tenantId);
    if (!normalizeRoles(actor.roles).includes("OPS_ADMIN")) {
      throw new ForbiddenException({
        code: "MISSION_CONTROL_OPERATOR_REQUIRED",
        message: "Mission Control actions require the OPS_ADMIN role",
      });
    }
    if (input.action === "REPLAY" && !hasPermission(actor.roles, "domain-events:replay")) {
      throw new ForbiddenException({
        code: "MISSION_CONTROL_REPLAY_PERMISSION_REQUIRED",
        message: "Domain event replay requires domain-events:replay",
      });
    }
    assertActionAllowedByRunbook(input.runbookId, input.action, input.targetType);

    const intentHash = hashMissionControlIntent({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      actorUserId: actor.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      runbookId: input.runbookId,
      dryRun: input.dryRun,
      options: input.options,
    });

    const receipt = await this.claimReceipt(actor, input, intentHash);
    if (["SUCCEEDED", "FAILED", "NO_OP"].includes(receipt.status)) {
      return { receipt: toReceiptView(receipt), duplicate: true };
    }

    try {
      const adapter = await this.executeAdapter(actor, input, receipt.id);
      const completed = await this.prisma.missionControlActionReceipt.update({
        where: { id: receipt.id },
        data: {
          status: adapter.status,
          beforeJson: adapter.before as object | undefined,
          resultJson: adapter.result as object,
          incidentId: adapter.incidentId,
          leaseExpiresAt: null,
          completedAt: new Date(),
        },
      }) as ReceiptRow;

      await this.appendAudit(actor, input, completed, adapter).catch((error) => {
        this.logger.error(`Mission Control audit append failed receipt=${receipt.id}: ${String(error)}`);
      });
      this.emitReceipt(actor.tenantId, completed);
      return { receipt: toReceiptView(completed), duplicate: false };
    } catch (error) {
      const sanitized = sanitizeError(error);
      const failed = await this.prisma.missionControlActionReceipt.update({
        where: { id: receipt.id },
        data: {
          status: "FAILED",
          errorCode: sanitized.code,
          errorMessage: sanitized.message.slice(0, 500),
          resultJson: {
            code: sanitized.code,
            message: sanitized.message.slice(0, 500),
          },
          leaseExpiresAt: null,
          completedAt: new Date(),
        },
      }) as ReceiptRow;
      this.emitReceipt(actor.tenantId, failed);
      await this.appendAudit(actor, input, failed, {
        status: "NO_OP",
        result: { code: sanitized.code, message: sanitized.message },
      }).catch(() => undefined);
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === "object" && response !== null) {
          (response as Record<string, unknown>).receiptId = failed.id;
        }
        throw error;
      }
      throw new ServiceUnavailableException({
        code: sanitized.code,
        message: sanitized.message,
        receiptId: failed.id,
      });
    }
  }

  private assertEnabled(tenantId: string): void {
    if (!isMissionControlV2Enabled(tenantId)) {
      throw new NotFoundException({
        code: "MISSION_CONTROL_V2_DISABLED",
        message: "Mission Control 2.0 is not active for this tenant",
      });
    }
  }

  private async claimReceipt(
    actor: MissionControlActor,
    input: MissionControlActionInput,
    intentHash: string,
  ): Promise<ReceiptRow> {
    const unique = {
      tenantId_idempotencyKey: {
        tenantId: actor.tenantId,
        idempotencyKey: input.idempotencyKey,
      },
    };
    let existing = await this.prisma.missionControlActionReceipt.findUnique({
      where: unique,
    }) as ReceiptRow | null;

    if (!existing) {
      try {
        return await this.prisma.missionControlActionReceipt.create({
          data: {
            tenantId: actor.tenantId,
            orgId: actor.orgId,
            actorUserId: actor.userId,
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId,
            scope: input.targetType === "PermanentLoop" ? "platform" : "tenant",
            reason: input.reason,
            runbookId: input.runbookId,
            idempotencyKey: input.idempotencyKey,
            intentHash,
            status: "RUNNING",
            dryRun: input.dryRun,
            optionsJson: input.options,
            requestId: actor.requestId,
            correlationId: randomUUID(),
            leaseExpiresAt: new Date(Date.now() + RECEIPT_LEASE_MS),
          },
        }) as ReceiptRow;
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        existing = await this.prisma.missionControlActionReceipt.findUnique({
          where: unique,
        }) as ReceiptRow | null;
      }
    }

    if (!existing) {
      throw new ServiceUnavailableException({
        code: "MISSION_CONTROL_RECEIPT_UNAVAILABLE",
        message: "The action receipt could not be claimed",
      });
    }
    if (existing.intentHash !== intentHash) {
      throw new ConflictException({
        code: "MISSION_CONTROL_IDEMPOTENCY_CONFLICT",
        message: "Idempotency key was already used for another intent",
      });
    }
    if (["SUCCEEDED", "FAILED", "NO_OP"].includes(existing.status)) {
      return existing;
    }
    if (existing.leaseExpiresAt && existing.leaseExpiresAt.getTime() > Date.now()) {
      throw new ConflictException({
        code: "MISSION_CONTROL_ACTION_IN_PROGRESS",
        message: "An action with this idempotency key is still running",
        receiptId: existing.id,
      });
    }

    const reclaimed = await this.prisma.missionControlActionReceipt.updateMany({
      where: {
        id: existing.id,
        status: "RUNNING",
        OR: [
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lte: new Date() } },
        ],
      },
      data: {
        leaseExpiresAt: new Date(Date.now() + RECEIPT_LEASE_MS),
        attempts: { increment: 1 },
        errorCode: null,
        errorMessage: null,
      },
    });
    if (reclaimed.count !== 1) {
      throw new ConflictException({
        code: "MISSION_CONTROL_ACTION_IN_PROGRESS",
        message: "The stale receipt was already reclaimed by another operator",
        receiptId: existing.id,
      });
    }
    return await this.prisma.missionControlActionReceipt.findUniqueOrThrow({
      where: { id: existing.id },
    }) as ReceiptRow;
  }

  private async executeAdapter(
    actor: MissionControlActor,
    input: MissionControlActionInput,
    receiptId: string,
  ): Promise<AdapterResult> {
    if (input.targetType === "OperationalSignal") {
      return this.executeSignalAction(actor, input);
    }
    if (input.targetType === "PermanentLoop") {
      return this.executeLoopAction(actor, input);
    }
    if (input.targetType === "AgentRun") {
      return this.executeAgentRunAction(actor, input);
    }
    if (input.targetType === "DomainEvent") {
      return this.executeDomainEventAction(actor, input);
    }
    if (input.targetType === "MissionControlException") {
      if (input.action === "ESCALATE") {
        return this.executeEscalation(actor, input, receiptId);
      }
      if (input.action === "RESOLVE") {
        return this.executeIncidentResolution(actor, input);
      }
    }
    throw new ConflictException({
      code: "MISSION_CONTROL_ACTION_NOT_AVAILABLE",
      message: "This action is not available for the requested target type",
    });
  }

  private async executeSignalAction(
    actor: MissionControlActor,
    input: MissionControlActionInput,
  ): Promise<AdapterResult> {
    if (!["ACKNOWLEDGE", "RESOLVE", "DISMISS"].includes(input.action)) {
      throw new ConflictException({
        code: "MISSION_CONTROL_ACTION_NOT_AVAILABLE",
        message: "The signal does not support this action",
      });
    }
    const signal = await this.prisma.operationalSignal.findFirst({
      where: { id: input.targetId, tenantId: actor.tenantId },
      select: { id: true, status: true, severity: true, type: true },
    });
    if (!signal) {
      throw new NotFoundException({
        code: "MISSION_CONTROL_TARGET_NOT_FOUND",
        message: "Operational signal not found",
      });
    }
    const desired = input.action === "ACKNOWLEDGE"
      ? "acknowledged"
      : input.action === "RESOLVE"
        ? "resolved"
        : "dismissed";
    if (signal.status === desired) {
      return {
        status: "NO_OP",
        before: { status: signal.status },
        result: { status: signal.status, alreadyConverged: true },
      };
    }
    if (["resolved", "dismissed"].includes(signal.status)) {
      throw new ConflictException({
        code: "MISSION_CONTROL_TARGET_STATE_CONFLICT",
        message: "The operational signal is already terminal",
      });
    }
    if (input.dryRun) {
      return {
        status: "NO_OP",
        before: { status: signal.status },
        result: { dryRun: true, wouldSetStatus: desired },
      };
    }

    const changed = input.action === "ACKNOWLEDGE"
      ? await this.signals.acknowledge(signal.id, actor.tenantId)
      : input.action === "RESOLVE"
        ? await this.signals.resolve(signal.id, actor.tenantId)
        : await this.signals.dismiss(signal.id, actor.tenantId);
    if (!changed) {
      throw new NotFoundException({
        code: "MISSION_CONTROL_TARGET_NOT_FOUND",
        message: "Operational signal not found",
      });
    }
    return {
      status: "SUCCEEDED",
      before: { status: signal.status },
      result: { status: desired },
    };
  }

  private async executeLoopAction(
    actor: MissionControlActor,
    input: MissionControlActionInput,
  ): Promise<AdapterResult> {
    if (!["PAUSE", "RESUME"].includes(input.action)) {
      throw new ConflictException({
        code: "MISSION_CONTROL_ACTION_NOT_AVAILABLE",
        message: "The permanent loop does not support this action",
      });
    }
    const definition = this.loops.getDefinition(input.targetId);
    if (!definition) {
      throw new NotFoundException({
        code: "MISSION_CONTROL_TARGET_NOT_FOUND",
        message: "Permanent loop not found",
      });
    }
    const paused = await this.loops.isPaused(input.targetId);
    const desired = input.action === "PAUSE";
    if (paused === desired) {
      return {
        status: "NO_OP",
        before: { paused },
        result: { paused, alreadyConverged: true, scope: "platform" },
      };
    }
    if (input.dryRun) {
      return {
        status: "NO_OP",
        before: { paused },
        result: { dryRun: true, wouldSetPaused: desired, scope: "platform" },
      };
    }
    await this.loops.setPaused(input.targetId, desired, actor.userId);
    return {
      status: "SUCCEEDED",
      before: { paused },
      result: { paused: desired, scope: "platform" },
    };
  }

  private async executeAgentRunAction(
    actor: MissionControlActor,
    input: MissionControlActionInput,
  ): Promise<AdapterResult> {
    if (!["RETRY", "REQUEUE"].includes(input.action)) {
      throw new ConflictException({
        code: "MISSION_CONTROL_ACTION_NOT_AVAILABLE",
        message: "The agent run does not support this action",
      });
    }
    const run = await this.prisma.agentRun.findFirst({
      where: { id: input.targetId, tenantId: actor.tenantId },
      select: {
        id: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        deadLettered: true,
      },
    });
    if (!run) {
      throw new NotFoundException({
        code: "MISSION_CONTROL_TARGET_NOT_FOUND",
        message: "Agent run not found",
      });
    }
    if (!["FAILED", "CANCELLED"].includes(run.status) && !run.deadLettered) {
      throw new ConflictException({
        code: "MISSION_CONTROL_TARGET_STATE_CONFLICT",
        message: "Agent run is not in a recoverable state",
      });
    }
    if (input.action === "RETRY" && run.deadLettered) {
      throw new ConflictException({
        code: "MISSION_CONTROL_REQUEUE_REQUIRED",
        message: "Dead-lettered agent runs must be requeued",
      });
    }
    if (input.dryRun) {
      return {
        status: "NO_OP",
        before: {
          status: run.status,
          attempts: run.attempts,
          deadLettered: run.deadLettered,
        },
        result: {
          dryRun: true,
          wouldSetStatus: "QUEUED",
          action: input.action,
        },
      };
    }
    const result = input.action === "RETRY"
      ? await this.ops.retryAgentRun({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
        runId: run.id,
        requestId: actor.requestId,
      })
      : await this.ops.requeueAgentRun({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
        runId: run.id,
        requestId: actor.requestId,
      });
    return {
      status: "SUCCEEDED",
      before: {
        status: run.status,
        attempts: run.attempts,
        deadLettered: run.deadLettered,
      },
      result: { ...result, action: input.action },
    };
  }

  private async executeDomainEventAction(
    actor: MissionControlActor,
    input: MissionControlActionInput,
  ): Promise<AdapterResult> {
    if (input.action !== "REPLAY") {
      throw new ConflictException({
        code: "MISSION_CONTROL_ACTION_NOT_AVAILABLE",
        message: "The domain event does not support this action",
      });
    }
    const detail = await this.outbox.getDeliveryDetail({
      actor: {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
        requestId: actor.requestId,
      },
      eventId: input.targetId,
    });
    if (input.dryRun) {
      return {
        status: "NO_OP",
        before: { status: detail.status, replayCount: detail.replayCount },
        result: {
          dryRun: true,
          consumerName: input.options.consumerName ?? null,
          wouldReplay: true,
        },
      };
    }
    const result = await this.outbox.replay({
      actor: {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        userId: actor.userId,
        requestId: actor.requestId,
      },
      eventId: input.targetId,
      consumerName: input.options.consumerName,
      reason: input.reason,
    });
    return {
      status: "SUCCEEDED",
      before: { status: detail.status, replayCount: detail.replayCount },
      result,
    };
  }

  private async executeEscalation(
    actor: MissionControlActor,
    input: MissionControlActionInput,
    receiptId: string,
  ): Promise<AdapterResult> {
    await this.assertExceptionTarget(actor.tenantId, input.targetId);
    const existing = await this.prisma.missionControlIncident.findFirst({
      where: {
        tenantId: actor.tenantId,
        kind: "operation",
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        targetType: "MissionControlException",
        targetId: input.targetId,
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return {
        status: "NO_OP",
        before: { incidentId: existing.id, status: existing.status },
        result: { incidentId: existing.id, status: existing.status, alreadyConverged: true },
        incidentId: existing.id,
      };
    }
    if (input.dryRun) {
      return {
        status: "NO_OP",
        result: { dryRun: true, wouldCreateIncident: true, targetId: input.targetId },
      };
    }
    const incident = await this.prisma.missionControlIncident.create({
      data: {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        source: "mission-control-2",
        posture: "escalated",
        severity: "high",
        title: `Escalated Mission Control exception ${input.targetId}`,
        detail: input.reason,
        alertIds: [input.targetId],
        kind: "operation",
        status: "OPEN",
        actorUserId: actor.userId,
        targetType: "MissionControlException",
        targetId: input.targetId,
        reason: input.reason,
        runbookId: input.runbookId,
        actionReceiptId: receiptId,
      },
    });
    this.sse.emit(
      `mission-control:${actor.tenantId}`,
      "mission-control-incident:created",
      {
        id: incident.id,
        severity: incident.severity,
        status: incident.status,
        title: incident.title,
        targetId: incident.targetId,
        createdAt: incident.createdAt.toISOString(),
      },
    );
    return {
      status: "SUCCEEDED",
      result: { incidentId: incident.id, status: incident.status },
      incidentId: incident.id,
    };
  }

  private async executeIncidentResolution(
    actor: MissionControlActor,
    input: MissionControlActionInput,
  ): Promise<AdapterResult> {
    if (!input.targetId.startsWith("incident:")) {
      throw new ConflictException({
        code: "MISSION_CONTROL_ACTION_NOT_AVAILABLE",
        message: "RESOLVE is only available for an incident exception",
      });
    }
    const incidentId = input.targetId.slice("incident:".length);
    const incident = await this.prisma.missionControlIncident.findFirst({
      where: { id: incidentId, tenantId: actor.tenantId },
    });
    if (!incident) {
      throw new NotFoundException({
        code: "MISSION_CONTROL_TARGET_NOT_FOUND",
        message: "Mission Control incident not found",
      });
    }
    if (incident.status === "RESOLVED") {
      return {
        status: "NO_OP",
        before: { status: incident.status },
        result: { status: "RESOLVED", alreadyConverged: true },
        incidentId: incident.id,
      };
    }
    if (input.dryRun) {
      return {
        status: "NO_OP",
        before: { status: incident.status },
        result: { dryRun: true, wouldSetStatus: "RESOLVED" },
        incidentId: incident.id,
      };
    }
    await this.prisma.missionControlIncident.updateMany({
      where: { id: incident.id, tenantId: actor.tenantId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        actorUserId: actor.userId,
        reason: input.reason,
        runbookId: input.runbookId,
      },
    });
    return {
      status: "SUCCEEDED",
      before: { status: incident.status },
      result: { status: "RESOLVED" },
      incidentId: incident.id,
    };
  }

  private async assertExceptionTarget(tenantId: string, exceptionId: string): Promise<void> {
    const [source, targetId] = exceptionId.split(":", 2);
    let exists = false;
    if (source === "signal") {
      exists = Boolean(await this.prisma.operationalSignal.findFirst({
        where: { id: targetId, tenantId },
        select: { id: true },
      }));
    } else if (source === "event") {
      exists = Boolean(await this.prisma.domainOutboxEvent.findFirst({
        where: { eventId: targetId, tenantId },
        select: { eventId: true },
      }));
    } else if (source === "agent_run") {
      exists = Boolean(await this.prisma.agentRun.findFirst({
        where: { id: targetId, tenantId },
        select: { id: true },
      }));
    } else if (source === "approval") {
      exists = Boolean(await this.prisma.agentApproval.findFirst({
        where: { id: targetId, tenantId },
        select: { id: true },
      }));
    } else if (source === "incident") {
      exists = Boolean(await this.prisma.missionControlIncident.findFirst({
        where: { id: targetId, OR: [{ tenantId }, { tenantId: null }] },
        select: { id: true },
      }));
    } else if (source === "loop") {
      exists = Boolean(this.loops.getDefinition(targetId));
    } else if (source === "service_health" || source === "worker_queue") {
      exists = true;
    }
    if (!exists) {
      throw new NotFoundException({
        code: "MISSION_CONTROL_TARGET_NOT_FOUND",
        message: "Mission Control exception not found",
      });
    }
  }

  private async appendAudit(
    actor: MissionControlActor,
    input: MissionControlActionInput,
    receipt: ReceiptRow,
    adapter: AdapterResult,
  ): Promise<void> {
    await this.audit.append({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      actorUserId: actor.userId,
      action: "ops.mission-control.action",
      entityType: input.targetType,
      entityId: input.targetId,
      requestId: actor.requestId,
      timestamp: new Date().toISOString(),
      beforeJson: adapter.before,
      afterJson: {
        receiptId: receipt.id,
        status: receipt.status,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        runbookId: input.runbookId,
        idempotencyKey: input.idempotencyKey,
        correlationId: receipt.correlationId,
        incidentId: receipt.incidentId,
        dryRun: input.dryRun,
        result: adapter.result,
      },
    });
  }

  private emitReceipt(tenantId: string, receipt: ReceiptRow): void {
    this.sse.emit(
      `mission-control:${tenantId}`,
      "mission-control-action:updated",
      toReceiptView(receipt),
    );
  }

  private async loadSignalExceptions(tenantId: string): Promise<MissionControlExceptionItem[]> {
    const rows = await this.prisma.operationalSignal.findMany({
      where: { tenantId, status: { in: ["open", "acknowledged"] } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return rows.map((row) => ({
      exceptionId: `signal:${row.id}`,
      source: "signal",
      targetType: "OperationalSignal",
      targetId: row.id,
      severity: normalizeSeverity(row.severity),
      status: row.status === "acknowledged" ? "acknowledged" : "open",
      title: row.title,
      summary: row.message,
      occurredAt: row.createdAt.toISOString(),
      correlationId: null,
      availableActions: row.status === "acknowledged"
        ? ["RESOLVE", "DISMISS", "ESCALATE"]
        : ["ACKNOWLEDGE", "RESOLVE", "DISMISS", "ESCALATE"],
      runbookIds: ["signal-triage-v1", "incident-coordination-v1"],
      deepLink: row.buildOpsProjectId
        ? `/admin/intelligence-rooms/${row.buildOpsProjectId}`
        : "/admin/mission-control",
    }));
  }

  private async loadEventExceptions(tenantId: string): Promise<MissionControlExceptionItem[]> {
    const rows = await this.prisma.domainOutboxEvent.findMany({
      where: {
        tenantId,
        OR: [
          { status: { in: ["FAILED", "DEAD_LETTER"] } },
          { consumptions: { some: { status: { in: ["FAILED", "DEAD_LETTER"] } } } },
        ],
      },
      include: {
        consumptions: {
          where: { status: { in: ["FAILED", "DEAD_LETTER"] } },
          select: { consumerName: true, status: true, lastError: true },
        },
      },
      orderBy: { recordedAt: "asc" },
      take: 100,
    });
    return rows.map((row) => {
      const deadLetter = row.status === "DEAD_LETTER" ||
        row.consumptions.some((consumption) => consumption.status === "DEAD_LETTER");
      const consumerNames = row.consumptions.map((consumption) => consumption.consumerName);
      return {
        exceptionId: `event:${row.eventId}`,
        source: "event",
        targetType: "DomainEvent",
        targetId: row.eventId,
        severity: deadLetter ? "critical" : "high",
        status: deadLetter ? "dead_letter" : "failed",
        title: `${row.eventType} delivery ${deadLetter ? "dead-lettered" : "failed"}`,
        summary: consumerNames.length > 0
          ? `Affected consumers: ${consumerNames.join(", ")}`
          : (row.lastError ?? "Outbox delivery failed"),
        occurredAt: row.recordedAt.toISOString(),
        correlationId: row.correlationId,
        availableActions: ["REPLAY", "ESCALATE"],
        runbookIds: ["event-delivery-recovery-v1", "incident-coordination-v1"],
        deepLink: `/admin/domain-events?eventId=${encodeURIComponent(row.eventId)}`,
      };
    });
  }

  private async loadAgentRunExceptions(tenantId: string): Promise<MissionControlExceptionItem[]> {
    const rows = await this.prisma.agentRun.findMany({
      where: {
        tenantId,
        OR: [
          { status: { in: ["FAILED", "CANCELLED"] } },
          { deadLettered: true },
          { requiresHumanReview: true },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return rows.map((row) => ({
      exceptionId: `agent_run:${row.id}`,
      source: "agent_run",
      targetType: "AgentRun",
      targetId: row.id,
      severity: row.deadLettered ? "critical" : row.requiresHumanReview ? "medium" : "high",
      status: row.deadLettered ? "dead_letter" : "failed",
      title: `${row.agentType} run requires recovery`,
      summary: row.error ?? row.outputSummary ?? `Agent run status is ${row.status}`,
      occurredAt: row.createdAt.toISOString(),
      correlationId: row.correlationId,
      availableActions: row.deadLettered
        ? ["REQUEUE", "ESCALATE"]
        : ["RETRY", "REQUEUE", "ESCALATE"],
      runbookIds: ["agent-run-recovery-v1", "incident-coordination-v1"],
      deepLink: `/admin/agents?runId=${encodeURIComponent(row.id)}`,
    }));
  }

  private async loadApprovalExceptions(tenantId: string): Promise<MissionControlExceptionItem[]> {
    const rows = await this.prisma.agentApproval.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { requestedAt: "asc" },
      take: 100,
    });
    return rows.map((row) => ({
      exceptionId: `approval:${row.id}`,
      source: "approval",
      targetType: "AgentApproval",
      targetId: row.id,
      severity: normalizeSeverity(row.riskLevel),
      status: "pending_approval",
      title: row.title,
      summary: row.contextSummary ?? row.reason,
      occurredAt: row.requestedAt.toISOString(),
      correlationId: row.correlationId,
      availableActions: ["ESCALATE"],
      runbookIds: ["incident-coordination-v1"],
      deepLink: `/admin/agents?approvalId=${encodeURIComponent(row.id)}`,
    }));
  }

  private async loadLoopExceptions(): Promise<MissionControlExceptionItem[]> {
    const [states, proposals] = await Promise.all([
      this.prisma.permanentLoopState.findMany({
        where: {
          OR: [
            { paused: true },
            { lastCycleStatus: { in: ["failed", "error", "FAILED", "ERROR"] } },
          ],
        },
        orderBy: { updatedAt: "asc" },
        take: 50,
      }),
      this.prisma.agentDecision.findMany({
        where: {
          loopId: { not: null },
          decision: "proposed",
          outcome: "pending_review",
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
    ]);
    const stateItems: MissionControlExceptionItem[] = states.map((row) => ({
      exceptionId: `loop:${row.id}`,
      source: "loop",
      targetType: "PermanentLoop",
      targetId: row.id,
      severity: row.lastCycleStatus?.toLowerCase() === "failed" ? "high" : "medium",
      status: row.lastCycleStatus?.toLowerCase() === "failed" ? "failed" : "open",
      title: `Permanent loop ${row.id} ${row.paused ? "is paused" : "failed"}`,
      summary: `cycles=${row.cyclesCompleted}, skipped=${row.cyclesSkipped}, findings=${row.findingsRecorded}`,
      occurredAt: row.updatedAt.toISOString(),
      correlationId: null,
      availableActions: row.paused ? ["RESUME", "ESCALATE"] : ["PAUSE", "ESCALATE"],
      runbookIds: ["permanent-loop-control-v1", "incident-coordination-v1"],
      deepLink: "/admin/omega",
    }));
    const proposalItems: MissionControlExceptionItem[] = proposals.map((row) => ({
      exceptionId: `loop:${row.loopId ?? row.id}`,
      source: "loop",
      targetType: "PermanentLoop",
      targetId: row.loopId ?? row.id,
      severity: "medium",
      status: "pending_approval",
      title: `Permanent loop proposal for ${row.target}`,
      summary: row.rationale,
      occurredAt: row.createdAt.toISOString(),
      correlationId: row.runId,
      availableActions: ["PAUSE", "ESCALATE"],
      runbookIds: ["permanent-loop-control-v1", "incident-coordination-v1"],
      deepLink: "/admin/omega",
    }));
    return [...stateItems, ...proposalItems];
  }

  private async loadIncidentExceptions(tenantId: string): Promise<MissionControlExceptionItem[]> {
    const rows = await this.prisma.missionControlIncident.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        status: { not: "RESOLVED" },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return rows.map((row) => ({
      exceptionId: `incident:${row.id}`,
      source: "incident",
      targetType: "MissionControlIncident",
      targetId: row.id,
      severity: normalizeSeverity(row.severity),
      status: row.status === "ACKNOWLEDGED" ? "acknowledged" : "open",
      title: row.title,
      summary: row.detail,
      occurredAt: row.createdAt.toISOString(),
      correlationId: row.actionReceiptId,
      availableActions: row.tenantId === tenantId ? ["RESOLVE"] : ["ESCALATE"],
      runbookIds: ["incident-coordination-v1"],
      deepLink: "/admin/ai-mission-control",
    }));
  }

  private async loadServiceHealthExceptions(
    tenantId: string,
  ): Promise<MissionControlExceptionItem[]> {
    const status = this.health.getHealth();
    const items: MissionControlExceptionItem[] = [];
    for (const component of ["api", "worker", "redis"] as const) {
      if (status[component] !== "degraded") continue;
      items.push({
        exceptionId: `service_health:${component}`,
        source: "service_health",
        targetType: "ServiceHealth",
        targetId: component,
        severity: component === "api" || component === "redis" ? "critical" : "high",
        status: "failed",
        title: `${component.toUpperCase()} health is degraded`,
        summary: `Last health snapshot: ${status.checkedAt}`,
        occurredAt: status.checkedAt,
        correlationId: null,
        availableActions: ["ESCALATE"],
        runbookIds: ["service-health-diagnosis-v1", "incident-coordination-v1"],
        deepLink: "/admin/ai-mission-control",
      });
    }
    const latest = this.observer.getLatest();
    if (latest?.tenantId === tenantId) {
      latest.alerts.forEach((alert, index) => {
        items.push({
          exceptionId: `service_health:observer-${latest.observedAt}-${index}`,
          source: "service_health",
          targetType: "ObserverAlert",
          targetId: `observer-${index}`,
          severity: normalizeSeverity(alert.level),
          status: "open",
          title: `${alert.area}: ${alert.message}`,
          summary: alert.recommendation,
          occurredAt: latest.observedAt,
          correlationId: null,
          availableActions: ["ESCALATE"],
          runbookIds: ["service-health-diagnosis-v1", "incident-coordination-v1"],
          deepLink: "/admin/ai-mission-control",
        });
      });
    }
    return items;
  }

  private async loadWorkerQueueExceptions(): Promise<MissionControlExceptionItem[]> {
    const metrics = await this.ops.getWorkerQueueMetrics();
    if (metrics.connected && metrics.failed === 0 && metrics.delayed === 0) {
      return [];
    }
    return [{
      exceptionId: `worker_queue:${metrics.queueName}`,
      source: "worker_queue",
      targetType: "WorkerQueue",
      targetId: metrics.queueName,
      severity: !metrics.connected ? "critical" : metrics.failed > 0 ? "high" : "medium",
      status: metrics.failed > 0 ? "failed" : "open",
      title: !metrics.connected ? "Worker queue is disconnected" : "Worker queue needs attention",
      summary: `waiting=${metrics.waiting}, active=${metrics.active}, failed=${metrics.failed}, delayed=${metrics.delayed}`,
      occurredAt: new Date().toISOString(),
      correlationId: null,
      availableActions: ["ESCALATE"],
      runbookIds: ["service-health-diagnosis-v1", "incident-coordination-v1"],
      deepLink: "/admin/agents",
    }];
  }
}

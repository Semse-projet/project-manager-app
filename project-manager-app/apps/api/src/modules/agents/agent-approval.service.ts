import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import prismaClientPackage from "@prisma/client";
import type { AgentApprovalRequest } from "@semse/agents";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { resolveAuditLifecycleMode } from "../prometeo/tool-governance/tool-call-audit.js";

const { Prisma } = prismaClientPackage as typeof import("@prisma/client");

/** H05 (entrega B): estado de ejecución de una aprobación del copiloto. `undefined` = sin dato (anteriores a la migración). */
export type ApprovalExecutionStatus = "NOT_STARTED" | "EXECUTING" | "SUCCEEDED" | "FAILED";

type StoredApproval = AgentApprovalRequest & {
  tenantId: string;
  orgId: string;
  decisionComment?: string;
  decidedAt?: string;
  decidedByUserId?: string;
  executionStatus?: ApprovalExecutionStatus;
  executionStartedAt?: string;
  executionFinishedAt?: string;
  executionError?: string;
  executionId?: string;
};

type DbApprovalRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  runId: string;
  correlationId: string;
  agentType: string;
  title: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  riskLevel: string;
  riskScore: InstanceType<typeof Prisma.Decimal>;
  policyDecision: string;
  requiredApprovals: unknown;
  contextSummary: string | null;
  decisionComment: string | null;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  requestedAt: Date;
  executionStatus?: string | null;
  executionStartedAt?: Date | null;
  executionFinishedAt?: Date | null;
  executionError?: string | null;
  executionId?: string | null;
};

function toDbStatus(status: AgentApprovalRequest["status"]): DbApprovalRecord["status"] {
  switch (status) {
    case "approved":
      return "APPROVED";
    case "rejected":
      return "REJECTED";
    default:
      return "PENDING";
  }
}

function fromDbStatus(status: DbApprovalRecord["status"]): AgentApprovalRequest["status"] {
  switch (status) {
    case "APPROVED":
      return "approved";
    case "REJECTED":
      return "rejected";
    default:
      return "pending";
  }
}

@Injectable()
export class AgentApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
    private readonly auditService: AuditService
  ) {}

  async register(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    requestId: string;
    approvals: AgentApprovalRequest[];
  }): Promise<StoredApproval[]> {
    await this.actorContextService.ensureActorContext(input);

    const stored: StoredApproval[] = [];

    for (const approval of input.approvals) {
      const record = (await this.prisma.agentApproval.upsert({
        where: { id: approval.id },
        update: {
          tenantId: input.tenantId,
          orgId: input.orgId,
          runId: approval.runId,
          correlationId: approval.correlationId,
          agentType: approval.agentType,
          title: approval.title,
          reason: approval.reason,
          status: toDbStatus(approval.status),
          riskLevel: approval.riskLevel,
          riskScore: new Prisma.Decimal(approval.riskScore),
          policyDecision: approval.policyDecision,
          requiredApprovals: approval.requiredApprovals as unknown as import("@prisma/client").Prisma.InputJsonValue,
          contextSummary: approval.contextSummary ?? null
        },
        create: {
          id: approval.id,
          tenantId: input.tenantId,
          orgId: input.orgId,
          runId: approval.runId,
          correlationId: approval.correlationId,
          agentType: approval.agentType,
          title: approval.title,
          reason: approval.reason,
          status: toDbStatus(approval.status),
          riskLevel: approval.riskLevel,
          riskScore: new Prisma.Decimal(approval.riskScore),
          policyDecision: approval.policyDecision,
          requiredApprovals: approval.requiredApprovals as unknown as import("@prisma/client").Prisma.InputJsonValue,
          contextSummary: approval.contextSummary ?? null,
          requestedAt: new Date(approval.requestedAt)
        }
      })) as DbApprovalRecord;

      const entry = this.toRecord(record);
      stored.push(entry);

      await this.auditService.append({
        tenantId: input.tenantId,
        orgId: input.orgId,
        actorUserId: input.userId,
        action: "agent.approval.create",
        entityType: "AgentApproval",
        entityId: entry.id,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        afterJson: {
          runId: entry.runId,
          agentType: entry.agentType,
          status: entry.status,
          riskLevel: entry.riskLevel,
          riskScore: entry.riskScore
        }
      });
    }

    return stored;
  }

  async list(input: { tenantId: string; orgId?: string; userId?: string }): Promise<StoredApproval[]> {
    if (input.orgId && input.userId) {
      await this.actorContextService.ensureActorContext({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId
      });
    }

    const approvals = (await this.prisma.agentApproval.findMany({
      where: {
        tenantId: input.tenantId
      },
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }]
    })) as DbApprovalRecord[];

    return approvals.map((approval) => this.toRecord(approval));
  }

  async get(input: {
    tenantId: string;
    approvalId: string;
    orgId?: string;
    userId?: string;
  }): Promise<StoredApproval> {
    if (input.orgId && input.userId) {
      await this.actorContextService.ensureActorContext({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId
      });
    }

    const approval = (await this.prisma.agentApproval.findFirst({
      where: {
        id: input.approvalId,
        tenantId: input.tenantId
      }
    })) as DbApprovalRecord | null;

    if (!approval) {
      throw new NotFoundException(`Agent approval '${input.approvalId}' not found`);
    }

    return this.toRecord(approval);
  }

  async decide(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    approvalId: string;
    decision: "approved" | "rejected";
    comment?: string;
    requestId: string;
  }): Promise<StoredApproval> {
    await this.actorContextService.ensureActorContext(input);

    const approval = await this.get({
      tenantId: input.tenantId,
      approvalId: input.approvalId,
      orgId: input.orgId,
      userId: input.userId
    });

    if (approval.status !== "pending") {
      throw new ConflictException(
        `Approval '${input.approvalId}' has already been decided (${approval.status})`
      );
    }

    // Transición condicional: solo una decisión concurrente puede pasar de PENDING a un estado final.
    // H05: una aprobación de acción del copiloto nace con ejecución `NOT_STARTED` para que una caída entre aprobar y
    // ejecutar deje un estado explícito. Solo con el ciclo de vida activo: con `off` (o antes de aplicar la migración)
    // no se escriben las columnas nuevas.
    const trackExecution =
      input.decision === "approved" && approval.correlationId.startsWith("copilot:") && resolveAuditLifecycleMode() !== "off";
    const claimed = await this.prisma.agentApproval.updateMany({
      where: { id: approval.id, tenantId: input.tenantId, status: "PENDING" },
      data: {
        status: toDbStatus(input.decision),
        decisionComment: input.comment,
        decidedAt: new Date(),
        decidedByUserId: input.userId,
        ...(trackExecution ? { executionStatus: "NOT_STARTED" } : {})
      }
    });
    if (claimed.count !== 1) {
      throw new ConflictException(`Approval '${input.approvalId}' has already been decided`);
    }
    const row = await this.prisma.agentApproval.findFirst({ where: { id: approval.id, tenantId: input.tenantId } });
    if (!row) throw new NotFoundException(`Approval '${input.approvalId}' not found`);
    const updated = this.toRecord(row as DbApprovalRecord);

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "agent.approval.decision",
      entityType: "AgentApproval",
      entityId: updated.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        status: updated.status,
        decisionComment: updated.decisionComment,
        decidedAt: updated.decidedAt,
        runId: updated.runId
      }
    });

    return updated;
  }

  // ── H05 (entrega B): estado de ejecución ───────────────────────────────────

  /**
   * Reclama la ejecución con una transición condicional: como máximo un proceso pasa a `EXECUTING`. `from` son los
   * estados desde los que se puede reclamar (`NOT_STARTED` la primera vez; `FAILED` en un reintento manual).
   */
  async claimExecution(input: {
    tenantId: string;
    approvalId: string;
    executionId: string;
    from: ApprovalExecutionStatus[];
    now?: Date;
  }): Promise<boolean> {
    const result = await this.prisma.agentApproval.updateMany({
      where: {
        id: input.approvalId,
        tenantId: input.tenantId,
        status: "APPROVED",
        executionStatus: { in: input.from }
      },
      data: {
        executionStatus: "EXECUTING",
        executionStartedAt: input.now ?? new Date(),
        executionFinishedAt: null,
        executionError: null,
        executionId: input.executionId
      }
    });
    return result.count === 1;
  }

  /** Cierra la ejecución (`EXECUTING → SUCCEEDED | FAILED`); el error se guarda ya acotado. */
  async finishExecution(input: {
    tenantId: string;
    approvalId: string;
    status: "SUCCEEDED" | "FAILED";
    error?: string;
    now?: Date;
  }): Promise<boolean> {
    const result = await this.prisma.agentApproval.updateMany({
      where: { id: input.approvalId, tenantId: input.tenantId, executionStatus: "EXECUTING" },
      data: {
        executionStatus: input.status,
        executionFinishedAt: input.now ?? new Date(),
        executionError: input.error ? input.error.slice(0, 500) : null
      }
    });
    return result.count === 1;
  }

  /**
   * Barrido idempotente. NO reintenta efectos (decisión D2: ninguno tiene hoy idempotencia verificada): deja un estado
   * explícito para que un humano decida. `EXECUTING` caducado ⇒ `FAILED/INTERRUPTED`; aprobada sin llegar a ejecutarse
   * (`NOT_STARTED` caducada) ⇒ `FAILED/NOT_EXECUTED`. Devuelve cuántas filas cambió cada regla.
   */
  async reconcileExecutions(input: { olderThan: Date; now?: Date }): Promise<{ interrupted: number; notExecuted: number }> {
    const now = input.now ?? new Date();
    const interrupted = await this.prisma.agentApproval.updateMany({
      where: { status: "APPROVED", executionStatus: "EXECUTING", executionStartedAt: { lt: input.olderThan } },
      data: { executionStatus: "FAILED", executionFinishedAt: now, executionError: "INTERRUPTED" }
    });
    const notExecuted = await this.prisma.agentApproval.updateMany({
      where: { status: "APPROVED", executionStatus: "NOT_STARTED", decidedAt: { lt: input.olderThan } },
      data: { executionStatus: "FAILED", executionFinishedAt: now, executionError: "NOT_EXECUTED" }
    });
    return { interrupted: interrupted.count, notExecuted: notExecuted.count };
  }

  private toRecord(record: DbApprovalRecord): StoredApproval {
    return {
      id: record.id,
      tenantId: record.tenantId,
      orgId: record.orgId,
      runId: record.runId,
      correlationId: record.correlationId,
      agentType: record.agentType as AgentApprovalRequest["agentType"],
      title: record.title,
      reason: record.reason,
      status: fromDbStatus(record.status),
      riskLevel: record.riskLevel as AgentApprovalRequest["riskLevel"],
      riskScore: Number(record.riskScore),
      requestedAt: record.requestedAt.toISOString(),
      policyDecision: record.policyDecision as AgentApprovalRequest["policyDecision"],
      requiredApprovals: Array.isArray(record.requiredApprovals)
        ? record.requiredApprovals.filter((value): value is string => typeof value === "string")
        : [],
      contextSummary: record.contextSummary ?? undefined,
      decisionComment: record.decisionComment ?? undefined,
      decidedAt: record.decidedAt?.toISOString(),
      decidedByUserId: record.decidedByUserId ?? undefined,
      executionStatus: (record.executionStatus ?? undefined) as ApprovalExecutionStatus | undefined,
      executionStartedAt: record.executionStartedAt?.toISOString(),
      executionFinishedAt: record.executionFinishedAt?.toISOString(),
      executionError: record.executionError ?? undefined,
      executionId: record.executionId ?? undefined
    };
  }
}

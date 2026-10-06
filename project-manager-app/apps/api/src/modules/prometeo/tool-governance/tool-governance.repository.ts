import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";

/** Columnas de ciclo de vida y lineage (H05). Todas opcionales: el modo `off` no las escribe. */
export type ToolInvocationLifecycleFields = {
  executionId?: string;
  source?: string;
  runId?: string;
  sessionId?: string;
  threadId?: string;
  projectId?: string;
  agentId?: string;
  approvalId?: string;
  proposedActionId?: string;
  policyVersion?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  inputDigest?: string;
  outputDigest?: string;
  inputSummary?: string;
  outputSummary?: string;
  errorCode?: string;
  redactionVersion?: string;
  expiresAt?: Date;
};

export type ToolInvocationAuditInput = {
  tenantId: string;
  actorId: string;
  namespace: string;
  name: string;
  mode: string;
  status: string;
  blockedReason?: string;
  requestId: string;
} & ToolInvocationLifecycleFields;

export type ToolExecutionTerminalPatch = {
  status: string;
  blockedReason?: string;
  errorCode?: string;
  completedAt: Date;
  durationMs: number;
  outputDigest?: string;
  outputSummary?: string;
  expiresAt: Date;
};

export type ProposedActionStatus =
  | "PROPOSED"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED"
  | "EXECUTED";

export type ProposedActionRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  actorId: string;
  namespace: string;
  name: string;
  approvalPolicy: string;
  status: ProposedActionStatus;
  inputJson: Record<string, unknown>;
  requiredApprovals: string[];
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  executedAt: Date | null;
  resultJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProposedActionInput = {
  tenantId: string;
  orgId: string;
  actorId: string;
  namespace: string;
  name: string;
  approvalPolicy: string;
  inputJson: Record<string, unknown>;
  requiredApprovals: string[];
};

export type TransitionProposedActionInput = {
  tenantId: string;
  id: string;
  fromStatuses: ProposedActionStatus[];
  toStatus: ProposedActionStatus;
  patch: Record<string, unknown>;
};

export type FinalizeProposedActionInput = {
  id: string;
  status: ProposedActionStatus;
  resultJson?: unknown;
  executedAt?: Date;
};

function lifecycleData(input: ToolInvocationLifecycleFields) {
  return {
    executionId: input.executionId,
    source: input.source,
    runId: input.runId,
    sessionId: input.sessionId,
    threadId: input.threadId,
    projectId: input.projectId,
    agentId: input.agentId,
    approvalId: input.approvalId,
    proposedActionId: input.proposedActionId,
    policyVersion: input.policyVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.durationMs,
    inputDigest: input.inputDigest,
    outputDigest: input.outputDigest,
    inputSummary: input.inputSummary,
    outputSummary: input.outputSummary,
    errorCode: input.errorCode,
    redactionVersion: input.redactionVersion,
    expiresAt: input.expiresAt,
  };
}

function requirePrisma(prisma: PrismaService | undefined): PrismaService {
  if (!prisma) {
    throw new Error("Prometeo write-tool approvals require a PrismaService to be injected");
  }
  return prisma;
}

@Injectable()
export class ToolGovernanceRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async recordInvocation(input: ToolInvocationAuditInput): Promise<void> {
    if (!this.prisma) {
      return;
    }

    await this.prisma.prometeoToolInvocationAudit.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        namespace: input.namespace,
        name: input.name,
        mode: input.mode,
        status: input.status,
        blockedReason: input.blockedReason,
        requestId: input.requestId,
        ...lifecycleData(input),
      },
    });
  }

  // ── H05: ciclo de vida por ejecución ───────────────────────────────────────

  /** Crea la fila de INICIO (`status: started`). Falla si el `executionId` ya existe (unicidad). */
  async recordStart(input: Omit<ToolInvocationAuditInput, "status">): Promise<void> {
    const prisma = requirePrisma(this.prisma);
    await prisma.prometeoToolInvocationAudit.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        namespace: input.namespace,
        name: input.name,
        mode: input.mode,
        requestId: input.requestId,
        ...lifecycleData(input),
        status: "started",
      },
    });
  }

  /**
   * Cierra una ejecución. Transición condicional `started → terminal` y acotada al tenant: una segunda escritura
   * terminal no pisa la primera. Devuelve `false` si no había una fila `started` (ya cerrada o inexistente).
   */
  async recordTerminal(tenantId: string, executionId: string, patch: ToolExecutionTerminalPatch): Promise<boolean> {
    const prisma = requirePrisma(this.prisma);
    const result = await prisma.prometeoToolInvocationAudit.updateMany({
      where: { tenantId, executionId, status: "started" },
      data: {
        status: patch.status,
        blockedReason: patch.blockedReason,
        errorCode: patch.errorCode,
        completedAt: patch.completedAt,
        durationMs: patch.durationMs,
        outputDigest: patch.outputDigest,
        outputSummary: patch.outputSummary,
        expiresAt: patch.expiresAt,
      },
    });
    return result.count === 1;
  }

  /**
   * Barrido idempotente: una ejecución que lleva demasiado en `started` se dio por interrumpida (caída del proceso)
   * y pasa a `failed / INTERRUPTED`, para que no "desaparezca". Devuelve cuántas filas cambió.
   */
  async reconcileInterrupted(input: { olderThan: Date; now: Date; retentionDays: number }): Promise<number> {
    const prisma = requirePrisma(this.prisma);
    const result = await prisma.prometeoToolInvocationAudit.updateMany({
      where: { status: "started", startedAt: { lt: input.olderThan } },
      data: {
        status: "failed",
        errorCode: "INTERRUPTED",
        completedAt: input.now,
        expiresAt: new Date(input.now.getTime() + input.retentionDays * 86_400_000),
      },
    });
    return result.count;
  }

  /** Retención: borra el contenido redactado vencido; conserva digest, estado y tiempos. */
  async purgeExpiredContent(now: Date): Promise<number> {
    const prisma = requirePrisma(this.prisma);
    const result = await prisma.prometeoToolInvocationAudit.updateMany({
      where: { expiresAt: { lt: now }, OR: [{ inputSummary: { not: null } }, { outputSummary: { not: null } }] },
      data: { inputSummary: null, outputSummary: null },
    });
    return result.count;
  }

  async findExecution(tenantId: string, executionId: string) {
    const prisma = requirePrisma(this.prisma);
    return prisma.prometeoToolInvocationAudit.findFirst({ where: { tenantId, executionId } });
  }

  async listExecutionsByProject(input: { tenantId: string; projectId: string; limit?: number }) {
    const prisma = requirePrisma(this.prisma);
    return prisma.prometeoToolInvocationAudit.findMany({
      where: { tenantId: input.tenantId, projectId: input.projectId, executionId: { not: null } },
      orderBy: { startedAt: "desc" },
      take: Math.min(Math.max(input.limit ?? 50, 1), 200),
    });
  }

  async createProposedAction(input: CreateProposedActionInput): Promise<ProposedActionRecord> {
    const prisma = requirePrisma(this.prisma);
    const created = await prisma.prometeoProposedAction.create({
      data: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        actorId: input.actorId,
        namespace: input.namespace,
        name: input.name,
        approvalPolicy: input.approvalPolicy,
        inputJson: input.inputJson as never,
        requiredApprovals: input.requiredApprovals,
      },
    });
    return created as unknown as ProposedActionRecord;
  }

  async findProposedAction(input: { tenantId: string; id: string }): Promise<ProposedActionRecord | null> {
    const prisma = requirePrisma(this.prisma);
    const found = await prisma.prometeoProposedAction.findFirst({
      where: { id: input.id, tenantId: input.tenantId },
    });
    return found as unknown as ProposedActionRecord | null;
  }

  /**
   * Conditionally moves a proposed action out of `fromStatuses` into `toStatus`
   * with a single atomic update. Returns false (instead of throwing) when the
   * row was already transitioned by a concurrent caller, so two parallel
   * approve/reject calls can never both "win" — exactly one executes.
   */
  async transitionProposedAction(input: TransitionProposedActionInput): Promise<boolean> {
    const prisma = requirePrisma(this.prisma);
    const { count } = await prisma.prometeoProposedAction.updateMany({
      where: { id: input.id, tenantId: input.tenantId, status: { in: input.fromStatuses } },
      data: { status: input.toStatus, ...input.patch },
    });
    return count === 1;
  }

  async finalizeProposedAction(input: FinalizeProposedActionInput): Promise<void> {
    const prisma = requirePrisma(this.prisma);
    await prisma.prometeoProposedAction.update({
      where: { id: input.id },
      data: {
        status: input.status,
        resultJson: input.resultJson === undefined ? undefined : (input.resultJson as never),
        executedAt: input.executedAt,
      },
    });
  }
}

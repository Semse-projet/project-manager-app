import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";

export type ToolInvocationAuditInput = {
  tenantId: string;
  actorId: string;
  namespace: string;
  name: string;
  mode: string;
  status: string;
  blockedReason?: string;
  requestId: string;
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
      },
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

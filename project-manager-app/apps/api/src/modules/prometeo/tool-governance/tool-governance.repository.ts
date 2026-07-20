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

export type ProposedActionRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  actorId: string;
  namespace: string;
  name: string;
  approvalPolicy: string;
  status: "PROPOSED" | "AWAITING_APPROVAL" | "APPROVED" | "REJECTED" | "BLOCKED" | "EXECUTED";
  inputJson: unknown;
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
  inputJson: unknown;
};

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
    return this.requirePrisma().prometeoProposedAction.create({
      data: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        actorId: input.actorId,
        namespace: input.namespace,
        name: input.name,
        approvalPolicy: input.approvalPolicy,
        status: "AWAITING_APPROVAL",
        inputJson: input.inputJson as never,
      },
    }) as Promise<ProposedActionRecord>;
  }

  async findProposedAction(input: { id: string; tenantId: string }): Promise<ProposedActionRecord | null> {
    return this.requirePrisma().prometeoProposedAction.findFirst({
      where: { id: input.id, tenantId: input.tenantId },
    }) as Promise<ProposedActionRecord | null>;
  }

  /** Atomically claims a still-pending proposal. Returns null if it was already terminal (race-safe). */
  async claimForApproval(input: { id: string; tenantId: string; approvedBy: string }): Promise<boolean> {
    const result = await this.requirePrisma().prometeoProposedAction.updateMany({
      where: { id: input.id, tenantId: input.tenantId, status: "AWAITING_APPROVAL" },
      data: { status: "APPROVED", approvedBy: input.approvedBy, approvedAt: new Date() },
    });
    return result.count === 1;
  }

  async markExecuted(input: { id: string; tenantId: string; resultJson: unknown }): Promise<void> {
    await this.requirePrisma().prometeoProposedAction.update({
      where: { id: input.id },
      data: { status: "EXECUTED", executedAt: new Date(), resultJson: input.resultJson as never },
    });
  }

  /** Atomically rejects a still-pending proposal. Returns false if it was already terminal (race-safe). */
  async reject(input: { id: string; tenantId: string; rejectedBy: string; reason: string }): Promise<boolean> {
    const result = await this.requirePrisma().prometeoProposedAction.updateMany({
      where: { id: input.id, tenantId: input.tenantId, status: "AWAITING_APPROVAL" },
      data: {
        status: "REJECTED",
        rejectedBy: input.rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: input.reason,
      },
    });
    return result.count === 1;
  }

  private requirePrisma(): PrismaService {
    if (!this.prisma) {
      throw new Error("PrismaService is required for tool-governance proposed action operations");
    }
    return this.prisma;
  }
}

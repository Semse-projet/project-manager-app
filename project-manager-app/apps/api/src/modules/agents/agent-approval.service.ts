import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import prismaClientPackage from "@prisma/client";
import type { AgentApprovalRequest } from "@semse/agents";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

const { Prisma } = prismaClientPackage as typeof import("@prisma/client");

type StoredApproval = AgentApprovalRequest & {
  tenantId: string;
  orgId: string;
  decisionComment?: string;
  decidedAt?: string;
  decidedByUserId?: string;
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

    const updated = this.toRecord(
      (await this.prisma.agentApproval.update({
        where: { id: approval.id },
        data: {
          status: toDbStatus(input.decision),
          decisionComment: input.comment,
          decidedAt: new Date(),
          decidedByUserId: input.userId
        }
      })) as DbApprovalRecord
    );

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
      decidedByUserId: record.decidedByUserId ?? undefined
    };
  }
}

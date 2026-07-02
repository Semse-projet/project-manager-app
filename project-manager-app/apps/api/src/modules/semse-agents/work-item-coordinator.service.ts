import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type {
  WorkItem,
  DecisionPackage,
  HarnessRiskLevel,
} from "@semse/agents";

export type CreateWorkItemInput = {
  tenantId: string;
  humanOwner: string;
  objective: string;
  riskLevel: HarnessRiskLevel;
  suggestedAgents?: string[];
  allowedTools?: string[];
  forbiddenTools?: string[];
  acceptanceCriteria?: string[];
  rollbackRequired?: boolean;
  contextRefs?: string[];
  services?: string[];
};

export type WorkItemRecord = {
  id: string;
  tenantId: string;
  humanOwner: string;
  objective: string;
  riskLevel: string;
  status: string;
  suggestedAgents: string[];
  allowedTools: string[];
  forbiddenTools: string[];
  acceptanceCriteria: string[];
  rollbackRequired: boolean;
  contextRefs: string[];
  services: string[];
  decisionPackage: DecisionPackage | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class WorkItemCoordinatorService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkItem(input: CreateWorkItemInput): Promise<WorkItemRecord> {
    const item = await this.prisma.harnessWorkItem.create({
      data: {
        tenantId: input.tenantId,
        humanOwner: input.humanOwner,
        objective: input.objective,
        riskLevel: input.riskLevel,
        status: "open",
        suggestedAgents: input.suggestedAgents ?? [],
        allowedTools: input.allowedTools ?? [],
        forbiddenTools: input.forbiddenTools ?? [],
        acceptanceCriteria: input.acceptanceCriteria ?? [],
        rollbackRequired: input.rollbackRequired ?? false,
        contextRefsJson: input.contextRefs ?? [],
        servicesJson: input.services ?? [],
      },
    });
    return this.toRecord(item);
  }

  async getWorkItem(id: string, tenantId: string): Promise<WorkItemRecord | null> {
    const item = await this.prisma.harnessWorkItem.findFirst({ where: { id, tenantId } });
    return item ? this.toRecord(item) : null;
  }

  async listWorkItems(tenantId: string, status?: string): Promise<WorkItemRecord[]> {
    const items = await this.prisma.harnessWorkItem.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return items.map((item) => this.toRecord(item));
  }

  async resolveWorkItem(
    id: string,
    tenantId: string,
    decisionPackage: DecisionPackage,
    resolvedBy: string,
  ): Promise<WorkItemRecord> {
    const approved = decisionPackage.recommendation === "approve";
    const rejected = decisionPackage.recommendation === "reject";
    const now = new Date();

    const item = await this.prisma.harnessWorkItem.update({
      where: { id },
      data: {
        status: approved ? "approved" : rejected ? "rejected" : "awaiting_approval",
        decisionPackageJson: decisionPackage as unknown as Prisma.InputJsonValue,
        ...(approved ? { approvedAt: now, approvedBy: resolvedBy } : {}),
        ...(rejected ? { rejectedAt: now, rejectedBy: resolvedBy } : {}),
      },
    });
    return this.toRecord(item);
  }

  toWorkItem(record: WorkItemRecord): WorkItem {
    return {
      id: record.id,
      objective: record.objective,
      riskLevel: record.riskLevel as HarnessRiskLevel,
      services: record.services,
      humanOwner: record.humanOwner,
      suggestedAgents: record.suggestedAgents,
      contextRefs: record.contextRefs,
      allowedTools: record.allowedTools,
      forbiddenTools: record.forbiddenTools,
      acceptanceCriteria: record.acceptanceCriteria,
      rollbackRequired: record.rollbackRequired,
    };
  }

  private toRecord(item: {
    id: string;
    tenantId: string;
    humanOwner: string;
    objective: string;
    riskLevel: string;
    status: string;
    suggestedAgents: string[];
    allowedTools: string[];
    forbiddenTools: string[];
    acceptanceCriteria: string[];
    rollbackRequired: boolean;
    contextRefsJson: unknown;
    servicesJson: unknown;
    decisionPackageJson: unknown;
    approvedAt: Date | null;
    approvedBy: string | null;
    rejectedAt: Date | null;
    rejectedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): WorkItemRecord {
    return {
      id: item.id,
      tenantId: item.tenantId,
      humanOwner: item.humanOwner,
      objective: item.objective,
      riskLevel: item.riskLevel,
      status: item.status,
      suggestedAgents: item.suggestedAgents,
      allowedTools: item.allowedTools,
      forbiddenTools: item.forbiddenTools,
      acceptanceCriteria: item.acceptanceCriteria,
      rollbackRequired: item.rollbackRequired,
      contextRefs: Array.isArray(item.contextRefsJson) ? (item.contextRefsJson as string[]) : [],
      services: Array.isArray(item.servicesJson) ? (item.servicesJson as string[]) : [],
      decisionPackage: item.decisionPackageJson as DecisionPackage | null,
      approvedAt: item.approvedAt?.toISOString() ?? null,
      approvedBy: item.approvedBy,
      rejectedAt: item.rejectedAt?.toISOString() ?? null,
      rejectedBy: item.rejectedBy,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

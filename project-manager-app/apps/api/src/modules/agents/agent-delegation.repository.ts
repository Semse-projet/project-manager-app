import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class AgentDelegationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    tenantId: string;
    orgId: string;
    projectId?: string;
    sourceRunId?: string;
    coordinatorId: string;
    targetAgentId: string;
    taskTitle: string;
    taskContextJson: Record<string, unknown>;
  }) {
    return this.prisma.agentDelegation.create({
      data: {
        ...data,
        taskContextJson: data.taskContextJson as any,
        status: "pending",
      },
    });
  }

  async attachTargetRun(id: string, tenantId: string, targetRunId: string) {
    return this.prisma.agentDelegation.update({
      where: { id, tenantId },
      data: { targetRunId, status: "executing" },
    });
  }

  async updateStatus(id: string, tenantId: string, status: string, resultJson?: Record<string, unknown>, error?: string) {
    return this.prisma.agentDelegation.update({
      where: { id, tenantId },
      data: {
        status,
        ...(resultJson && { resultJson: resultJson as any }),
        ...(error && { error }),
      },
    });
  }

  async findById(id: string, tenantId: string) {
    return this.prisma.agentDelegation.findUnique({
      where: { id, tenantId },
    });
  }

  async listByCoordinator(input: {
    tenantId: string;
    coordinatorId: string;
    projectId?: string;
    statuses?: string[];
    limit?: number;
  }) {
    return this.prisma.agentDelegation.findMany({
      where: {
        tenantId: input.tenantId,
        coordinatorId: input.coordinatorId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.statuses?.length ? { status: { in: input.statuses } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
    });
  }

  async listByProject(input: {
    tenantId: string;
    projectId: string;
    statuses?: string[];
    limit?: number;
  }) {
    return this.prisma.agentDelegation.findMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        ...(input.statuses?.length ? { status: { in: input.statuses } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
    });
  }

  async countByCoordinator(input: { tenantId: string; coordinatorId: string; projectId?: string }) {
    return this.prisma.agentDelegation.groupBy({
      by: ["status"],
      where: {
        tenantId: input.tenantId,
        coordinatorId: input.coordinatorId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
      },
      _count: { id: true },
    });
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

@Injectable()
export class AgroTaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listTasks(farmId: string, filters?: { status?: string; targetType?: string; targetId?: string }) {
    return this.prisma.agroFarmTask.findMany({
      where: {
        farmId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.targetType && { targetType: filters.targetType }),
        ...(filters?.targetId && { targetId: filters.targetId }),
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });
  }

  async findTask(taskId: string) {
    return this.prisma.agroFarmTask.findUnique({ where: { id: taskId } });
  }

  async createTask(input: {
    farmId: string;
    title: string;
    type: string;
    targetType?: string;
    targetId?: string;
    assignedToId?: string;
    priority?: string;
    dueAt?: Date;
    notes?: string;
  }) {
    return this.prisma.agroFarmTask.create({
      data: {
        farmId: input.farmId,
        title: input.title,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        assignedToId: input.assignedToId,
        status: "PENDING",
        priority: input.priority ?? "MEDIUM",
        dueAt: input.dueAt,
        notes: input.notes,
      },
    });
  }

  async updateTask(taskId: string, input: {
    title?: string;
    assignedToId?: string;
    priority?: string;
    dueAt?: Date | null;
    notes?: string;
    status?: string;
    startedAt?: Date | null;
    completedAt?: Date | null;
    blockedAt?: Date | null;
    cancelledAt?: Date | null;
    blockReason?: string | null;
    cancelReason?: string | null;
  }) {
    return this.prisma.agroFarmTask.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.assignedToId !== undefined && { assignedToId: input.assignedToId }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.dueAt !== undefined && { dueAt: input.dueAt }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
        ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
        ...(input.blockedAt !== undefined && { blockedAt: input.blockedAt }),
        ...(input.cancelledAt !== undefined && { cancelledAt: input.cancelledAt }),
        ...(input.blockReason !== undefined && { blockReason: input.blockReason }),
        ...(input.cancelReason !== undefined && { cancelReason: input.cancelReason }),
      },
    });
  }

  async getEntityTimeline(farmId: string, entityType: string, entityId: string) {
    return this.prisma.agroAuditEvent.findMany({
      where: { farmId, entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}

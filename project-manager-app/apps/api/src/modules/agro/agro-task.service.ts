import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";
import { AgroTaskRepository } from "./agro-task.repository.js";

const VALID_TYPES = [
  "FEEDING", "VACCINATION", "TREATMENT", "WEIGHING", "MOVEMENT",
  "CLEANING", "INSPECTION", "INVENTORY", "SALE", "WATER_CHECK", "OTHER",
] as const;

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const VALID_TARGET_TYPES = [
  "ANIMAL", "ANIMAL_GROUP", "FARM_UNIT", "INVENTORY", "GENERAL",
] as const;

// FSM: allowed transitions
const TRANSITIONS: Record<string, string[]> = {
  PENDING:     ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "BLOCKED", "CANCELLED"],
  BLOCKED:     ["PENDING", "IN_PROGRESS", "CANCELLED"],
  COMPLETED:   [],
  CANCELLED:   [],
};

@Injectable()
export class AgroTaskService {
  constructor(
    private readonly repo: AgroTaskRepository,
    private readonly farmRepo: AgroFarmRepository,
    private readonly audit: AgroAuditRepository,
  ) {}

  private async assertFarmAccess(farmId: string, ownerId: string) {
    const farm = await this.farmRepo.findFarm(farmId);
    if (!farm || farm.ownerId !== ownerId) throw new NotFoundException(`Farm not found: ${farmId}`);
    return farm;
  }

  async listTasks(farmId: string, ownerId: string, filters?: { status?: string; targetType?: string; targetId?: string }) {
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.listTasks(farmId, filters);
  }

  async getTask(taskId: string) {
    const task = await this.repo.findTask(taskId);
    if (!task) throw new NotFoundException(`Task not found: ${taskId}`);
    return task;
  }

  async listEntityTasks(farmId: string, ownerId: string, targetType: string, targetId: string) {
    await this.assertFarmAccess(farmId, ownerId);
    return this.repo.listTasks(farmId, { targetType, targetId });
  }

  async createTask(farmId: string, ownerId: string, input: {
    title: string;
    type: string;
    targetType?: string;
    targetId?: string;
    assignedToId?: string;
    priority?: string;
    dueAt?: Date;
    notes?: string;
  }) {
    await this.assertFarmAccess(farmId, ownerId);
    if (!input.title?.trim()) throw new BadRequestException("Task title is required");
    if (!VALID_TYPES.includes(input.type as any)) {
      throw new BadRequestException(`Invalid task type: ${input.type}`);
    }
    if (input.priority && !VALID_PRIORITIES.includes(input.priority as any)) {
      throw new BadRequestException(`Invalid priority: ${input.priority}`);
    }
    if (input.targetType && !VALID_TARGET_TYPES.includes(input.targetType as any)) {
      throw new BadRequestException(`Invalid targetType: ${input.targetType}`);
    }

    const task = await this.repo.createTask({ farmId, ...input });
    await this.audit.record({
      farmId, actorId: ownerId,
      entityType: "AgroFarmTask", entityId: task.id,
      action: "task.created",
      after: { title: task.title, type: task.type, status: task.status },
      source: "WEB",
    });
    return task;
  }

  async updateTask(taskId: string, ownerId: string, input: {
    title?: string;
    assignedToId?: string;
    priority?: string;
    dueAt?: Date | null;
    notes?: string;
  }) {
    const task = await this.getTask(taskId);
    await this.assertFarmAccess(task.farmId, ownerId);
    if (["COMPLETED", "CANCELLED"].includes(task.status)) {
      throw new BadRequestException(`Cannot edit task with status: ${task.status}`);
    }
    if (input.priority && !VALID_PRIORITIES.includes(input.priority as any)) {
      throw new BadRequestException(`Invalid priority: ${input.priority}`);
    }

    const updated = await this.repo.updateTask(taskId, input);
    await this.audit.record({
      farmId: task.farmId, actorId: ownerId,
      entityType: "AgroFarmTask", entityId: taskId,
      action: "task.updated",
      before: { title: task.title, priority: task.priority },
      after: { title: updated.title, priority: updated.priority },
      source: "WEB",
    });
    return updated;
  }

  private async transition(taskId: string, ownerId: string, toStatus: string, extra?: {
    blockReason?: string;
    cancelReason?: string;
  }) {
    const task = await this.getTask(taskId);
    await this.assertFarmAccess(task.farmId, ownerId);
    const allowed = TRANSITIONS[task.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(`Cannot transition task from ${task.status} to ${toStatus}`);
    }

    const now = new Date();
    const patch: Parameters<typeof this.repo.updateTask>[1] = { status: toStatus };
    if (toStatus === "IN_PROGRESS") patch.startedAt = now;
    if (toStatus === "COMPLETED")   patch.completedAt = now;
    if (toStatus === "BLOCKED")     { patch.blockedAt = now; patch.blockReason = extra?.blockReason ?? null; }
    if (toStatus === "CANCELLED")   { patch.cancelledAt = now; patch.cancelReason = extra?.cancelReason ?? null; }

    const updated = await this.repo.updateTask(taskId, patch);
    await this.audit.record({
      farmId: task.farmId, actorId: ownerId,
      entityType: "AgroFarmTask", entityId: taskId,
      action: `task.${toStatus.toLowerCase()}`,
      before: { status: task.status },
      after: { status: toStatus, ...extra },
      source: "WEB",
    });
    return updated;
  }

  async startTask(taskId: string, ownerId: string) {
    return this.transition(taskId, ownerId, "IN_PROGRESS");
  }

  async completeTask(taskId: string, ownerId: string) {
    return this.transition(taskId, ownerId, "COMPLETED");
  }

  async blockTask(taskId: string, ownerId: string, reason?: string) {
    return this.transition(taskId, ownerId, "BLOCKED", { blockReason: reason });
  }

  async cancelTask(taskId: string, ownerId: string, reason?: string) {
    return this.transition(taskId, ownerId, "CANCELLED", { cancelReason: reason });
  }

  async getTaskTimeline(taskId: string, ownerId: string) {
    const task = await this.getTask(taskId);
    await this.assertFarmAccess(task.farmId, ownerId);
    return this.repo.getEntityTimeline(task.farmId, "AgroFarmTask", taskId);
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { databaseEnabled } from "../../infrastructure/persistence/persistence-mode.js";

export interface TaskRecord {
  id: string;
  tenantId: string;
  jobId: string | null;
  milestone: string | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function toTaskRecord(row: {
  id: string;
  tenantId: string;
  jobId: string | null;
  milestone: string | null;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): TaskRecord {
  return {
    ...row,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const MOCK_TASKS: TaskRecord[] = [];

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listByWorker(input: { tenantId: string; userId: string; status?: string }): Promise<TaskRecord[]> {
    if (!databaseEnabled()) return MOCK_TASKS;

    const rows = await this.prisma.jobTask.findMany({
      where: {
        tenantId: input.tenantId,
        assignedTo: input.userId,
        deletedAt: null,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(toTaskRecord);
  }

  async listByJob(input: { tenantId: string; jobId: string }): Promise<TaskRecord[]> {
    if (!databaseEnabled()) return MOCK_TASKS;

    const rows = await this.prisma.jobTask.findMany({
      where: { tenantId: input.tenantId, jobId: input.jobId, deletedAt: null },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toTaskRecord);
  }

  async create(input: {
    tenantId: string;
    jobId: string;
    milestone: string;
    title: string;
    description?: string;
    dueDate?: string;
    priority?: string;
    assignedTo?: string;
    createdBy: string;
  }): Promise<TaskRecord> {
    if (!input.title.trim()) throw new BadRequestException("title required");

    if (!databaseEnabled()) {
      const mock: TaskRecord = {
        id: `task_${Date.now()}`,
        tenantId: input.tenantId,
        jobId: input.jobId,
        milestone: input.milestone,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? "medium",
        status: "pending",
        assignedTo: input.assignedTo ?? null,
        createdBy: input.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      MOCK_TASKS.push(mock);
      return mock;
    }

    const row = await this.prisma.jobTask.create({
      data: {
        tenantId: input.tenantId,
        jobId: input.jobId,
        milestone: input.milestone,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        priority: input.priority ?? "medium",
        assignedTo: input.assignedTo,
        createdBy: input.createdBy,
      },
    });
    return toTaskRecord(row);
  }

  async updateStatus(input: { tenantId: string; taskId: string; status: string }): Promise<TaskRecord> {
    const allowed = ["pending", "in_progress", "done", "blocked"];
    if (!allowed.includes(input.status)) throw new BadRequestException("invalid status");

    if (!databaseEnabled()) {
      const t = MOCK_TASKS.find(t => t.id === input.taskId);
      if (!t) throw new NotFoundException("task not found");
      t.status = input.status;
      return t;
    }

    const row = await this.prisma.jobTask.update({
      where: { id: input.taskId, tenantId: input.tenantId },
      data: { status: input.status },
    });
    return toTaskRecord(row);
  }
}

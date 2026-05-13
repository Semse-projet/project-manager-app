import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  type BuildOpsMilestoneDto,
  type BuildOpsOverviewDto,
  type BuildOpsProjectDto,
  type BuildOpsTaskDto,
  type BuildOpsTaskPriority,
  type BuildOpsTaskStatus,
  type BuildOpsProjectStatus,
  type BuildOpsRiskLevel
} from "./buildops.types.js";

type StoredBuildOpsProject = {
  id: string;
  tenantId: string;
  orgId: string;
  jobId: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  trade: string;
  projectType: string;
  clientName: string;
  professionalName: string | null;
  location: string;
  budgetEstimate: Prisma.Decimal | null;
  status: string;
  riskScore: number;
  riskLevel: string;
  startDate: Date | null;
  dueDate: Date | null;
  sourceTool: string | null;
  sourceToolInput: Prisma.JsonValue | null;
  sourceToolResult: Prisma.JsonValue | null;
  clientPlanApprovalStatus: string;
  clientPlanApprovedAt: Date | null;
  clientPlanApprovedById: string | null;
  clientPlanApprovalSource: string | null;
  clientPlanReviewedAt: Date | null;
  clientPlanReviewComment: string | null;
  legacyPromotionStatus: string;
  legacyPromotedAt: Date | null;
  completion: number;
  createdAt: Date;
  updatedAt: Date;
};

type StoredBuildOpsTask = {
  id: string;
  tenantId: string;
  orgId: string;
  projectId: string | null;
  createdBy: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeName: string | null;
  assigneeUserId: string | null;
  dueDate: Date | null;
  completion: number;
  sourceTool: string | null;
  evidenceRequired: Prisma.JsonValue | null;
  project?: { title: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredBuildOpsMilestone = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  amount: Prisma.Decimal;
  sequence: number;
  status: string;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: { job: { title: string } };
  _count?: { evidence: number };
};

const RISK_LEVELS = new Set<BuildOpsRiskLevel>(["low", "medium", "high", "critical"]);
const TASK_STATUSES = new Set<BuildOpsTaskStatus>(["todo", "in_progress", "blocked", "done", "canceled"]);
const TASK_PRIORITIES = new Set<BuildOpsTaskPriority>(["low", "medium", "high", "urgent"]);
const MILESTONE_STATUSES = new Set<BuildOpsMilestoneDto["status"]>(["draft", "awaiting_review", "submitted", "approved", "rejected", "paid"]);
const BUILDOPS_SOURCE_TOOL_RESULT_SCHEMA_VERSION = "1.0";

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toDateString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeSourceToolResult(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    schemaVersion: BUILDOPS_SOURCE_TOOL_RESULT_SCHEMA_VERSION,
  };
}

@Injectable()
export class BuildOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string): Promise<BuildOpsOverviewDto> {
    const [projects, tasks, milestones, evidence, disputes] = await Promise.all([
      this.prisma.buildOpsProject.findMany({
        where: { tenantId },
        select: { status: true, riskLevel: true },
      }),
      this.prisma.buildOpsTask.count({
        where: {
          tenantId,
          dueDate: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
          status: { in: ["todo", "in_progress", "blocked"] },
        },
      }),
      this.prisma.milestone.count({
        where: {
          project: { tenantId },
          deletedAt: null,
          status: { in: ["AWAITING_REVIEW", "SUBMITTED"] },
        },
      }),
      this.prisma.evidence.count({
        where: {
          project: { tenantId },
          validationStatus: { in: ["pending", "manual_review"] },
        },
      }),
      this.prisma.dispute.count({
        where: {
          tenantId,
          status: { in: ["OPEN", "ASSIGNED", "UNDER_REVIEW"] },
        },
      }),
    ]);

    const activeProjects = projects.filter((project) => ["approved", "in_progress", "paused"].includes(project.status)).length;
    const draftEstimates = projects.filter((project) => ["draft", "estimating"].includes(project.status)).length;
    const tasksDue = tasks;
    const milestonesPending = milestones;
    const evidencePending = evidence;
    const riskAlerts =
      projects.filter((project) => ["high", "critical"].includes(project.riskLevel)).length + disputes;

    const recentActivity = (await this.prisma.buildOpsProject.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { title: true, trade: true, status: true, updatedAt: true },
    })).map((project) => `${project.title} · ${project.trade} · ${project.status}`);

    return {
      activeProjects,
      draftEstimates,
      tasksDue,
      milestonesPending,
      evidencePending,
      riskAlerts,
      recentActivity: recentActivity.length > 0 ? recentActivity : ["No activity yet"],
    };
  }

  async listTasks(tenantId: string, filters?: { projectId?: string | null; status?: string | null }): Promise<BuildOpsTaskDto[]> {
    const tasks = (await this.prisma.buildOpsTask.findMany({
      where: {
        tenantId,
        ...(filters?.projectId ? { projectId: filters.projectId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      include: { project: { select: { title: true } } },
    })) as StoredBuildOpsTask[];

    return tasks.map((task) => this.toTaskDto(task));
  }

  async listMilestones(tenantId: string): Promise<BuildOpsMilestoneDto[]> {
    const milestones = (await this.prisma.milestone.findMany({
      where: {
        deletedAt: null,
        project: { tenantId },
      },
      include: {
        project: { select: { job: { select: { title: true } } } },
        _count: { select: { evidence: true } },
      },
      orderBy: [{ projectId: "asc" }, { sequence: "asc" }],
    })) as StoredBuildOpsMilestone[];

    return milestones.map((milestone) => this.toMilestoneDto(milestone));
  }

  async getTask(tenantId: string, taskId: string): Promise<BuildOpsTaskDto> {
    const task = (await this.prisma.buildOpsTask.findFirst({
      where: { tenantId, id: taskId },
      include: { project: { select: { title: true } } },
    })) as StoredBuildOpsTask | null;

    if (!task) {
      throw new NotFoundException("BuildOps task not found");
    }

    return this.toTaskDto(task);
  }

  async listProjects(tenantId: string): Promise<BuildOpsProjectDto[]> {
    const projects = (await this.prisma.buildOpsProject.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    })) as StoredBuildOpsProject[];

    return projects.map((project) => this.toDto(project));
  }

  async getProject(tenantId: string, projectId: string): Promise<BuildOpsProjectDto> {
    const project = (await this.prisma.buildOpsProject.findFirst({
      where: { tenantId, id: projectId },
    })) as StoredBuildOpsProject | null;

    if (!project) {
      throw new NotFoundException("BuildOps project not found");
    }

    return this.toDto(project);
  }

  async recoverStalePromotions(input: { tenantId: string; olderThanMinutes?: number }): Promise<{ recovered: number; cutoff: string }> {
    const olderThanMinutes = Math.max(5, Math.min(input.olderThanMinutes ?? 15, 24 * 60));
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const result = await this.prisma.buildOpsProject.updateMany({
      where: {
        tenantId: input.tenantId,
        legacyPromotionStatus: "promoting",
        updatedAt: { lt: cutoff },
      },
      data: {
        legacyPromotionStatus: "failed",
      },
    });

    return {
      recovered: result.count,
      cutoff: cutoff.toISOString(),
    };
  }

  async createProject(input: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    title: string;
    description?: string | null;
    trade: string;
    projectType: string;
    clientName: string;
    professionalName?: string | null;
    location: string;
    budgetEstimate?: number | null;
    status?: BuildOpsProjectStatus;
    riskScore?: number;
    riskLevel?: BuildOpsRiskLevel;
    startDate?: string | null;
    dueDate?: string | null;
    sourceTool?: string | null;
    sourceToolInput?: Record<string, unknown> | null;
    sourceToolResult?: Record<string, unknown> | null;
  }): Promise<BuildOpsProjectDto> {
    const project = (await this.prisma.buildOpsProject.create({
      data: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        createdBy: input.createdBy,
        title: input.title,
        description: input.description ?? null,
        trade: input.trade,
        projectType: input.projectType,
        clientName: input.clientName,
        professionalName: input.professionalName ?? null,
        location: input.location,
        budgetEstimate: input.budgetEstimate != null ? new Prisma.Decimal(input.budgetEstimate) : null,
        status: input.status ?? "draft",
        riskScore: input.riskScore ?? 0,
        riskLevel: input.riskLevel ?? "low",
        startDate: input.startDate ? new Date(input.startDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        sourceTool: input.sourceTool ?? null,
        completion: input.status && input.status !== "draft" ? 15 : 0,
        sourceToolInput: input.sourceToolInput ? (input.sourceToolInput as Prisma.InputJsonValue) : undefined,
        sourceToolResult: input.sourceToolResult
          ? (normalizeSourceToolResult(input.sourceToolResult) as Prisma.InputJsonValue)
          : undefined,
      },
    })) as StoredBuildOpsProject;

    return this.toDto(project);
  }

  async createFromToolResult(input: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    sourceTool: string;
    sourceToolInput: Record<string, unknown>;
    sourceToolResult: Record<string, unknown>;
    title?: string | null;
    description?: string | null;
    trade?: string | null;
    projectType?: string | null;
    clientName?: string | null;
    professionalName?: string | null;
    location?: string | null;
  }): Promise<BuildOpsProjectDto> {
    const result = input.sourceToolResult as Record<string, unknown> | undefined;
    const costs = result?.costs && typeof result.costs === "object" ? (result.costs as Record<string, unknown>) : {};
    const risk = result?.risk && typeof result.risk === "object" ? (result.risk as Record<string, unknown>) : {};

    const title = input.title?.trim() || `${input.sourceTool} estimate`;
    const trade = input.trade?.trim() || String(result?.trade ?? input.sourceTool);
    const projectType = input.projectType?.trim() || String(result?.projectType ?? "estimate");
    const clientName = input.clientName?.trim() || "Client";
    const location = input.location?.trim() || "TBD";

    const budgetEstimate = toNumber(costs.totalClientPrice ?? costs.total ?? costs.totalCost, 0);
    const riskScore = toNumber(risk.score ?? result?.riskScore, 0);
    const riskLevelCandidate = String(risk.level ?? result?.riskLevel ?? "low") as BuildOpsRiskLevel;
    const riskLevel = RISK_LEVELS.has(riskLevelCandidate) ? riskLevelCandidate : "low";

    return this.createProject({
      tenantId: input.tenantId,
      orgId: input.orgId,
      createdBy: input.createdBy,
      title,
      description: input.description ?? null,
      trade,
      projectType,
      clientName,
      professionalName: input.professionalName ?? null,
      location,
      budgetEstimate,
      status: "estimating",
      riskScore,
      riskLevel,
      sourceTool: input.sourceTool,
      sourceToolInput: input.sourceToolInput,
      sourceToolResult: normalizeSourceToolResult(input.sourceToolResult),
    });
  }

  async createTask(input: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    title: string;
    description?: string | null;
    projectId?: string | null;
    status?: BuildOpsTaskStatus;
    priority?: BuildOpsTaskPriority;
    assigneeName?: string | null;
    assigneeUserId?: string | null;
    dueDate?: string | null;
    sourceTool?: string | null;
    evidenceRequired?: Record<string, unknown> | null;
  }): Promise<BuildOpsTaskDto> {
    if (input.projectId) {
      const project = await this.prisma.buildOpsProject.findFirst({
        where: {
          id: input.projectId,
          tenantId: input.tenantId,
        },
        select: { id: true },
      });

      if (!project) {
        throw new NotFoundException("BuildOps project not found");
      }
    }

    const task = (await this.prisma.buildOpsTask.create({
      data: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        createdBy: input.createdBy,
        title: input.title,
        description: input.description ?? null,
        projectId: input.projectId ?? null,
        status: input.status ?? "todo",
        priority: input.priority ?? "medium",
        assigneeName: input.assigneeName ?? null,
        assigneeUserId: input.assigneeUserId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        sourceTool: input.sourceTool ?? null,
        evidenceRequired: input.evidenceRequired ? (input.evidenceRequired as Prisma.InputJsonValue) : undefined,
      },
      include: { project: { select: { title: true } } },
    })) as StoredBuildOpsTask;

    return this.toTaskDto(task);
  }

  private toDto(project: StoredBuildOpsProject): BuildOpsProjectDto {
    return {
      id: project.id,
      tenantId: project.tenantId,
      orgId: project.orgId,
      jobId: project.jobId,
      createdBy: project.createdBy,
      title: project.title,
      description: project.description,
      trade: project.trade,
      projectType: project.projectType,
      clientName: project.clientName,
      professionalName: project.professionalName,
      location: project.location,
      budgetEstimate: project.budgetEstimate ? project.budgetEstimate.toNumber() : null,
      status: project.status as BuildOpsProjectStatus,
      riskScore: project.riskScore,
      riskLevel: project.riskLevel as BuildOpsRiskLevel,
      startDate: toDateString(project.startDate),
      dueDate: toDateString(project.dueDate),
      sourceTool: project.sourceTool,
      sourceToolInput: toJsonObject(project.sourceToolInput),
      sourceToolResult: toJsonObject(project.sourceToolResult),
      clientPlanApprovalStatus: project.clientPlanApprovalStatus as BuildOpsProjectDto["clientPlanApprovalStatus"],
      clientPlanApprovedAt: toDateString(project.clientPlanApprovedAt),
      clientPlanApprovedById: project.clientPlanApprovedById,
      clientPlanApprovalSource:
        project.clientPlanApprovalSource === "client" || project.clientPlanApprovalSource === "admin_override"
          ? project.clientPlanApprovalSource
          : null,
      clientPlanReviewedAt: toDateString(project.clientPlanReviewedAt),
      clientPlanReviewComment: project.clientPlanReviewComment,
      legacyPromotionStatus: project.legacyPromotionStatus,
      legacyPromotedAt: toDateString(project.legacyPromotedAt),
      completion: project.completion,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private toTaskDto(task: StoredBuildOpsTask): BuildOpsTaskDto {
    return {
      id: task.id,
      tenantId: task.tenantId,
      orgId: task.orgId,
      projectId: task.projectId,
      createdBy: task.createdBy,
      title: task.title,
      description: task.description,
      status: task.status as BuildOpsTaskStatus,
      priority: task.priority as BuildOpsTaskPriority,
      assigneeName: task.assigneeName,
      assigneeUserId: task.assigneeUserId,
      dueDate: toDateString(task.dueDate),
      completion: task.completion,
      sourceTool: task.sourceTool,
      evidenceRequired: toJsonObject(task.evidenceRequired),
      projectTitle: task.project?.title ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private toMilestoneDto(milestone: StoredBuildOpsMilestone): BuildOpsMilestoneDto {
    const status = String(milestone.status).toLowerCase() as BuildOpsMilestoneDto["status"];
    return {
      id: milestone.id,
      projectId: milestone.projectId,
      projectTitle: milestone.project.job.title,
      title: milestone.title,
      description: milestone.description,
      amount: milestone.amount.toNumber(),
      sequence: milestone.sequence,
      status: MILESTONE_STATUSES.has(status) ? status : "draft",
      evidenceCount: milestone._count?.evidence ?? 0,
      approvedAt: toDateString(milestone.approvedAt),
      createdAt: milestone.createdAt.toISOString(),
      updatedAt: milestone.updatedAt.toISOString(),
    };
  }
}

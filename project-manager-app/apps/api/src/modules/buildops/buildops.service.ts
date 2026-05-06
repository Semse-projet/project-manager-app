import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  type BuildOpsOverviewDto,
  type BuildOpsProjectDto,
  type BuildOpsProjectStatus,
  type BuildOpsRiskLevel
} from "./buildops.types.js";

type StoredBuildOpsProject = {
  id: string;
  tenantId: string;
  orgId: string;
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
  completion: number;
  createdAt: Date;
  updatedAt: Date;
};

const RISK_LEVELS = new Set<BuildOpsRiskLevel>(["low", "medium", "high", "critical"]);

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

@Injectable()
export class BuildOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string): Promise<BuildOpsOverviewDto> {
    const [projects, tasks, milestones, evidence, disputes] = await Promise.all([
      this.prisma.buildOpsProject.findMany({
        where: { tenantId },
        select: { status: true, riskLevel: true },
      }),
      this.prisma.$transaction([
        this.prisma.jobTask.count({
          where: {
            tenantId,
            deletedAt: null,
            dueDate: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
            status: { in: ["pending", "in_progress", "blocked"] },
          },
        }),
        this.prisma.workOrder.count({
          where: {
            tenantId,
            dueAt: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
            status: { in: ["open", "assigned", "in_progress"] },
          },
        }),
      ]),
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
    const tasksDue = tasks[0] + tasks[1];
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
        sourceToolResult: input.sourceToolResult ? (input.sourceToolResult as Prisma.InputJsonValue) : undefined,
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
      sourceToolResult: input.sourceToolResult,
    });
  }

  private toDto(project: StoredBuildOpsProject): BuildOpsProjectDto {
    return {
      id: project.id,
      tenantId: project.tenantId,
      orgId: project.orgId,
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
      completion: project.completion,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}

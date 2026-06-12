import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { IntakeOperationsBridgeService } from "../intake-operations-bridge/intake-operations-bridge.service.js";
import type { IntakeOperationsBridgeComputationResult } from "../intake-operations-bridge/intake-operations-bridge.types.js";
import type { BuildOpsPlanActorInput } from "./buildops-plan-approval.types.js";
import type {
  BuildOpsPlanRerunResult,
  RerunBuildOpsPlanInput,
} from "./buildops-plan-rerun.types.js";

type StoredPlan = {
  id: string;
  tenantId: string;
  orgId: string;
  jobId: string | null;
  createdBy: string;
  sourceToolInput: Prisma.JsonValue | null;
  sourceToolResult: Prisma.JsonValue | null;
  clientPlanApprovalStatus: string;
  clientPlanReviewedAt: Date | null;
  clientPlanReviewComment: string | null;
  legacyPromotionStatus: string;
  updatedAt: Date;
};

type StoredVersion = {
  id: string;
  tenantId: string;
  buildOpsProjectId: string;
  versionNumber: number;
  status: string;
  sourceToolInputJson: Prisma.JsonValue | null;
  sourceToolResultJson: Prisma.JsonValue | null;
  inputSnapshotJson: Prisma.JsonValue | null;
  clientPlanReviewCommentSnapshot: string | null;
  runReason: string;
  triggeredByUserId: string;
  triggeredAt: Date;
  completedAt: Date | null;
  previousVersionId: string | null;
  errorMessage: string | null;
};

type StoredJobSnapshot = {
  id: string;
  tenantId: string;
  clientOrgId: string;
  title: string;
  category: string | null;
  scope: string;
  status: string;
  location: string | null;
  urgency: string | null;
  budgetMin: Prisma.Decimal | null;
  budgetMax: Prisma.Decimal | null;
  updatedAt: Date;
};

type StoredIntakeSnapshot = {
  id: string;
  publishedJobId: string | null;
  rawDescription: string;
  normalizedTitle: string;
  detectedCategory: string;
  missingFields: string[];
  uploadedImagesJson: Prisma.JsonValue | null;
  projectScopeJson: Prisma.JsonValue | null;
  generatedEstimateJson: Prisma.JsonValue | null;
  generatedMilestonesJson: Prisma.JsonValue | null;
  activeWarningsJson: Prisma.JsonValue | null;
  updatedAt: Date;
};

type PreparedRerun = {
  planId: string;
  jobId: string;
  currentComment: string | null;
  activeVersion: {
    id: string;
    versionNumber: number;
  };
  runningVersion: {
    id: string;
    versionNumber: number;
  };
};

type RerunTx = Prisma.TransactionClient & Pick<
  PrismaService,
  | "buildOpsProject"
  | "buildOpsPlanVersion"
  | "project"
  | "milestone"
  | "jobTask"
  | "evidence"
  | "job"
  | "projectIntake"
>;

const SERIALIZATION_CONFLICT_MESSAGE = "concurrent state change detected, please retry";
const PLAN_RERUN_BLOCKED_MESSAGE = "BuildOps plan must be in changes_requested before bridge re-run.";

function isObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function truncateErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

function isConcurrentConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034" || error.code === "P2002";
  }
  return error instanceof Error && /\b40001\b|serialize|deadlock|write conflict|unique constraint/i.test(error.message);
}

@Injectable()
export class BuildOpsPlanRerunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intakeOperationsBridgeService: IntakeOperationsBridgeService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly sseBus?: SseEventBusService,
  ) {}

  async rerunBridge(input: RerunBuildOpsPlanInput): Promise<BuildOpsPlanRerunResult> {
    let prepared: PreparedRerun | null = null;

    try {
      prepared = await this.runSerializable((tx) => this.prepareRerun(tx, input));

      const computed = await this.intakeOperationsBridgeService.computeBridgePlan({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        roles: input.roles,
        jobId: prepared.jobId,
        rerunContext: {
          runReason: "client_changes_requested",
          clientPlanReviewComment: prepared.currentComment,
          previousVersionId: prepared.activeVersion.id,
          previousVersionNumber: prepared.activeVersion.versionNumber,
          triggeredByUserId: input.userId,
        },
      });

      const result = await this.runSerializable((tx) => this.finalizeRerun(tx, input, prepared!, computed));
      await this.appendAudit(input, result);
      this.sseBus?.emit(`buildops:${input.tenantId}`, "buildops-plan-rerun-completed", {
        buildOpsProjectId: result.buildOpsProjectId,
        activeVersionId: result.activeVersionId,
        activeVersionNumber: result.activeVersionNumber,
        previousVersionId: result.previousVersionId,
        approvalStatus: result.approvalStatus,
        actorUserId: input.userId,
        rerunCompletedAt: result.rerunCompletedAt,
      });
      return result;
    } catch (error) {
      if (prepared?.runningVersion.id) {
        await this.markVersionFailed({
          tenantId: input.tenantId,
          buildOpsProjectId: input.buildOpsProjectId,
          versionId: prepared.runningVersion.id,
          errorMessage: truncateErrorMessage(error),
        });
      }
      throw error;
    }
  }

  private async prepareRerun(tx: RerunTx, input: RerunBuildOpsPlanInput): Promise<PreparedRerun> {
    const plan = await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId);
    this.assertOpsPermission(input);
    await this.assertNotPromoted(tx, plan);
    this.assertRerunnableState(plan);

    if (!plan.jobId) {
      throw new ConflictException("BuildOps plan must be linked to a job before bridge re-run.");
    }

    const runningVersion = await tx.buildOpsPlanVersion.findFirst({
      where: {
        tenantId: input.tenantId,
        buildOpsProjectId: plan.id,
        status: "running",
      },
      select: { id: true },
    });

    if (runningVersion) {
      throw new ConflictException("bridge re-run already in progress for this BuildOps plan");
    }

    const activeVersionRecord = await this.findActiveVersion(tx, input.tenantId, plan.id);
    let activeVersion = activeVersionRecord
      ? {
          id: activeVersionRecord.id,
          versionNumber: activeVersionRecord.versionNumber,
        }
      : null;
    const latestVersion = await tx.buildOpsPlanVersion.findFirst({
      where: {
        tenantId: input.tenantId,
        buildOpsProjectId: plan.id,
      },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    if (!activeVersion) {
      if (latestVersion) {
        throw new ConflictException("BuildOps plan version history is inconsistent: no active version found.");
      }
      if (!plan.sourceToolResult) {
        throw new ConflictException("BuildOps plan has no active sourceToolResult to bootstrap version history.");
      }

      const bootstrapVersion = await tx.buildOpsPlanVersion.create({
        data: {
          tenantId: input.tenantId,
          buildOpsProjectId: plan.id,
          versionNumber: 1,
          sourceToolInputJson: isObject(plan.sourceToolInput) ? (plan.sourceToolInput as Prisma.InputJsonValue) : Prisma.DbNull,
          sourceToolResultJson: isObject(plan.sourceToolResult) ? (plan.sourceToolResult as Prisma.InputJsonValue) : Prisma.DbNull,
          inputSnapshotJson: toInputJson({
            bootstrapSource: "buildops_project.active_mirror",
            mirroredAt: plan.updatedAt.toISOString(),
          }),
          clientPlanReviewCommentSnapshot: plan.clientPlanReviewComment,
          runReason: "bootstrap_current_active_plan",
          triggeredByUserId: plan.createdBy,
          triggeredAt: plan.updatedAt,
          completedAt: plan.updatedAt,
          previousVersionId: null,
          status: "active",
          errorMessage: null,
        },
        select: {
          id: true,
          versionNumber: true,
        },
      });

      activeVersion = {
        id: bootstrapVersion.id,
        versionNumber: bootstrapVersion.versionNumber,
      };
    }

    if (!activeVersion) {
      throw new ConflictException("BuildOps plan version history is inconsistent: bootstrap failed.");
    }

    const job = await tx.job.findFirst({
      where: {
        tenantId: input.tenantId,
        id: plan.jobId,
      },
      select: {
        id: true,
        tenantId: true,
        clientOrgId: true,
        title: true,
        category: true,
        scope: true,
        status: true,
        location: true,
        urgency: true,
        budgetMin: true,
        budgetMax: true,
        updatedAt: true,
      },
    });

    if (!job) {
      throw new NotFoundException("Job not found for BuildOps plan re-run");
    }

    const intake = await tx.projectIntake.findFirst({
      where: {
        tenantId: input.tenantId,
        publishedJobId: plan.jobId,
      },
      select: {
        id: true,
        publishedJobId: true,
        rawDescription: true,
        normalizedTitle: true,
        detectedCategory: true,
        missingFields: true,
        uploadedImagesJson: true,
        projectScopeJson: true,
        generatedEstimateJson: true,
        generatedMilestonesJson: true,
        activeWarningsJson: true,
        updatedAt: true,
      },
    });

    const nextVersionNumber = activeVersion.versionNumber + 1;
    const now = new Date();
    const created = await tx.buildOpsPlanVersion.create({
      data: {
        tenantId: input.tenantId,
        buildOpsProjectId: plan.id,
        versionNumber: nextVersionNumber,
        sourceToolInputJson: Prisma.DbNull,
        sourceToolResultJson: Prisma.DbNull,
        inputSnapshotJson: toInputJson({
          job: this.serializeJobSnapshot(job),
          projectIntake: intake ? this.serializeIntakeSnapshot(intake) : null,
          sourceToolInput: isObject(plan.sourceToolInput) ? plan.sourceToolInput : null,
          rerunContext: {
            runReason: "client_changes_requested",
            requestedAt: plan.clientPlanReviewedAt?.toISOString() ?? null,
            clientPlanReviewComment: plan.clientPlanReviewComment,
            previousVersionId: activeVersion.id,
            previousVersionNumber: activeVersion.versionNumber,
          },
        }),
        clientPlanReviewCommentSnapshot: plan.clientPlanReviewComment,
        runReason: "client_changes_requested",
        triggeredByUserId: input.userId,
        triggeredAt: now,
        completedAt: null,
        previousVersionId: activeVersion.id,
        status: "running",
        errorMessage: null,
      },
      select: {
        id: true,
        versionNumber: true,
      },
    });

    return {
      planId: plan.id,
      jobId: plan.jobId,
      currentComment: plan.clientPlanReviewComment,
      activeVersion,
      runningVersion: {
        id: created.id,
        versionNumber: created.versionNumber,
      },
    };
  }

  private async finalizeRerun(
    tx: RerunTx,
    input: RerunBuildOpsPlanInput,
    prepared: PreparedRerun,
    computed: IntakeOperationsBridgeComputationResult,
  ): Promise<BuildOpsPlanRerunResult> {
    const plan = await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId);
    this.assertOpsPermission(input);
    await this.assertNotPromoted(tx, plan);
    this.assertRerunnableState(plan);

    const activeVersion = await this.findActiveVersion(tx, input.tenantId, plan.id);
    if (!activeVersion || activeVersion.id !== prepared.activeVersion.id) {
      throw new ConflictException(SERIALIZATION_CONFLICT_MESSAGE);
    }

    const runningVersion = (await tx.buildOpsPlanVersion.findFirst({
      where: {
        tenantId: input.tenantId,
        buildOpsProjectId: plan.id,
        id: prepared.runningVersion.id,
      },
      select: {
        id: true,
        versionNumber: true,
        status: true,
      },
    })) as Pick<StoredVersion, "id" | "versionNumber" | "status"> | null;

    if (!runningVersion || runningVersion.status !== "running") {
      throw new ConflictException(SERIALIZATION_CONFLICT_MESSAGE);
    }

    const now = new Date();

    await tx.buildOpsPlanVersion.update({
      where: { id: activeVersion.id },
      data: {
        status: "superseded",
        completedAt: activeVersion.completedAt ?? now,
      },
    });

    await tx.buildOpsPlanVersion.update({
      where: { id: runningVersion.id },
      data: {
        sourceToolInputJson: toInputJson(computed.sourceToolInput),
        sourceToolResultJson: toInputJson(computed.sourceToolResult),
        status: "active",
        errorMessage: null,
        completedAt: now,
      },
    });

    await tx.buildOpsProject.update({
      where: { id: plan.id },
      data: {
        title: computed.projectPatch.title,
        description: computed.projectPatch.description,
        trade: computed.projectPatch.trade,
        projectType: computed.projectPatch.projectType,
        clientName: computed.projectPatch.clientName,
        location: computed.projectPatch.location,
        budgetEstimate: computed.projectPatch.budgetEstimate != null
          ? new Prisma.Decimal(computed.projectPatch.budgetEstimate)
          : null,
        status: computed.projectPatch.status,
        riskScore: computed.projectPatch.riskScore,
        riskLevel: computed.projectPatch.riskLevel,
        sourceTool: computed.projectPatch.sourceTool,
        sourceToolInput: toInputJson(computed.sourceToolInput),
        sourceToolResult: toInputJson(computed.sourceToolResult),
        clientPlanApprovalStatus: "pending",
        clientPlanApprovedAt: null,
        clientPlanApprovedById: null,
        clientPlanApprovalSource: null,
        clientPlanApprovalReason: null,
        completion: computed.projectPatch.completion,
      },
    });

    const taskSync = await this.intakeOperationsBridgeService.syncProjectedBuildOpsTasks({
      tenantId: input.tenantId,
      orgId: plan.orgId,
      userId: input.userId,
      buildOpsProjectId: plan.id,
      taskTemplates: computed.taskTemplates,
      tx,
    });

    return {
      status: "rerun_completed",
      buildOpsProjectId: plan.id,
      activeVersionId: runningVersion.id,
      activeVersionNumber: runningVersion.versionNumber,
      previousVersionId: activeVersion.id,
      previousVersionNumber: activeVersion.versionNumber,
      tasksCreated: taskSync.tasksCreated,
      tasksReused: taskSync.tasksReused,
      approvalStatus: "pending",
      rerunCompletedAt: now.toISOString(),
    };
  }

  private async markVersionFailed(input: {
    tenantId: string;
    buildOpsProjectId: string;
    versionId: string;
    errorMessage: string;
  }): Promise<void> {
    await this.prisma.buildOpsPlanVersion.updateMany({
      where: {
        id: input.versionId,
        tenantId: input.tenantId,
        buildOpsProjectId: input.buildOpsProjectId,
        status: "running",
      },
      data: {
        status: "failed",
        errorMessage: input.errorMessage,
        completedAt: new Date(),
      },
    });
  }

  private async runSerializable<T>(work: (tx: RerunTx) => Promise<T>): Promise<T> {
    // Bajo aislamiento Serializable los conflictos P2034/40001 son esperables;
    // se reintenta la transaccion completa antes de devolver 409 al cliente.
    const maxAttempts = 3;
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => work(tx as RerunTx),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (!isConcurrentConflict(error)) {
          throw error;
        }
        if (attempt >= maxAttempts) {
          throw new ConflictException(SERIALIZATION_CONFLICT_MESSAGE);
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 50));
      }
    }
  }

  private async findPlanOrThrow(tx: RerunTx, tenantId: string, buildOpsProjectId: string): Promise<StoredPlan> {
    const plan = (await tx.buildOpsProject.findFirst({
      where: {
        id: buildOpsProjectId,
        tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        orgId: true,
        jobId: true,
        createdBy: true,
        sourceToolInput: true,
        sourceToolResult: true,
        clientPlanApprovalStatus: true,
        clientPlanReviewedAt: true,
        clientPlanReviewComment: true,
        legacyPromotionStatus: true,
        updatedAt: true,
      },
    })) as StoredPlan | null;

    if (!plan) {
      throw new NotFoundException("BuildOps plan not found");
    }

    return plan;
  }

  private async findActiveVersion(
    tx: RerunTx,
    tenantId: string,
    buildOpsProjectId: string,
  ): Promise<StoredVersion | null> {
    return (await tx.buildOpsPlanVersion.findFirst({
      where: {
        tenantId,
        buildOpsProjectId,
        status: "active",
      },
      orderBy: {
        versionNumber: "desc",
      },
      select: {
        id: true,
        tenantId: true,
        buildOpsProjectId: true,
        versionNumber: true,
        status: true,
        sourceToolInputJson: true,
        sourceToolResultJson: true,
        inputSnapshotJson: true,
        clientPlanReviewCommentSnapshot: true,
        runReason: true,
        triggeredByUserId: true,
        triggeredAt: true,
        completedAt: true,
        previousVersionId: true,
        errorMessage: true,
      },
    })) as StoredVersion | null;
  }

  private assertOpsPermission(actor: BuildOpsPlanActorInput): void {
    if (!actor.roles.includes("OPS_ADMIN")) {
      throw new ForbiddenException("bridge re-run requires OPS_ADMIN role");
    }
  }

  private assertRerunnableState(plan: StoredPlan): void {
    if (plan.clientPlanApprovalStatus !== "changes_requested") {
      throw new ConflictException(PLAN_RERUN_BLOCKED_MESSAGE);
    }
  }

  private async assertNotPromoted(tx: RerunTx, plan: StoredPlan): Promise<void> {
    if (plan.legacyPromotionStatus === "promoted") {
      throw new ConflictException("BuildOps plan already has promoted legacy artifacts");
    }

    const [projects, milestones, tasks, evidence] = await Promise.all([
      tx.project.count({
        where: {
          tenantId: plan.tenantId,
          promotedFromBuildOpsProjectId: plan.id,
        },
      }),
      tx.milestone.count({
        where: {
          project: {
            tenantId: plan.tenantId,
          },
          promotedFromBuildOpsProjectId: plan.id,
          deletedAt: null,
        },
      }),
      tx.jobTask.count({
        where: {
          tenantId: plan.tenantId,
          promotedFromBuildOpsProjectId: plan.id,
          deletedAt: null,
        },
      }),
      tx.evidence.count({
        where: {
          project: {
            tenantId: plan.tenantId,
          },
          promotedFromBuildOpsProjectId: plan.id,
        },
      }),
    ]);

    if (projects + milestones + tasks + evidence > 0) {
      throw new ConflictException("BuildOps plan already has promoted legacy artifacts");
    }
  }

  private serializeJobSnapshot(job: StoredJobSnapshot): Record<string, unknown> {
    return {
      id: job.id,
      title: job.title,
      category: job.category,
      scope: job.scope,
      status: job.status,
      location: job.location,
      urgency: job.urgency,
      clientOrgId: job.clientOrgId,
      budgetMin: job.budgetMin?.toNumber() ?? null,
      budgetMax: job.budgetMax?.toNumber() ?? null,
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  private serializeIntakeSnapshot(intake: StoredIntakeSnapshot): Record<string, unknown> {
    return {
      id: intake.id,
      publishedJobId: intake.publishedJobId,
      rawDescription: intake.rawDescription,
      normalizedTitle: intake.normalizedTitle,
      detectedCategory: intake.detectedCategory,
      missingFields: intake.missingFields,
      uploadedImagesJson: intake.uploadedImagesJson,
      projectScopeJson: intake.projectScopeJson,
      generatedEstimateJson: intake.generatedEstimateJson,
      generatedMilestonesJson: intake.generatedMilestonesJson,
      activeWarningsJson: intake.activeWarningsJson,
      updatedAt: intake.updatedAt.toISOString(),
    };
  }

  private async appendAudit(input: RerunBuildOpsPlanInput, result: BuildOpsPlanRerunResult): Promise<void> {
    if (!this.auditService) return;
    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "buildops.plan.rerun_bridge",
      entityType: "BuildOpsProject",
      entityId: input.buildOpsProjectId,
      requestId: `buildops_plan_rerun_${result.activeVersionId}`,
      timestamp: result.rerunCompletedAt,
      afterJson: result,
    });
  }
}

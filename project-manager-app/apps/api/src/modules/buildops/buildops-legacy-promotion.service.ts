import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { BuildOpsPlanActorInput } from "./buildops-plan-approval.types.js";
import {
  mapLegacyEvidence,
  mapLegacyJobTasks,
  mapLegacyMilestones,
  parseBuildOpsSourceToolResult,
  parseUploadedImages,
} from "./buildops-legacy-promotion.mapper.js";
import type {
  BuildOpsLegacyPromotionResult,
  PromoteApprovedPlanToLegacyInput,
} from "./buildops-legacy-promotion.types.js";

type StoredPlan = {
  id: string;
  tenantId: string;
  orgId: string;
  jobId: string | null;
  createdBy: string;
  sourceToolResult: Prisma.JsonValue | null;
  clientPlanApprovalStatus: string;
  clientPlanApprovedAt: Date | null;
  legacyPromotionStatus: string;
  legacyPromotedAt: Date | null;
  job: {
    clientOrgId: string;
  } | null;
};

type StoredProject = {
  id: string;
  tenantId: string;
  assignedProOrgId: string;
  promotedFromBuildOpsProjectId: string | null;
  promotedAt: Date | null;
  promotedByUserId: string | null;
};

type StoredBuildOpsTask = {
  id: string;
  templateKey: string | null;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: string;
  assigneeUserId: string | null;
};

type PromotionTx = Prisma.TransactionClient & Pick<
  PrismaService,
  "buildOpsProject" | "project" | "milestone" | "jobTask" | "projectIntake" | "buildOpsTask" | "jobReservation" | "evidence"
>;

const SERIALIZATION_CONFLICT_MESSAGE = "concurrent state change detected, please retry";
const PLAN_APPROVAL_REQUIRED_MESSAGE = "BuildOps plan must be approved before legacy promotion.";

function toIso(value: Date): string {
  return value.toISOString();
}

function isSerializableConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }
  return error instanceof Error && /\b40001\b|serialize|deadlock|write conflict/i.test(error.message);
}

@Injectable()
export class BuildOpsLegacyPromotionService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  async promoteApprovedPlanToLegacy(input: PromoteApprovedPlanToLegacyInput): Promise<BuildOpsLegacyPromotionResult> {
    const result = await this.runSerializable(async (tx) => {
      const plan = await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId);
      this.assertPromotionPermission(plan, input);

      if (plan.legacyPromotionStatus === "promoted") {
        return this.loadExistingPromotionResult(tx, plan, "already_promoted");
      }

      if (plan.clientPlanApprovalStatus !== "approved" || !plan.clientPlanApprovedAt) {
        throw new ConflictException(PLAN_APPROVAL_REQUIRED_MESSAGE);
      }

      if (!plan.jobId) {
        throw new ConflictException("BuildOps plan must be linked to a job before legacy promotion.");
      }

      const lock = await tx.buildOpsProject.updateMany({
        where: {
          id: plan.id,
          tenantId: input.tenantId,
          clientPlanApprovalStatus: "approved",
          legacyPromotionStatus: {
            in: ["pending", "failed"],
          },
        },
        data: {
          legacyPromotionStatus: "promoting",
        },
      });

      if (lock.count !== 1) {
        const current = await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId);
        if (current.legacyPromotionStatus === "promoted") {
          return this.loadExistingPromotionResult(tx, current, "already_promoted");
        }
        if (current.legacyPromotionStatus === "promoting") {
          throw new ConflictException("legacy promotion already in progress");
        }
        if (current.clientPlanApprovalStatus !== "approved" || !current.clientPlanApprovedAt) {
          throw new ConflictException(PLAN_APPROVAL_REQUIRED_MESSAGE);
        }
        throw new ConflictException(SERIALIZATION_CONFLICT_MESSAGE);
      }

      const promotedAt = new Date();
      const parsed = parseBuildOpsSourceToolResult(plan.sourceToolResult);
      const acceptedReservation = await tx.jobReservation.findFirst({
        where: {
          jobId: plan.jobId,
          status: "ACCEPTED",
        },
        select: {
          id: true,
          professionalOrgId: true,
        },
      });

      if (!acceptedReservation?.professionalOrgId) {
        throw new ConflictException("Accepted reservation required before legacy promotion.");
      }

      const project = (await tx.project.findFirst({
        where: {
          tenantId: input.tenantId,
          jobId: plan.jobId,
        },
        select: {
          id: true,
          tenantId: true,
          assignedProOrgId: true,
          promotedFromBuildOpsProjectId: true,
          promotedAt: true,
          promotedByUserId: true,
        },
      })) as StoredProject | null;

      if (!project) {
        throw new ConflictException("Legacy project not found for this job. Accept a reservation before promoting.");
      }

      if (project.assignedProOrgId !== acceptedReservation.professionalOrgId) {
        throw new ConflictException("Legacy project assignment does not match the accepted reservation.");
      }

      if (project.promotedFromBuildOpsProjectId && project.promotedFromBuildOpsProjectId !== plan.id) {
        throw new ConflictException("Legacy project is already linked to a different BuildOps plan.");
      }

      await tx.project.update({
        where: { id: project.id },
        data: {
          promotedFromBuildOpsProjectId: project.promotedFromBuildOpsProjectId ?? plan.id,
          promotedAt: project.promotedAt ?? promotedAt,
          promotedByUserId: project.promotedByUserId ?? input.userId,
        },
      });

      const milestonePayloads = mapLegacyMilestones({
        buildOpsProjectId: plan.id,
        promotedAt: promotedAt.toISOString(),
        promotedByUserId: input.userId,
        milestonePlan: parsed.milestonePlan,
        evidenceChecklist: parsed.evidenceChecklist,
      });

      const existingMilestones = await tx.milestone.findMany({
        where: {
          projectId: project.id,
          deletedAt: null,
        },
        select: {
          id: true,
          sequence: true,
          promotedFromBuildOpsProjectId: true,
        },
      });

      const existingMilestoneBySequence = new Map<number, { id: string; promotedFromBuildOpsProjectId: string | null }>(
        existingMilestones.map((milestone) => [milestone.sequence, milestone]),
      );

      let milestonesCreated = 0;
      for (const milestone of milestonePayloads) {
        const existing = existingMilestoneBySequence.get(milestone.sequence);
        if (existing) {
          if (existing.promotedFromBuildOpsProjectId === plan.id) {
            continue;
          }
          throw new ConflictException(
            `Legacy milestone sequence ${milestone.sequence} already exists and is not linked to this BuildOps plan.`,
          );
        }

        await tx.milestone.create({
          data: {
            projectId: project.id,
            title: milestone.title,
            description: milestone.description,
            amount: new Prisma.Decimal(milestone.amount),
            sequence: milestone.sequence,
            status: "DRAFT",
            checklistSchema: milestone.checklistSchema as Prisma.InputJsonValue,
            requiredEvidenceTypes: milestone.requiredEvidenceTypes,
            promotedFromBuildOpsProjectId: plan.id,
            promotedAt,
            promotedByUserId: input.userId,
          },
        });
        milestonesCreated += 1;
      }

      const buildOpsTasks = (await tx.buildOpsTask.findMany({
        where: {
          tenantId: input.tenantId,
          projectId: plan.id,
        },
        select: {
          id: true,
          templateKey: true,
          title: true,
          description: true,
          dueDate: true,
          priority: true,
          assigneeUserId: true,
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      })) as StoredBuildOpsTask[];

      const taskPayloads = mapLegacyJobTasks({
        buildOpsTasks,
      });

      const existingJobTasks = await tx.jobTask.findMany({
        where: {
          tenantId: input.tenantId,
          jobId: plan.jobId,
          deletedAt: null,
        },
        select: {
          id: true,
          promotedFromBuildOpsTaskId: true,
        },
      });

      const existingJobTaskIds = new Set(
        existingJobTasks
          .map((task) => task.promotedFromBuildOpsTaskId)
          .filter((taskId): taskId is string => typeof taskId === "string" && taskId.length > 0),
      );

      let tasksCreated = 0;
      for (const task of taskPayloads) {
        if (existingJobTaskIds.has(task.promotedFromBuildOpsTaskId)) {
          continue;
        }

        await tx.jobTask.create({
          data: {
            tenantId: input.tenantId,
            jobId: plan.jobId,
            milestone: task.milestone,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            priority: task.priority,
            assignedTo: task.assignedTo,
            createdBy: input.userId,
            promotedFromBuildOpsProjectId: plan.id,
            promotedFromBuildOpsTaskId: task.promotedFromBuildOpsTaskId,
            promotedAt,
            promotedByUserId: input.userId,
          },
        });
        tasksCreated += 1;
      }

      const intake = await tx.projectIntake.findFirst({
        where: {
          tenantId: input.tenantId,
          publishedJobId: plan.jobId,
        },
        select: {
          id: true,
          userId: true,
          uploadedImagesJson: true,
        },
      });

      const uploadedImages = parseUploadedImages(intake?.uploadedImagesJson ?? null);
      const evidencePayloads = mapLegacyEvidence({
        buildOpsProjectId: plan.id,
        projectIntakeId: intake?.id ?? null,
        promotedAt: promotedAt.toISOString(),
        promotedByUserId: input.userId,
        uploadedImages,
      });

      const existingEvidence = await tx.evidence.findMany({
        where: {
          projectId: project.id,
        },
        select: {
          id: true,
          bucketKey: true,
        },
      });
      const existingEvidenceKeys = new Set(existingEvidence.map((item) => item.bucketKey));

      const uploadedById = intake?.userId ?? plan.createdBy ?? input.userId;
      let evidenceCreated = 0;
      for (const evidence of evidencePayloads) {
        if (existingEvidenceKeys.has(evidence.bucketKey)) {
          continue;
        }

        await tx.evidence.create({
          data: {
            projectId: project.id,
            milestoneId: null,
            uploadedById,
            kind: evidence.kind,
            bucketKey: evidence.bucketKey,
            metadataJson: evidence.metadataJson as Prisma.InputJsonValue,
            promotedFromBuildOpsProjectId: plan.id,
            promotedAt,
            promotedByUserId: input.userId,
          },
        });
        existingEvidenceKeys.add(evidence.bucketKey);
        evidenceCreated += 1;
      }

      await tx.buildOpsProject.update({
        where: { id: plan.id },
        data: {
          legacyPromotionStatus: "promoted",
          legacyPromotedAt: promotedAt,
        },
      });

      return {
        status: "promoted" as const,
        buildOpsProjectId: plan.id,
        legacyProjectId: project.id,
        milestonesCreated,
        tasksCreated,
        evidenceCreated,
        alreadyPromoted: false,
        promotedAt: toIso(promotedAt),
        paymentEscrowCreated: false as const,
      };
    });

    await this.appendPromotionAudit(input, result);
    return result;
  }

  private async runSerializable<T>(work: (tx: PromotionTx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => work(tx as PromotionTx),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (isSerializableConflict(error)) {
        throw new ConflictException(SERIALIZATION_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  private async findPlanOrThrow(tx: PromotionTx, tenantId: string, buildOpsProjectId: string): Promise<StoredPlan> {
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
        sourceToolResult: true,
        clientPlanApprovalStatus: true,
        clientPlanApprovedAt: true,
        legacyPromotionStatus: true,
        legacyPromotedAt: true,
        job: {
          select: {
            clientOrgId: true,
          },
        },
      },
    })) as StoredPlan | null;

    if (!plan) {
      throw new NotFoundException("BuildOps plan not found");
    }

    return plan;
  }

  private assertPromotionPermission(plan: StoredPlan, actor: BuildOpsPlanActorInput) {
    if (actor.roles.includes("OPS_ADMIN")) {
      return;
    }
    if (!plan.jobId || !plan.job || plan.job.clientOrgId !== actor.orgId) {
      throw new ForbiddenException("actor is not allowed to promote this BuildOps plan");
    }
  }

  private async loadExistingPromotionResult(
    tx: PromotionTx,
    plan: StoredPlan,
    status: "already_promoted" | "promoted",
  ): Promise<BuildOpsLegacyPromotionResult> {
    if (!plan.jobId) {
      throw new ConflictException("BuildOps plan promotion status is inconsistent: missing job link.");
    }

    const project = await tx.project.findFirst({
      where: {
        tenantId: plan.tenantId,
        jobId: plan.jobId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new ConflictException("BuildOps plan promotion status is inconsistent: legacy project missing.");
    }

    return {
      status,
      buildOpsProjectId: plan.id,
      legacyProjectId: project.id,
      milestonesCreated: 0,
      tasksCreated: 0,
      evidenceCreated: 0,
      alreadyPromoted: status === "already_promoted",
      promotedAt: toIso(plan.legacyPromotedAt ?? new Date()),
      paymentEscrowCreated: false,
    };
  }

  private async appendPromotionAudit(
    actor: PromoteApprovedPlanToLegacyInput,
    result: BuildOpsLegacyPromotionResult,
  ): Promise<void> {
    if (!this.auditService) {
      return;
    }

    await this.auditService.append({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      actorUserId: actor.userId,
      action: "buildops.plan.promote_legacy",
      entityType: "BuildOpsProject",
      entityId: actor.buildOpsProjectId,
      requestId: `buildops-legacy-promotion-${Date.now()}`,
      timestamp: new Date().toISOString(),
      afterJson: result,
    });
  }
}

import {
  BadRequestException,
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
import type {
  ApproveClientPlanInput,
  BuildOpsPlanActorInput,
  BuildOpsPlanApprovalResult,
  BuildOpsPlanApprovalSource,
  BuildOpsPlanApprovalStatus,
  RejectClientPlanInput,
  RequestChangesInput,
  UnapproveClientPlanInput,
} from "./buildops-plan-approval.types.js";

type StoredPlan = {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  jobId: string | null;
  clientPlanApprovalStatus: string;
  clientPlanApprovedAt: Date | null;
  clientPlanApprovedById: string | null;
  clientPlanApprovalSource: string | null;
  clientPlanApprovalReason: string | null;
  clientPlanReviewedAt: Date | null;
  clientPlanReviewComment: string | null;
  clientPlanUnapprovedAt: Date | null;
  clientPlanUnapprovedById: string | null;
  clientPlanUnapprovalReason: string | null;
  legacyPromotionStatus: string;
  job: {
    clientOrgId: string;
  } | null;
};

type PlanTx = Prisma.TransactionClient &
  Pick<PrismaService, "buildOpsProject" | "jobReservation" | "milestone">;

const SERIALIZATION_CONFLICT_MESSAGE = "concurrent state change detected, please retry";
const PLAN_APPROVAL_STATUSES = new Set<BuildOpsPlanApprovalStatus>([
  "pending",
  "approved",
  "changes_requested",
  "rejected",
]);

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function requireText(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new BadRequestException(`${fieldName} is required`);
  }
  return normalized;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function asObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isSerializableConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }
  return error instanceof Error && /\b40001\b|serialize|deadlock|write conflict/i.test(error.message);
}

@Injectable()
export class BuildOpsPlanApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly sseBus?: SseEventBusService,
  ) {}

  async approveClientPlan(input: ApproveClientPlanInput): Promise<BuildOpsPlanApprovalResult> {
    const reason = normalizeOptionalText(input.reason);

    if (input.source === "admin_override" && !reason) {
      throw new BadRequestException("admin override requires reason");
    }

    const result = await this.runSerializable(async (tx) => {
      const plan = await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId);
      this.assertPlanNotPromoted(plan);
      this.assertApprovePermission(plan, input, input.source, reason);

      if (plan.clientPlanApprovalStatus === "approved") {
        return this.toResult(plan);
      }

      if (!PLAN_APPROVAL_STATUSES.has(plan.clientPlanApprovalStatus as BuildOpsPlanApprovalStatus)) {
        throw new ConflictException(`unsupported approval status '${plan.clientPlanApprovalStatus}'`);
      }

      const now = new Date();
      const updated = await tx.buildOpsProject.updateMany({
        where: {
          id: plan.id,
          tenantId: input.tenantId,
          legacyPromotionStatus: { not: "promoted" },
          clientPlanApprovalStatus: {
            in: ["pending", "changes_requested", "rejected"],
          },
        },
        data: {
          clientPlanApprovalStatus: "approved",
          clientPlanApprovedAt: now,
          clientPlanApprovedById: input.userId,
          clientPlanApprovalSource: input.source,
          clientPlanApprovalReason: reason,
          clientPlanReviewedAt: now,
          clientPlanReviewComment: null,
        },
      });

      if (updated.count !== 1) {
        const current = await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId);
        this.assertPlanNotPromoted(current);
        if (current.clientPlanApprovalStatus === "approved") {
          return this.toResult(current);
        }
        throw new ConflictException(SERIALIZATION_CONFLICT_MESSAGE);
      }

      return this.toResult(await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId));
    });
    await this.appendPlanAudit(input, "buildops.plan.approve", result, { source: input.source, reason });
    this.emitSsePlanEvent(input.tenantId, "buildops-plan-approved", {
      buildOpsProjectId: result.buildOpsProjectId,
      approvalStatus: result.clientPlanApprovalStatus,
      actorUserId: input.userId,
      jobId: result.buildOpsProjectId,
      approvedAt: result.clientPlanApprovedAt,
    });
    return result;
  }

  async requestChanges(input: RequestChangesInput): Promise<BuildOpsPlanApprovalResult> {
    const comment = requireText(input.comment, "comment");
    const result = await this.transitionToReviewState(input, "changes_requested", comment);
    await this.appendPlanAudit(input, "buildops.plan.request_changes", result, { comment });
    this.emitSsePlanEvent(input.tenantId, "buildops-plan-changes-requested", {
      buildOpsProjectId: result.buildOpsProjectId,
      approvalStatus: result.clientPlanApprovalStatus,
      actorUserId: input.userId,
      comment,
      reviewedAt: result.clientPlanReviewedAt,
    });
    return result;
  }

  async rejectClientPlan(input: RejectClientPlanInput): Promise<BuildOpsPlanApprovalResult> {
    const comment = requireText(input.comment, "comment");
    const result = await this.transitionToReviewState(input, "rejected", comment);
    await this.appendPlanAudit(input, "buildops.plan.reject", result, { comment });
    this.emitSsePlanEvent(input.tenantId, "buildops-plan-rejected", {
      buildOpsProjectId: result.buildOpsProjectId,
      approvalStatus: result.clientPlanApprovalStatus,
      actorUserId: input.userId,
      comment,
      reviewedAt: result.clientPlanReviewedAt,
    });
    return result;
  }

  async unapproveClientPlan(input: UnapproveClientPlanInput): Promise<BuildOpsPlanApprovalResult> {
    const reason = requireText(input.reason, "reason");

    const result = await this.runSerializable(async (tx) => {
      const plan = await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId);
      this.assertPlanNotPromoted(plan);
      this.assertManagementPermission(plan, input);

      if (plan.clientPlanApprovalStatus === "pending") {
        return this.toResult(plan);
      }
      if (plan.clientPlanApprovalStatus !== "approved") {
        throw new ConflictException("plan is not approved");
      }

      await this.assertCanLeaveApprovedState(tx, plan);

      const now = new Date();
      const updated = await tx.buildOpsProject.updateMany({
        where: {
          id: plan.id,
          tenantId: input.tenantId,
          legacyPromotionStatus: { not: "promoted" },
          clientPlanApprovalStatus: "approved",
        },
        data: {
          clientPlanApprovalStatus: "pending",
          clientPlanApprovedAt: null,
          clientPlanApprovedById: null,
          clientPlanApprovalSource: null,
          clientPlanApprovalReason: null,
          clientPlanReviewedAt: null,
          clientPlanReviewComment: null,
          clientPlanUnapprovedAt: now,
          clientPlanUnapprovedById: input.userId,
          clientPlanUnapprovalReason: reason,
        },
      });

      if (updated.count !== 1) {
        const current = await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId);
        this.assertPlanNotPromoted(current);
        if (current.clientPlanApprovalStatus === "pending") {
          return this.toResult(current);
        }
        throw new ConflictException(SERIALIZATION_CONFLICT_MESSAGE);
      }

      return this.toResult(await this.findPlanOrThrow(tx, input.tenantId, input.buildOpsProjectId));
    });
    await this.appendPlanAudit(input, "buildops.plan.unapprove", result, { reason });
    this.emitSsePlanEvent(input.tenantId, "buildops-plan-unapproved", {
      buildOpsProjectId: result.buildOpsProjectId,
      approvalStatus: result.clientPlanApprovalStatus,
      actorUserId: input.userId,
      reason,
    });
    return result;
  }

  private async transitionToReviewState(
    actor: BuildOpsPlanActorInput & { buildOpsProjectId: string },
    targetStatus: "changes_requested" | "rejected",
    comment: string,
  ): Promise<BuildOpsPlanApprovalResult> {
    return this.runSerializable(async (tx) => {
      const plan = await this.findPlanOrThrow(tx, actor.tenantId, actor.buildOpsProjectId);
      this.assertPlanNotPromoted(plan);
      this.assertManagementPermission(plan, actor);

      if (plan.clientPlanApprovalStatus === targetStatus) {
        return this.toResult(plan);
      }

      if (!["pending", "approved", "changes_requested", "rejected"].includes(plan.clientPlanApprovalStatus)) {
        throw new ConflictException(`unsupported approval status '${plan.clientPlanApprovalStatus}'`);
      }

      const now = new Date();
      const data: Prisma.BuildOpsProjectUpdateManyMutationInput = {
        clientPlanApprovalStatus: targetStatus,
        clientPlanReviewedAt: now,
        clientPlanReviewComment: comment,
      };

      if (plan.clientPlanApprovalStatus === "approved") {
        await this.assertCanLeaveApprovedState(tx, plan);
        data.clientPlanApprovedAt = null;
        data.clientPlanApprovedById = null;
        data.clientPlanApprovalSource = null;
        data.clientPlanApprovalReason = null;
        data.clientPlanUnapprovedAt = now;
        data.clientPlanUnapprovedById = actor.userId;
        data.clientPlanUnapprovalReason = comment;
      }

      const updated = await tx.buildOpsProject.updateMany({
        where: {
          id: plan.id,
          tenantId: actor.tenantId,
          legacyPromotionStatus: { not: "promoted" },
          clientPlanApprovalStatus: {
            in: ["pending", "approved", "changes_requested", "rejected"],
          },
        },
        data,
      });

      if (updated.count !== 1) {
        const current = await this.findPlanOrThrow(tx, actor.tenantId, actor.buildOpsProjectId);
        this.assertPlanNotPromoted(current);
        if (current.clientPlanApprovalStatus === targetStatus) {
          return this.toResult(current);
        }
        throw new ConflictException(SERIALIZATION_CONFLICT_MESSAGE);
      }

      return this.toResult(await this.findPlanOrThrow(tx, actor.tenantId, actor.buildOpsProjectId));
    });
  }

  private async runSerializable<T>(work: (tx: PlanTx) => Promise<T>): Promise<T> {
    // Bajo aislamiento Serializable los conflictos P2034/40001 son esperables;
    // se reintenta la transaccion completa antes de devolver 409 al cliente.
    const maxAttempts = 3;
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => work(tx as PlanTx),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (!isSerializableConflict(error)) {
          throw error;
        }
        if (attempt >= maxAttempts) {
          throw new ConflictException(SERIALIZATION_CONFLICT_MESSAGE);
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 50));
      }
    }
  }

  private async findPlanOrThrow(tx: PlanTx, tenantId: string, buildOpsProjectId: string): Promise<StoredPlan> {
    const plan = (await tx.buildOpsProject.findFirst({
      where: {
        id: buildOpsProjectId,
        tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        orgId: true,
        createdBy: true,
        jobId: true,
        clientPlanApprovalStatus: true,
        clientPlanApprovedAt: true,
        clientPlanApprovedById: true,
        clientPlanApprovalSource: true,
        clientPlanApprovalReason: true,
        clientPlanReviewedAt: true,
        clientPlanReviewComment: true,
        clientPlanUnapprovedAt: true,
        clientPlanUnapprovedById: true,
        clientPlanUnapprovalReason: true,
        legacyPromotionStatus: true,
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

  private assertPlanNotPromoted(plan: StoredPlan) {
    if (plan.legacyPromotionStatus === "promoted") {
      throw new ConflictException("plan already has promoted legacy artifacts");
    }
  }

  private assertApprovePermission(
    plan: StoredPlan,
    actor: BuildOpsPlanActorInput,
    source: BuildOpsPlanApprovalSource,
    reason: string | null,
  ) {
    if (source === "admin_override") {
      if (!actor.roles.includes("OPS_ADMIN")) {
        throw new ForbiddenException("actor lacks OPS_ADMIN role");
      }
      if (!reason) {
        throw new BadRequestException("admin override requires reason");
      }
      return;
    }

    if (!plan.jobId || !plan.job) {
      throw new ForbiddenException("client approval requires a job-linked buildops plan");
    }
    if (plan.job.clientOrgId !== actor.orgId) {
      throw new ForbiddenException("actor is not allowed to approve this client plan");
    }
  }

  private assertManagementPermission(plan: StoredPlan, actor: BuildOpsPlanActorInput) {
    if (actor.roles.includes("OPS_ADMIN")) {
      return;
    }
    if (!plan.jobId || !plan.job || plan.job.clientOrgId !== actor.orgId) {
      throw new ForbiddenException("actor is not allowed to manage this client plan");
    }
  }

  private async assertCanLeaveApprovedState(tx: PlanTx, plan: StoredPlan) {
    if (!plan.jobId) {
      return;
    }

    const acceptedReservation = await tx.jobReservation.findFirst({
      where: {
        jobId: plan.jobId,
        status: "ACCEPTED",
      },
      select: { id: true },
    });

    if (acceptedReservation) {
      throw new ForbiddenException("reservation already accepted, use change order");
    }

    const milestones = await tx.milestone.findMany({
      where: {
        deletedAt: null,
        project: {
          jobId: plan.jobId,
        },
      },
      select: {
        checklistSchema: true,
      },
    });

    const promotedMilestones = milestones.filter((milestone) => {
      const checklist = asObject(milestone.checklistSchema);
      const meta = asObject((checklist?.meta as Prisma.JsonValue | undefined) ?? null);
      return meta?.buildOpsProjectId === plan.id;
    }).length;

    if (promotedMilestones > 0) {
      throw new ConflictException(
        "milestones already promoted from this plan exist — state inconsistent, manual review required",
      );
    }
  }

  private toResult(plan: StoredPlan): BuildOpsPlanApprovalResult {
    return {
      buildOpsProjectId: plan.id,
      clientPlanApprovalStatus: plan.clientPlanApprovalStatus as BuildOpsPlanApprovalStatus,
      clientPlanApprovedAt: toIso(plan.clientPlanApprovedAt),
      clientPlanApprovedById: plan.clientPlanApprovedById,
      clientPlanApprovalSource:
        plan.clientPlanApprovalSource === "client" || plan.clientPlanApprovalSource === "admin_override"
          ? (plan.clientPlanApprovalSource as BuildOpsPlanApprovalSource)
          : null,
      clientPlanReviewedAt: toIso(plan.clientPlanReviewedAt),
      clientPlanReviewComment: plan.clientPlanReviewComment,
    };
  }

  private async appendPlanAudit(
    actor: BuildOpsPlanActorInput & { buildOpsProjectId: string },
    action: string,
    result: BuildOpsPlanApprovalResult,
    details: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditService) {
      return;
    }

    await this.auditService.append({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      actorUserId: actor.userId,
      action,
      entityType: "BuildOpsProject",
      entityId: actor.buildOpsProjectId,
      requestId: `buildops-plan-${Date.now()}`,
      timestamp: new Date().toISOString(),
      afterJson: {
        ...details,
        clientPlanApprovalStatus: result.clientPlanApprovalStatus,
        clientPlanApprovedAt: result.clientPlanApprovedAt,
        clientPlanApprovedById: result.clientPlanApprovedById,
        clientPlanApprovalSource: result.clientPlanApprovalSource,
        clientPlanReviewedAt: result.clientPlanReviewedAt,
      },
    });
  }

  private emitSsePlanEvent(tenantId: string, event: string, data: Record<string, unknown>): void {
    this.sseBus?.emit(`buildops:${tenantId}`, event, data);
  }
}

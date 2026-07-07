// @ts-nocheck
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { type MilestoneRecord } from "../../common/domain-store.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { databaseEnabled } from "../../infrastructure/persistence/persistence-mode.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { findProjectLinkByJobIdOrThrow, findProjectLinkByProjectIdOrThrow } from "../projects/project-link.repository.js";
import {
  approveMilestoneMemory,
  createMilestoneMemory,
  listMilestonesByProjectMemory,
  rejectMilestoneMemory,
  submitMilestoneMemory
} from "./milestones.memory.js";
import {
  assertMilestoneApprovable,
  assertMilestoneCreatable,
  assertMilestoneReadable,
  assertMilestoneRejectable,
  assertMilestoneSubmittable,
  type MilestoneActor,
  type MilestoneLifecycleSnapshot,
  type MilestoneOwnership
} from "./milestones.policy.js";

const milestoneStatusMap = {
  draft: "DRAFT",
  awaiting_review: "AWAITING_REVIEW",
  submitted: "SUBMITTED",
  approved: "APPROVED",
  rejected: "REJECTED",
  paid: "PAID"
} as const;

type StoredMilestone = {
  id: string;
  projectId: string;
  title: string;
  amount: { toNumber(): number };
  sequence: number;
  status: string;
  project?: {
    jobId: string;
    assignedProOrgId: string;
    job: {
      clientOrgId: string;
    };
  };
  _count?: {
    evidence: number;
  };
};

type MilestoneEventContext = {
  milestoneId: string;
  projectId: string;
  jobId: string;
  evidenceCount: number;
  proUserId: string | null;
  clientUserId: string | null;
};

type VisionAnalysisSummaryRow = {
  qualityScore: number | null;
  blurScore: number | null;
  brightnessScore: number | null;
  riskLevel: string | null;
  requiresHumanReview: boolean;
  canAutoApprove: boolean;
  riskReasons: unknown;
};

type OptionalVisionPrisma = {
  visionAnalysis?: {
    findMany(input: {
      where: { milestoneId: string; status: string };
      select: Record<string, boolean>;
    }): Promise<VisionAnalysisSummaryRow[]>;
  };
};

function toMilestoneRecord(milestone: StoredMilestone, tenantId: string): MilestoneRecord {
  return {
    id: milestone.id,
    tenantId,
    projectId: milestone.projectId,
    title: milestone.title,
    amount: milestone.amount.toNumber(),
    sequence: milestone.sequence,
    status: milestone.status.toLowerCase() as MilestoneRecord["status"],
    evidenceCount: milestone._count?.evidence ?? 0
  };
}

@Injectable()
export class MilestonesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async create(input: {
    tenantId: string;
    projectId: string;
    title: string;
    amount: number;
    sequence: number;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      return createMilestoneMemory(input);
    }

    await this.actorContextService.ensureActorContext(input);
    const project = await this.findProjectOrThrow(input);
    assertMilestoneCreatable(this.toActor(input), this.toOwnership(project));

    if (input.amount <= 0) {
      throw new BadRequestException("milestone amount must be greater than zero");
    }

    const duplicateSequence = await this.prisma.milestone.findFirst({
      where: {
        projectId: input.projectId,
        deletedAt: null,
        sequence: input.sequence
      },
      select: { id: true }
    });

    if (duplicateSequence) {
      throw new ConflictException(`milestone sequence '${input.sequence}' already exists`);
    }

    const milestone = (await this.prisma.milestone.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        amount: input.amount,
        sequence: input.sequence,
        status: "DRAFT"
      }
    })) as StoredMilestone;

    return toMilestoneRecord(milestone, input.tenantId);
  }

  async listByProject(input: {
    tenantId: string;
    projectId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord[]> {
    if (!databaseEnabled()) {
      return listMilestonesByProjectMemory({
        tenantId: input.tenantId,
        projectId: input.projectId
      });
    }

    await this.actorContextService.ensureActorContext(input);
    const project = await this.findProjectOrThrow(input);
    assertMilestoneReadable(this.toActor(input), this.toOwnership(project));

    const milestones = (await this.prisma.milestone.findMany({
      where: {
        projectId: input.projectId,
        deletedAt: null
      },
      include: {
        _count: {
          select: { evidence: true }
        }
      },
      orderBy: { sequence: "asc" }
    })) as StoredMilestone[];

    return milestones.map((milestone) => toMilestoneRecord(milestone, input.tenantId));
  }

  async submit(input: {
    tenantId: string;
    milestoneId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      return submitMilestoneMemory(input);
    }

    await this.actorContextService.ensureActorContext(input);

    const snapshot = await this.getLifecycleSnapshot(input);
    assertMilestoneSubmittable(this.toActor(input), snapshot);

    const updated = (await this.prisma.milestone.update({
      where: { id: snapshot.milestoneId },
      data: { status: milestoneStatusMap.submitted }
    })) as StoredMilestone;

    return toMilestoneRecord(updated, input.tenantId);
  }

  async approve(input: {
    tenantId: string;
    milestoneId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      return approveMilestoneMemory(input);
    }

    await this.actorContextService.ensureActorContext(input);

    const snapshot = await this.getLifecycleSnapshot(input);
    assertMilestoneApprovable(this.toActor(input), snapshot);

    const updated = (await this.prisma.milestone.update({
      where: { id: snapshot.milestoneId },
      data: { status: milestoneStatusMap.approved }
    })) as StoredMilestone;

    return toMilestoneRecord(updated, input.tenantId);
  }

  async reject(input: {
    tenantId: string;
    milestoneId: string;
    reason: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      return rejectMilestoneMemory(input);
    }

    await this.actorContextService.ensureActorContext(input);

    const snapshot = await this.getLifecycleSnapshot(input);
    assertMilestoneRejectable(this.toActor(input), snapshot);

    const updated = (await this.prisma.milestone.update({
      where: { id: snapshot.milestoneId },
      data: { status: milestoneStatusMap.rejected }
    })) as StoredMilestone;

    return {
      ...toMilestoneRecord(updated, input.tenantId),
      rejectionReason: input.reason,
      reviewDecision: "reject"
    };
  }

  async requestChanges(input: {
    tenantId: string;
    milestoneId: string;
    reason: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      const milestone = rejectMilestoneMemory(input);
      milestone.status = "draft";
      milestone.reviewDecision = "request_changes";
      milestone.rejectionReason = input.reason;
      return milestone;
    }

    await this.actorContextService.ensureActorContext(input);

    const snapshot = await this.getLifecycleSnapshot(input);
    assertMilestoneRejectable(this.toActor(input), snapshot);

    const updated = (await this.prisma.milestone.update({
      where: { id: snapshot.milestoneId },
      data: { status: milestoneStatusMap.draft }
    })) as StoredMilestone;

    return {
      ...toMilestoneRecord(updated, input.tenantId),
      rejectionReason: input.reason,
      reviewDecision: "request_changes"
    };
  }

  async getEventContext(input: { tenantId: string; milestoneId: string }): Promise<MilestoneEventContext> {
    const milestone = await this.prisma.milestone.findFirst({
      where: {
        id: input.milestoneId,
        deletedAt: null,
        project: {
          tenantId: input.tenantId
        }
      },
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            jobId: true,
            job: {
              select: {
                clientOrgId: true,
                reservations: {
                  where: { status: "ACCEPTED" },
                  select: { professionalId: true },
                  take: 1,
                },
                contract: {
                  select: { clientUserId: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            evidence: true
          }
        }
      }
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone '${input.milestoneId}' not found`);
    }

    let clientUserId = milestone.project.job?.contract?.clientUserId ?? null;

    if (!clientUserId) {
      const clientOrgId = milestone.project.job?.clientOrgId;
      if (clientOrgId) {
        const member = await this.prisma.membership.findFirst({
          where: { orgId: clientOrgId, role: { key: "CLIENT" } },
          select: { userId: true },
        });
        clientUserId = member?.userId ?? null;
      }
    }

    return {
      milestoneId: milestone.id,
      projectId: milestone.projectId,
      jobId: milestone.project.jobId,
      evidenceCount: milestone._count.evidence,
      proUserId: milestone.project.job?.reservations?.[0]?.professionalId ?? null,
      clientUserId,
    };
  }

  async listByJob(input: {
    tenantId: string;
    jobId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord[]> {
    if (!databaseEnabled()) {
      const project = await this.findProjectByJobOrThrow(input);
      return this.listByProject({
        tenantId: input.tenantId,
        projectId: project.id,
        userId: input.userId,
        orgId: input.orgId,
        roles: input.roles
      });
    }

    await this.actorContextService.ensureActorContext(input);

    const project = await this.findProjectByJob(input);
    if (!project) {
      const job = await this.prisma.job.findFirst({
        where: {
          id: input.jobId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        select: {
          id: true
        }
      });

      if (!job) {
        throw new NotFoundException(`Job '${input.jobId}' not found`);
      }

      return [];
    }

    return this.listByProject({
      tenantId: input.tenantId,
      projectId: project.id,
      userId: input.userId,
      orgId: input.orgId,
      roles: input.roles
    });
  }

  async resolveProjectIdByJob(input: { tenantId: string; jobId: string }): Promise<string> {
    const project = await this.findProjectByJobOrThrow(input);
    return project.id;
  }

  async countProjectEvidence(input: { tenantId: string; projectId: string }): Promise<number> {
    return this.prisma.evidence.count({
      where: {
        project: { id: input.projectId, tenantId: input.tenantId },
      },
    });
  }

  private async findProjectOrThrow(input: { tenantId: string; projectId: string }) {
    return findProjectLinkByProjectIdOrThrow(this.prisma, input);
  }

  private async findProjectByJobOrThrow(input: { tenantId: string; jobId: string }) {
    return findProjectLinkByJobIdOrThrow(this.prisma, input);
  }

  private async findProjectByJob(input: { tenantId: string; jobId: string }) {
    return (await this.prisma.project.findFirst({
      where: {
        tenantId: input.tenantId,
        jobId: input.jobId,
        job: {
          deletedAt: null
        }
      },
      select: {
        id: true,
        jobId: true,
        assignedProOrgId: true,
        job: {
          select: {
            clientOrgId: true
          }
        }
      }
    })) as
      | {
          id: string;
          jobId: string;
          assignedProOrgId: string;
          job: { clientOrgId: string };
        }
      | null;
  }

  private async getLifecycleSnapshot(input: {
    tenantId: string;
    milestoneId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneLifecycleSnapshot> {
    const milestone = await this.findStoredMilestoneOrThrow(input);
    const evidenceCount = await this.prisma.evidence.count({
      where: {
        milestoneId: input.milestoneId,
        project: {
          tenantId: input.tenantId
        }
      }
    });

    return {
      milestoneId: milestone.id,
      currentStatus: milestone.status.toLowerCase() as MilestoneRecord["status"],
      ownership: this.toOwnership(milestone.project!),
      evidenceCount
    };
  }

  private toActor(input: { tenantId: string; orgId: string; userId: string; roles: string[] }): MilestoneActor {
    return {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles
    };
  }

  private toOwnership(input: { assignedProOrgId: string; job: { clientOrgId: string } }): MilestoneOwnership {
    return {
      clientOrgId: input.job.clientOrgId,
      assignedProOrgId: input.assignedProOrgId
    };
  }

  private async findStoredMilestoneOrThrow(input: {
    tenantId: string;
    milestoneId: string;
  }): Promise<StoredMilestone> {
    const milestone = (await this.prisma.milestone.findFirst({
      where: {
        id: input.milestoneId,
        deletedAt: null,
        project: {
          tenantId: input.tenantId
        }
      },
      include: {
        project: {
          select: {
            jobId: true,
            assignedProOrgId: true,
            job: {
              select: {
                clientOrgId: true
              }
            }
          }
        }
      }
    })) as StoredMilestone | null;

    if (!milestone) {
      throw new NotFoundException(`Milestone '${input.milestoneId}' not found`);
    }

    return milestone;
  }

  // ── Evidence Items ──────────────────────────────────────────────────────────

  async listEvidenceItems(milestoneId: string) {
    return this.prisma.milestoneEvidenceItem.findMany({
      where:   { milestoneId },
      orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
    });
  }

  /** Full detail of one evidence item including linked Evidence file metadata. */
  async getEvidenceItemDetail(milestoneId: string, itemId: string, tenantId: string) {
    const item = await this.prisma.milestoneEvidenceItem.findFirst({
      where: { id: itemId, milestoneId, milestone: { project: { tenantId } } },
    });
    if (!item) return null;

    const evidence = item.evidenceId
      ? await this.prisma.evidence.findFirst({
          where: { id: item.evidenceId },
          select: { id: true, bucketKey: true, kind: true, validationStatus: true, aiQualityScore: true, createdAt: true, uploadedById: true },
        })
      : null;

    const reviewer = item.reviewedById
      ? await this.prisma.user.findFirst({ where: { id: item.reviewedById }, select: { id: true, email: true } })
      : null;

    const uploader = evidence?.uploadedById
      ? await this.prisma.user.findFirst({ where: { id: evidence.uploadedById }, select: { id: true, email: true } })
      : null;

    return {
      ...item,
      file: evidence ? {
        evidenceId:      evidence.id,
        bucketKey:       evidence.bucketKey,
        kind:            evidence.kind,
        validationStatus: evidence.validationStatus,
        aiQualityScore:  evidence.aiQualityScore,
        uploadedAt:      evidence.createdAt,
        uploadedBy:      uploader,
      } : null,
      reviewer,
    };
  }

  /** History from AuditLog for this evidence item — paginated. */
  async getEvidenceItemHistory(itemId: string, tenantId: string, opts?: { limit?: number; cursor?: string }) {
    const limit = Math.min(opts?.limit ?? 20, 50);
    const events = await this.prisma.auditLog.findMany({
      where: {
        entityType: "MilestoneEvidenceItem",
        entityId:   itemId,
        tenantId,
        ...(opts?.cursor ? { occurredAt: { lt: new Date(opts.cursor) } } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: limit + 1,
      select: {
        id: true, action: true, beforeJson: true, afterJson: true,
        occurredAt: true, actorUserId: true,
        actor: { select: { id: true, email: true } },
      },
    });

    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore ? page[page.length - 1]?.occurredAt.toISOString() : undefined;

    return { events: page, pageInfo: { hasMore, nextCursor } };
  }

  /** Archive an evidence item logically; no hard delete; writes AuditLog. */
  async archiveEvidenceItem(input: {
    milestoneId:    string;
    itemId:         string;
    tenantId:       string;
    archiveReason:  string;
    actorUserId:    string;
  }) {
    const item = await this.prisma.milestoneEvidenceItem.findFirst({
      where: { id: input.itemId, milestoneId: input.milestoneId, milestone: { project: { tenantId: input.tenantId } } },
    });
    if (!item) return null;

    const previousStatus = item.status;

    const updated = await this.prisma.milestoneEvidenceItem.update({
      where: { id: input.itemId },
      data: { status: "archived", updatedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId:    input.tenantId,
        actorUserId: input.actorUserId,
        entityType:  "MilestoneEvidenceItem",
        entityId:    input.itemId,
        action:      "evidence_archived",
        beforeJson:  { status: previousStatus, evidenceId: item.evidenceId } as object,
        afterJson:   { status: "archived", archiveReason: input.archiveReason, archivedAt: new Date().toISOString() } as object,
      },
    });

    return { updated, previousStatus };
  }

  /** Replace the file linked to an evidence item; writes AuditLog for trazabilidad. */
  async replaceEvidenceItem(input: {
    milestoneId:    string;
    itemId:         string;
    tenantId:       string;
    newEvidenceId:  string;
    replacedReason: string;
    actorUserId:    string;
  }) {
    const item = await this.prisma.milestoneEvidenceItem.findFirst({
      where: { id: input.itemId, milestoneId: input.milestoneId, milestone: { project: { tenantId: input.tenantId } } },
    });
    if (!item) return null;

    const previousStatus = item.status;
    const previousEvidenceId = item.evidenceId;

    // Update item: new evidenceId + reset to submitted + clear AI review note
    const updated = await this.prisma.milestoneEvidenceItem.update({
      where: { id: input.itemId },
      data: {
        evidenceId:   input.newEvidenceId,
        status:       "submitted",
        reviewNote:   null,    // clear previous AI/admin review
        reviewedById: null,
        reviewedAt:   null,
        updatedAt:    new Date(),
      },
    });

    // Write AuditLog for history (no migration needed)
    await this.prisma.auditLog.create({
      data: {
        tenantId:    input.tenantId,
        actorUserId: input.actorUserId,
        entityType:  "MilestoneEvidenceItem",
        entityId:    input.itemId,
        action:      "evidence_replaced",
        beforeJson:  { status: previousStatus, evidenceId: previousEvidenceId } as object,
        afterJson:   { status: "submitted",    evidenceId: input.newEvidenceId, replacedReason: input.replacedReason } as object,
      },
    });

    return { updated, previousStatus, previousEvidenceId };
  }

  async seedEvidenceItems(milestoneId: string, items: Array<{
    label: string;
    description?: string;
    kind?: "PHOTO" | "VIDEO" | "DOCUMENT";
    phase?: "before" | "during" | "after";
    required?: boolean;
  }>) {
    // Idempotent — skip if items already seeded
    const existing = await this.prisma.milestoneEvidenceItem.count({ where: { milestoneId } });
    if (existing > 0) return;

    if (items.length === 0) return;

    await this.prisma.milestoneEvidenceItem.createMany({
      data: items.map(item => ({
        id:          `mev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        milestoneId,
        label:       item.label,
        description: item.description ?? null,
        kind:        item.kind ?? "PHOTO",
        phase:       item.phase ?? "after",
        required:    item.required ?? true,
        status:      "missing",
      })),
      skipDuplicates: true,
    });
  }

  async updateEvidenceItemStatus(input: {
    milestoneId:  string;
    itemId:       string;
    status:       "submitted" | "approved" | "rejected" | "needs_reupload" | "missing";
    evidenceId?:  string;
    reviewNote?:  string;   // admin review note or agent JSON
    auditReason?: string;   // human-readable reason (stored in reviewNote if no agent JSON)
    reviewedById?: string;
  }) {
    // Merge admin auditReason into reviewNote if no explicit reviewNote provided
    const reviewNote = input.reviewNote
      ?? (input.auditReason ? JSON.stringify({ adminReview: { status: input.status, reason: input.auditReason, reviewedAt: new Date().toISOString() } }) : undefined);

    return this.prisma.milestoneEvidenceItem.update({
      where: { id: input.itemId, milestoneId: input.milestoneId },
      data: {
        status:       input.status,
        evidenceId:   input.evidenceId ?? undefined,
        reviewNote:   reviewNote ?? undefined,
        reviewedById: input.reviewedById ?? undefined,
        reviewedAt:   new Date(),
        updatedAt:    new Date(),
      },
    });
  }

  // ── Payment Readiness ────────────────────────────────────────────────────────

  async computePaymentReadiness(milestoneId: string, tenantId: string): Promise<{
    status:       "not_ready" | "ready_to_release" | "released" | "held" | "disputed";
    reasons:      string[];
    blockers:     string[];
    nextAction:   string;
    milestone?:   { status: string; paymentReadiness: string; evidenceReadiness: string };
  }> {
    const milestone = await this.prisma.milestone.findFirst({
      where:   { id: milestoneId, project: { tenantId } },
      include: {
        evidenceItems: true,
        disputes:      { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
        paymentTxns:   { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!milestone) return {
      status:     "not_ready",
      reasons:    [],
      blockers:   ["Milestone not found"],
      nextAction: "Verify milestone ID",
    };

    const reasons:  string[] = [];
    const blockers: string[] = [];
    let status: "not_ready" | "ready_to_release" | "released" | "held" | "disputed" = "not_ready";

    // Dispute check
    if (milestone.disputes.length > 0) {
      blockers.push("Active dispute — payment held until resolution");
      return { status: "disputed", reasons, blockers, nextAction: "Resolve open dispute", milestone: {
        status: milestone.status, paymentReadiness: milestone.paymentReadiness, evidenceReadiness: milestone.evidenceReadiness,
      }};
    }

    // Already paid
    if (milestone.status === "PAID") {
      reasons.push("Milestone has been paid");
      return { status: "released", reasons, blockers, nextAction: "Milestone complete", milestone: {
        status: milestone.status, paymentReadiness: milestone.paymentReadiness, evidenceReadiness: milestone.evidenceReadiness,
      }};
    }

    // Evidence checklist
    const requiredItems = milestone.evidenceItems.filter(e => e.required);
    const approvedItems = requiredItems.filter(e => e.status === "approved");
    const missingItems  = requiredItems.filter(e => e.status === "missing");
    const rejectedItems = requiredItems.filter(e => e.status === "rejected");
    const submittedItems = requiredItems.filter(e => e.status === "submitted");

    if (requiredItems.length > 0) {
      if (approvedItems.length === requiredItems.length) {
        reasons.push(`All ${requiredItems.length} required evidence item(s) approved`);
      } else {
        if (missingItems.length > 0)  blockers.push(`${missingItems.length} required evidence item(s) still missing`);
        if (rejectedItems.length > 0) blockers.push(`${rejectedItems.length} evidence item(s) rejected — must be resubmitted`);
        if (submittedItems.length > 0) reasons.push(`${submittedItems.length} evidence item(s) submitted — pending review`);
      }
    }

    // Approval check
    const milestoneApproved = milestone.status === "APPROVED";
    if (milestoneApproved) {
      reasons.push("Client approved this milestone");
    } else {
      if (milestone.status === "SUBMITTED" || milestone.status === "AWAITING_REVIEW") {
        blockers.push("Waiting for client approval");
      } else if (milestone.status === "REJECTED") {
        blockers.push("Client rejected — changes required before resubmission");
      } else {
        blockers.push("Milestone not yet submitted for approval");
      }
    }

    // Determine final status
    if (blockers.length === 0 && milestoneApproved) {
      status = "ready_to_release";
    } else if (blockers.some(b => b.includes("rejected"))) {
      status = "held";
    }

    // Update DB status if it changed
    if (milestone.paymentReadiness !== status) {
      await this.prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          paymentReadiness:  status,
          evidenceReadiness: requiredItems.length === 0 ? "complete"
            : approvedItems.length === requiredItems.length ? "complete"
            : submittedItems.length > 0 ? "partial" : "missing",
        },
      });
    }

    const nextAction =
      status === "ready_to_release" ? "Release payment to professional" :
      milestone.disputes.length > 0 ? "Resolve open dispute" :
      milestone.status === "SUBMITTED" ? "Awaiting client review" :
      blockers.some(b => b.includes("evidence")) ? "Upload required evidence photos" :
      "Submit milestone for client approval";

    return {
      status,
      reasons,
      blockers,
      nextAction,
      milestone: { status: milestone.status, paymentReadiness: status, evidenceReadiness: milestone.evidenceReadiness },
    };
  }

  async getVisionSummary(milestoneId: string, tenantId: string): Promise<{
    milestoneId: string;
    totalAnalyzed: number;
    avgQualityScore: number | null;
    avgBlurScore: number | null;
    avgBrightnessScore: number | null;
    riskLevelCounts: Record<string, number>;
    requiresHumanReviewCount: number;
    canAutoApproveCount: number;
    overallVisionReady: boolean;
    blockers: string[];
    generatedAt: string;
  }> {
    const visionDelegate = (this.prisma as unknown as OptionalVisionPrisma).visionAnalysis;
    const analyses = visionDelegate
      ? await visionDelegate.findMany({
          where: {
            milestoneId,
            status: "completed",
          },
          select: {
            qualityScore: true,
            blurScore: true,
            brightnessScore: true,
            riskLevel: true,
            requiresHumanReview: true,
            canAutoApprove: true,
            riskReasons: true,
          },
        })
      : [];

    if (analyses.length === 0) {
      return {
        milestoneId,
        totalAnalyzed: 0,
        avgQualityScore: null,
        avgBlurScore: null,
        avgBrightnessScore: null,
        riskLevelCounts: {},
        requiresHumanReviewCount: 0,
        canAutoApproveCount: 0,
        overallVisionReady: false,
        blockers: ["No vision analyses found for this milestone"],
        generatedAt: new Date().toISOString(),
      };
    }

    const scored = analyses.filter(a => a.qualityScore !== null);
    const avgQuality = scored.length > 0
      ? scored.reduce((s, a) => s + (a.qualityScore ?? 0), 0) / scored.length : null;
    const avgBlur = scored.length > 0
      ? scored.reduce((s, a) => s + (a.blurScore ?? 0), 0) / scored.length : null;
    const avgBrightness = scored.length > 0
      ? scored.reduce((s, a) => s + (a.brightnessScore ?? 0), 0) / scored.length : null;

    const riskLevelCounts: Record<string, number> = {};
    for (const a of analyses) {
      const lvl = a.riskLevel ?? "unknown";
      riskLevelCounts[lvl] = (riskLevelCounts[lvl] ?? 0) + 1;
    }

    const requiresHumanReviewCount = analyses.filter(a => a.requiresHumanReview).length;
    const canAutoApproveCount = analyses.filter(a => a.canAutoApprove).length;

    const blockers: string[] = [];
    const criticalCount = (riskLevelCounts["critical"] ?? 0) + (riskLevelCounts["high"] ?? 0);
    if (criticalCount > 0) blockers.push(`${criticalCount} photo(s) flagged as high/critical risk`);
    if (avgQuality !== null && avgQuality < 0.5) blockers.push(`Average quality score ${(avgQuality * 100).toFixed(0)}% is below 50% threshold`);
    if (requiresHumanReviewCount > 0) blockers.push(`${requiresHumanReviewCount} photo(s) require human review`);

    const overallVisionReady = blockers.length === 0 && analyses.length > 0;

    return {
      milestoneId,
      totalAnalyzed: analyses.length,
      avgQualityScore: avgQuality !== null ? Math.round(avgQuality * 1000) / 1000 : null,
      avgBlurScore: avgBlur !== null ? Math.round(avgBlur * 1000) / 1000 : null,
      avgBrightnessScore: avgBrightness !== null ? Math.round(avgBrightness * 1000) / 1000 : null,
      riskLevelCounts,
      requiresHumanReviewCount,
      canAutoApproveCount,
      overallVisionReady,
      blockers,
      generatedAt: new Date().toISOString(),
    };
  }

  async checkAllMilestonesApproved(input: { tenantId: string; projectId: string }): Promise<boolean> {
    if (!databaseEnabled()) return false;
    const [total, approved] = await Promise.all([
      this.prisma.milestone.count({
        where: { projectId: input.projectId, deletedAt: null },
      }),
      this.prisma.milestone.count({
        where: { projectId: input.projectId, deletedAt: null, status: { in: ["APPROVED", "PAID"] } },
      }),
    ]);
    return total > 0 && total === approved;
  }
}

import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import {
  PROJECT_ORIGINATOR_PROPOSED_V1_SCHEMA_REF,
  PROJECT_ORIGINATOR_VALIDATED_V1_SCHEMA_REF,
  projectOriginatorProposedV1EventSchema,
  projectOriginatorValidatedV1EventSchema,
} from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { OutboxRepository } from "../domain-events/outbox.repository.js";

export type ProjectOriginatorRow = {
  id: string;
  tenantId: string;
  projectId: string;
  originatorUserId: string;
  status: "PENDING_OWNER_VALIDATION" | "VALIDATED" | "REJECTED";
  validatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OriginatorRewardRow = {
  id: string;
  tenantId: string;
  projectOriginatorId: string;
  type: "FIXED_BONUS" | "PLATFORM_FEE_SHARE";
  triggerEvent: string;
  amountCents: number;
  platformFeeCentsSnapshot: number | null;
  status: "PENDING_REVIEW" | "BLOCKED_NO_PAYOUT_ACCOUNT" | "RELEASED" | "RELEASE_FAILED" | "REVERSED";
  reviewEndsAt: Date;
  releasedAt: Date | null;
  releaseFailedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class OriginatorRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  async findByProjectId(projectId: string): Promise<ProjectOriginatorRow | null> {
    return this.prisma.projectOriginator.findUnique({ where: { projectId } });
  }

  async findById(id: string): Promise<ProjectOriginatorRow | null> {
    return this.prisma.projectOriginator.findUnique({ where: { id } });
  }

  // Bridges the execution-phase Project (where milestones/payments live) back
  // to the BuildOpsProject where the originator registration lives, via the
  // Job both point to. Returns null anywhere the chain doesn't resolve
  // (never published, never originated, or not yet validated) — those are
  // the common case, not error conditions.
  async findValidatedByJobId(jobId: string): Promise<ProjectOriginatorRow | null> {
    const buildOpsProject = await this.prisma.buildOpsProject.findUnique({
      where: { jobId },
      select: { id: true },
    });
    if (!buildOpsProject) return null;
    return this.prisma.projectOriginator.findFirst({
      where: { projectId: buildOpsProject.id, status: "VALIDATED" },
    });
  }

  async findRewardByType(
    projectOriginatorId: string,
    type: "FIXED_BONUS" | "PLATFORM_FEE_SHARE",
  ): Promise<OriginatorRewardRow | null> {
    return this.prisma.originatorReward.findUnique({
      where: { projectOriginatorId_type: { projectOriginatorId, type } },
    });
  }

  async propose(input: {
    tenantId: string;
    orgId: string;
    projectId: string;
    originatorUserId: string;
    actorUserId: string;
    requestId: string;
  }): Promise<ProjectOriginatorRow> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.projectOriginator.create({
        data: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          originatorUserId: input.originatorUserId,
        },
      });

      const now = new Date();
      const event = projectOriginatorProposedV1EventSchema.parse({
        eventId: crypto.randomUUID(),
        eventType: "project.originator_proposed.v1",
        version: 1,
        envelopeVersion: 2,
        occurredAt: now.toISOString(),
        recordedAt: now.toISOString(),
        tenantId: input.tenantId,
        orgId: input.orgId,
        module: "originator",
        entityType: "ProjectOriginator",
        entityId: created.id,
        actor: { type: "user", id: input.actorUserId },
        correlationId: input.requestId,
        idempotencyKey: `originator-proposed:${created.id}`,
        schemaRef: PROJECT_ORIGINATOR_PROPOSED_V1_SCHEMA_REF,
        payload: {
          projectOriginatorId: created.id,
          projectId: input.projectId,
          originatorUserId: input.originatorUserId,
        },
        metadata: { source: "originator.propose" },
      });

      await this.outboxRepository.create(tx, event);
      return created;
    });
  }

  async validate(input: {
    projectOriginator: ProjectOriginatorRow;
    orgId: string;
    actorUserId: string;
    decision: "VALIDATED" | "REJECTED";
    requestId: string;
  }): Promise<ProjectOriginatorRow> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectOriginator.update({
        where: { id: input.projectOriginator.id },
        data: {
          status: input.decision,
          validatedAt: input.decision === "VALIDATED" ? new Date() : null,
        },
      });

      const now = new Date();
      const event = projectOriginatorValidatedV1EventSchema.parse({
        eventId: crypto.randomUUID(),
        eventType: "project.originator_validated.v1",
        version: 1,
        envelopeVersion: 2,
        occurredAt: now.toISOString(),
        recordedAt: now.toISOString(),
        tenantId: input.projectOriginator.tenantId,
        orgId: input.orgId,
        module: "originator",
        entityType: "ProjectOriginator",
        entityId: updated.id,
        actor: { type: "user", id: input.actorUserId },
        correlationId: input.requestId,
        idempotencyKey: `originator-validated:${updated.id}:${input.decision}`,
        schemaRef: PROJECT_ORIGINATOR_VALIDATED_V1_SCHEMA_REF,
        payload: {
          projectOriginatorId: updated.id,
          projectId: updated.projectId,
          originatorUserId: updated.originatorUserId,
          decision: input.decision,
        },
        metadata: { source: "originator.validate" },
      });

      await this.outboxRepository.create(tx, event);
      return updated;
    });
  }

  async createRewardEvent(input: {
    tenantId: string;
    projectOriginatorId: string;
    type: "FIXED_BONUS" | "PLATFORM_FEE_SHARE";
    triggerEvent: string;
    amountCents: number;
    platformFeeCentsSnapshot: number | null;
    payoutsEnabled: boolean;
  }): Promise<OriginatorRewardRow> {
    const now = new Date();
    const eligible = input.payoutsEnabled;
    return this.prisma.originatorReward.create({
      data: {
        tenantId: input.tenantId,
        projectOriginatorId: input.projectOriginatorId,
        type: input.type,
        triggerEvent: input.triggerEvent,
        amountCents: input.amountCents,
        platformFeeCentsSnapshot: input.platformFeeCentsSnapshot,
        status: eligible ? "PENDING_REVIEW" : "BLOCKED_NO_PAYOUT_ACCOUNT",
        reviewEndsAt: eligible
          ? new Date(now.getTime() + REVIEW_WINDOW_MS)
          : now,
      },
    });
  }

  async findRewardsByProjectOriginatorId(
    projectOriginatorId: string,
  ): Promise<OriginatorRewardRow[]> {
    return this.prisma.originatorReward.findMany({
      where: { projectOriginatorId },
      orderBy: { createdAt: "asc" },
    });
  }

  // Called once the originator's StripeConnectAccount.payoutsEnabled flips true.
  async unblockPendingRewards(projectOriginatorId: string): Promise<number> {
    const now = new Date();
    const result = await this.prisma.originatorReward.updateMany({
      where: { projectOriginatorId, status: "BLOCKED_NO_PAYOUT_ACCOUNT" },
      data: {
        status: "PENDING_REVIEW",
        reviewEndsAt: new Date(now.getTime() + REVIEW_WINDOW_MS),
      },
    });
    return result.count;
  }
}

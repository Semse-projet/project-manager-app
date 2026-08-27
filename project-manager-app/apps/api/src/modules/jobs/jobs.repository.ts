import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  JOB_CREATED_V1_SCHEMA_REF,
  JOB_STATUS_CHANGED_V1_SCHEMA_REF,
  jobCreatedV1EventSchema,
  jobStatusChangedV1EventSchema,
} from "@semse/schemas";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { type JobRecord } from "../../common/domain-store.js";
import { OutboxRepository } from "../domain-events/outbox.repository.js";
import {
  buildJobsBidsProjection,
  isJobsBidsProjectionEnabled,
  isJobsBidsProjectionPersistenceEnabled,
  type JobsBidsProjectionSnapshot,
} from "./jobs-bids-projection.js";

const jobStatusMap = {
  draft: "DRAFT",
  posted: "POSTED",
  published: "PUBLISHED",
  reserved: "RESERVED",
  accepted: "ACCEPTED",
  in_progress: "IN_PROGRESS",
  review: "REVIEW",
  completed: "COMPLETED",
  dispute: "DISPUTE",
  awarded: "AWARDED",
  cancelled: "CANCELLED"
} as const;

type StoredJob = {
  id: string;
  tenantId: string;
  clientOrgId: string;
  title: string;
  category: string | null;
  scope: string;
  status: string;
  budgetType: string | null;
  budgetMin: { toNumber(): number } | null;
  budgetMax: { toNumber(): number } | null;
  location: string | null;
  latitude: { toNumber(): number } | null;
  longitude: { toNumber(): number } | null;
  locationSource: string | null;
  urgency: string | null;
  deadline: Date | null;
};

type JobTransitionAccess = {
  clientOrgId: string;
  professionalOrgId: string | null;
};

type JobTransitionAccessRow = {
  clientOrgId: string;
  project: { assignedProOrgId: string | null } | null;
  contract: { professionalOrgId: string | null } | null;
  reservations: Array<{ professionalOrgId: string | null }>;
};

@Injectable()
export class JobsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
    private readonly outboxRepository: OutboxRepository
  ) {}

  /**
   * 2.27 — this used to filter only by tenantId + deletedAt: null, so ANY
   * authenticated caller (e.g. a PRO hitting GET /api/semse/jobs from
   * worker/dashboard) received every job for the whole tenant across ALL
   * client organizations, in every status including DRAFT (unpublished).
   * The frontend only *displayed* a filtered subset — the full payload,
   * including other clients' draft/private jobs, still reached the browser.
   *
   * Now scoped by role, matching how each role is actually allowed to see
   * jobs elsewhere in the app:
   *  - OPS_ADMIN: unrestricted (tenant-wide ops visibility is intentional).
   *  - CLIENT: only jobs belonging to the caller's own client org.
   *  - PRO/WORKER: only postable jobs (POSTED/PUBLISHED, open to bid) plus
   *    jobs the caller is already engaged with (bid, reservation, contract,
   *    or org-level project assignment) — same "assigned" definition used by
   *    FieldOpsRepository.trackerJobAssignmentWhere and
   *    LaborEngineRepository.findJobForLaborEntry.
   *  - Any other/unrecognized role: falls back to own-org scoping (deny by
   *    default rather than tenant-wide).
   */
  async listByTenant(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    status?: JobRecord["status"];
  }): Promise<JobRecord[]> {
    await this.actorContextService.ensureActorContext(input);

    const isOpsAdmin = input.roles.includes("OPS_ADMIN");
    const isClient = input.roles.includes("CLIENT");
    const isPro = input.roles.includes("PRO") || input.roles.includes("WORKER");

    const visibilityWhere: Prisma.JobWhereInput = isOpsAdmin
      ? {}
      : isClient
        ? { clientOrgId: input.orgId }
        : isPro
          ? {
              OR: [
                { status: { in: ["POSTED", "PUBLISHED"] } },
                { bids: { some: { professionalUserId: input.userId } } },
                {
                  reservations: {
                    some: {
                      status: { in: ["ACTIVE", "ACCEPTED"] },
                      OR: [{ professionalId: input.userId }, { professionalOrgId: input.orgId }]
                    }
                  }
                },
                { contract: { is: { deletedAt: null, OR: [{ professionalUserId: input.userId }, { professionalOrgId: input.orgId }] } } },
                { project: { is: { assignedProOrgId: input.orgId } } }
              ]
            }
          : { clientOrgId: input.orgId };

    const jobs = (await this.prisma.job.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        ...(input.status ? { status: jobStatusMap[input.status] } : {}),
        ...visibilityWhere
      },
      orderBy: { createdAt: "desc" }
    })) as StoredJob[];

    return jobs.map((job) => this.toRecord(job));
  }

  async findById(input: {
    tenantId: string;
    jobId: string;
    orgId: string;
    userId: string;
  }): Promise<JobRecord> {
    await this.actorContextService.ensureActorContext(input);
    const job = (await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null
      }
    })) as StoredJob | null;

    if (!job) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    return this.toRecord(job);
  }

  async create(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    title: string;
    category?: string;
    scope: string;
    budgetType?: string;
    budgetMin?: number;
    budgetMax?: number;
    location?: string;
    latitude?: number;
    longitude?: number;
    locationSource?: "geocoded" | "manual";
    urgency?: string;
    deadline?: Date;
    requestId?: string;
  }): Promise<JobRecord> {
    await this.actorContextService.ensureActorContext(input);
    const job = (await this.prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          tenantId: input.tenantId,
          clientOrgId: input.orgId,
          title: input.title,
          category: input.category,
          scope: input.scope,
          status: "POSTED",
          budgetType: input.budgetType,
          budgetMin: input.budgetMin,
          budgetMax: input.budgetMax,
          location: input.location,
          latitude: input.latitude,
          longitude: input.longitude,
          locationSource: input.locationSource,
          urgency: input.urgency,
          deadline: input.deadline,
        }
      });

      const recordedAt = new Date();
      const event = jobCreatedV1EventSchema.parse({
        eventId: randomUUID(),
        eventType: "job.created.v1",
        version: 1,
        envelopeVersion: 2,
        occurredAt: recordedAt.toISOString(),
        recordedAt: recordedAt.toISOString(),
        tenantId: input.tenantId,
        orgId: input.orgId,
        module: "jobs",
        entityType: "Job",
        entityId: created.id,
        actor: { type: "user", id: input.userId },
        correlationId: input.requestId ?? created.id,
        idempotencyKey: jobsBidsEventIdempotencyKey("job.created.v1", created.id),
        schemaRef: JOB_CREATED_V1_SCHEMA_REF,
        payload: {
          jobId: created.id,
          clientOrgId: input.orgId,
          title: created.title,
          category: created.category ?? undefined,
          scope: created.scope,
          budgetType: created.budgetType ?? undefined,
          budgetMin: created.budgetMin?.toNumber(),
          budgetMax: created.budgetMax?.toNumber(),
          location: created.location ?? undefined,
          urgency: created.urgency ?? undefined,
          deadline: created.deadline?.toISOString(),
        },
        metadata: { source: "jobs.create" },
      });
      await this.outboxRepository.create(tx, event);

      return created;
    })) as StoredJob;

    return this.toRecord(job);
  }

  async archive(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
  }): Promise<{ id: string; archivedAt: string }> {
    await this.actorContextService.ensureActorContext(input);

    const job = (await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        clientOrgId: true
      }
    })) as { id: string; clientOrgId: string } | null;

    if (!job) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }
    if (job.clientOrgId !== input.orgId && !input.roles.includes("OPS_ADMIN")) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    const archivedAt = new Date();
    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        deletedAt: archivedAt
      }
    });

    return {
      id: job.id,
      archivedAt: archivedAt.toISOString()
    };
  }

  async restore(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    jobId: string;
  }): Promise<{ id: string; restored: true }> {
    await this.actorContextService.ensureActorContext(input);

    const job = await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId
      },
      select: {
        id: true,
        clientOrgId: true,
        deletedAt: true
      }
    });

    if (!job) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }
    if (job.clientOrgId !== input.orgId && !input.roles.includes("OPS_ADMIN")) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        deletedAt: null
      }
    });

    return {
      id: job.id,
      restored: true
    };
  }

  async updateFields(input: {
    tenantId: string;
    jobId: string;
    fields: Partial<{
      title: string;
      scope: string;
      category: string;
      budgetType: string;
      budgetMin: number;
      budgetMax: number;
      urgency: string;
      deadline: string;
      location: string;
      latitude: number;
      longitude: number;
      locationSource: "geocoded" | "manual";
    }>;
  }): Promise<JobRecord> {
    const existing = await this.prisma.job.findFirst({
      where: { id: input.jobId, tenantId: input.tenantId, deletedAt: null },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    const job = (await this.prisma.job.update({
      where: { id: existing.id },
      data: { ...input.fields }
    })) as StoredJob;

    return this.toRecord(job);
  }

  async updateStatus(input: {
    tenantId: string;
    jobId: string;
    status: JobRecord["status"];
    orgId: string;
    actorType: "user" | "system" | "agent" | "webhook";
    actorId: string;
    requestId?: string;
  }): Promise<JobRecord> {
    const dbStatus = jobStatusMap[input.status];
    if (!dbStatus) {
      throw new Error(`Unknown job status: ${input.status}`);
    }

    const job = (await this.prisma.$transaction(async (tx) => {
      const existing = await tx.job.findFirst({
        where: {
          id: input.jobId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        select: { id: true, status: true, updatedAt: true }
      });

      if (!existing) {
        throw new NotFoundException(`Job '${input.jobId}' not found`);
      }

      const updated = await tx.job.update({
        where: { id: existing.id },
        data: { status: dbStatus }
      });

      const recordedAt = new Date();
      const event = jobStatusChangedV1EventSchema.parse({
        eventId: randomUUID(),
        eventType: "job.status_changed.v1",
        version: 1,
        envelopeVersion: 2,
        occurredAt: recordedAt.toISOString(),
        recordedAt: recordedAt.toISOString(),
        tenantId: input.tenantId,
        orgId: input.orgId,
        module: "jobs",
        entityType: "Job",
        entityId: updated.id,
        actor: { type: input.actorType, id: input.actorId },
        correlationId: input.requestId ?? `${updated.id}:${existing.updatedAt.getTime()}`,
        idempotencyKey: jobsBidsEventIdempotencyKey(
          "job.status_changed.v1",
          `${updated.id}:${existing.status}:${dbStatus}:${existing.updatedAt.getTime()}`
        ),
        schemaRef: JOB_STATUS_CHANGED_V1_SCHEMA_REF,
        payload: {
          jobId: updated.id,
          fromStatus: existing.status,
          toStatus: dbStatus,
        },
        metadata: { source: "jobs.update-status" },
      });
      await this.outboxRepository.create(tx, event);

      return updated;
    })) as StoredJob;

    return this.toRecord(job);
  }

  async getTransitionAccess(input: {
    tenantId: string;
    jobId: string;
  }): Promise<JobTransitionAccess> {
    const job = (await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        clientOrgId: true,
        project: {
          select: {
            assignedProOrgId: true
          }
        },
        contract: {
          select: {
            professionalOrgId: true
          }
        },
        reservations: {
          where: {
            status: {
              in: ["ACTIVE", "ACCEPTED"]
            }
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 1,
          select: {
            professionalOrgId: true
          }
        }
      }
    })) as JobTransitionAccessRow | null;

    if (!job) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    return {
      clientOrgId: job.clientOrgId,
      professionalOrgId:
        job.project?.assignedProOrgId ??
        job.contract?.professionalOrgId ??
        job.reservations[0]?.professionalOrgId ??
        null
    };
  }

  /**
   * Rebuilds `JobsBidsProjection` for one job from current DB state (not
   * delta-application from the triggering event) — same strategy as
   * ProjectsRepository.rebuildLifecycleProjection, safe under out-of-order
   * delivery. Returns "disabled" without touching the projection table
   * when the tenant isn't canary-allowlisted or the persist kill switch is
   * off, so the consumer can still ack the event cleanly.
   */
  async rebuildJobsBidsProjection(input: {
    tenantId: string;
    jobId: string;
  }): Promise<{
    effect: "updated" | "no_op" | "disabled";
    revision?: string;
    sourceUpdatedAt?: string;
  }> {
    if (
      !isJobsBidsProjectionEnabled(input.tenantId) ||
      !isJobsBidsProjectionPersistenceEnabled()
    ) {
      return { effect: "disabled" };
    }

    const sources = await this.prisma.job.findFirst({
      where: { id: input.jobId, tenantId: input.tenantId },
      select: {
        id: true,
        tenantId: true,
        clientOrgId: true,
        title: true,
        status: true,
        updatedAt: true,
        bids: {
          select: {
            id: true,
            proOrgId: true,
            professionalUserId: true,
            amount: true,
            etaDays: true,
            status: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!sources) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    const projection = buildJobsBidsProjection({
      job: {
        id: sources.id,
        tenantId: sources.tenantId,
        clientOrgId: sources.clientOrgId,
        title: sources.title,
        status: sources.status,
        updatedAt: sources.updatedAt,
      },
      bids: sources.bids.map((bid) => ({
        id: bid.id,
        proOrgId: bid.proOrgId,
        professionalUserId: bid.professionalUserId,
        amount: bid.amount.toNumber(),
        etaDays: bid.etaDays,
        status: bid.status,
        updatedAt: bid.updatedAt,
      })),
    });

    const effect = await this.persistJobsBidsProjection(input, projection);
    return {
      effect,
      revision: projection.revision,
      sourceUpdatedAt: projection.sourceUpdatedAt,
    };
  }

  private async persistJobsBidsProjection(
    input: { tenantId: string; jobId: string },
    projection: JobsBidsProjectionSnapshot
  ): Promise<"updated" | "no_op"> {
    const sourceUpdatedAt = new Date(projection.sourceUpdatedAt);
    const data = {
      tenantId: input.tenantId,
      clientOrgId: projection.job.clientOrgId,
      schemaVersion: projection.schemaVersion,
      revision: projection.revision,
      snapshotJson: projection as unknown as Prisma.InputJsonValue,
      sourceUpdatedAt,
      generatedAt: new Date(projection.generatedAt)
    };
    let current = await this.prisma.jobsBidsProjection.findUnique({
      where: { jobId: input.jobId },
      select: { id: true, revision: true, sourceUpdatedAt: true }
    });

    if (
      current?.revision === projection.revision ||
      (current && current.sourceUpdatedAt.getTime() > sourceUpdatedAt.getTime())
    ) {
      return "no_op";
    }

    if (!current) {
      try {
        await this.prisma.jobsBidsProjection.create({
          data: {
            jobId: input.jobId,
            ...data
          }
        });
        return "updated";
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }
        current = await this.prisma.jobsBidsProjection.findUnique({
          where: { jobId: input.jobId },
          select: { id: true, revision: true, sourceUpdatedAt: true }
        });
      }
    }

    if (
      !current ||
      current.revision === projection.revision ||
      current.sourceUpdatedAt.getTime() > sourceUpdatedAt.getTime()
    ) {
      return "no_op";
    }

    const updated = await this.prisma.jobsBidsProjection.updateMany({
      where: {
        id: current.id,
        jobId: input.jobId,
        revision: current.revision,
        sourceUpdatedAt: {
          lte: sourceUpdatedAt
        }
      },
      data
    });
    return updated.count === 1 ? "updated" : "no_op";
  }

  private toRecord(job: StoredJob): JobRecord {
    return {
      id: job.id,
      tenantId: job.tenantId,
      clientOrgId: job.clientOrgId,
      title: job.title,
      category: job.category ?? undefined,
      scope: job.scope,
      status: job.status.toLowerCase() as JobRecord["status"],
      budgetType: job.budgetType ?? undefined,
      budgetMin: job.budgetMin?.toNumber(),
      budgetMax: job.budgetMax?.toNumber(),
      location: job.location ?? undefined,
      latitude: job.latitude?.toNumber(),
      longitude: job.longitude?.toNumber(),
      locationSource: (job.locationSource as "geocoded" | "manual" | null) ?? undefined,
      urgency: job.urgency ?? undefined,
      deadline: job.deadline?.toISOString(),
    };
  }
}

/**
 * Anchored to the write's own state (a freshly-created entity id, or a
 * pre-update `updatedAt` snapshot for a mutation) rather than the caller's
 * `requestId` — jobs/bids `create`/`updateStatus` have no existing
 * request-level idempotency contract to key off of (unlike
 * `evidence.repository.ts`), so keying on caller-supplied data here would
 * make a legitimate client retry roll back its own successful write via a
 * spurious outbox P2002. Anchoring on DB-generated state means this key
 * can never collide across two genuinely different writes.
 */
function jobsBidsEventIdempotencyKey(eventType: string, anchor: string): string {
  return `${eventType}:${anchor}`;
}

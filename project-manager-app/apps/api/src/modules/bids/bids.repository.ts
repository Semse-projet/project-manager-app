import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  BID_ACCEPTED_V1_SCHEMA_REF,
  BID_CREATED_V1_SCHEMA_REF,
  BID_REJECTED_V1_SCHEMA_REF,
  bidAcceptedV1EventSchema,
  bidCreatedV1EventSchema,
  bidRejectedV1EventSchema,
} from "@semse/schemas";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { type BidRecord } from "../../common/domain-store.js";
import { OutboxRepository } from "../domain-events/outbox.repository.js";

type StoredBid = {
  id: string;
  jobId: string;
  proOrgId: string;
  professionalUserId: string;
  amount: { toNumber(): number };
  etaDays: number;
  status: string;
  note?: string | null;
  professional?: {
    email: string;
    ratingsReceived?: Array<{ score: number }>;
  } | null;
  job: {
    id: string;
    tenantId: string;
    status: string;
    clientOrgId: string;
  };
};

type BidTx = Prisma.TransactionClient & Pick<PrismaService, "bid" | "job" | "jobReservation" | "project">;

@Injectable()
export class BidsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
    private readonly outboxRepository: OutboxRepository
  ) {}

  async listByJob(input: {
    tenantId: string;
    jobId: string;
    orgId: string;
    userId: string;
  }): Promise<BidRecord[]> {
    await this.actorContextService.ensureActorContext(input);

    const bids = (await this.prisma.bid.findMany({
      where: {
        jobId: input.jobId,
        job: {
          tenantId: input.tenantId
        }
      },
      include: {
        job: {
          select: {
            id: true,
            tenantId: true,
            status: true,
            clientOrgId: true
          }
        },
        professional: {
            select: {
              email: true,
              ratingsReceived: { select: { score: true }, take: 100 }
            }
          }
      },
      orderBy: { createdAt: "desc" }
    })) as StoredBid[];

    return bids.map((bid) => this.toRecord(bid));
  }

  /** Tenant-wide bid feed for admin oversight — not scoped to a job or a
   * professional, unlike listByJob/listByWorker above. Gated at the
   * controller by an OPS_ADMIN-only permission (bids:read:tenant), never
   * bids:read, since that permission is also granted to CLIENT/PRO/WORKER. */
  async listByTenant(input: { tenantId: string }): Promise<BidRecord[]> {
    const bids = (await this.prisma.bid.findMany({
      where: {
        job: { tenantId: input.tenantId }
      },
      include: {
        job: {
          select: {
            id: true,
            tenantId: true,
            status: true,
            clientOrgId: true
          }
        },
        professional: {
          select: {
            email: true,
            ratingsReceived: { select: { score: true }, take: 100 }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    })) as StoredBid[];

    return bids.map((bid) => this.toRecord(bid));
  }

  async listByWorker(input: {
    tenantId: string;
    userId: string;
    orgId: string;
  }): Promise<BidRecord[]> {
    await this.actorContextService.ensureActorContext(input);

    const bids = await this.prisma.bid.findMany({
      where: {
        professionalUserId: input.userId,
        job: { tenantId: input.tenantId }
      },
      include: {
        job: {
          select: {
            id: true,
            tenantId: true,
            title: true,
            category: true,
            location: true,
            budgetMin: true,
            budgetMax: true,
            status: true,
            clientOrgId: true,
            // Job only tracks clientOrgId (an org can have multiple members)
            // — Contract.clientUserId is the one place that identifies the
            // specific client user who actually signed, which is what a
            // review needs to attribute to a person. See G-PRO-07/2.17 in
            // docs/AUDIT_REMEDIATION_PLAN.md.
            contract: {
              select: {
                clientUserId: true,
                clientUser: { select: { email: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return bids.map((bid) => ({
      id: bid.id,
      tenantId: bid.job.tenantId,
      jobId: bid.jobId,
      proOrgId: bid.proOrgId,
      professionalUserId: bid.professionalUserId ?? undefined,
      amount: bid.amount.toNumber(),
      etaDays: bid.etaDays,
      note: bid.note ?? undefined,
      status: bid.status.toLowerCase() as BidRecord["status"],
      jobTitle: bid.job.title,
      jobCategory: bid.job.category ?? undefined,
      jobLocation: bid.job.location ?? undefined,
      jobBudgetMin: bid.job.budgetMin?.toNumber() ?? undefined,
      jobBudgetMax: bid.job.budgetMax?.toNumber() ?? undefined,
      jobStatus: bid.job.status.toLowerCase(),
      clientUserId: bid.job.contract?.clientUserId ?? undefined,
      clientEmail: bid.job.contract?.clientUser?.email ?? undefined,
      createdAt: bid.createdAt.toISOString(),
    }));
  }

  async create(input: {
    tenantId: string;
    jobId: string;
    proOrgId: string;
    userId: string;
    orgId: string;
    roles?: string[];
    amount: number;
    etaDays: number;
    note?: string;
  }): Promise<BidRecord> {
    await this.actorContextService.ensureActorContext(input);
    await this.ensureProfessionalMembership(input);

    await this.prisma.org.upsert({
      where: { id: input.proOrgId },
      update: { tenantId: input.tenantId, type: "pro", name: input.proOrgId },
      create: {
        id: input.proOrgId,
        tenantId: input.tenantId,
        type: "pro",
        name: input.proOrgId
      }
    });

    const job = await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null
      }
    });

    if (!job) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }
    if (job.status !== "PUBLISHED" && job.status !== "POSTED") {
      throw new BadRequestException("bids can only be created for published jobs");
    }

    const blockingReservation = await this.prisma.jobReservation.findFirst({
      where: {
        jobId: input.jobId,
        status: {
          in: ["ACTIVE", "ACCEPTED"]
        }
      },
      select: { id: true }
    });
    if (blockingReservation) {
      throw new ConflictException("job is already in reservation flow");
    }

    const existingContract = await this.prisma.contract.findFirst({
      where: {
        jobId: input.jobId,
        job: {
          tenantId: input.tenantId,
          deletedAt: null
        },
        deletedAt: null
      },
      select: { id: true }
    });
    if (existingContract) {
      throw new ConflictException("job already has an active contract flow");
    }

    const duplicate = await this.prisma.bid.findFirst({
      where: {
        jobId: input.jobId,
        proOrgId: input.proOrgId,
        status: {
          in: ["SUBMITTED", "ACCEPTED"]
        }
      }
    });

    if (duplicate) {
      throw new ConflictException("pro already has an active bid for this job");
    }

    const bid = (await this.prisma.$transaction(async (tx) => {
      const created = await tx.bid.create({
        data: {
          jobId: input.jobId,
          proOrgId: input.proOrgId,
          professionalUserId: input.userId,
          amount: input.amount,
          etaDays: input.etaDays,
          note: input.note,
          status: "SUBMITTED"
        },
        include: {
          job: {
            select: {
              id: true,
              tenantId: true,
              status: true,
              clientOrgId: true
            }
          }
        }
      });

      const recordedAt = new Date();
      const event = bidCreatedV1EventSchema.parse({
        eventId: randomUUID(),
        eventType: "bid.created.v1",
        version: 1,
        envelopeVersion: 2,
        occurredAt: recordedAt.toISOString(),
        recordedAt: recordedAt.toISOString(),
        tenantId: input.tenantId,
        orgId: input.orgId,
        module: "bids",
        entityType: "Bid",
        entityId: created.id,
        actor: { type: "user", id: input.userId },
        correlationId: created.id,
        idempotencyKey: bidsEventIdempotencyKey("bid.created.v1", created.id),
        schemaRef: BID_CREATED_V1_SCHEMA_REF,
        payload: {
          bidId: created.id,
          jobId: created.jobId,
          proOrgId: created.proOrgId,
          professionalUserId: input.userId,
          amount: created.amount.toNumber(),
          etaDays: created.etaDays,
        },
        metadata: { source: "bids.create" },
      });
      await this.outboxRepository.create(tx, event);

      return created;
    })) as StoredBid;

    return this.toRecord(bid);
  }

  async accept(input: {
    tenantId: string;
    bidId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<BidRecord> {
    await this.actorContextService.ensureActorContext(input);

    const bid = (await this.prisma.bid.findFirst({
      where: {
        id: input.bidId,
        job: {
          tenantId: input.tenantId
        }
      },
      include: {
        job: {
          select: {
            id: true,
            tenantId: true,
            status: true,
            clientOrgId: true
          }
        }
      }
    })) as StoredBid | null;

    if (!bid) {
      throw new NotFoundException(`Bid '${input.bidId}' not found`);
    }
    if (bid.job.clientOrgId !== input.orgId && !input.roles.includes("OPS_ADMIN")) {
      throw new ForbiddenException("actor cannot accept this bid");
    }
    if (bid.status === "ACCEPTED") {
      return this.toRecord(bid);
    }
    if (bid.status !== "SUBMITTED") {
      throw new ConflictException("only submitted bids can be accepted");
    }

    const existingContract = await this.prisma.contract.findFirst({
      where: {
        jobId: bid.jobId,
        job: {
          tenantId: input.tenantId,
          deletedAt: null
        },
        deletedAt: null
      },
      select: { id: true }
    });
    if (existingContract) {
      throw new ConflictException("job already has an active contract flow");
    }

    const accepted = (await this.prisma.$transaction(async (tx) => {
      const db = tx as BidTx;
      const conflictingReservation = await db.jobReservation.findFirst({
        where: {
          jobId: bid.jobId,
          status: { in: ["ACTIVE", "ACCEPTED"] }
        },
        select: {
          id: true,
          status: true,
          professionalId: true,
          professionalOrgId: true
        }
      });

      if (conflictingReservation?.status === "ACTIVE") {
        throw new ConflictException("job already has an active reservation flow");
      }

      if (
        conflictingReservation &&
        (
          conflictingReservation.professionalId !== bid.professionalUserId ||
          conflictingReservation.professionalOrgId !== bid.proOrgId
        )
      ) {
        throw new ConflictException("job already has an accepted reservation");
      }

      const updated = await db.bid.update({
        where: { id: bid.id },
        data: {
          status: "ACCEPTED"
        },
        include: {
          job: {
            select: {
              id: true,
              tenantId: true,
              status: true,
              clientOrgId: true
            }
          }
        }
      });

      const acceptedEventTime = new Date();
      const acceptedEvent = bidAcceptedV1EventSchema.parse({
        eventId: randomUUID(),
        eventType: "bid.accepted.v1",
        version: 1,
        envelopeVersion: 2,
        occurredAt: acceptedEventTime.toISOString(),
        recordedAt: acceptedEventTime.toISOString(),
        tenantId: input.tenantId,
        orgId: input.orgId,
        module: "bids",
        entityType: "Bid",
        entityId: updated.id,
        actor: { type: "user", id: input.userId },
        correlationId: updated.id,
        idempotencyKey: bidsEventIdempotencyKey("bid.accepted.v1", updated.id),
        schemaRef: BID_ACCEPTED_V1_SCHEMA_REF,
        payload: {
          bidId: updated.id,
          jobId: updated.jobId,
          proOrgId: updated.proOrgId,
        },
        metadata: { source: "bids.accept" },
      });
      await this.outboxRepository.create(db, acceptedEvent);

      // Bulk-reject: every other SUBMITTED bid on this job loses out once one
      // is accepted. Selected before the updateMany (which doesn't return
      // rows) so each loses bid still gets its own bid.rejected.v1 — see
      // jobs-bids-event-projection.tasks.md T-023 (decision: per-bid, not
      // aggregated).
      const outbid = await db.bid.findMany({
        where: {
          jobId: bid.jobId,
          id: { not: bid.id },
          status: "SUBMITTED"
        },
        select: { id: true, jobId: true, proOrgId: true }
      });

      await db.bid.updateMany({
        where: {
          jobId: bid.jobId,
          id: {
            not: bid.id
          },
          status: "SUBMITTED"
        },
        data: {
          status: "REJECTED"
        }
      });

      for (const rejected of outbid) {
        const rejectedEventTime = new Date();
        const rejectedEvent = bidRejectedV1EventSchema.parse({
          eventId: randomUUID(),
          eventType: "bid.rejected.v1",
          version: 1,
          envelopeVersion: 2,
          occurredAt: rejectedEventTime.toISOString(),
          recordedAt: rejectedEventTime.toISOString(),
          tenantId: input.tenantId,
          orgId: input.orgId,
          module: "bids",
          entityType: "Bid",
          entityId: rejected.id,
          actor: { type: "user", id: input.userId },
          correlationId: `${rejected.id}:${updated.id}`,
          idempotencyKey: bidsEventIdempotencyKey("bid.rejected.v1", rejected.id),
          schemaRef: BID_REJECTED_V1_SCHEMA_REF,
          payload: {
            bidId: rejected.id,
            jobId: rejected.jobId,
            proOrgId: rejected.proOrgId,
            reason: "competing_bid_accepted",
          },
          metadata: { source: "bids.accept", acceptedBidId: updated.id },
        });
        await this.outboxRepository.create(db, rejectedEvent);
      }

      if (!conflictingReservation) {
        const now = new Date();
        await db.jobReservation.create({
          data: {
            jobId: bid.jobId,
            professionalOrgId: bid.proOrgId,
            professionalId: bid.professionalUserId,
            status: "ACCEPTED",
            reservedAt: now,
            expiresAt: now,
            acceptedAt: now
          }
        });
      }

      await db.job.update({
        where: { id: bid.jobId },
        data: {
          status: "ACCEPTED"
        }
      });

      await db.project.upsert({
        where: {
          jobId: bid.jobId
        },
        update: {
          assignedProOrgId: bid.proOrgId
        },
        create: {
          tenantId: input.tenantId,
          jobId: bid.jobId,
          assignedProOrgId: bid.proOrgId,
          status: "OPEN"
        }
      });

      return updated;
    })) as StoredBid;

    return this.toRecord(accepted);
  }

  private toRecord(bid: StoredBid): BidRecord {
    const ratings = bid.professional?.ratingsReceived ?? [];
    const ratingCount = ratings.length;
    const avgRating = ratingCount > 0
      ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / ratingCount) * 10) / 10
      : undefined;

    return {
      id: bid.id,
      tenantId: bid.job.tenantId,
      jobId: bid.jobId,
      proOrgId: bid.proOrgId,
      professionalUserId: bid.professionalUserId,
      amount: bid.amount.toNumber(),
      etaDays: bid.etaDays,
      note: bid.note ?? undefined,
      proEmail: bid.professional?.email ?? undefined,
      status: bid.status.toLowerCase() as BidRecord["status"],
      avgRating,
      ratingCount: ratingCount > 0 ? ratingCount : undefined,
    };
  }

  private async ensureProfessionalMembership(input: {
    proOrgId: string;
    orgId: string;
    userId: string;
    roles?: string[];
  }): Promise<void> {
    if (input.proOrgId !== input.orgId && !input.roles?.includes("OPS_ADMIN")) {
      throw new ForbiddenException("actor cannot create bids for a different professional org");
    }

    const role =
      (await this.prisma.role.findUnique({
        where: { key: "PRO" },
        select: { id: true }
      })) ??
      (await this.prisma.role.create({
        data: {
          key: "PRO",
          name: "Professional"
        },
        select: { id: true }
      }));

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: input.userId,
        orgId: input.proOrgId,
        roleId: role.id
      },
      select: { userId: true }
    });

    if (membership) {
      return;
    }

    await this.prisma.membership.create({
      data: {
        userId: input.userId,
        orgId: input.proOrgId,
        roleId: role.id
      }
    });
  }
}

/** Anchored to the bid's own (DB-generated) id — see the matching comment
 * in jobs.repository.ts for why this doesn't key off requestId. */
function bidsEventIdempotencyKey(eventType: string, bidId: string): string {
  return `${eventType}:${bidId}`;
}

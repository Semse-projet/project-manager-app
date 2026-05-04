import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { type BidRecord } from "../../common/domain-store.js";

type StoredBid = {
  id: string;
  jobId: string;
  proOrgId: string;
  professionalUserId: string;
  amount: { toNumber(): number };
  etaDays: number;
  status: string;
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
    private readonly actorContextService: ActorContextService
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
        }
      },
      orderBy: { createdAt: "desc" }
    })) as StoredBid[];

    return bids.map((bid) => this.toRecord(bid));
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

    const bid = (await this.prisma.bid.create({
      data: {
        jobId: input.jobId,
        proOrgId: input.proOrgId,
        professionalUserId: input.userId,
        amount: input.amount,
        etaDays: input.etaDays,
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
      const existingAcceptedReservation = await db.jobReservation.findFirst({
        where: {
          jobId: bid.jobId,
          status: "ACCEPTED"
        },
        select: {
          id: true,
          professionalId: true,
          professionalOrgId: true
        }
      });

      if (
        existingAcceptedReservation &&
        (
          existingAcceptedReservation.professionalId !== bid.professionalUserId ||
          existingAcceptedReservation.professionalOrgId !== bid.proOrgId
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

      if (!existingAcceptedReservation) {
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
    return {
      id: bid.id,
      tenantId: bid.job.tenantId,
      jobId: bid.jobId,
      proOrgId: bid.proOrgId,
      professionalUserId: bid.professionalUserId,
      amount: bid.amount.toNumber(),
      etaDays: bid.etaDays,
      status: bid.status.toLowerCase() as BidRecord["status"]
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

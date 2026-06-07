import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type StoredRating = {
  id: string;
  jobId: string;
  fromUserId: string;
  toUserId: string;
  score: number;
  comment: string | null;
  createdAt: Date;
  job: {
    id: string;
    title: string;
  };
  fromUser: {
    id: string;
    email: string;
  };
  toUser: {
    id: string;
    email: string;
  };
};

type StoredJobParticipant = {
  id: string;
  tenantId: string;
  clientOrgId: string;
  status: string;
  title: string;
  contract: {
    clientUserId: string;
    professionalUserId: string;
    clientOrgId: string | null;
    professionalOrgId: string | null;
  } | null;
  reservations: Array<{
    professionalId: string;
    professionalOrgId: string | null;
  }>;
};

export type RatingRecord = {
  id: string;
  jobId: string;
  score: number;
  comment?: string;
  createdAt: Date;
  job: {
    id: string;
    title: string;
  };
  fromUser: {
    id: string;
    email: string;
  };
  toUser: {
    id: string;
    email: string;
  };
};

export type RatingSummaryRecord = {
  userId: string;
  averageScore: number;
  totalRatings: number;
  recentRatings: RatingRecord[];
};

@Injectable()
export class RatingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async findRatingsByTenant(input: {
    tenantId: string;
    orgId: string;
    userId: string;
  }): Promise<RatingRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const ratings = (await this.prisma.rating.findMany({
      where: {
        job: {
          tenantId: input.tenantId
        }
      },
      include: {
        job: { select: { id: true, title: true } },
        fromUser: { select: { id: true, email: true } },
        toUser: { select: { id: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    })) as StoredRating[];

    return ratings.map((rating) => this.toRatingRecord(rating));
  }

  async findRatingsForUser(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetUserId: string;
  }): Promise<RatingRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const ratings = (await this.prisma.rating.findMany({
      where: {
        job: {
          tenantId: input.tenantId
        },
        OR: [{ fromUserId: input.targetUserId }, { toUserId: input.targetUserId }]
      },
      include: {
        job: { select: { id: true, title: true } },
        fromUser: { select: { id: true, email: true } },
        toUser: { select: { id: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    })) as StoredRating[];

    return ratings.map((rating) => this.toRatingRecord(rating));
  }

  async findRatingById(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    ratingId: string;
  }): Promise<RatingRecord> {
    await this.actorContextService.ensureActorContext(input);
    const rating = (await this.prisma.rating.findFirst({
      where: {
        id: input.ratingId,
        job: {
          tenantId: input.tenantId
        }
      },
      include: {
        job: { select: { id: true, title: true } },
        fromUser: { select: { id: true, email: true } },
        toUser: { select: { id: true, email: true } }
      }
    })) as StoredRating | null;

    if (!rating) {
      throw new NotFoundException(`Rating '${input.ratingId}' not found`);
    }

    return this.toRatingRecord(rating);
  }

  async summarizeRatingsForUser(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetUserId: string;
  }): Promise<RatingSummaryRecord> {
    await this.actorContextService.ensureActorContext(input);

    const aggregate = await this.prisma.rating.aggregate({
      where: {
        toUserId: input.targetUserId,
        job: {
          tenantId: input.tenantId,
          deletedAt: null
        }
      },
      _avg: { score: true },
      _count: { id: true }
    });

    const recentRatings = (await this.prisma.rating.findMany({
      where: {
        toUserId: input.targetUserId,
        job: {
          tenantId: input.tenantId
        }
      },
      include: {
        job: { select: { id: true, title: true } },
        fromUser: { select: { id: true, email: true } },
        toUser: { select: { id: true, email: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 5
    })) as StoredRating[];

    return {
      userId: input.targetUserId,
      averageScore: aggregate._avg.score ?? 0,
      totalRatings: aggregate._count.id,
      recentRatings: recentRatings.map((rating) => this.toRatingRecord(rating))
    };
  }

  async createRating(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    jobId: string;
    toUserId: string;
    score: number;
    comment?: string;
  }): Promise<RatingRecord> {
    await this.actorContextService.ensureActorContext({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId
    });
    await this.actorContextService.ensureActorContext({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.toUserId
    });

    const job = (await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      include: {
        contract: {
          select: {
            clientUserId: true,
            professionalUserId: true,
            clientOrgId: true,
            professionalOrgId: true
          }
        },
        reservations: {
          select: {
            professionalId: true,
            professionalOrgId: true
          },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    })) as StoredJobParticipant | null;

    if (!job) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    if (job.status !== "COMPLETED") {
      throw new BadRequestException("Ratings can only be submitted for completed jobs");
    }

    const duplicate = await this.prisma.rating.findFirst({
      where: {
        jobId: input.jobId,
        fromUserId: input.userId
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new ConflictException("This user already submitted a rating for the job");
    }

    const clientUserId = job.contract?.clientUserId ?? null;
    const professionalUserId = job.contract?.professionalUserId ?? job.reservations[0]?.professionalId ?? null;
    const professionalOrgId = job.contract?.professionalOrgId ?? job.reservations[0]?.professionalOrgId ?? null;

    const actorIsClient =
      input.orgId === job.clientOrgId || (clientUserId !== null && input.userId === clientUserId);
    const actorIsProfessional =
      input.userId === professionalUserId || (professionalOrgId !== null && input.orgId === professionalOrgId);

    if (!actorIsClient && !actorIsProfessional) {
      throw new ForbiddenException("Only job participants can submit ratings");
    }

    const expectedTargetUserId = actorIsClient ? professionalUserId : clientUserId;

    if (!expectedTargetUserId) {
      throw new BadRequestException("The job does not yet resolve a rateable counterpart user");
    }

    if (input.toUserId !== expectedTargetUserId) {
      throw new BadRequestException("Rating target does not match the counterparty for this job");
    }

    const rating = (await this.prisma.rating.create({
      data: {
        jobId: input.jobId,
        fromUserId: input.userId,
        toUserId: input.toUserId,
        score: input.score,
        comment: input.comment
      },
      include: {
        job: { select: { id: true, title: true } },
        fromUser: { select: { id: true, email: true } },
        toUser: { select: { id: true, email: true } }
      }
    })) as StoredRating;

    return this.toRatingRecord(rating);
  }

  private toRatingRecord(rating: StoredRating): RatingRecord {
    return {
      id: rating.id,
      jobId: rating.jobId,
      score: rating.score,
      comment: rating.comment ?? undefined,
      createdAt: rating.createdAt,
      job: rating.job,
      fromUser: rating.fromUser,
      toUser: rating.toUser
    };
  }
}

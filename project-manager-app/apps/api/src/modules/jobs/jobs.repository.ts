import { Injectable, NotFoundException } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { type JobRecord } from "../../common/domain-store.js";

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
  title: string;
  category: string | null;
  scope: string;
  status: string;
  budgetType: string | null;
  budgetMin: { toNumber(): number } | null;
  budgetMax: { toNumber(): number } | null;
  location: string | null;
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
    private readonly actorContextService: ActorContextService
  ) {}

  async listByTenant(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    status?: JobRecord["status"];
  }): Promise<JobRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const jobs = (await this.prisma.job.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        ...(input.status ? { status: jobStatusMap[input.status] } : {})
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
    urgency?: string;
    deadline?: Date;
  }): Promise<JobRecord> {
    await this.actorContextService.ensureActorContext(input);
    const job = (await this.prisma.job.create({
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
        urgency: input.urgency,
        deadline: input.deadline,
      }
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
  }): Promise<JobRecord> {
    const dbStatus = jobStatusMap[input.status];
    if (!dbStatus) {
      throw new Error(`Unknown job status: ${input.status}`);
    }

    const existing = await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!existing) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    const job = (await this.prisma.job.update({
      where: { id: existing.id },
      data: { status: dbStatus }
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

  private toRecord(job: StoredJob): JobRecord {
    return {
      id: job.id,
      tenantId: job.tenantId,
      title: job.title,
      category: job.category ?? undefined,
      scope: job.scope,
      status: job.status.toLowerCase() as JobRecord["status"],
      budgetType: job.budgetType ?? undefined,
      budgetMin: job.budgetMin?.toNumber(),
      budgetMax: job.budgetMax?.toNumber(),
      location: job.location ?? undefined,
      urgency: job.urgency ?? undefined,
      deadline: job.deadline?.toISOString(),
    };
  }
}

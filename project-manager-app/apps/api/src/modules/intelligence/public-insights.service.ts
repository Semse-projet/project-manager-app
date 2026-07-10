import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  ProfessionalCredentialService,
  type ProfessionalCredentialRecord,
} from "./professional-credential.service.js";

export type PublicLandingOverview = {
  tenantId: string;
  stats: {
    activeJobs: number;
    verifiedProfessionals: number;
    completedProjects: number;
    averageRating: number;
  };
  topProfessionals: ProfessionalCredentialRecord[];
  testimonials: Array<{
    id: string;
    score: number;
    comment: string;
    jobTitle: string;
    authorName: string;
    targetName: string;
    createdAt: string;
  }>;
  featuredJobs: Array<{
    id: string;
    title: string;
    category: string | null;
    scope: string;
    status: string;
    budgetMin: number | null;
    budgetMax: number | null;
    location: string | null;
    urgency: string | null;
  }>;
  generatedAt: string;
};

function toNum(value: unknown): number {
  return parseFloat(String(value ?? 0)) || 0;
}

type PublicTestimonialRow = {
  id: string;
  score: number;
  comment: string | null;
  createdAt: Date;
  job: { title: string };
  fromUser: { email: string; profile: { displayName: string | null } | null };
  toUser: { email: string; profile: { displayName: string | null } | null };
};

type PublicFeaturedJobRow = {
  id: string;
  title: string;
  category: string | null;
  scope: string;
  status: string;
  budgetMin: unknown;
  budgetMax: unknown;
  location: string | null;
  urgency: string | null;
};

@Injectable()
export class PublicInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: ProfessionalCredentialService,
  ) {}

  async getLandingOverview(tenantId: string, limit = 3): Promise<PublicLandingOverview> {
    const [activeJobs, verifiedProfessionals, completedProjects, ratingAgg, topProfessionals, testimonials, featuredJobs] = await Promise.all([
      this.prisma.job.count({
        where: {
          tenantId,
          deletedAt: null,
          status: {
            in: ["POSTED", "PUBLISHED", "RESERVED", "ACCEPTED", "IN_PROGRESS", "REVIEW", "AWARDED"],
          },
        },
      }),
      this.prisma.professionalCredential.count({
        where: {
          tenantId,
          verifiedAt: { not: null },
        },
      }),
      this.prisma.projectArchive.count({
        where: { tenantId },
      }),
      this.prisma.rating.aggregate({
        where: {
          job: {
            tenantId,
            deletedAt: null,
          },
        },
        _avg: { score: true },
      }),
      this.credentials.listTopProfessionals(tenantId, Math.max(1, limit)),
      this.prisma.rating.findMany({
        where: {
          job: {
            tenantId,
            deletedAt: null,
          },
          comment: {
            not: null,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          score: true,
          comment: true,
          createdAt: true,
          job: {
            select: {
              title: true,
            },
          },
          fromUser: {
            select: {
              email: true,
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
          toUser: {
            select: {
              email: true,
              profile: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.job.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: {
            in: ["POSTED", "PUBLISHED", "IN_PROGRESS", "REVIEW", "COMPLETED", "AWARDED"],
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          category: true,
          scope: true,
          status: true,
          budgetMin: true,
          budgetMax: true,
          location: true,
          urgency: true,
        },
      }),
    ]);

    return {
      tenantId,
      stats: {
        activeJobs,
        verifiedProfessionals,
        completedProjects,
        averageRating: parseFloat(toNum(ratingAgg._avg.score).toFixed(1)),
      },
      topProfessionals: topProfessionals
        .filter((pro: ProfessionalCredentialRecord) => Boolean(pro.publicSlug))
        .slice(0, limit),
      testimonials: (testimonials as PublicTestimonialRow[])
        .filter((row: PublicTestimonialRow) => typeof row.comment === "string" && row.comment.trim().length > 0)
        .map((row: PublicTestimonialRow) => ({
          id: row.id,
          score: row.score,
          comment: String(row.comment).trim(),
          jobTitle: row.job.title,
          authorName: row.fromUser.profile?.displayName?.trim() || row.fromUser.email,
          targetName: row.toUser.profile?.displayName?.trim() || row.toUser.email,
          createdAt: row.createdAt.toISOString(),
        })),
      featuredJobs: (featuredJobs as PublicFeaturedJobRow[]).map((job: PublicFeaturedJobRow) => ({
        id: job.id,
        title: job.title,
        category: job.category,
        scope: job.scope,
        status: job.status,
        budgetMin: job.budgetMin ? toNum(job.budgetMin) : null,
        budgetMax: job.budgetMax ? toNum(job.budgetMax) : null,
        location: job.location,
        urgency: job.urgency,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  /** Vacantes abiertas para el onboarding público de workers (/worker/apply). */
  async getPublicOpenings(tenantId: string, limit = 12): Promise<PublicJobOpening[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: OPEN_JOB_STATUSES },
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
      select: PUBLIC_OPENING_SELECT,
    });
    return (jobs as PublicFeaturedJobRow[]).map(toPublicOpening);
  }

  async getPublicOpening(tenantId: string, jobId: string): Promise<PublicJobOpening | null> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        tenantId,
        deletedAt: null,
        status: { in: OPEN_JOB_STATUSES },
      },
      select: PUBLIC_OPENING_SELECT,
    });
    return job ? toPublicOpening(job as PublicFeaturedJobRow) : null;
  }
}

export type PublicJobOpening = {
  id: string;
  title: string;
  category: string | null;
  scope: string;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  location: string | null;
  urgency: string | null;
};

const OPEN_JOB_STATUSES = ["POSTED", "PUBLISHED"];

const PUBLIC_OPENING_SELECT = {
  id: true,
  title: true,
  category: true,
  scope: true,
  status: true,
  budgetMin: true,
  budgetMax: true,
  location: true,
  urgency: true,
} as const;

function toPublicOpening(job: PublicFeaturedJobRow): PublicJobOpening {
  return {
    id: job.id,
    title: job.title,
    category: job.category,
    scope: job.scope,
    status: job.status,
    budgetMin: job.budgetMin ? toNum(job.budgetMin) : null,
    budgetMax: job.budgetMax ? toNum(job.budgetMax) : null,
    location: job.location,
    urgency: job.urgency,
  };
}

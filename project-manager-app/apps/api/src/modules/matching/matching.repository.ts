import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { CandidateInput } from "./matching.algorithm.js";

type JobRow = {
  id: string;
  title: string;
  category: string | null;
  scope: string;
  tenantId: string;
};

type UserRow = {
  id: string;
  email: string;
  trustScore: { toNumber(): number } | number;
  verificationStatus: string;
};

type RatingAggRow = {
  toUserId: string;
  _avg: { score: number | null };
  _count: { id: number };
};

type JobHistoryRow = {
  professionalId: string;
  job: { title: string; scope: string; category: string | null };
};

type JobCountRow = {
  professionalId: string;
  _count: { id: number };
};

type CandidateProfileUserRow = {
  id: string;
  email: string;
  profile: {
    displayName: string | null;
  } | null;
};

type CandidateProfileCredentialRow = {
  userId: string;
  displayName: string;
  publicSlug: string | null;
  specialties: unknown;
  badgesJson: unknown;
  verifiedAt: Date | null;
  avgClientRating: unknown;
  completedProjects: number;
  trustScore: number;
};

export type CandidatePublicProfile = {
  userId: string;
  email: string;
  displayName: string;
  publicSlug: string | null;
  specialties: string[];
  badges: string[];
  verifiedAt: string | null;
  avgClientRating: number;
  completedProjects: number;
  trustScore: number;
};

export type PreferredMatchTarget = {
  userId: string;
  displayName: string;
  publicSlug: string | null;
  source: "job_memory";
};

function toNum(value: unknown): number {
  return parseFloat(String(value ?? 0)) || 0;
}

/**
 * Cold-start neutral prior for trustScore (0-1 scale).
 *
 * `User.trustScore` defaults to 0 in the schema and nothing in the codebase
 * ever writes a different value for a brand-new professional — 0 means "no
 * signal yet", not "actively distrusted". Feeding that raw 0 into the matching
 * composite (see matching.algorithm.ts) buries every new professional under
 * anyone with any positive score at all, no matter how strong their other
 * signals (verification, rating) are. Applying a neutral midpoint prior only
 * for professionals with zero completed jobs in this tenant (the actual
 * cold-start population) avoids that, without touching the stored value or
 * its meaning anywhere else trustScore is read (risk scoring, admin views).
 */
const COLD_START_TRUST_PRIOR = 0.5;

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

@Injectable()
export class MatchingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findJobOrThrow(tenantId: string, jobId: string): Promise<JobRow> {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId, deletedAt: null },
      select: { id: true, title: true, category: true, scope: true, tenantId: true }
    }) as JobRow | null;

    if (!job) throw new NotFoundException(`Job '${jobId}' not found`);
    return job;
  }

  /**
   * Load all active workers for a tenant with their aggregate rating signals.
   * A "worker" is any verified or pending user who has at least one active
   * reservation or completed contract in the tenant.
   */
  async loadCandidates(tenantId: string): Promise<CandidateInput[]> {
    // All users who have ever been reserved for a job in this tenant
    const reservedUsers = await this.prisma.jobReservation.findMany({
      where: { job: { tenantId } },
      select: { professionalId: true },
      distinct: ["professionalId"]
    }) as Array<{ professionalId: string }>;

    if (reservedUsers.length === 0) return [];

    const userIds = reservedUsers.map((r) => r.professionalId);

    // User base data
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, status: "active" },
      select: {
        id: true,
        email: true,
        trustScore: true,
        verificationStatus: true
      }
    }) as UserRow[];

    if (users.length === 0) return [];

    const activeUserIds = users.map((u) => u.id);

    // Rating aggregates per user
    const ratingAggs = await this.prisma.rating.groupBy({
      by: ["toUserId"],
      where: { toUserId: { in: activeUserIds }, job: { tenantId } },
      _avg: { score: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }) as unknown as RatingAggRow[];

    const ratingByUser = new Map(
      ratingAggs.map((r) => [r.toUserId, { avg: r._avg.score ?? 0, total: r._count.id }])
    );

    // Historical job text per user (completed jobs they were professional on)
    const completedHistory = await this.prisma.jobReservation.findMany({
      where: {
        professionalId: { in: activeUserIds },
        job: { tenantId, status: "COMPLETED", deletedAt: null }
      },
      select: {
        professionalId: true,
        job: { select: { title: true, scope: true, category: true } }
      }
    }) as JobHistoryRow[];

    const historyByUser = new Map<string, string[]>();
    for (const row of completedHistory) {
      const existing = historyByUser.get(row.professionalId) ?? [];
      existing.push([row.job.title, row.job.category ?? "", row.job.scope].join(" "));
      historyByUser.set(row.professionalId, existing);
    }

    // Completed job count per user
    const completedCounts = await this.prisma.jobReservation.groupBy({
      by: ["professionalId"],
      where: {
        professionalId: { in: activeUserIds },
        job: { tenantId, status: "COMPLETED", deletedAt: null }
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }) as unknown as JobCountRow[];

    const completedByUser = new Map(completedCounts.map((r) => [r.professionalId, r._count.id]));

    return users.map((u) => {
      const rating = ratingByUser.get(u.id) ?? { avg: 0, total: 0 };
      const rawTrustScore = typeof u.trustScore === "object"
        ? u.trustScore.toNumber()
        : (u.trustScore as number);
      const completedJobs = completedByUser.get(u.id) ?? 0;
      // Cold-start ramp: a professional with no completed jobs in this tenant
      // has never had a chance to earn a real trustScore. Treat their untouched
      // 0 default as "no data" (neutral prior) instead of "distrusted". Once
      // they've completed at least one job, any trustScore on record — including
      // a genuine 0 — reflects real signal and is passed through unmodified.
      const trustScore = completedJobs === 0 && rawTrustScore === 0
        ? COLD_START_TRUST_PRIOR
        : rawTrustScore;
      return {
        userId: u.id,
        email: u.email,
        trustScore,
        verificationStatus: u.verificationStatus,
        avgRating: rating.avg,
        totalRatings: rating.total,
        completedJobs,
        historicalJobText: (historyByUser.get(u.id) ?? []).join(" ")
      };
    });
  }

  async loadPublicCandidateProfiles(userIds: string[]): Promise<Map<string, CandidatePublicProfile>> {
    if (userIds.length === 0) return new Map();

    const [users, credentials] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              displayName: true,
            },
          },
        },
      }) as Promise<CandidateProfileUserRow[]>,
      this.prisma.professionalCredential.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          displayName: true,
          publicSlug: true,
          specialties: true,
          badgesJson: true,
          verifiedAt: true,
          avgClientRating: true,
          completedProjects: true,
          trustScore: true,
        },
      }) as Promise<CandidateProfileCredentialRow[]>,
    ]);

    const userById = new Map(users.map((user) => [user.id, user]));
    const credentialByUserId = new Map(credentials.map((credential) => [credential.userId, credential]));

    return new Map(userIds.map((userId) => {
      const user = userById.get(userId);
      const credential = credentialByUserId.get(userId);
      const displayName = credential?.displayName?.trim()
        || user?.profile?.displayName?.trim()
        || user?.email
        || userId;

      return [userId, {
        userId,
        email: user?.email ?? "",
        displayName,
        publicSlug: credential?.publicSlug ?? null,
        specialties: readStringArray(credential?.specialties),
        badges: readStringArray(credential?.badgesJson),
        verifiedAt: credential?.verifiedAt?.toISOString() ?? null,
        avgClientRating: toNum(credential?.avgClientRating),
        completedProjects: credential?.completedProjects ?? 0,
        trustScore: credential?.trustScore ?? 0,
      }];
    }));
  }

  async loadPreferredTargetForJob(tenantId: string, jobId: string): Promise<PreferredMatchTarget | null> {
    const entry = await this.prisma.workspaceMemoryEntry.findFirst({
      where: {
        tenantId,
        workspaceId: `job:${jobId}`,
        kind: "decision",
        tags: { has: "preferred-professional" },
      },
      orderBy: { updatedAt: "desc" },
      select: { body: true },
    });

    if (!entry?.body) return null;

    try {
      const parsed = JSON.parse(entry.body) as {
        userId?: unknown;
        displayName?: unknown;
        publicSlug?: unknown;
      };

      if (typeof parsed.userId !== "string" || typeof parsed.displayName !== "string") {
        return null;
      }

      return {
        userId: parsed.userId,
        displayName: parsed.displayName,
        publicSlug: typeof parsed.publicSlug === "string" ? parsed.publicSlug : null,
        source: "job_memory",
      };
    } catch {
      return null;
    }
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type MarketplaceListing = {
  id:          string;
  title:       string;
  category:    string | null;
  location:    string | null;
  budgetMin:   number | null;
  budgetMax:   number | null;
  budgetType:  string | null;
  status:      string;
  urgency:     string | null;
  scope:       string;
  postedAt:    string;
  clientOrg?:  string;
  bidsCount:   number;
};

export type MarketplaceStats = {
  totalListings: number;
  byCategory:    Record<string, number>;
  byUrgency:     Record<string, number>;
  avgBudgetMin:  number | null;
};

export type MarketplaceProfessional = {
  id:            string;
  name:          string;
  email:         string;
  completedJobs: number;
  avgRating:     number | null;
};

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Listings (published jobs) ─────────────────────────────────────────────

  async listOpenJobs(input: {
    tenantId:  string;
    category?: string;
    location?: string;
    urgency?:  string;
    limit?:    number;
    offset?:   number;
  }): Promise<{ listings: MarketplaceListing[]; total: number }> {
    const limit = input.limit ?? 20;
    const skip  = input.offset ?? 0;

    const where = {
      tenantId:  input.tenantId,
      status:    { in: ["POSTED", "PUBLISHED"] as never[] },
      deletedAt: null,
      ...(input.category ? { category: input.category }             : {}),
      ...(input.location ? { location: { contains: input.location, mode: "insensitive" as const } } : {}),
      ...(input.urgency  ? { urgency: input.urgency }               : {}),
    };

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take:    limit,
        skip,
        select: {
          id: true, title: true, category: true, location: true,
          budgetType: true, budgetMin: true, budgetMax: true,
          status: true, urgency: true, scope: true, createdAt: true,
          clientOrg: { select: { name: true } },
          bids:      { select: { id: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    const listings: MarketplaceListing[] = jobs.map((j) => ({
      id:         j.id,
      title:      j.title,
      category:   j.category,
      location:   j.location,
      budgetMin:  j.budgetMin ? Number(j.budgetMin) : null,
      budgetMax:  j.budgetMax ? Number(j.budgetMax) : null,
      budgetType: j.budgetType,
      status:     j.status,
      urgency:    j.urgency,
      scope:      j.scope.slice(0, 200),
      postedAt:   j.createdAt.toISOString(),
      clientOrg:  (j.clientOrg as { name?: string } | null)?.name,
      bidsCount:  j.bids.length,
    }));

    return { listings, total };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(tenantId: string): Promise<MarketplaceStats> {
    const jobs = await this.prisma.job.findMany({
      where: { tenantId, status: { in: ["POSTED", "PUBLISHED"] }, deletedAt: null },
      select: { category: true, urgency: true, budgetMin: true },
    });

    const byCategory: Record<string, number> = {};
    const byUrgency:  Record<string, number> = {};
    let totalBudget = 0; let budgetCount = 0;

    for (const j of jobs) {
      const cat = j.category ?? "general";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      const urg = j.urgency ?? "medium";
      byUrgency[urg] = (byUrgency[urg] ?? 0) + 1;
      if (j.budgetMin) { totalBudget += Number(j.budgetMin); budgetCount++; }
    }

    return {
      totalListings: jobs.length,
      byCategory,
      byUrgency,
      avgBudgetMin: budgetCount > 0 ? Math.round(totalBudget / budgetCount) : null,
    };
  }

  // ── Professionals (users with accepted bids) ─────────────────────────────

  async listProfessionals(input: {
    tenantId: string;
    limit?:   number;
  }): Promise<MarketplaceProfessional[]> {
    // Use bids as proxy for professional activity (accepted bids = proven contractors)
    const bids = await this.prisma.bid.findMany({
      where: {
        job: { tenantId: input.tenantId },
        status: "ACCEPTED" as const,
      },
      select: { professionalUserId: true },
      take: (input.limit ?? 20) * 5,
    });

    const profCounts = new Map<string, number>();
    for (const b of bids) {
      if (!b.professionalUserId) continue;
      profCounts.set(b.professionalUserId, (profCounts.get(b.professionalUserId) ?? 0) + 1);
    }

    if (profCounts.size === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...profCounts.keys()] } },
      select: { id: true, email: true },
      take: input.limit ?? 20,
    });

    // Get average ratings
    const ratings = await this.prisma.rating.findMany({
      where: { job: { tenantId: input.tenantId }, toUserId: { in: [...profCounts.keys()] } },
      select: { toUserId: true, score: true },
    });
    const ratingMap = new Map<string, { sum: number; count: number }>();
    for (const r of ratings) {
      const cur = ratingMap.get(r.toUserId) ?? { sum: 0, count: 0 };
      cur.sum += r.score; cur.count++;
      ratingMap.set(r.toUserId, cur);
    }

    return users
      .sort((a, b) => (profCounts.get(b.id) ?? 0) - (profCounts.get(a.id) ?? 0))
      .map((u) => {
        const rating = ratingMap.get(u.id);
        return {
          id:            u.id,
          name:          u.email.split("@")[0] ?? u.email,
          email:         u.email,
          completedJobs: profCounts.get(u.id) ?? 0,
          avgRating:     rating ? Math.round((rating.sum / rating.count) * 10) / 10 : null,
        };
      });
  }
}

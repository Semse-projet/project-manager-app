import { Injectable, NotFoundException } from "@nestjs/common";
import type { ReputationScoreView } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { computeReputation, type ReputationInput } from "./reputation.algorithm.js";

type UserRow = {
  id: string;
  verificationStatus: string;
  ratingsReceived: Array<{ score: number; createdAt: Date }>;
};

@Injectable()
export class ReputationService {
  constructor(private readonly prisma: PrismaService) {}

  async computeForUser(tenantId: string, targetUserId: string): Promise<ReputationScoreView> {
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, status: "active" },
      select: {
        id: true,
        verificationStatus: true,
        ratingsReceived: {
          where: { job: { tenantId } },
          select: { score: true, createdAt: true },
          orderBy: { createdAt: "desc" }
        }
      }
    }) as UserRow | null;

    if (!user) throw new NotFoundException(`User '${targetUserId}' not found`);

    // Total jobs as professional in this tenant
    const [totalJobsRow, completedJobsRow] = await Promise.all([
      this.prisma.jobReservation.aggregate({
        where: { professionalId: targetUserId, job: { tenantId } },
        _count: { id: true }
      }) as Promise<{ _count: { id: number } }>,

      this.prisma.jobReservation.aggregate({
        where: {
          professionalId: targetUserId,
          job: { tenantId, status: "COMPLETED", deletedAt: null }
        },
        _count: { id: true }
      }) as Promise<{ _count: { id: number } }>
    ]);

    // Disputes raised against the professional:
    // find contracts where user is professional → get their projectIds → count disputes
    const proContracts = await this.prisma.contract.findMany({
      where: { professionalUserId: targetUserId, job: { tenantId } },
      select: { job: { select: { project: { select: { id: true } } } } }
    }) as Array<{ job: { project: { id: string } | null } | null }>;

    const projectIds = proContracts.flatMap((c) =>
      c.job?.project?.id ? [c.job.project.id] : []
    );

    const disputesCount = projectIds.length > 0
      ? await this.prisma.dispute.count({
          where: { projectId: { in: projectIds }, raisedById: { not: targetUserId } }
        })
      : 0;

    const input: ReputationInput = {
      userId: targetUserId,
      verificationStatus: user.verificationStatus,
      ratings: user.ratingsReceived,
      totalJobsAsProfessional: totalJobsRow._count.id,
      completedJobs: completedJobsRow._count.id,
      disputesAgainst: disputesCount
    };

    return computeReputation(input);
  }

  async computeBatchForTenant(tenantId: string): Promise<ReputationScoreView[]> {
    // Find all professionals in the tenant
    const reservedUsers = await this.prisma.jobReservation.findMany({
      where: { job: { tenantId } },
      select: { professionalId: true },
      distinct: ["professionalId"]
    }) as Array<{ professionalId: string }>;

    const results = await Promise.all(
      reservedUsers.map((r: { professionalId: string }) =>
        this.computeForUser(tenantId, r.professionalId).catch(() => null)
      )
    );

    return results.filter((r): r is ReputationScoreView => r !== null);
  }

  /**
   * Compute for multiple users grouped as `JobCountRow[]` pattern.
   * Used by the matching engine to pre-compute reputation signals.
   */
  async computeForUsers(tenantId: string, userIds: string[]): Promise<Map<string, ReputationScoreView>> {
    const results = await Promise.all(
      userIds.map((id) =>
        this.computeForUser(tenantId, id).catch(() => null)
      )
    );
    const map = new Map<string, ReputationScoreView>();
    for (let i = 0; i < userIds.length; i++) {
      const r = results[i];
      if (r) map.set(userIds[i], r);
    }
    return map;
  }
}

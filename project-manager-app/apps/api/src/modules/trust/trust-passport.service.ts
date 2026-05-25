import crypto from "node:crypto";
import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ReputationService } from "../ratings/reputation.service.js";
import type {
  TrustPassportClaims,
  TrustPassportContributions,
  TrustPassportVerifyResult,
  TrustPassportView,
} from "./trust-passport.types.js";

const PASSPORT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function fromb64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getPassportSecret(): string {
  const secret = process.env.PASSPORT_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("PASSPORT_SECRET or AUTH_SECRET must be set");
  return secret;
}

function signPassport(claims: Omit<TrustPassportClaims, "jti" | "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const full: TrustPassportClaims = {
    ...claims,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + PASSPORT_TTL_SECONDS,
  };
  const encoded = b64url(JSON.stringify(full));
  const sig = crypto.createHmac("sha256", getPassportSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyPassport(token: string): TrustPassportClaims {
  const dot = token.lastIndexOf(".");
  if (dot === -1) throw new Error("malformed token");

  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", getPassportSecret()).update(encoded).digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("invalid signature");
  }

  const claims = JSON.parse(fromb64url(encoded)) as TrustPassportClaims;
  if (claims.typ !== "trust-passport") throw new Error("wrong token type");
  if (claims.exp < Math.floor(Date.now() / 1000)) throw new Error("passport expired");
  return claims;
}

@Injectable()
export class TrustPassportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reputationService: ReputationService,
  ) {}

  async issue(tenantId: string, targetUserId: string): Promise<TrustPassportView> {
    const user = await this.prisma.user.findFirst({
      where: { id: targetUserId, status: "active" },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User '${targetUserId}' not found`);

    const [reputation, contributions] = await Promise.all([
      this.reputationService.computeForUser(tenantId, targetUserId),
      this.buildContributions(tenantId, targetUserId),
    ]);

    const now = new Date().toISOString();
    const token = signPassport({
      sub: targetUserId,
      iss: "semse",
      typ: "trust-passport",
      cryptoProfile: "HMAC-SHA256",
      reputation: {
        score: reputation.score,
        tier: reputation.tier,
        algorithmVersion: reputation.algorithmVersion,
        signals: reputation.signals,
      },
      contributions,
      computedAt: now,
    });

    const claims = verifyPassport(token);
    return {
      token,
      claims,
      expiresAt: new Date(claims.exp * 1000).toISOString(),
    };
  }

  verify(token: string): TrustPassportVerifyResult {
    try {
      const claims = verifyPassport(token);
      return { valid: true, claims };
    } catch (err: unknown) {
      return { valid: false, reason: err instanceof Error ? err.message : "unknown error" };
    }
  }

  private async buildContributions(
    tenantId: string,
    userId: string,
  ): Promise<TrustPassportContributions> {
    const [
      jobsCompleted,
      totalJobsAsProf,
      milestonesDelivered,
      evidenceSubmitted,
      ratingSummary,
      disputesAgainst,
    ] = await Promise.all([
      this.prisma.jobReservation.count({
        where: { professionalId: userId, job: { tenantId, status: "COMPLETED", deletedAt: null } },
      }),
      this.prisma.jobReservation.count({
        where: { professionalId: userId, job: { tenantId } },
      }),
      // Milestones paid where the professional was assigned to the project
      this.prisma.milestone.count({
        where: {
          status: "PAID",
          project: { assignedProOrgId: { not: undefined }, job: { tenantId } },
          deletedAt: null,
        },
      }),
      this.prisma.evidence.count({
        where: { uploadedById: userId },
      }),
      this.prisma.rating.aggregate({
        where: { toUserId: userId, job: { tenantId } },
        _avg: { score: true },
        _count: { id: true },
      }),
      // Disputes raised against this professional (by others)
      (async () => {
        const contracts = await this.prisma.contract.findMany({
          where: { professionalUserId: userId, job: { tenantId } },
          select: { job: { select: { project: { select: { id: true } } } } },
        });
        const projectIds = contracts.flatMap((c) =>
          c.job?.project?.id ? [c.job.project.id] : [],
        );
        if (projectIds.length === 0) return 0;
        return this.prisma.dispute.count({
          where: { projectId: { in: projectIds }, raisedById: { not: userId } },
        });
      })(),
    ]);

    const disputeRate =
      totalJobsAsProf > 0 ? Math.round((disputesAgainst / totalJobsAsProf) * 1000) / 1000 : 0;

    return {
      jobsCompleted,
      milestonesDelivered,
      evidenceSubmitted,
      disputeRate,
      avgRating: Math.round((ratingSummary._avg.score ?? 0) * 100) / 100,
      totalRatings: ratingSummary._count.id,
    };
  }

  /** Confirm requester can issue a passport for targetUserId. */
  assertCanIssue(requesterId: string, requesterRoles: string[], targetUserId: string): void {
    const isSelf = requesterId === targetUserId;
    const isAdmin = requesterRoles.includes("OPS_ADMIN");
    if (!isSelf && !isAdmin) {
      throw new UnauthorizedException("Can only issue a trust passport for yourself");
    }
  }
}

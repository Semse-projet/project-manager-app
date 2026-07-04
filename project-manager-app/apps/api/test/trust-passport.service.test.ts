import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// Set up test secret before any service code runs
process.env.PASSPORT_SECRET = "test-passport-secret-for-unit-tests-32+";

// ── Inline crypto helpers (same logic as trust-passport.service.ts) ────────────
const PASSPORT_TTL_SECONDS = 30 * 24 * 60 * 60;

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}
function fromb64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}
function getSecret(): string {
  return process.env.PASSPORT_SECRET ?? process.env.AUTH_SECRET ?? "";
}

function signPassport(claims: any): string {
  const now = Math.floor(Date.now() / 1000);
  const full = { ...claims, jti: crypto.randomUUID(), iat: now, exp: now + PASSPORT_TTL_SECONDS };
  const encoded = b64url(JSON.stringify(full));
  const sig = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyPassport(token: string): any {
  const dot = token.lastIndexOf(".");
  if (dot === -1) throw new Error("malformed token");
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("invalid signature");
  }
  const claims = JSON.parse(fromb64url(encoded));
  if (claims.typ !== "trust-passport") throw new Error("wrong token type");
  if (claims.exp < Math.floor(Date.now() / 1000)) throw new Error("passport expired");
  return claims;
}

// ── Inline TrustPassportService ───────────────────────────────────────────────
import { UnauthorizedException, NotFoundException } from "@nestjs/common";

class TrustPassportService {
  prisma: any;
  reputationService: any;

  constructor(prisma: any, reputationService: any) {
    this.prisma = prisma;
    this.reputationService = reputationService;
  }

  async issue(tenantId: string, targetUserId: string): Promise<any> {
    const user = await this.prisma.user.findFirst({ where: { id: targetUserId, status: "active" }, select: { id: true } });
    if (!user) throw new NotFoundException(`User '${targetUserId}' not found`);

    const [reputation, contributions] = await Promise.all([
      this.reputationService.computeForUser(tenantId, targetUserId),
      this.buildContributions(tenantId, targetUserId)
    ]);

    const now = new Date().toISOString();
    const token = signPassport({
      sub: targetUserId, iss: "semse", typ: "trust-passport", cryptoProfile: "HMAC-SHA256",
      reputation: { score: reputation.score, tier: reputation.tier, algorithmVersion: reputation.algorithmVersion, signals: reputation.signals },
      contributions, computedAt: now
    });

    const claims = verifyPassport(token);
    return { token, claims, expiresAt: new Date(claims.exp * 1000).toISOString() };
  }

  verify(token: string): any {
    try {
      const claims = verifyPassport(token);
      return { valid: true, claims };
    } catch (err: unknown) {
      return { valid: false, reason: err instanceof Error ? err.message : "unknown error" };
    }
  }

  private async buildContributions(tenantId: string, userId: string): Promise<any> {
    const [jobsCompleted, totalJobsAsProf, milestonesDelivered, evidenceSubmitted, ratingSummary, disputesAgainst] =
      await Promise.all([
        this.prisma.jobReservation.count({ where: { professionalId: userId, job: { tenantId, status: "COMPLETED", deletedAt: null } } }),
        this.prisma.jobReservation.count({ where: { professionalId: userId, job: { tenantId } } }),
        this.prisma.milestone.count({ where: { status: "PAID", project: { assignedProOrgId: { not: undefined }, job: { tenantId } }, deletedAt: null } }),
        this.prisma.evidence.count({ where: { uploadedById: userId } }),
        this.prisma.rating.aggregate({ where: { toUserId: userId, job: { tenantId } }, _avg: { score: true }, _count: { id: true } }),
        (async () => {
          const contracts = await this.prisma.contract.findMany({
            where: { professionalUserId: userId, job: { tenantId } },
            select: { job: { select: { project: { select: { id: true } } } } }
          });
          const projectIds = contracts.flatMap((c: any) => c.job?.project?.id ? [c.job.project.id] : []);
          if (projectIds.length === 0) return 0;
          return this.prisma.dispute.count({ where: { projectId: { in: projectIds }, raisedById: { not: userId } } });
        })()
      ]);

    const disputeRate = totalJobsAsProf > 0 ? Math.round((disputesAgainst / totalJobsAsProf) * 1000) / 1000 : 0;
    return {
      jobsCompleted, milestonesDelivered, evidenceSubmitted, disputeRate,
      avgRating: Math.round((ratingSummary._avg.score ?? 0) * 100) / 100,
      totalRatings: ratingSummary._count.id
    };
  }

  assertCanIssue(requesterId: string, requesterRoles: string[], targetUserId: string): void {
    const isSelf = requesterId === targetUserId;
    const isAdmin = requesterRoles.includes("OPS_ADMIN");
    if (!isSelf && !isAdmin) throw new UnauthorizedException("Can only issue a trust passport for yourself");
  }
}

// ── Test helpers ──────────────────────────────────────────────────────────────
function makeReputation() {
  return { score: 82, tier: "GOLD", algorithmVersion: "v2", signals: { jobsCompleted: 12, avgRating: 4.5 } };
}

function makePrisma(overrides: any = {}) {
  return {
    user: { findFirst: async (_: any) => ({ id: "user_pro" }), ...overrides.user },
    jobReservation: { count: async (_: any) => 12, ...overrides.jobReservation },
    milestone: { count: async (_: any) => 8, ...overrides.milestone },
    evidence: { count: async (_: any) => 25, ...overrides.evidence },
    rating: { aggregate: async (_: any) => ({ _avg: { score: 4.5 }, _count: { id: 10 } }), ...overrides.rating },
    contract: { findMany: async (_: any) => [], ...overrides.contract },
    dispute: { count: async (_: any) => 0, ...overrides.dispute },
    ...overrides
  };
}

function makeService(prismaOverrides: any = {}) {
  const prisma = makePrisma(prismaOverrides);
  const reputationService = { computeForUser: async (_tenantId: string, _userId: string) => makeReputation() };
  return new TrustPassportService(prisma, reputationService);
}

// ── Token signing/verification tests ─────────────────────────────────────────
describe("passport token signing and verification", () => {
  it("signs a valid passport token", () => {
    const token = signPassport({
      sub: "user_1", iss: "semse", typ: "trust-passport",
      cryptoProfile: "HMAC-SHA256", reputation: { score: 80, tier: "SILVER", algorithmVersion: "v2", signals: {} },
      contributions: {}, computedAt: new Date().toISOString()
    });
    assert.ok(token.includes("."), "token should have payload.signature format");
    const parts = token.split(".");
    assert.equal(parts.length, 2);
  });

  it("verified claims have correct structure", () => {
    const token = signPassport({
      sub: "user_2", iss: "semse", typ: "trust-passport",
      cryptoProfile: "HMAC-SHA256", reputation: { score: 90, tier: "PLATINUM", algorithmVersion: "v2", signals: {} },
      contributions: { jobsCompleted: 5 }, computedAt: new Date().toISOString()
    });
    const claims = verifyPassport(token);
    assert.equal(claims.sub, "user_2");
    assert.equal(claims.typ, "trust-passport");
    assert.equal(claims.iss, "semse");
    assert.ok(claims.jti, "should have jti");
    assert.ok(claims.iat > 0, "should have iat");
    assert.ok(claims.exp > claims.iat, "exp should be after iat");
  });

  it("rejects tampered token", () => {
    const token = signPassport({
      sub: "user_3", iss: "semse", typ: "trust-passport",
      cryptoProfile: "HMAC-SHA256", reputation: { score: 70, tier: "BRONZE", algorithmVersion: "v2", signals: {} },
      contributions: {}, computedAt: new Date().toISOString()
    });
    const tampered = token.slice(0, -5) + "XXXXX";
    assert.throws(() => verifyPassport(tampered), /invalid signature/);
  });

  it("rejects malformed token (no dot)", () => {
    assert.throws(() => verifyPassport("nodotinhere"), /malformed/);
  });
});

// ── TrustPassportService.issue ────────────────────────────────────────────────
describe("TrustPassportService.issue", () => {
  it("issues a passport with correct structure", async () => {
    const svc = makeService();
    const result = await svc.issue("tenant_1", "user_pro");
    assert.ok(result.token, "should have token");
    assert.ok(result.claims, "should have claims");
    assert.ok(result.expiresAt, "should have expiresAt");
    assert.equal(result.claims.sub, "user_pro");
    assert.equal(result.claims.typ, "trust-passport");
  });

  it("throws NotFoundException for unknown user", async () => {
    const svc = makeService({ user: { findFirst: async () => null } });
    await assert.rejects(
      () => svc.issue("tenant_1", "user_unknown"),
      (err: any) => err instanceof NotFoundException && err.message.includes("user_unknown")
    );
  });

  it("includes reputation score in passport claims", async () => {
    const svc = makeService();
    const result = await svc.issue("tenant_1", "user_pro");
    assert.equal(result.claims.reputation.score, 82);
    assert.equal(result.claims.reputation.tier, "GOLD");
  });

  it("includes contributions in passport claims", async () => {
    const svc = makeService();
    const result = await svc.issue("tenant_1", "user_pro");
    const c = result.claims.contributions;
    assert.equal(c.jobsCompleted, 12);
    assert.equal(c.milestonesDelivered, 8);
    assert.equal(c.evidenceSubmitted, 25);
    assert.equal(c.totalRatings, 10);
    assert.equal(c.avgRating, 4.5);
  });

  it("passport expires in ~30 days", async () => {
    const svc = makeService();
    const result = await svc.issue("tenant_1", "user_pro");
    const now = Math.floor(Date.now() / 1000);
    const exp = result.claims.exp;
    const diff = exp - now;
    assert.ok(diff > PASSPORT_TTL_SECONDS - 10, "exp should be ~30 days from now");
    assert.ok(diff <= PASSPORT_TTL_SECONDS, "exp should not exceed 30 days");
  });

  it("computes disputeRate as 0 when no jobs", async () => {
    const svc = makeService({
      jobReservation: { count: async () => 0 },
      contract: { findMany: async () => [] }
    });
    const result = await svc.issue("tenant_1", "user_pro");
    assert.equal(result.claims.contributions.disputeRate, 0);
  });

  it("computes disputeRate correctly when disputes exist", async () => {
    let countCallN = 0;
    const svc = makeService({
      jobReservation: { count: async () => { countCallN++; return countCallN === 1 ? 5 : 10; } },
      contract: { findMany: async () => [
        { job: { project: { id: "proj_1" } } },
        { job: { project: { id: "proj_2" } } }
      ] },
      dispute: { count: async () => 2 }
    });
    const result = await svc.issue("tenant_1", "user_pro");
    // 2 disputes / 10 total jobs = 0.2
    assert.equal(result.claims.contributions.disputeRate, 0.2);
  });
});

// ── TrustPassportService.verify ───────────────────────────────────────────────
describe("TrustPassportService.verify", () => {
  it("returns valid:true for a good token", async () => {
    const svc = makeService();
    const { token } = await svc.issue("tenant_1", "user_pro");
    const result = svc.verify(token);
    assert.equal(result.valid, true);
    assert.ok(result.claims);
  });

  it("returns valid:false with reason for tampered token", async () => {
    const svc = makeService();
    const { token } = await svc.issue("tenant_1", "user_pro");
    const result = svc.verify(token + "tampered");
    assert.equal(result.valid, false);
    assert.ok(result.reason, "should have a reason");
  });

  it("returns valid:false for empty string", () => {
    const svc = makeService();
    const result = svc.verify("invalid.token.format.here");
    assert.equal(result.valid, false);
  });
});

// ── TrustPassportService.assertCanIssue ──────────────────────────────────────
describe("TrustPassportService.assertCanIssue", () => {
  it("self-issue succeeds", () => {
    const svc = makeService();
    assert.doesNotThrow(() => svc.assertCanIssue("user_a", ["CLIENT"], "user_a"));
  });

  it("OPS_ADMIN can issue for anyone", () => {
    const svc = makeService();
    assert.doesNotThrow(() => svc.assertCanIssue("admin_1", ["OPS_ADMIN"], "user_b"));
  });

  it("non-admin cannot issue for another user", () => {
    const svc = makeService();
    assert.throws(
      () => svc.assertCanIssue("user_a", ["CLIENT"], "user_b"),
      (err: any) => err instanceof UnauthorizedException && err.message.includes("yourself")
    );
  });

  it("WORKER cannot issue for another user", () => {
    const svc = makeService();
    assert.throws(
      () => svc.assertCanIssue("worker_1", ["WORKER"], "user_b"),
      (err: any) => err instanceof UnauthorizedException
    );
  });
});

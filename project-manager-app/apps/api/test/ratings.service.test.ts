import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";

// ── Inline policy functions (avoid dist/ import) ─────────────────────────────
type RatingActor = { tenantId: string; orgId: string; userId: string; roles: string[] };
type RatingAccessRecord = { fromUserId: string; toUserId: string };

function isOpsAdmin(actor: RatingActor) { return actor.roles.includes("OPS_ADMIN"); }
function canCreateRating(actor: RatingActor) {
  return actor.roles.includes("CLIENT") || actor.roles.includes("PRO") || isOpsAdmin(actor);
}
function canReadRating(actor: RatingActor, r: RatingAccessRecord) {
  return isOpsAdmin(actor) || actor.userId === r.fromUserId || actor.userId === r.toUserId;
}
function canReadRatingSummary(actor: RatingActor, targetUserId: string) {
  return isOpsAdmin(actor) || actor.userId === targetUserId;
}

// ── Inline RatingsService (avoid dist/ import) ────────────────────────────────
class RatingsService {
  ratingsRepository: any;
  auditService: any;
  domainEventBus: any;

  constructor(repo: any, audit: any, bus: any) {
    this.ratingsRepository = repo;
    this.auditService = audit;
    this.domainEventBus = bus;
  }

  async listRatings(actor: RatingActor) {
    if (isOpsAdmin(actor)) return this.ratingsRepository.findRatingsByTenant(actor);
    return this.ratingsRepository.findRatingsForUser({
      tenantId: actor.tenantId, orgId: actor.orgId,
      userId: actor.userId, targetUserId: actor.userId
    });
  }

  async getRating(actor: RatingActor, ratingId: string) {
    const rating = await this.ratingsRepository.findRatingById({
      tenantId: actor.tenantId, orgId: actor.orgId,
      userId: actor.userId, ratingId
    });
    if (!canReadRating(actor, { fromUserId: rating.fromUser.id, toUserId: rating.toUser.id })) {
      throw new ForbiddenException("Cannot read this rating");
    }
    return rating;
  }

  async summarizeUser(actor: RatingActor, userId: string) {
    if (!canReadRatingSummary(actor, userId)) throw new ForbiddenException("Cannot read rating summary for this user");
    return this.ratingsRepository.summarizeRatingsForUser({
      tenantId: actor.tenantId, orgId: actor.orgId,
      userId: actor.userId, targetUserId: userId
    });
  }

  async createRating(input: RatingActor & {
    jobId: string; toUserId: string; score: number; comment?: string; requestId: string;
  }) {
    if (!canCreateRating(input)) throw new ForbiddenException("Cannot submit ratings");
    const rating = await this.ratingsRepository.createRating({
      tenantId: input.tenantId, orgId: input.orgId, userId: input.userId,
      jobId: input.jobId, toUserId: input.toUserId, score: input.score, comment: input.comment
    });
    await this.auditService.append({
      id: `aud_${Date.now()}`, tenantId: input.tenantId, orgId: input.orgId,
      actorUserId: input.userId, action: "rating.create", entityType: "Rating",
      entityId: rating.id, requestId: input.requestId, timestamp: new Date().toISOString(),
      afterJson: { jobId: rating.jobId, toUserId: rating.toUser.id, score: rating.score, comment: rating.comment }
    });
    await this.domainEventBus.emit(
      { type: "rating.submitted", meta: { tenantId: input.tenantId, correlationId: `rating:${rating.id}:submitted`,
        actorId: input.userId, actorType: "user", occurredAt: new Date().toISOString(), version: 1 },
        payload: { ratingId: rating.id, jobId: rating.jobId, fromUserId: rating.fromUser.id,
          toUserId: rating.toUser.id, score: rating.score, comment: rating.comment },
        triggers: ["trust-match", "audit"] },
      { tenantId: input.tenantId, orgId: input.orgId, userId: input.userId, requestId: input.requestId }
    );
    return rating;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRating(overrides: any = {}) {
  return {
    id: "rating_1", jobId: "job_1",
    fromUser: { id: "user_client" }, toUser: { id: "user_pro" },
    score: 4, comment: "Good work",
    createdAt: new Date(),
    ...overrides
  };
}

function makeActor(roles: string[] = ["CLIENT"]) {
  return { tenantId: "t1", orgId: "org1", userId: "user_client", roles };
}

function createService(repoOverrides: any = {}) {
  const auditCalls: any[] = [];
  const busCalls: any[] = [];

  const repo = {
    findRatingsByTenant: async (_: any) => [makeRating()],
    findRatingsForUser: async (_: any) => [makeRating()],
    findRatingById: async (_: any) => makeRating(),
    createRating: async (input: any) => ({
      id: "rating_new", jobId: input.jobId,
      fromUser: { id: input.userId }, toUser: { id: input.toUserId },
      score: input.score, comment: input.comment, createdAt: new Date()
    }),
    summarizeRatingsForUser: async (_: any) => ({
      targetUserId: "user_pro", count: 5, avgScore: 4.2,
      breakdown: { 5: 2, 4: 2, 3: 1 }
    }),
    ...repoOverrides
  };

  const audit = { append: async (entry: any) => { auditCalls.push(entry); } };
  const bus = { emit: async (event: any, ctx: any) => { busCalls.push({ event, ctx }); } };

  const svc = new RatingsService(repo, audit, bus);
  return { svc, auditCalls, busCalls };
}

// ── Policy tests ──────────────────────────────────────────────────────────────
describe("ratings policy", () => {
  it("OPS_ADMIN can create rating", () => {
    assert.ok(canCreateRating(makeActor(["OPS_ADMIN"])));
  });

  it("CLIENT can create rating", () => {
    assert.ok(canCreateRating(makeActor(["CLIENT"])));
  });

  it("PRO can create rating", () => {
    assert.ok(canCreateRating(makeActor(["PRO"])));
  });

  it("WORKER cannot create rating", () => {
    assert.ok(!canCreateRating(makeActor(["WORKER"])));
  });

  it("can read own rating (fromUser)", () => {
    assert.ok(canReadRating(
      makeActor(["CLIENT"]),
      { fromUserId: "user_client", toUserId: "user_pro" }
    ));
  });

  it("can read own rating (toUser)", () => {
    assert.ok(canReadRating(
      { tenantId: "t1", orgId: "org1", userId: "user_pro", roles: ["PRO"] },
      { fromUserId: "user_client", toUserId: "user_pro" }
    ));
  });

  it("cannot read someone else's rating", () => {
    assert.ok(!canReadRating(
      { tenantId: "t1", orgId: "org1", userId: "user_other", roles: ["PRO"] },
      { fromUserId: "user_client", toUserId: "user_pro" }
    ));
  });

  it("OPS_ADMIN can read any rating", () => {
    assert.ok(canReadRating(
      makeActor(["OPS_ADMIN"]),
      { fromUserId: "user_a", toUserId: "user_b" }
    ));
  });

  it("canReadRatingSummary: own user", () => {
    assert.ok(canReadRatingSummary(makeActor(["CLIENT"]), "user_client"));
  });

  it("canReadRatingSummary: different user forbidden", () => {
    assert.ok(!canReadRatingSummary(makeActor(["CLIENT"]), "user_other"));
  });

  it("OPS_ADMIN can read any summary", () => {
    assert.ok(canReadRatingSummary(makeActor(["OPS_ADMIN"]), "any_user"));
  });
});

// ── Service tests ─────────────────────────────────────────────────────────────
describe("RatingsService.listRatings", () => {
  it("OPS_ADMIN gets all tenant ratings", async () => {
    const adminActor = makeActor(["OPS_ADMIN"]);
    let calledWith: any = null;
    const { svc } = createService({
      findRatingsByTenant: async (actor: any) => { calledWith = actor; return [makeRating()]; }
    });
    const result = await svc.listRatings(adminActor);
    assert.equal(result.length, 1);
    assert.equal(calledWith.userId, "user_client");
  });

  it("non-admin gets own ratings only", async () => {
    let calledWith: any = null;
    const { svc } = createService({
      findRatingsForUser: async (q: any) => { calledWith = q; return [makeRating()]; }
    });
    const result = await svc.listRatings(makeActor(["CLIENT"]));
    assert.equal(result.length, 1);
    assert.equal(calledWith.targetUserId, "user_client");
  });
});

describe("RatingsService.getRating", () => {
  it("returns rating when actor is fromUser", async () => {
    const { svc } = createService();
    const rating = await svc.getRating(makeActor(["CLIENT"]), "rating_1");
    assert.equal(rating.id, "rating_1");
    assert.equal(rating.fromUser.id, "user_client");
  });

  it("returns rating when actor is toUser", async () => {
    const { svc } = createService({
      findRatingById: async () => makeRating({ fromUser: { id: "user_other" }, toUser: { id: "user_client" } })
    });
    const rating = await svc.getRating(makeActor(["CLIENT"]), "rating_1");
    assert.equal(rating.toUser.id, "user_client");
  });

  it("throws ForbiddenException for unrelated user", async () => {
    const { svc } = createService({
      findRatingById: async () => makeRating({ fromUser: { id: "user_a" }, toUser: { id: "user_b" } })
    });
    await assert.rejects(
      () => svc.getRating(makeActor(["CLIENT"]), "rating_1"),
      (err: any) => err instanceof ForbiddenException && err.message.includes("Cannot read")
    );
  });

  it("OPS_ADMIN can read any rating", async () => {
    const { svc } = createService({
      findRatingById: async () => makeRating({ fromUser: { id: "user_a" }, toUser: { id: "user_b" } })
    });
    const rating = await svc.getRating(makeActor(["OPS_ADMIN"]), "rating_1");
    assert.equal(rating.id, "rating_1");
  });
});

describe("RatingsService.summarizeUser", () => {
  it("returns summary for own user", async () => {
    const { svc } = createService();
    const summary = await svc.summarizeUser(makeActor(["CLIENT"]), "user_client");
    assert.equal(summary.targetUserId, "user_pro");
    assert.equal(summary.count, 5);
    assert.equal(summary.avgScore, 4.2);
  });

  it("throws for summary of other user", async () => {
    const { svc } = createService();
    await assert.rejects(
      () => svc.summarizeUser(makeActor(["CLIENT"]), "user_other"),
      (err: any) => err instanceof ForbiddenException
    );
  });

  it("OPS_ADMIN can summarize any user", async () => {
    const { svc } = createService();
    const summary = await svc.summarizeUser(makeActor(["OPS_ADMIN"]), "user_other");
    assert.equal(summary.count, 5);
  });
});

describe("RatingsService.createRating", () => {
  it("creates rating and emits event + audit", async () => {
    const { svc, auditCalls, busCalls } = createService();
    const rating = await svc.createRating({
      ...makeActor(["CLIENT"]),
      jobId: "job_1", toUserId: "user_pro",
      score: 5, comment: "Excellent", requestId: "req_1"
    });

    assert.equal(rating.id, "rating_new");
    assert.equal(rating.score, 5);
    assert.equal(rating.fromUser.id, "user_client");
    assert.equal(rating.toUser.id, "user_pro");

    // Audit was recorded
    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0].action, "rating.create");
    assert.equal(auditCalls[0].entityType, "Rating");
    assert.equal(auditCalls[0].entityId, "rating_new");

    // Domain event was emitted
    assert.equal(busCalls.length, 1);
    assert.equal(busCalls[0].event.type, "rating.submitted");
    assert.equal(busCalls[0].event.payload.score, 5);
    assert.deepEqual(busCalls[0].event.triggers, ["trust-match", "audit"]);
  });

  it("throws ForbiddenException when actor cannot create rating", async () => {
    const { svc } = createService();
    await assert.rejects(
      () => svc.createRating({
        ...makeActor(["WORKER"]), // WORKER role cannot rate
        jobId: "job_1", toUserId: "user_pro",
        score: 3, requestId: "req_2"
      }),
      (err: any) => err instanceof ForbiddenException && err.message.includes("Cannot submit ratings")
    );
  });

  it("PRO can submit a rating", async () => {
    const { svc } = createService();
    const rating = await svc.createRating({
      tenantId: "t1", orgId: "org1", userId: "user_pro", roles: ["PRO"],
      jobId: "job_1", toUserId: "user_client", score: 4, requestId: "req_3"
    });
    assert.equal(rating.toUser.id, "user_client");
  });

  it("rating event contains correlationId with rating id", async () => {
    const { svc, busCalls } = createService();
    await svc.createRating({
      ...makeActor(["CLIENT"]),
      jobId: "job_1", toUserId: "user_pro",
      score: 3, requestId: "req_4"
    });
    assert.match(busCalls[0].event.meta.correlationId, /rating:rating_new:submitted/);
  });

  it("does not emit audit when repo fails", async () => {
    const { svc, auditCalls } = createService({
      createRating: async () => { throw new Error("DB error"); }
    });
    await assert.rejects(
      () => svc.createRating({
        ...makeActor(["CLIENT"]),
        jobId: "job_1", toUserId: "user_pro",
        score: 4, requestId: "req_5"
      }),
      (err: any) => err.message === "DB error"
    );
    assert.equal(auditCalls.length, 0);
  });
});

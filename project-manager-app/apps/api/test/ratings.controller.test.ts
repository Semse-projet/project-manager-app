import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { RatingsController } from "../dist/modules/ratings/ratings.controller.js";
import {
  canCreateRating,
  canReadRating,
  canReadRatingSummary,
  isOpsAdmin,
} from "../dist/modules/ratings/ratings.policy.js";

// ── Policy unit tests ─────────────────────────────────────────────────────────

test("ratings policy: isOpsAdmin returns true only for OPS_ADMIN role", () => {
  assert.equal(isOpsAdmin({ tenantId: "t1", orgId: "o1", userId: "u1", roles: ["OPS_ADMIN"] }), true);
  assert.equal(isOpsAdmin({ tenantId: "t1", orgId: "o1", userId: "u1", roles: ["CLIENT"] }), false);
  assert.equal(isOpsAdmin({ tenantId: "t1", orgId: "o1", userId: "u1", roles: [] }), false);
});

test("ratings policy: canCreateRating allows CLIENT, PRO, OPS_ADMIN only", () => {
  const base = { tenantId: "t1", orgId: "o1", userId: "u1" };
  assert.equal(canCreateRating({ ...base, roles: ["CLIENT"] }), true);
  assert.equal(canCreateRating({ ...base, roles: ["PRO"] }), true);
  assert.equal(canCreateRating({ ...base, roles: ["OPS_ADMIN"] }), true);
  assert.equal(canCreateRating({ ...base, roles: ["WORKER"] }), false);
  assert.equal(canCreateRating({ ...base, roles: [] }), false);
});

test("ratings policy: canReadRating allows admin or rating participant", () => {
  const admin = { tenantId: "t1", orgId: "o1", userId: "u_admin", roles: ["OPS_ADMIN"] };
  const from  = { tenantId: "t1", orgId: "o1", userId: "u_from",  roles: ["CLIENT"] };
  const to    = { tenantId: "t1", orgId: "o1", userId: "u_to",    roles: ["PRO"] };
  const other = { tenantId: "t1", orgId: "o1", userId: "u_other", roles: ["CLIENT"] };
  const record = { fromUserId: "u_from", toUserId: "u_to" };

  assert.equal(canReadRating(admin, record), true, "admin can read");
  assert.equal(canReadRating(from,  record), true, "fromUser can read");
  assert.equal(canReadRating(to,    record), true, "toUser can read");
  assert.equal(canReadRating(other, record), false, "third party cannot read");
});

test("ratings policy: canReadRatingSummary allows admin or self", () => {
  const admin = { tenantId: "t1", orgId: "o1", userId: "u_admin", roles: ["OPS_ADMIN"] };
  const self  = { tenantId: "t1", orgId: "o1", userId: "u_pro",   roles: ["PRO"] };
  const other = { tenantId: "t1", orgId: "o1", userId: "u_other", roles: ["CLIENT"] };

  assert.equal(canReadRatingSummary(admin, "u_pro"),  true, "admin can read anyone");
  assert.equal(canReadRatingSummary(self,  "u_pro"),  true, "self summary allowed");
  assert.equal(canReadRatingSummary(other, "u_pro"),  false, "others blocked");
});

// ── Controller permission declarations ────────────────────────────────────────

test("ratings controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["list",           "ratings:read"],
    ["reputation",     "ratings:read"],
    ["reputationBatch","ratings:read"],
    ["summary",        "ratings:read"],
    ["detail",         "ratings:read"],
    ["create",         "ratings:create"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, RatingsController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── Controller routing ────────────────────────────────────────────────────────

function makeActor(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_test_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_client_1",
      userId: "usr_client_1",
      roles: ["CLIENT"],
      ...overrides,
    },
  };
}

test("ratings controller: list routes to service and returns ok wrapper", async () => {
  let listCalled = false;
  const controller = new RatingsController(
    {
      async listRatings() {
        listCalled = true;
        return [{ id: "rat_1", jobId: "job_1", score: 5 }];
      },
      async getRating() { return { id: "rat_1" }; },
      async summarizeUser() { return { userId: "u1", averageScore: 4.5, totalRatings: 2, recentRatings: [] }; },
      async createRating() { return { id: "rat_new", jobId: "job_1", score: 4 }; },
    } as never,
    {
      async computeForUser() { return { score: 90, level: "low" }; },
      async computeBatchForTenant() { return []; },
    } as never,
  );

  const result = await controller.list(makeActor() as never);
  assert.equal(listCalled, true);
  assert.equal(result.requestId, "req_test_1");
  assert.ok(Array.isArray(result.data));
});

test("ratings controller: detail returns single rating by id", async () => {
  const controller = new RatingsController(
    {
      async listRatings() { return []; },
      async getRating(_actor: unknown, ratingId: string) { return { id: ratingId, score: 4 }; },
      async summarizeUser() { return { userId: "u1", averageScore: 4.0, totalRatings: 1, recentRatings: [] }; },
      async createRating() { return { id: "rat_1" }; },
    } as never,
    {
      async computeForUser() { return { score: 85, level: "low" }; },
      async computeBatchForTenant() { return []; },
    } as never,
  );

  const result = await controller.detail(makeActor() as never, "rat_abc");
  assert.equal(result.data.id, "rat_abc");
});

test("ratings controller: create passes parsed body to service", async () => {
  const calls: unknown[] = [];
  const controller = new RatingsController(
    {
      async listRatings() { return []; },
      async getRating() { return { id: "r1" }; },
      async summarizeUser() { return { userId: "u1", averageScore: 5, totalRatings: 1, recentRatings: [] }; },
      async createRating(input: unknown) {
        calls.push(input);
        return { id: "rat_new", jobId: "job_1", score: 5 };
      },
    } as never,
    {
      async computeForUser() { return {}; },
      async computeBatchForTenant() { return []; },
    } as never,
  );

  const body = { jobId: "job_1", toUserId: "usr_pro_1", score: 5, comment: "Excellent work" };
  const result = await controller.create(makeActor() as never, body);
  assert.equal(result.data.id, "rat_new");
  assert.equal(calls.length, 1);
});

test("ratings controller: create rejects invalid score range via zod", async () => {
  const controller = new RatingsController(
    {
      async listRatings() { return []; },
      async getRating() { return {}; },
      async summarizeUser() { return {}; },
      async createRating() { return {}; },
    } as never,
    {
      async computeForUser() { return {}; },
      async computeBatchForTenant() { return []; },
    } as never,
  );

  // score=6 violates max:5
  await assert.rejects(
    () => controller.create(makeActor() as never, { jobId: "job_1", toUserId: "u1", score: 6 }),
    /BadRequestException|score/i
  );
});

test("ratings controller: reputation endpoint calls reputationService", async () => {
  const controller = new RatingsController(
    {
      async listRatings() { return []; },
      async getRating() { return {}; },
      async summarizeUser() { return {}; },
      async createRating() { return {}; },
    } as never,
    {
      async computeForUser(_tenantId: string, userId: string) {
        return { userId, score: 72, level: "low", computedAt: new Date().toISOString() };
      },
      async computeBatchForTenant() { return []; },
    } as never,
  );

  const result = await controller.reputation(makeActor() as never, "usr_pro_1");
  assert.equal(result.data.userId, "usr_pro_1");
  assert.ok(result.data.score > 0);
});

test("ratings service: listRatings delegates to tenant-wide query for OPS_ADMIN", async () => {
  const tenantCalls: string[] = [];
  const userCalls: string[] = [];

  const { RatingsService } = await import("../dist/modules/ratings/ratings.service.js");

  const repo = {
    async findRatingsByTenant({ tenantId }: { tenantId: string }) {
      tenantCalls.push(tenantId);
      return [{ id: "rat_admin_1" }];
    },
    async findRatingsForUser({ tenantId }: { tenantId: string }) {
      userCalls.push(tenantId);
      return [{ id: "rat_user_1" }];
    },
    async findRatingById() { return {}; },
    async summarizeRatingsForUser() { return {}; },
    async createRating() { return {}; },
  };

  const service = new RatingsService(repo as never, { append: async () => {} } as never, { emit: async () => {} } as never);

  const adminActor = { tenantId: "t1", orgId: "o1", userId: "u_admin", roles: ["OPS_ADMIN"] };
  const clientActor = { tenantId: "t1", orgId: "o1", userId: "u_client", roles: ["CLIENT"] };

  await service.listRatings(adminActor);
  await service.listRatings(clientActor);

  assert.equal(tenantCalls.length, 1, "OPS_ADMIN uses tenant-wide query");
  assert.equal(userCalls.length, 1, "CLIENT uses user-scoped query");
});

test("ratings service: summarizeUser throws ForbiddenException for non-self non-admin", async () => {
  const { RatingsService } = await import("../dist/modules/ratings/ratings.service.js");

  const service = new RatingsService(
    {
      async findRatingsByTenant() { return []; },
      async findRatingsForUser() { return []; },
      async findRatingById() { return {}; },
      async summarizeRatingsForUser() { return {}; },
      async createRating() { return {}; },
    } as never,
    { append: async () => {} } as never,
    { emit: async () => {} } as never,
  );

  const actor = { tenantId: "t1", orgId: "o1", userId: "u_client", roles: ["CLIENT"] };

  await assert.rejects(
    () => service.summarizeUser(actor, "u_someone_else"),
    ForbiddenException
  );
});

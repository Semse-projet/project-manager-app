import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { MatchingController } from "../dist/modules/matching/matching.controller.js";
import { MatchingRepository } from "../dist/modules/matching/matching.repository.js";
import { MatchingService } from "../dist/modules/matching/matching.service.js";

test("matching controller declares matching:read permission", () => {
  const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, MatchingController.prototype.matchJob);
  assert.deepEqual(metadata, ["matching:read"]);
});

test("matching controller wraps service response with request id", async () => {
  const controller = new MatchingController({
    async matchJob(tenantId: string, input: { jobId: string; limit: number; minScore: number }) {
      return {
        jobId: input.jobId,
        jobTitle: "Instalacion split",
        candidatesEvaluated: 1,
        candidates: [
          {
            userId: "usr_1",
            email: "pro@example.com",
            score: 0.91,
            percentileRank: 100,
            breakdown: {
              textSimilarity: 0.8,
              trustSignal: 0.9,
              verificationSignal: 1,
              ratingSignal: 0.7,
            },
            verificationStatus: "verified",
            trustScore: 0.9,
            avgRating: 4.7,
            totalRatings: 18,
            completedJobs: 25,
          },
        ],
        algorithmVersion: "v1.0",
        computedAt: "2026-06-09T12:00:00.000Z",
        tenantId,
        input,
      };
    },
  } as never);

  const result = await controller.matchJob(
    {
      headers: { "x-request-id": "req_match_1" },
      authContext: { userId: "usr_client_1", tenantId: "tenant_1", orgId: "org_1", roles: ["CLIENT"] },
    } as never,
    { jobId: "job_1", limit: 5, minScore: 0.2 },
  );

  assert.equal(result.requestId, "req_match_1");
  assert.equal(result.data.algorithmVersion, "v1.0");
  assert.equal(result.data.candidates[0]?.userId, "usr_1");
});

test("matching service returns algorithm version and visible score breakdown", async () => {
  const service = new MatchingService({
    async findJobOrThrow(tenantId: string, jobId: string) {
      assert.equal(tenantId, "tenant_1");
      assert.equal(jobId, "job_1");
      return {
        id: "job_1",
        title: "Instalacion split",
        category: "HVAC",
        scope: "instalacion de minisplit y cableado",
        tenantId,
      };
    },
    async loadCandidates() {
      return [
        {
          userId: "usr_1",
          email: "pro@example.com",
          trustScore: 0.9,
          verificationStatus: "verified",
          avgRating: 4.8,
          totalRatings: 20,
          completedJobs: 12,
          historicalJobText: "instalacion split cableado hvac",
        },
      ];
    },
    async loadPreferredTargetForJob() {
      return null;
    },
    async loadPublicCandidateProfiles() {
      return new Map();
    },
  } as never);

  const result = await service.matchJob("tenant_1", { jobId: "job_1", limit: 3, minScore: 0 });

  assert.equal(result.algorithmVersion, "v1.0");
  assert.equal(result.candidatesEvaluated, 1);
  assert.equal(result.candidates[0]?.breakdown.textSimilarity > 0, true);
  assert.equal(result.candidates[0]?.score <= 1, true);
  assert.equal(result.candidates[0]?.score >= 0, true);
  assert.ok(result.computedAt.length > 0);
});

test("matching repository rejects cross-tenant job lookup", async () => {
  const repository = new MatchingRepository({
    job: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string; deletedAt: null } }) =>
        where.tenantId === "tenant_1"
          ? { id: where.id, title: "Instalacion split", category: "HVAC", scope: "scope", tenantId: where.tenantId }
          : null,
    },
  } as never);

  const job = await repository.findJobOrThrow("tenant_1", "job_1");
  assert.equal(job.tenantId, "tenant_1");

  await assert.rejects(
    () => repository.findJobOrThrow("tenant_2", "job_1"),
    NotFoundException
  );
});

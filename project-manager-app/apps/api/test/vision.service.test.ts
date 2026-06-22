import test from "node:test";
import assert from "node:assert/strict";
import { VisionService } from "../dist/modules/vision/vision.service.js";
import type { VisionRepository } from "../dist/modules/vision/vision.repository.js";
import type { VisionServiceClient } from "../dist/modules/vision/clients/vision-service.client.js";

// Mock implementation of Repository
const mockRepository = {
  create: async (input: any) => ({
    id: "va_123",
    evidenceId: input.evidenceId,
    status: "pending",
  }),
  update: async (id: string, input: any) => ({
    id,
    status: input.status,
    ...input,
  }),
} as unknown as VisionRepository;

// Mock implementation of Client
const mockServiceClient = {
  analyzeEvidence: async (payload: any) => ({
    evidenceId: payload.evidenceId,
    status: "completed",
    quality: {
      qualityScore: 0.91,
      blurScore: 0.08,
      brightnessScore: 0.77,
      contrastScore: 0.82,
      usable: true,
    },
    duplicate: {
      duplicateRisk: 0.12,
      hashValue: "dhash123",
    },
    progress: {
      changeScore: 0.68,
      visualProgressDetected: true,
      requiresHumanReview: false,
    },
    governance: {
      recommendedAction: "approve_for_review",
      requiresHumanReview: false,
      canAutoApprove: true,
    },
    rawResult: {
      riskLevel: "low",
      reasons: [],
    },
  }),
} as unknown as VisionServiceClient;

test("VisionService runAnalysis successfully creates and updates record", async () => {
  const service = new VisionService(mockRepository, mockServiceClient);

  const result = await service.runAnalysis({
    evidenceId: "ev_123",
    imageUrl: "https://example.com/test.jpg",
    jobId: "job_456",
    milestoneId: "ms_789",
    trade: "painting",
  });

  assert.equal(result.id, "va_123");
  assert.equal(result.status, "completed");
  assert.equal(result.qualityScore, 0.91);
  assert.equal(result.blurScore, 0.08);
  assert.equal(result.duplicateRisk, 0.12);
  assert.equal(result.changeScore, 0.68);
  assert.equal(result.canAutoApprove, true);
  assert.equal(result.recommendedAction, "approve_for_review");
});

test("VisionService handles errors by setting status to failed", async () => {
  const failingServiceClient = {
    analyzeEvidence: async () => {
      throw new Error("Connection timed out");
    },
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, failingServiceClient);

  const result = await service.runAnalysis({
    evidenceId: "ev_failed",
    imageUrl: "https://example.com/failed.jpg",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.rawResult.errorMessage, "Connection timed out");
});

import test from "node:test";
import assert from "node:assert/strict";
import { VisionService } from "../../apps/api/dist/modules/vision/vision.service.js";
import type { VisionRepository } from "../../apps/api/dist/modules/vision/vision.repository.js";
import type { VisionServiceClient } from "../../apps/api/dist/modules/vision/clients/vision-service.client.js";

// Common mocks
const mockRepository = {
  create: async (input: any) => ({ id: "va_1", status: "pending", ...input }),
  update: async (id: string, input: any) => ({ id, ...input }),
  findByEvidenceId: async (id: string) => ({ id: "va_1", evidenceId: id, status: "completed" }),
  listByJob: async (jobId: string) => [{ id: "va_1", jobId, status: "completed" }],
  listByMilestone: async (milestoneId: string) => [{ id: "va_1", milestoneId, status: "completed" }],
  upsertByEvidenceId: async (id: string, input: any) => ({ ...input }),
} as unknown as VisionRepository;

const successResponse = {
  quality: {
    qualityScore: 0.85,
    blurScore: 0.1,
    brightnessScore: 0.8,
    contrastScore: 0.75,
    usable: true,
  },
  duplicate: {
    duplicateRisk: 0.05,
    hashValue: "hash123",
  },
  progress: {
    changeScore: 0.6,
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
};

// ── runAnalysis Tests ────────────────────────────────────────────────────

test("VisionService.runAnalysis: creates pending record and completes with stats", async () => {
  const mockClient = {
    analyzeEvidence: async () => successResponse,
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const result = await service.runAnalysis({
    evidenceId: "ev_1",
    imageUrl: "https://example.com/photo.jpg",
    jobId: "job_1",
    trade: "painting",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.qualityScore, 0.85);
  assert.equal(result.canAutoApprove, true);
});

test("VisionService.runAnalysis: handles errors and marks as failed", async () => {
  const mockClient = {
    analyzeEvidence: async () => {
      throw new Error("Service unavailable");
    },
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const result = await service.runAnalysis({
    evidenceId: "ev_failed",
    imageUrl: "https://example.com/bad.jpg",
  });

  assert.equal(result.status, "failed");
  assert.ok(result.rawResult?.errorMessage);
});

test("VisionService.runAnalysis: includes optional metadata in request", async () => {
  const calls: any[] = [];
  const mockClient = {
    analyzeEvidence: async (payload: any) => {
      calls.push(payload);
      return successResponse;
    },
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  await service.runAnalysis({
    evidenceId: "ev_2",
    imageUrl: "https://example.com/test.jpg",
    metadata: { custom: "data" },
  });

  assert.equal(calls[0]?.metadata?.custom, "data");
});

// ── Query Methods ────────────────────────────────────────────────────────

test("VisionService.getAnalysis: retrieves by evidenceId", async () => {
  const service = new VisionService(mockRepository, {} as never, {} as never, {} as never);
  const result = await service.getAnalysis("ev_test");
  assert.ok(result.id);
});

test("VisionService.getByJob: returns all analyses for job", async () => {
  const service = new VisionService(mockRepository, {} as never, {} as never, {} as never);
  const results = await service.getByJob("job_1");
  assert.ok(Array.isArray(results));
});

test("VisionService.getByMilestone: returns analyses for milestone", async () => {
  const service = new VisionService(mockRepository, {} as never, {} as never, {} as never);
  const results = await service.getByMilestone("ms_1");
  assert.ok(Array.isArray(results));
});

// ── Advanced Analyzer Methods ────────────────────────────────────────────

test("VisionService.analyzeBlueprint: calls client with imageUrl and optional trade", async () => {
  const calls: any[] = [];
  const mockClient = {
    analyzeBlueprint: async (input: any) => {
      calls.push(input);
      return { lineCount: 25, isBlueprint: true, density: 0.15 };
    },
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  await service.analyzeBlueprint("https://example.com/blueprint.png", "electrical");

  assert.equal(calls[0]?.imageUrl, "https://example.com/blueprint.png");
  assert.equal(calls[0]?.trade, "electrical");
});

test("VisionService.correctPerspective: returns corrected image with optional base64", async () => {
  const mockClient = {
    correctPerspective: async (input: any) => ({
      corrected: true,
      base64Image: input.returnBase64 ? "data:image/jpeg;base64,abc" : null,
      widthPx: 1920,
      heightPx: 1080,
    }),
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const result = await service.correctPerspective("https://example.com/tilted.jpg", true);
  assert.equal(result.corrected, true);
  assert.ok(result.base64Image);
});

test("VisionService.binarizeDocument: processes document image", async () => {
  const mockClient = {
    binarizeDocument: async () => ({
      success: true,
      processedBase64: "data:image/png;base64,binary",
    }),
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const result = await service.binarizeDocument("https://example.com/doc.jpg");
  assert.equal(result.success, true);
});

test("VisionService.estimateArea: calculates area with optional expected comparison", async () => {
  const calls: any[] = [];
  const mockClient = {
    estimateArea: async (input: any) => {
      calls.push(input);
      return { estimatedAreaM2: 25.4, confidence: 0.78, method: "contour" };
    },
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  await service.estimateArea("https://example.com/room.jpg", 20);

  assert.equal(calls[0]?.expectedAreaM2, 20);
});

test("VisionService.checkSafety: detects PPE and compliance", async () => {
  const mockClient = {
    checkSafety: async () => ({
      helmetDetected: true,
      vestDetected: true,
      harnessDetected: false,
      complianceScore: 0.85,
      violations: [],
    }),
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const result = await service.checkSafety("https://example.com/construction.jpg");
  assert.equal(result.helmetDetected, true);
  assert.equal(result.complianceScore, 0.85);
});

test("VisionService.matchReference: compares delivered vs reference image", async () => {
  const mockClient = {
    matchReference: async () => ({
      similarityScore: 0.82,
      orbMatchCount: 45,
      ssimScore: 0.79,
      histogramScore: 0.85,
      meetsStandard: true,
    }),
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const result = await service.matchReference(
    "https://example.com/delivered.jpg",
    "https://example.com/reference.jpg"
  );

  assert.equal(result.meetsStandard, true);
  assert.ok(result.similarityScore > 0);
});

test("VisionService.detectTrade: identifies trade type from image", async () => {
  const mockClient = {
    detectTrade: async (input: any) => ({
      detectedTrade: "electrical",
      confidence: 0.91,
      expectedTrade: input.expectedTrade,
      match: true,
    }),
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const result = await service.detectTrade("https://example.com/work.jpg", "electrical");
  assert.equal(result.match, true);
});

// ── Batch Operations ──────────────────────────────────────────────────

test("VisionService.runBatchAnalysis: processes multiple images and persists results", async () => {
  const persistCalls: any[] = [];
  const batchMockRepo = {
    ...mockRepository,
    upsertByEvidenceId: async (id: string, data: any) => {
      persistCalls.push({ id, ...data });
      return { id };
    },
  } as unknown as VisionRepository;

  const mockClient = {
    batchAnalyze: async () => ({
      total: 2,
      completed: 2,
      failed: 0,
      results: [
        {
          evidenceId: "ev_1",
          status: "completed",
          result: { ...successResponse },
        },
        {
          evidenceId: "ev_2",
          status: "completed",
          result: { ...successResponse },
        },
      ],
      batchDurationMs: 150,
    }),
  } as unknown as VisionServiceClient;

  const service = new VisionService(batchMockRepo, mockClient, {} as never, {} as never);

  const items = [
    { evidenceId: "ev_1", imageUrl: "https://example.com/1.jpg" },
    { evidenceId: "ev_2", imageUrl: "https://example.com/2.jpg" },
  ];

  const result = await service.runBatchAnalysis(items, "job_1", "ms_1");

  assert.equal(result.total, 2);
  assert.equal(result.completed, 2);
  assert.ok(persistCalls.length > 0);
});

test("VisionService.runBatchAnalysis: includes jobId and milestoneId in request", async () => {
  const calls: any[] = [];
  const mockClient = {
    batchAnalyze: async (input: any) => {
      calls.push(input);
      return { total: 1, completed: 1, failed: 0, results: [], batchDurationMs: 50 };
    },
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  await service.runBatchAnalysis(
    [{ evidenceId: "ev_1", imageUrl: "https://example.com/1.jpg" }],
    "job_1",
    "ms_1"
  );

  assert.equal(calls[0]?.jobId, "job_1");
  assert.equal(calls[0]?.milestoneId, "ms_1");
});

// ── Timeline Operations ──────────────────────────────────────────────

test("VisionService.buildTimeline: generates GIF from image sequence with fps", async () => {
  const calls: any[] = [];
  const mockClient = {
    buildTimeline: async (input: any) => {
      calls.push(input);
      return {
        frameCount: 5,
        durationMs: 2500,
        base64Gif: "data:image/gif;base64,R0lGOD...",
      };
    },
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const urls = [
    "https://example.com/1.jpg",
    "https://example.com/2.jpg",
    "https://example.com/3.jpg",
  ];

  const result = await service.buildTimeline(urls, undefined, 2);

  assert.equal(calls[0]?.fps, 2);
  assert.equal(result.frameCount, 5);
  assert.ok(result.base64Gif);
});

test("VisionService.buildTimeline: accepts custom resolution parameters", async () => {
  const calls: any[] = [];
  const mockClient = {
    buildTimeline: async (input: any) => {
      calls.push(input);
      return { frameCount: 3, durationMs: 1500, base64Gif: "data:image/gif;base64,..." };
    },
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  await service.buildTimeline(
    ["https://example.com/1.jpg", "https://example.com/2.jpg"],
    ["Start", "End"],
    1,
    1280,
    720
  );

  assert.equal(calls[0]?.outputWidth, 1280);
  assert.equal(calls[0]?.outputHeight, 720);
});

// ── Consistency Checks ────────────────────────────────────────────────

test("VisionService.checkConsistency: validates location consistency across images", async () => {
  const mockClient = {
    checkConsistency: async () => ({
      consistencyScore: 0.88,
      outlierIndices: [],
      allSameLocation: true,
      pairwiseScores: [0.88, 0.85],
    }),
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const result = await service.checkConsistency([
    "https://example.com/1.jpg",
    "https://example.com/2.jpg",
  ]);

  assert.equal(result.allSameLocation, true);
  assert.ok(Array.isArray(result.pairwiseScores));
});

test("VisionService.checkConsistency: passes all URLs to client for analysis", async () => {
  const calls: any[] = [];
  const mockClient = {
    checkConsistency: async (input: any) => {
      calls.push(input);
      return { consistencyScore: 0.95, outlierIndices: [], allSameLocation: true, pairwiseScores: [] };
    },
  } as unknown as VisionServiceClient;

  const service = new VisionService(mockRepository, mockClient, {} as never, {} as never);

  const urls = ["https://example.com/single.jpg"];
  const result = await service.checkConsistency(urls);

  assert.equal(calls[0]?.imageUrls[0], urls[0]);
  assert.equal(result.consistencyScore, 0.95);
});

import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { VisionController } from "../dist/modules/vision/vision.controller.js";

function makeReq() {
  return {
    headers: { "x-request-id": "req_vision_1" },
  };
}

const STUB_VISION_ANALYSIS = {
  id: "va_1",
  evidenceId: "ev_1",
  jobId: "job_1",
  status: "completed",
  qualityScore: 0.85,
  blurScore: 0.1,
  brightnessScore: 0.8,
  contrastScore: 0.75,
  duplicateRisk: 0.05,
};

const STUB_BLUEPRINT = {
  lineCount: 25,
  density: 0.12,
  isBlueprint: true,
};

const STUB_PERSPECTIVE = {
  corrected: true,
  base64Image: "data:image/jpeg;base64,abc123==",
  widthPx: 1920,
  heightPx: 1080,
};

// ── Core Analysis Endpoints ───────────────────────────────────────────────────

test("vision controller: analyze routes dto to service", async () => {
  const calls: unknown[] = [];
  const controller = new VisionController({
    async runAnalysis(input: unknown) {
      calls.push(input);
      return STUB_VISION_ANALYSIS;
    },
    async getAnalysis() { return STUB_VISION_ANALYSIS; },
    async getByJob() { return [STUB_VISION_ANALYSIS]; },
    async getByMilestone() { return [STUB_VISION_ANALYSIS]; },
    async analyzeByEvidenceId() { return STUB_VISION_ANALYSIS; },
    async analyzeBlueprint() { return STUB_BLUEPRINT; },
    async correctPerspective() { return STUB_PERSPECTIVE; },
    async binarizeDocument() { return {}; },
    async buildTimeline() { return {}; },
    async checkSafety() { return {}; },
    async matchReference() { return {}; },
    async detectTrade() { return {}; },
    async estimateArea() { return {}; },
    async checkConsistency() { return {}; },
    async checkConsistencyByIds() { return {}; },
    async runBatchAnalysis() { return {}; },
    async runBatchByIds() { return {}; },
    async buildJobTimeline() { return {}; },
  } as never);

  const dto = { imageUrl: "https://example.com/photo.jpg", jobId: "job_1", trade: "painting" };
  const result = await controller.analyze(makeReq() as never, dto);
  assert.equal(result.requestId, "req_vision_1");
  assert.equal(result.data.status, "completed");
  assert.equal(calls[0]?.imageUrl, "https://example.com/photo.jpg");
});

test("vision controller: getAnalysis routes evidenceId to service", async () => {
  const calls: string[] = [];
  const controller = new VisionController({
    async runAnalysis() { return STUB_VISION_ANALYSIS; },
    async getAnalysis(evidenceId: string) {
      calls.push(evidenceId);
      return STUB_VISION_ANALYSIS;
    },
    async getByJob() { return []; },
    async getByMilestone() { return []; },
    async analyzeByEvidenceId() { return STUB_VISION_ANALYSIS; },
    async analyzeBlueprint() { return STUB_BLUEPRINT; },
    async correctPerspective() { return STUB_PERSPECTIVE; },
    async binarizeDocument() { return {}; },
    async buildTimeline() { return {}; },
    async checkSafety() { return {}; },
    async matchReference() { return {}; },
    async detectTrade() { return {}; },
    async estimateArea() { return {}; },
    async checkConsistency() { return {}; },
    async checkConsistencyByIds() { return {}; },
    async runBatchAnalysis() { return {}; },
    async runBatchByIds() { return {}; },
    async buildJobTimeline() { return {}; },
  } as never);

  const result = await controller.getAnalysis(makeReq() as never, "ev_abc");
  assert.equal(calls[0], "ev_abc");
  assert.equal(result.data.status, "completed");
});

// ── Query Endpoints ──────────────────────────────────────────────────────────

test("vision controller: getByJob returns array for jobId", async () => {
  const calls: string[] = [];
  const controller = new VisionController({
    async runAnalysis() { return STUB_VISION_ANALYSIS; },
    async getAnalysis() { return STUB_VISION_ANALYSIS; },
    async getByJob(jobId: string) {
      calls.push(jobId);
      return [STUB_VISION_ANALYSIS, { ...STUB_VISION_ANALYSIS, id: "va_2" }];
    },
    async getByMilestone() { return []; },
    async analyzeByEvidenceId() { return STUB_VISION_ANALYSIS; },
    async analyzeBlueprint() { return STUB_BLUEPRINT; },
    async correctPerspective() { return STUB_PERSPECTIVE; },
    async binarizeDocument() { return {}; },
    async buildTimeline() { return {}; },
    async checkSafety() { return {}; },
    async matchReference() { return {}; },
    async detectTrade() { return {}; },
    async estimateArea() { return {}; },
    async checkConsistency() { return {}; },
    async checkConsistencyByIds() { return {}; },
    async runBatchAnalysis() { return {}; },
    async runBatchByIds() { return {}; },
    async buildJobTimeline() { return {}; },
  } as never);

  const result = await controller.getByJob(makeReq() as never, "job_1");
  assert.ok(Array.isArray(result.data));
  assert.equal(result.data.length, 2);
  assert.equal(calls[0], "job_1");
});

test("vision controller: getByMilestone returns array for milestoneId", async () => {
  const controller = new VisionController({
    async runAnalysis() { return STUB_VISION_ANALYSIS; },
    async getAnalysis() { return STUB_VISION_ANALYSIS; },
    async getByJob() { return []; },
    async getByMilestone() { return [STUB_VISION_ANALYSIS]; },
    async analyzeByEvidenceId() { return STUB_VISION_ANALYSIS; },
    async analyzeBlueprint() { return STUB_BLUEPRINT; },
    async correctPerspective() { return STUB_PERSPECTIVE; },
    async binarizeDocument() { return {}; },
    async buildTimeline() { return {}; },
    async checkSafety() { return {}; },
    async matchReference() { return {}; },
    async detectTrade() { return {}; },
    async estimateArea() { return {}; },
    async checkConsistency() { return {}; },
    async checkConsistencyByIds() { return {}; },
    async runBatchAnalysis() { return {}; },
    async runBatchByIds() { return {}; },
    async buildJobTimeline() { return {}; },
  } as never);

  const result = await controller.getByMilestone(makeReq() as never, "ms_1");
  assert.ok(Array.isArray(result.data));
});

// ── Advanced Analysis Endpoints ───────────────────────────────────────────────

test("vision controller: blueprint routes to service", async () => {
  const calls: unknown[] = [];
  const controller = new VisionController({
    async runAnalysis() { return STUB_VISION_ANALYSIS; },
    async getAnalysis() { return STUB_VISION_ANALYSIS; },
    async getByJob() { return []; },
    async getByMilestone() { return []; },
    async analyzeByEvidenceId() { return STUB_VISION_ANALYSIS; },
    async analyzeBlueprint(url: string, trade?: string) {
      calls.push({ url, trade });
      return STUB_BLUEPRINT;
    },
    async correctPerspective() { return STUB_PERSPECTIVE; },
    async binarizeDocument() { return {}; },
    async buildTimeline() { return {}; },
    async checkSafety() { return {}; },
    async matchReference() { return {}; },
    async detectTrade() { return {}; },
    async estimateArea() { return {}; },
    async checkConsistency() { return {}; },
    async checkConsistencyByIds() { return {}; },
    async runBatchAnalysis() { return {}; },
    async runBatchByIds() { return {}; },
    async buildJobTimeline() { return {}; },
  } as never);

  const dto = { imageUrl: "https://example.com/blueprint.png", trade: "electrical" };
  const result = await controller.blueprint(makeReq() as never, dto);
  assert.equal(result.data.lineCount, 25);
  assert.equal(calls[0]?.trade, "electrical");
});

test("vision controller: perspectiveCorrect routes optional returnBase64", async () => {
  const calls: unknown[] = [];
  const controller = new VisionController({
    async runAnalysis() { return STUB_VISION_ANALYSIS; },
    async getAnalysis() { return STUB_VISION_ANALYSIS; },
    async getByJob() { return []; },
    async getByMilestone() { return []; },
    async analyzeByEvidenceId() { return STUB_VISION_ANALYSIS; },
    async analyzeBlueprint() { return STUB_BLUEPRINT; },
    async correctPerspective(url: string, returnBase64?: boolean) {
      calls.push({ url, returnBase64 });
      return STUB_PERSPECTIVE;
    },
    async binarizeDocument() { return {}; },
    async buildTimeline() { return {}; },
    async checkSafety() { return {}; },
    async matchReference() { return {}; },
    async detectTrade() { return {}; },
    async estimateArea() { return {}; },
    async checkConsistency() { return {}; },
    async checkConsistencyByIds() { return {}; },
    async runBatchAnalysis() { return {}; },
    async runBatchByIds() { return {}; },
    async buildJobTimeline() { return {}; },
  } as never);

  const dto = { imageUrl: "https://example.com/photo.jpg", returnBase64: true };
  const result = await controller.perspectiveCorrect(makeReq() as never, dto);
  assert.equal(result.data.corrected, true);
  assert.equal(calls[0]?.returnBase64, true);
});

// ── Batch & Timeline Endpoints ────────────────────────────────────────────────

test("vision controller: batch routes multiple images to service", async () => {
  const calls: unknown[] = [];
  const controller = new VisionController({
    async runAnalysis() { return STUB_VISION_ANALYSIS; },
    async getAnalysis() { return STUB_VISION_ANALYSIS; },
    async getByJob() { return []; },
    async getByMilestone() { return []; },
    async analyzeByEvidenceId() { return STUB_VISION_ANALYSIS; },
    async analyzeBlueprint() { return STUB_BLUEPRINT; },
    async correctPerspective() { return STUB_PERSPECTIVE; },
    async binarizeDocument() { return {}; },
    async buildTimeline() { return {}; },
    async checkSafety() { return {}; },
    async matchReference() { return {}; },
    async detectTrade() { return {}; },
    async estimateArea() { return {}; },
    async checkConsistency() { return {}; },
    async checkConsistencyByIds() { return {}; },
    async runBatchAnalysis(items: unknown[], jobId?: string) {
      calls.push({ items, jobId });
      return { total: Array.isArray(items) ? items.length : 0, completed: 2 };
    },
    async runBatchByIds() { return {}; },
    async buildJobTimeline() { return {}; },
  } as never);

  const dto = {
    items: [
      { imageUrl: "https://example.com/1.jpg", jobId: "job_1" },
      { imageUrl: "https://example.com/2.jpg", jobId: "job_1" },
    ],
    jobId: "job_1",
  };
  const result = await controller.batch(makeReq() as never, dto);
  assert.equal(result.data.total, 2);
});

test("vision controller: jobTimeline accepts optional fps query param", async () => {
  const calls: unknown[] = [];
  const controller = new VisionController({
    async runAnalysis() { return STUB_VISION_ANALYSIS; },
    async getAnalysis() { return STUB_VISION_ANALYSIS; },
    async getByJob() { return []; },
    async getByMilestone() { return []; },
    async analyzeByEvidenceId() { return STUB_VISION_ANALYSIS; },
    async analyzeBlueprint() { return STUB_BLUEPRINT; },
    async correctPerspective() { return STUB_PERSPECTIVE; },
    async binarizeDocument() { return {}; },
    async buildTimeline() { return {}; },
    async checkSafety() { return {}; },
    async matchReference() { return {}; },
    async detectTrade() { return {}; },
    async estimateArea() { return {}; },
    async checkConsistency() { return {}; },
    async checkConsistencyByIds() { return {}; },
    async runBatchAnalysis() { return {}; },
    async runBatchByIds() { return {}; },
    async buildJobTimeline(jobId: string, fps: number) {
      calls.push({ jobId, fps });
      return { base64Gif: "data:image/gif;base64,abc123=" };
    },
  } as never);

  const result = await controller.jobTimeline(makeReq() as never, "job_1", "4");
  assert.ok(result.data.base64Gif);
  assert.equal(calls[0]?.fps, 4);
});

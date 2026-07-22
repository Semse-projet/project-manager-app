import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";

function actor(overrides: Partial<{ roles: string[] }> = {}) {
  return {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "usr_1",
    roles: overrides.roles ?? ["PRO"],
  };
}

function makeService(vision: Record<string, unknown> = {}) {
  return new PrometeoToolExecutionService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    vision as never,
    undefined as never,
  );
}

test("vision.analyze_image: denies without vision:run and calls VisionService.runAnalysis with the real params when authorized", async () => {
  // EVENT_CONSUMER only holds domain-events:consume in rbac.ts — every other
  // built-in role (CLIENT/PRO/WORKER/OPS_ADMIN) already grants vision:run.
  await assert.rejects(
    () => makeService().invokeReadTool(actor({ roles: ["EVENT_CONSUMER"] }) as never, "req_1", {
      namespace: "vision",
      name: "analyze_image",
      input: { evidenceId: "ev_1", imageUrl: "https://example.com/a.jpg" },
    }),
    ForbiddenException,
  );

  let calledWith: Record<string, unknown> | null = null;
  const vision = {
    async runAnalysis(input: Record<string, unknown>) {
      calledWith = input;
      return { evidenceId: input.evidenceId, status: "completed" };
    },
  };
  const result = await makeService(vision).invokeReadTool(actor({ roles: ["PRO"] }) as never, "req_1", {
    namespace: "vision",
    name: "analyze_image",
    input: { evidenceId: "ev_1", imageUrl: "https://example.com/a.jpg", jobId: "job_1" },
  });

  assert.equal(result.status, "succeeded");
  assert.equal(calledWith?.evidenceId, "ev_1");
  assert.equal(calledWith?.imageUrl, "https://example.com/a.jpg");
  assert.equal(calledWith?.jobId, "job_1");
});

test("vision.analyze_image: evidenceId is required — missing it fails with a clear 400, not a silent pass-through", async () => {
  const vision = {
    async runAnalysis() {
      throw new Error("must not be called without evidenceId");
    },
  };
  await assert.rejects(
    () => makeService(vision).invokeReadTool(actor({ roles: ["PRO"] }) as never, "req_1", {
      namespace: "vision",
      name: "analyze_image",
      input: { imageUrl: "https://example.com/a.jpg" },
    }),
    /evidenceId is required/,
  );
});

test("vision.compare_before_after: calls VisionService.matchReference with both image URLs", async () => {
  let calledWith: unknown[] = [];
  const vision = {
    async matchReference(deliveredImageUrl: string, referenceImageUrl: string) {
      calledWith = [deliveredImageUrl, referenceImageUrl];
      return { similarityScore: 0.9, meetsStandard: true };
    },
  };
  const result = await makeService(vision).invokeReadTool(actor({ roles: ["PRO"] }) as never, "req_1", {
    namespace: "vision",
    name: "compare_before_after",
    input: { deliveredImageUrl: "https://example.com/after.jpg", referenceImageUrl: "https://example.com/before.jpg" },
  });

  assert.equal(result.status, "succeeded");
  assert.deepEqual(calledWith, ["https://example.com/after.jpg", "https://example.com/before.jpg"]);
});

test("vision.detect_material: calls VisionService.detectMaterial with imageUrl/expectedMaterial/enrich", async () => {
  let calledWith: unknown[] = [];
  const vision = {
    async detectMaterial(imageUrl: string, expectedMaterial: string | undefined, enrich: boolean | undefined) {
      calledWith = [imageUrl, expectedMaterial, enrich];
      return { material: "drywall", confidence: 0.8 };
    },
  };
  const result = await makeService(vision).invokeReadTool(actor({ roles: ["PRO"] }) as never, "req_1", {
    namespace: "vision",
    name: "detect_material",
    input: { imageUrl: "https://example.com/a.jpg", expectedMaterial: "drywall", enrich: false },
  });

  assert.equal(result.status, "succeeded");
  assert.deepEqual(calledWith, ["https://example.com/a.jpg", "drywall", false]);
});

test("vision.classify_space: calls VisionService.classifySpace, enrich omitted lets the service default apply", async () => {
  let calledWith: unknown[] = [];
  const vision = {
    async classifySpace(imageUrl: string, enrich: boolean | undefined) {
      calledWith = [imageUrl, enrich];
      return { category: "kitchen", confidence: 0.7 };
    },
  };
  const result = await makeService(vision).invokeReadTool(actor({ roles: ["PRO"] }) as never, "req_1", {
    namespace: "vision",
    name: "classify_space",
    input: { imageUrl: "https://example.com/a.jpg" },
  });

  assert.equal(result.status, "succeeded");
  assert.deepEqual(calledWith, ["https://example.com/a.jpg", undefined]);
});

test("vision.check_safety: calls VisionService.checkSafetyEnriched with imageUrl/trade", async () => {
  let calledWith: unknown[] = [];
  const vision = {
    async checkSafetyEnriched(imageUrl: string, trade: string | undefined) {
      calledWith = [imageUrl, trade];
      return { complianceScore: 0.5, violations: ["no helmet"] };
    },
  };
  const result = await makeService(vision).invokeReadTool(actor({ roles: ["PRO"] }) as never, "req_1", {
    namespace: "vision",
    name: "check_safety",
    input: { imageUrl: "https://example.com/a.jpg", trade: "roofing" },
  });

  assert.equal(result.status, "succeeded");
  assert.deepEqual(calledWith, ["https://example.com/a.jpg", "roofing"]);
});

test("vision.analyze_video: still not wired — returns a blocked result, not a crash", async () => {
  const result = await makeService({}).invokeReadTool(actor({ roles: ["PRO"] }) as never, "req_1", {
    namespace: "vision",
    name: "analyze_video",
    input: { videoFileId: "vid_1" },
  });

  assert.equal(result.status, "blocked");
  assert.match(String(result.errorMessage), /not wired for read execution/);
});

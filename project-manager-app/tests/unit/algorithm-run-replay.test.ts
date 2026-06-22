import test from "node:test";
import assert from "node:assert/strict";

// ── Inline replay logic from AlgorithmRunService ───────────────────────────────
// Tests the core replay behavior without NestJS/Prisma infrastructure.

type RunRecord = {
  id: string;
  toolName: string;
  inputJson: Record<string, unknown>;
  tenantId: string | null;
  userId: string | null;
  jobId: string | null;
  buildOpsProjectId: string | null;
  riskScore: number | null;
  confidenceScore: number | null;
  priceBandMid: string | null;
  algorithmVersion: string;
  createdAt: Date;
};

class NotFoundError extends Error { constructor(msg: string) { super(msg); this.name = "NotFoundException"; } }
class BadRequestError extends Error { constructor(msg: string) { super(msg); this.name = "BadRequestException"; } }

function buildReplayResult(
  original: RunRecord | null,
  calculate: (tool: string, input: Record<string, unknown>) => unknown,
) {
  if (!original) throw new NotFoundError(`AlgorithmRun not found`);

  let replayedResult: unknown;
  try {
    replayedResult = calculate(original.toolName, original.inputJson);
  } catch (error) {
    throw new BadRequestError(
      `Tool replay failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    original: {
      id: original.id,
      toolName: original.toolName,
      algorithmVersion: original.algorithmVersion,
      riskScore: original.riskScore,
      confidenceScore: original.confidenceScore,
      priceBandMid: original.priceBandMid,
      createdAt: original.createdAt,
    },
    replayed: replayedResult,
  };
}

const baseRun: RunRecord = {
  id: "run-1",
  tenantId: "t1",
  userId: "u1",
  jobId: null,
  buildOpsProjectId: null,
  toolName: "electrical",
  algorithmVersion: "v1.0.0",
  inputJson: { sqft: 1000 },
  riskScore: 30,
  confidenceScore: 80,
  priceBandMid: "1500",
  createdAt: new Date("2026-01-01"),
};

const mockCalcResult = {
  toolId: "electrical",
  trade: "electrical",
  risk: { score: 28, level: "low" },
  costs: { low: 900, mid: 1400, high: 1900 },
  isValid: true,
};

test("algorithm-engine replay — returns original snapshot and new result", () => {
  const result = buildReplayResult(baseRun, () => mockCalcResult);
  assert.equal(result.original.id, "run-1");
  assert.equal(result.original.toolName, "electrical");
  assert.deepEqual(result.replayed, mockCalcResult);
});

test("algorithm-engine replay — throws NotFoundError when run is null", () => {
  assert.throws(
    () => buildReplayResult(null, () => mockCalcResult),
    (err: Error) => err.name === "NotFoundException",
  );
});

test("algorithm-engine replay — wraps calculation errors in BadRequestError", () => {
  assert.throws(
    () => buildReplayResult(baseRun, () => { throw new Error("invalid input schema"); }),
    (err: Error) => err.name === "BadRequestException" && err.message.includes("invalid input schema"),
  );
});

test("algorithm-engine replay — original snapshot has correct shape", () => {
  const result = buildReplayResult(baseRun, () => mockCalcResult);
  const keys = Object.keys(result.original).sort();
  assert.deepEqual(keys, ["algorithmVersion", "confidenceScore", "createdAt", "id", "priceBandMid", "riskScore", "toolName"]);
});

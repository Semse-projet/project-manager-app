import test from "node:test";
import assert from "node:assert/strict";

import {
  executeSpecializedWorkerRun,
  shouldUseSpecializedWorkerHandler,
} from "../../apps/worker/src/agent-run-handlers.mjs";

const logger = {
  info() {},
  warn() {},
};

async function requestJson(path) {
  if (path === "/v1/jobs/job-1") {
    return {
      data: {
        id: "job-1",
        title: "Kitchen electrical repair",
        scope: "Replace panel breakers, inspect wiring, document before and after conditions, and prepare closeout notes for approval.",
        category: "electrical",
        budgetMin: 1200,
        budgetMax: 2400,
        urgency: "normal",
      },
    };
  }
  if (path === "/v1/projects/proj-1") {
    return { data: { id: "proj-1", jobId: "job-1", title: "Kitchen repair" } };
  }
  if (path === "/v1/projects/proj-1/milestones") {
    return {
      data: [
        { id: "ms-1", title: "Inspection", status: "submitted", evidenceCount: 2, amount: 800 },
        { id: "ms-2", title: "Closeout", status: "planned", amount: 1000 },
      ],
    };
  }
  if (path === "/v1/projects/proj-1/evidence") {
    return {
      data: [
        { id: "ev-1", kind: "photo", title: "before panel" },
        { id: "ev-2", kind: "photo", title: "after panel" },
        { id: "ev-3", kind: "document", title: "permit note" },
      ],
    };
  }
  if (path === "/v1/milestones/ms-1/evidence-items" || path === "/v1/milestones/ms-only/evidence-items") {
    return {
      data: [
        { id: "item-1", kind: "photo", title: "before" },
        { id: "item-2", kind: "photo", title: "after" },
        { id: "item-3", kind: "document", title: "inspection note" },
      ],
    };
  }
  if (path === "/v1/milestones/ms-1/vision-summary" || path === "/v1/milestones/ms-only/vision-summary") {
    return { data: { overallVisionReady: true, hasBeforeAfterPair: true } };
  }
  if (path === "/v1/jobs/job-1/trust") {
    return { data: { score: 82, level: "good", flags: [] } };
  }
  if (path === "/v1/projects/proj-1/trust") {
    return { data: { score: 82 } };
  }
  if (path === "/v1/disputes?projectId=proj-1") {
    return { data: [] };
  }

  throw new Error(`unhandled ${path}`);
}

function makeRun(agentType, context = {}) {
  return {
    run: {
      id: `run-${agentType}`,
      agentType,
      input: {
        context: {
          projectId: "proj-1",
          jobId: "job-1",
          milestoneId: "ms-1",
          eventType: "job.created",
          ...context,
        },
      },
    },
    requestJson,
    tenantId: "tnt_demo",
    logger,
    workerId: "worker-test",
  };
}

test("worker specialized handlers register immediate AI executor wave", () => {
  for (const agentType of ["job-planner", "evidence-coach", "risk"]) {
    assert.equal(shouldUseSpecializedWorkerHandler(agentType), true);
  }
});

test("job-planner worker handler produces a plan from real job context", async () => {
  const result = await executeSpecializedWorkerRun(makeRun("job-planner"));

  assert.equal(result.actionType, "plan");
  assert.equal(result.result.jobId, "job-1");
  assert.equal(result.result.milestones.length, 2);
  assert.ok(result.result.estimatedDays >= 2);
  assert.equal(result.requiresHumanReview, false);
});

test("evidence-coach worker handler scores project and milestone evidence", async () => {
  const result = await executeSpecializedWorkerRun(makeRun("evidence-coach"));

  assert.equal(result.actionType, "validate");
  assert.equal(result.result.approveRecommendation, true);
  assert.equal(result.result.evidenceCount, 3);
  assert.equal(result.result.qualityScore, 0.9);
  assert.equal(result.requiresHumanReview, false);
});

test("evidence-coach can run with milestone-only context", async () => {
  const result = await executeSpecializedWorkerRun(
    makeRun("evidence-coach", { projectId: undefined, jobId: undefined, milestoneId: "ms-only" })
  );

  assert.equal(result.actionType, "validate");
  assert.equal(result.result.milestoneId, "ms-only");
  assert.equal(result.result.approveRecommendation, true);
});

test("risk worker handler classifies low-risk job with sufficient context", async () => {
  const result = await executeSpecializedWorkerRun(makeRun("risk"));

  assert.equal(result.actionType, "classify");
  assert.equal(result.result.riskLevel, "low");
  assert.deepEqual(result.result.flags, []);
  assert.equal(result.requiresHumanReview, false);
});

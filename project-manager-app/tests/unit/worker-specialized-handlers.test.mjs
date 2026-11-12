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
  if (path === "/v1/projects?jobId=job-1") {
    return { data: [{ id: "proj-1", jobId: "job-1" }] };
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

// #1147 — Runs creados por AgentTriggerRouter (triggerType "event") no traen
// `input.context`: los IDs viven en `input.eventPayload` (ver
// apps/api/src/modules/domain-events/agent-trigger-router.service.ts). Estos
// fixtures reproducen esa forma exacta del productor real.
function makeEventRun(agentType, eventType, eventPayload, tenantId = "tnt_demo") {
  const calls = [];
  return {
    calls,
    input: {
      run: {
        id: `run-event-${agentType}`,
        agentType,
        triggerType: "event",
        input: {
          eventType,
          eventMeta: { tenantId, correlationId: `job:job-1:created` },
          eventPayload,
        },
      },
      requestJson: async (path, init, options) => {
        calls.push({ path, tenantId: options?.tenantId });
        return requestJson(path, init, options);
      },
      tenantId,
      logger,
      workerId: "worker-test",
    },
  };
}

test("pricing event run (job.created) resolves jobId from eventPayload", async () => {
  const { input, calls } = makeEventRun("pricing", "job.created", { jobId: "job-1", title: "Kitchen electrical repair" });
  const result = await executeSpecializedWorkerRun(input);

  assert.equal(result.result.jobId, "job-1");
  assert.ok(calls.every((call) => call.tenantId === "tnt_demo"), "every lookup must stay scoped to the run tenant");
});

test("risk event run (job.created) resolves jobId from eventPayload", async () => {
  const { input } = makeEventRun("risk", "job.created", { jobId: "job-1" });
  const result = await executeSpecializedWorkerRun(input);

  assert.equal(result.actionType, "classify");
  assert.equal(result.result.jobId, "job-1");
});

test("explicit input.context takes precedence over eventPayload identifiers", async () => {
  const { input } = makeEventRun("pricing", "job.created", { jobId: "job-from-event" });
  input.run.input.context = { jobId: "job-1" };
  const result = await executeSpecializedWorkerRun(input);

  assert.equal(result.result.jobId, "job-1");
});

test("event run without identifiers still fails closed (no invented projectId/jobId)", async () => {
  const { input, calls } = makeEventRun("pricing", "job.created", { title: "no ids here" });

  await assert.rejects(
    () => executeSpecializedWorkerRun(input),
    /Delegated run requires at least projectId or jobId in its context\./,
  );
  assert.equal(calls.length, 0, "must not query projects/jobs to guess ownership");
});

test("manual run without context keeps failing deliberately (observability probe)", async () => {
  await assert.rejects(
    () => executeSpecializedWorkerRun({
      run: { id: "run-probe", agentType: "pricing", triggerType: "manual", input: {} },
      requestJson, tenantId: "tnt_demo", logger, workerId: "worker-test",
    }),
    /Delegated run requires at least projectId or jobId in its context\./,
  );
});

test("non-string eventPayload identifiers are ignored", async () => {
  const { input } = makeEventRun("pricing", "job.created", { jobId: { $ne: null } });

  await assert.rejects(
    () => executeSpecializedWorkerRun(input),
    /Delegated run requires at least projectId or jobId/,
  );
});

 
// Security regression: an optional read returning HTTP 401/403 is not an empty
// trust, disputes or evidence snapshot. A run must not report a risk decision
// built from partial unauthorized inputs.
test("risk fails closed when optional trust read is denied (403)", async () => {
  const input = makeRun("risk");
  input.requestJson = async (path, ...args) => {
    if (path === "/v1/jobs/job-1/trust") {
      throw new Error("HTTP 403 /v1/jobs/job-1/trust: forbidden");
    }
    return requestJson(path, ...args);
  };

  await assert.rejects(
    () => executeSpecializedWorkerRun(input),
    /HTTP 403 \/v1\/jobs\/job-1\/trust/,
  );
});

test("evidence-coach fails closed when optional evidence lookup is unauthorized (401)", async () => {
  const input = makeRun("evidence-coach");
  input.requestJson = async (path, ...args) => {
    if (path === "/v1/milestones/ms-1/evidence-items") {
      throw new Error("HTTP 401 /v1/milestones/ms-1/evidence-items: unauthorized");
    }
    return requestJson(path, ...args);
  };

  await assert.rejects(
    () => executeSpecializedWorkerRun(input),
    /HTTP 401 \/v1\/milestones\/ms-1\/evidence-items/,
  );
});

test("risk still tolerates a missing optional trust snapshot (404)", async () => {
  const input = makeRun("risk");
  input.requestJson = async (path, ...args) => {
    if (path === "/v1/jobs/job-1/trust") {
      throw new Error("HTTP 404 /v1/jobs/job-1/trust: not found");
    }
    return requestJson(path, ...args);
  };

  const result = await executeSpecializedWorkerRun(input);
  assert.equal(result.actionType, "classify");
  assert.equal(result.result.jobId, "job-1");
  assert.equal(result.result.trustScore, null);
});

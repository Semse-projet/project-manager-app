import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { PrometeoAgent } from "../dist/modules/semse-agents/prometeo.agent.js";
import { BuildOpsIntelligenceAgent } from "../dist/modules/operational-intelligence/buildops-intelligence.agent.js";

function prohibitedRag() {
  let calls = 0;
  return {
    rag: { async retrieveContext() { calls++; throw new Error("UNAUTHORIZED_RAG_CALL"); } },
    calls: () => calls,
  };
}

test("Prometeo CONTEXT_REQUESTED ignores forged bus actor/scope and refuses private RAG", async () => {
  const rag = prohibitedRag();
  const dispatched: Array<Record<string, unknown>> = [];
  const bus = {
    register() {},
    makeMessage(input: Record<string, unknown>) { return input; },
    dispatch(input: Record<string, unknown>) { dispatched.push(input); },
  };
  const svc = new PrometeoAgent(bus as never, {} as never, rag.rag as never);
  await svc.handleMessage({
    from: "buildops", to: "prometeo", event: "CONTEXT_REQUESTED", projectId: "project-A",
    timestamp: new Date(), correlationId: "corr-A",
    payload: {
      query: "wiring inspection", tenantId: "tenant-A",
      userId: "forged-admin", orgId: "org-B",
      scope: null, roles: ["OPS_ADMIN"],
    },
  } as never);
  assert.equal(rag.calls(), 0);
  assert.equal(dispatched.length, 1);
  const result = (dispatched[0].payload as { narrative: Record<string, unknown> }).narrative;
  assert.equal(result.ragDiagnostic, "RAG_SCOPE_UNAVAILABLE");
  assert.equal(result.fromRAG, false);
  assert.deepEqual(result.citations, []);
  assert.ok(!JSON.stringify(result).includes("UNAUTHORIZED_RAG_CALL"));
});

test("Prometeo without RAG service reports service-unavailable, never fabricated citations", async () => {
  const bus = { register() {} };
  const svc = new PrometeoAgent(bus as never, {} as never);
  const result = await svc.generateNarrative("status", "project-A", "tenant-A");
  assert.equal(result.ragDiagnostic, "RAG_SERVICE_UNAVAILABLE");
  assert.deepEqual(result.citations, []);
});

test("BuildOps milestone rules complete with RAG_SCOPE_UNAVAILABLE and no private retrieval", async () => {
  const rag = prohibitedRag();
  const decisions: Array<Record<string, unknown>> = [];
  const prisma = {
    milestone: { async findFirst() {
      return {
        id: "milestone-A", status: "submitted", title: "Electrical",
        paymentReadiness: "not_ready", evidenceReadiness: "missing",
        evidenceItems: [{ id: "evidence-A", status: "missing", label: "Panel picture" }],
      };
    } },
    changeOrderCandidate: { async count() { return 0; } },
  };
  const signals = { async upsertSignal() { return { created: true }; } };
  const runs = { async record(input: Record<string, unknown>) { decisions.push(input); } };
  const svc = new BuildOpsIntelligenceAgent(prisma as never, signals as never, runs as never, undefined, rag.rag as never);
  await svc.evaluateMilestone({ tenantId: "tenant-A", milestoneId: "milestone-A", triggerEvent: "EVIDENCE_UPLOADED" });
  assert.equal(rag.calls(), 0);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].status, "completed");
  const decision = decisions[0].decisionJson as Record<string, unknown>;
  assert.equal(decision.ragDiagnostic, "RAG_SCOPE_UNAVAILABLE");
  assert.equal(decision.ragProvider, null);
  assert.deepEqual(decision.ragSources, []);
  assert.ok((decision.signalsCreated as string[]).includes("EVIDENCE_GAP"));
  assert.ok(!JSON.stringify(decisions[0]).includes("UNAUTHORIZED_RAG_CALL"));
});

test("BuildOps project rules preserve signals while refusing unverified RAG even with forged jobId", async () => {
  const rag = prohibitedRag();
  const decisions: Array<Record<string, unknown>> = [];
  const prisma = {
    buildOpsProject: { async findUnique() {
      return {
        id: "buildops-A", tenantId: "tenant-A", jobId: "job-A", riskLevel: "low",
        riskScore: 0.2, status: "active",
        sourceToolResult: { missingInputs: ["materials"] },
      };
    } },
  };
  const signals = { async upsertSignal() { return { created: true }; } };
  const runs = { async record(input: Record<string, unknown>) { decisions.push(input); } };
  const svc = new BuildOpsIntelligenceAgent(prisma as never, signals as never, runs as never, undefined, rag.rag as never);
  await svc.evaluateBuildOpsProject({
    tenantId: "tenant-A", buildOpsProjectId: "buildops-A",
    jobId: "forged-job-B", triggerEvent: "PROJECT_PLANNED",
  });
  assert.equal(rag.calls(), 0);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].status, "completed");
  const decision = decisions[0].decisionJson as Record<string, unknown>;
  assert.equal(decision.ragDiagnostic, "RAG_SCOPE_UNAVAILABLE");
  assert.deepEqual(decision.ragSources, []);
  assert.ok((decision.signalsCreated as string[]).includes("LOW_CONFIDENCE_ESTIMATE"));
});

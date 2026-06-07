import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAgentPolicy,
  executeGovernedAgentRun,
  getRuntimeAgentManifest
} from "@semse/agents";

test("pricing agent denies tools outside its capability manifest", () => {
  const result = evaluateAgentPolicy({
    agentType: "pricing",
    actionType: "event.emit",
    toolName: "event.emit.domain",
    target: "runtime",
    targetKind: "runtime",
    requestedContextSources: ["job"],
    environment: "worker"
  });

  assert.equal(result.decision, "deny");
  assert.ok(result.violatedPolicies.includes("capability.tool_not_allowed"));
});

test("dispute agent execution opens approval request and preserves reasoning", () => {
  const result = executeGovernedAgentRun({
    agentType: "dispute",
    runId: "run_dispute_test",
    correlationId: "corr_dispute_test",
    payload: {
      reason: "client reports incomplete evidence and missed deadline",
      severity: "high"
    },
    environment: "worker"
  });

  assert.equal(result.policy.decision, "allow");
  assert.equal(result.approvalRequests.length, 1);
  assert.equal(result.payload.favoredParty, "client");
  assert.match(String(result.payload.reasoning), /incomplete evidence/i);
});

test("pricing execution stays within medium risk manifest and produces tool trace", () => {
  const manifest = getRuntimeAgentManifest("pricing");
  const result = executeGovernedAgentRun({
    agentType: "pricing",
    runId: "run_pricing_test",
    correlationId: "corr_pricing_test",
    payload: {
      title: "Split unit install",
      scope: "install split unit and electrical adjustments",
      budgetCents: 125000
    },
    environment: "worker"
  });

  assert.equal(manifest.capabilities.maxRiskLevel, "high");
  assert.equal(result.policy.decision, "allow");
  assert.ok(result.toolDecisions.length > 0);
  assert.equal(result.payload.policyDecision, "allow");
});

import test from "node:test";
import assert from "node:assert/strict";
import { AgentPolicyService } from "../dist/modules/agents/agent-policy.service.js";

const service = new AgentPolicyService();

const approvedPlan = {
  id: "plan_1",
  title: "Plan aprobado",
  goal: "Liberar fondos dentro de un plan controlado.",
  rationale: "Existe evidencia y aprobación humana.",
  status: "approved" as const,
  steps: [],
  risks: [],
  requiredEvidence: [],
  successCriteria: [],
  createdAt: new Date().toISOString(),
};

test("high-risk action without approved plan is blocked", () => {
  const result = service.checkActionAllowed({
    actionType: "PROPOSE_ESCROW_RELEASE",
    riskLevel: "high",
    activePlan: null,
  });

  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.requiresPlan, true);
    assert.match(result.reason, /plan/i);
  }
});

test("high-risk action with approved plan passes", () => {
  const result = service.checkActionAllowed({
    actionType: "PROPOSE_ESCROW_RELEASE",
    riskLevel: "high",
    activePlan: approvedPlan,
  });

  assert.deepEqual(result, { allowed: true });
});

test("low-risk draft_message passes without plan", () => {
  const result = service.checkActionAllowed({
    actionType: "DRAFT_MESSAGE",
    riskLevel: "low",
    activePlan: null,
  });

  assert.deepEqual(result, { allowed: true });
});

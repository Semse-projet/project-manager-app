import test from "node:test";
import assert from "node:assert/strict";
import { PlanToolPolicyService } from "../dist/modules/agents/plan-tool-policy.service.js";

const service = new PlanToolPolicyService();

function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    capability: "searching",
    toolsAllowed: ["search_patterns", "read_file", "list_directory"],
    requiresApprovedPlan: false,
    requiredEvidence: [],
    evidenceStatus: "satisfied",
    riskLevel: "low",
    status: "ready",
    ...overrides,
  } as const;
}

test("searching allows read_file/list_directory/search_patterns", () => {
  assert.equal(service.canCapabilityUseTool("searching", "read_file"), true);
  assert.equal(service.canCapabilityUseTool("searching", "list_directory"), true);
  assert.equal(service.canCapabilityUseTool("searching", "search_patterns"), true);
});

test("searching blocks dispute_open", () => {
  const result = service.validateToolExecution({
    step: makeStep(),
    toolName: "propose_dispute_open",
    planApproved: false,
  });

  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.match(result.reason, /no está permitida/i);
  }
});

test("dispute requires approved plan", () => {
  const result = service.validateToolExecution({
    step: makeStep({
      capability: "dispute",
      toolsAllowed: ["propose_dispute_open"],
      requiresApprovedPlan: true,
      riskLevel: "high",
    }),
    toolName: "propose_dispute_open",
    planApproved: false,
  });

  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.match(result.reason, /plan aprobado/i);
  }
});

test("editing requires step ready or executing", () => {
  const result = service.validateToolExecution({
    step: makeStep({
      capability: "editing",
      toolsAllowed: ["edit_file", "apply_patch"],
      status: "pending",
      riskLevel: "medium",
    }),
    toolName: "edit_file",
    planApproved: true,
  });

  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.match(result.reason, /ready\/executing/i);
  }
});

test("shelling requires step ready", () => {
  const result = service.validateToolExecution({
    step: makeStep({
      capability: "shelling",
      toolsAllowed: ["run_command"],
      status: "blocked",
      riskLevel: "medium",
    }),
    toolName: "run_command",
    planApproved: true,
  });

  assert.equal(result.allowed, false);
});

test("waiting does not require approval", () => {
  const result = service.validateToolExecution({
    step: makeStep({
      capability: "waiting",
      toolsAllowed: ["wait_background_terminal"],
      status: "pending",
      requiresApprovedPlan: false,
      riskLevel: "low",
    }),
    toolName: "wait_background_terminal",
    planApproved: false,
  });

  assert.deepEqual(result, { allowed: true });
});

test("high-risk without approved plan is blocked", () => {
  const result = service.validateToolExecution({
    step: makeStep({
      capability: "worker",
      toolsAllowed: ["propose_escrow_release"],
      requiresApprovedPlan: true,
      riskLevel: "high",
    }),
    toolName: "propose_escrow_release",
    planApproved: false,
  });

  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.match(result.reason, /plan aprobado|high-risk/i);
  }
});

test("tool not permitted by capability is blocked", () => {
  const result = service.validateToolExecution({
    step: makeStep({
      capability: "composing",
      toolsAllowed: ["draft_message"],
      riskLevel: "low",
    }),
    toolName: "run_tests",
    planApproved: true,
  });

  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.match(result.reason, /no está permitida/i);
  }
});

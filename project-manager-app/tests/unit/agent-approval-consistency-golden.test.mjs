// Golden Approval Consistency Scenario (Agents Governance Reconciliation).
//
// The "forge" role is the one real case in this codebase where a single
// governed run is gated by TWO policy engines in sequence for the same
// request: the generic, manifest-based evaluateAgentPolicy (governance.ts)
// runs first; if it allows, execution proceeds into buildForge, which runs
// the file/branch/spec-aware evaluateForgePolicy (packages/forge) as a
// second, more specific gate.
//
// The invariant this test locks in: the SAME actor/task, varying only the
// dimension the specific (Forge) gate cares about (target branch), must
// never let the stricter gate's decision get silently discarded by the
// more permissive one. Concretely: requiresHumanReview at the top level of
// executeGovernedAgentRun's result must reflect the logical OR of both
// gates' restrictiveness — never just the generic gate's.
//
// A real, subtle finding this test also documents: the top-level
// `result.policy.decision` field alone reflects ONLY the generic gate — it
// is NOT safe to treat "policy.decision === 'allow'" as "no approval
// needed" for forge runs. `result.requiresHumanReview` is the field that
// correctly combines both gates and is the one callers must check.
import test from "node:test";
import assert from "node:assert/strict";
import { executeGovernedAgentRun } from "../../packages/agents/dist/index.js";

const approvedSpec = {
  id: "golden-forge-spec",
  path: "docs/specs/forge/golden.spec.md",
  digest: "golden123",
  status: "APPROVED",
};

function forgeTask(overrides = {}) {
  return {
    id: "golden-task-1",
    title: "Golden scenario task",
    spec: approvedSpec,
    requestedRole: "documentation-curator",
    riskLevel: "low",
    objective: "Prove approval consistency across the two forge gates",
    allowedFiles: ["docs/specs/forge/**"],
    forbiddenFiles: ["packages/db/**", ".env*"],
    allowedCommands: ["git status"],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/golden-scenario",
    environment: "sandbox",
    metadata: {},
    ...overrides,
  };
}

function runForge(task) {
  return executeGovernedAgentRun({
    agentType: "forge",
    runId: `run_${task.targetBranch}`,
    correlationId: `corr_${task.targetBranch}`,
    payload: {
      forgeRunId: "golden-forge-run",
      taskId: task.id,
      task,
      operatorContext: {
        source: "forge",
        operatorId: "user-golden",
        tenantId: "tenant-golden",
        orgId: "org-golden",
        roles: ["OPS_ADMIN"],
        scope: "task",
        runId: "golden-forge-run",
        taskId: task.id,
      },
      environment: "sandbox",
    },
    environment: "worker",
  });
}

test("golden scenario: same actor/task, branch-only difference — the specific (Forge) gate's stricter decision is never silently overridden", () => {
  const lowRisk = runForge(forgeTask({ targetBranch: "agent/golden-scenario" }));
  const targetingMain = runForge(forgeTask({ targetBranch: "main" }));

  // The generic, manifest-based gate (governance.ts) does not know about
  // branch targets at all — it allows both requests identically.
  assert.equal(lowRisk.policy.decision, "allow");
  assert.equal(targetingMain.policy.decision, "allow");

  // The Forge-specific gate (packages/forge/src/policy.ts), nested in
  // payload.policy, is what actually differs — and it must not be lost.
  assert.equal(lowRisk.payload.policy.decision, "allow");
  assert.equal(targetingMain.payload.policy.decision, "deny");

  // The consistency invariant: requiresHumanReview at the TOP level must
  // reflect the stricter (Forge-specific) gate, not just the generic one —
  // this is what a caller actually gates real approval-request behavior on.
  assert.equal(lowRisk.requiresHumanReview, false);
  assert.equal(
    targetingMain.requiresHumanReview,
    true,
    "a main-branch-targeting task must require human review even though the generic agent policy alone would allow it — " +
      "checking result.policy.decision in isolation would have missed this",
  );
});

test("golden scenario: the same inconsistency-risk pattern holds for a require_approval-tier Forge decision, not just deny", () => {
  const deploymentTask = forgeTask({
    requestedRole: "devops-release",
    environment: "staging",
    targetBranch: "main",
    riskLevel: "medium",
    allowedFiles: ["infra/**", ".github/**"],
  });
  const result = executeGovernedAgentRun({
    agentType: "forge",
    runId: "run_deployment_golden",
    correlationId: "corr_deployment_golden",
    payload: {
      forgeRunId: "golden-forge-run-2",
      taskId: deploymentTask.id,
      task: deploymentTask,
      action: "deployment.propose",
      operatorContext: {
        source: "forge",
        operatorId: "user-golden",
        tenantId: "tenant-golden",
        orgId: "org-golden",
        roles: ["OPS_ADMIN"],
        scope: "task",
        runId: "golden-forge-run-2",
        taskId: deploymentTask.id,
      },
      environment: "sandbox",
    },
    environment: "worker",
  });

  assert.equal(result.policy.decision, "allow", "the generic gate still allows a medium-risk deployment task");
  assert.equal(result.payload.policy.decision, "require_approval", "the Forge-specific gate flags deployment.propose as require_approval");
  assert.equal(result.requiresHumanReview, true, "require_approval from the specific gate must also surface as requiresHumanReview at the top level");
});

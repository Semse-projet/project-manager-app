/**
 * SPEC-AGT-001 (bloque AGT-001-E) — tests del Verification Loop.
 * Cubre los criterios de aceptación 1-4 del spec:
 *   1. run de escritura sin successCriteria → deny con razón trazable
 *   2. fail→pass → verified con 2 attempts y ≥2 eventos agent.verify
 *   3. budget agotado → exhausted + requiresHumanReview + approval abierto
 *   4. delegado explore que pide tool de escritura → deny
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  executeGovernedAgentRun,
} from "../../packages/agents/src/runtime.ts";
import "../../packages/agents/src/registrations.ts";
import {
  registerVerifierImpl,
  resetVerifierImpls,
  runVerifier,
} from "../../packages/agents/src/verifiers.ts";
import {
  HARD_MAX_ITERATIONS,
  MISSING_VERIFICATION_BUDGET_REASON,
  clampVerificationBudget,
  createDefaultVerificationBudget,
  isWriteActionType,
} from "../../packages/agents/src/verification.ts";
import { delegateTo, delegateAll, deriveDelegateBudget } from "../../packages/agents/src/delegate.ts";
import {
  verificationBudgetSchema,
  verificationReportSchema,
} from "../../packages/schemas/src/agent-verification.schema.ts";

const RUN_BASE = {
  agentType: "job-planner" as const,
  runId: "run_test_verification",
  correlationId: "corr_test_verification",
  payload: { title: "Test job", scope: "Refactor helper module and keep tests green." },
  environment: "test" as const,
};

function writeRun(extra: Partial<Parameters<typeof executeGovernedAgentRun>[0]> = {}) {
  return executeGovernedAgentRun({
    ...RUN_BASE,
    actionType: "code.write",
    ...extra,
  });
}

// ── Criterio 1: escritura sin budget → deny ──────────────────────────────────

test("write run without verification budget is denied with traceable reason", () => {
  const result = writeRun();

  assert.equal(result.policy.decision, "deny");
  assert.equal(result.policy.reason, MISSING_VERIFICATION_BUDGET_REASON);
  assert.ok(result.policy.violatedPolicies.includes("verification.budget_missing"));
  assert.ok(result.auditTrail.some((e) => e.type === "agent.policy.deny"));
  assert.equal(result.verification, undefined);
});

test("write run with empty successCriteria is denied", () => {
  const result = writeRun({
    verification: { maxIterations: 3, successCriteria: [] },
  });
  assert.equal(result.policy.decision, "deny");
  assert.equal(result.policy.reason, MISSING_VERIFICATION_BUDGET_REASON);
});

test("read run without budget is NOT denied (loop does not apply)", () => {
  const result = executeGovernedAgentRun(RUN_BASE);
  assert.notEqual(result.policy.decision, "deny");
  assert.equal(result.verification, undefined);
});

// ── Criterio 2: fail → pass → verified ───────────────────────────────────────

test("run whose first verify fails and second passes ends verified with 2 attempts", () => {
  resetVerifierImpls();
  let calls = 0;
  registerVerifierImpl("verify.custom", () => {
    calls += 1;
    return calls === 1
      ? { status: "fail", evidence: "1 test failed: expected 2 to equal 3" }
      : { status: "pass" };
  });

  try {
    const result = writeRun({
      verification: { maxIterations: 3, successCriteria: ["verify.custom"] },
    });

    assert.ok(result.verification, "verification report expected");
    assert.equal(result.verification.finalStatus, "verified");
    assert.equal(result.verification.attempts.length, 2);
    assert.equal(result.verification.iterationsUsed, 2);

    const verifyEvents = result.auditTrail.filter((e) => e.type === "agent.verify");
    assert.ok(verifyEvents.length >= 2, `expected ≥2 agent.verify events, got ${verifyEvents.length}`);
    assert.ok(result.auditTrail.some((e) => e.type === "agent.fix.attempt"));
  } finally {
    resetVerifierImpls();
  }
});

// ── Criterio 3: budget agotado → exhausted + approval ────────────────────────

test("run exhausting maxIterations ends exhausted, escalates risk and opens approval", () => {
  resetVerifierImpls();
  registerVerifierImpl("verify.custom", () => ({ status: "fail", evidence: "still broken" }));

  try {
    const result = writeRun({
      verification: { maxIterations: 2, successCriteria: ["verify.custom"] },
    });

    assert.ok(result.verification);
    assert.equal(result.verification.finalStatus, "exhausted");
    assert.equal(result.verification.iterationsUsed, 2);
    assert.equal(result.requiresHumanReview, true);
    assert.ok(result.approvalRequests.length >= 1, "an approval request must be opened");
    assert.ok(result.approvalRequests[0].contextSummary?.includes("verification exhausted"));
    assert.ok(["medium", "high", "critical"].includes(result.risk.riskLevel), "risk never below medium on exhaustion");
    assert.ok(result.risk.tags.includes("verification:exhausted"));
  } finally {
    resetVerifierImpls();
  }
});

test("verified run does not force human review beyond handler decision", () => {
  resetVerifierImpls();
  registerVerifierImpl("verify.custom", () => ({ status: "pass" }));

  try {
    const result = writeRun({
      verification: { maxIterations: 3, successCriteria: ["verify.custom"] },
    });
    assert.equal(result.verification?.finalStatus, "verified");
    assert.equal(result.verification?.attempts.length, 1);
  } finally {
    resetVerifierImpls();
  }
});

// ── Criterio 4: delegado explore no puede escribir ───────────────────────────

test("explore delegate requesting a write tool is denied", () => {
  const result = delegateTo("risk", {
    goal: "gather context",
    profile: "explore",
    restrictToolsTo: ["decision.classify_risk"],
  });

  assert.equal(result.blockedByPolicy, true);
  assert.equal(result.result.payload.reason, "EXPLORE_PROFILE_WRITE_TOOL");
  assert.deepEqual(result.result.payload.deniedTools, ["decision.classify_risk"]);
});

test("explore delegate with read tools proceeds with filtered envelope", () => {
  const result = delegateTo("risk", {
    goal: "gather context",
    profile: "explore",
  });

  assert.equal(result.blockedByPolicy, false);
  assert.equal(result.profile, "explore");
  // El envelope efectivo del explore solo contiene tools de lectura/verificación
  for (const tool of result.toolsUsed) {
    assert.ok(!tool.startsWith("decision.") && !tool.startsWith("event."), `write tool leaked: ${tool}`);
  }
});

test("general delegate receives ≤50% of the parent budget", () => {
  const parent = createDefaultVerificationBudget(["verify.unit_tests"]);
  const child = deriveDelegateBudget(parent);
  assert.ok(child.maxIterations <= Math.max(1, Math.floor(parent.maxIterations * 0.5)));
  assert.ok(child.maxIterations >= 1);
});

test("delegateAll processes in batches of at most MAX_CONCURRENT_DELEGATES", () => {
  const batches: number[] = [];
  const tasks = Array.from({ length: 9 }, (_, i) => ({
    role: "risk" as const,
    options: { goal: `task ${i}` },
  }));

  const results = delegateAll(tasks, (batchSize) => batches.push(batchSize));

  assert.equal(results.length, 9);
  assert.deepEqual(batches, [4, 4, 1]);
  assert.ok(batches.every((size) => size <= 4));
});

// ── Contratos: clamp, write detection, Zod ───────────────────────────────────

test("clampVerificationBudget enforces the hard iteration ceiling", () => {
  const clamped = clampVerificationBudget({ maxIterations: 99, successCriteria: ["verify.build"] });
  assert.equal(clamped.maxIterations, HARD_MAX_ITERATIONS);
  assert.equal(clampVerificationBudget({ maxIterations: 0, successCriteria: ["verify.build"] }).maxIterations, 1);
});

test("isWriteActionType detects declared and suffixed write actions", () => {
  assert.equal(isWriteActionType("code.write"), true);
  assert.equal(isWriteActionType("anything.write"), true);
  assert.equal(isWriteActionType("recommend"), false);
  assert.equal(isWriteActionType("runtime.execute"), false);
});

test("zod mirror validates budgets and rejects P2 violations", () => {
  assert.ok(verificationBudgetSchema.safeParse({ maxIterations: 3, successCriteria: ["verify.build"] }).success);
  // sin criterios → inválido (P2)
  assert.equal(verificationBudgetSchema.safeParse({ maxIterations: 3, successCriteria: [] }).success, false);
  // por encima del techo duro → inválido
  assert.equal(verificationBudgetSchema.safeParse({ maxIterations: 6, successCriteria: ["verify.build"] }).success, false);
});

test("zod mirror validates a full verification report", () => {
  const report = {
    budget: { maxIterations: 3, successCriteria: ["verify.custom"] },
    attempts: [
      { iteration: 1, verifier: "verify.custom", status: "fail", durationMs: 12, evidence: "boom" },
      { iteration: 2, verifier: "verify.custom", status: "pass", durationMs: 8 },
    ],
    finalStatus: "verified",
    iterationsUsed: 2,
  };
  assert.ok(verificationReportSchema.safeParse(report).success);
});

test("verify.custom without registered impl reports skipped, never pass", () => {
  resetVerifierImpls();
  const attempt = runVerifier("verify.custom", 1, { repoPath: process.cwd() });
  assert.equal(attempt.status, "skipped");
  assert.ok(attempt.evidence?.includes("no registered implementation"));
});

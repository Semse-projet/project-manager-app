import test from "node:test";
import assert from "node:assert/strict";
import {
  DECISION_INVARIANTS,
  STRUCTURAL_INVARIANTS,
  evaluateInvariants,
} from "../dist/modules/ai-models/decision/decision-invariants.js";
import { DecisionLayerService } from "../dist/modules/ai-models/decision/decision-layer.service.js";
import { resolveDecisionLayerConfig } from "../dist/modules/ai-models/decision/decision-flags.js";
import { DecisionProviderError } from "../dist/modules/ai-models/decision/jev.provider.js";

// Invariant registry — one test per invariant (handoff §54).
// Spec: docs/specs/prometeo/jev-decision-layer.spec.md §9.3.

const escalate = { action: "ESCALATE", confidence: 1, reasonCode: "DETERMINISTIC" };
const askUser = { action: "ASK_USER", confidence: 0.9, reasonCode: "JEV" };
const prometeo = { action: "PROMETEO", confidence: 0.99, reasonCode: "JEV" };

function violated(signals: Record<string, boolean>, proposed = prometeo, deterministic = escalate, feature = "agent_router") {
  return evaluateInvariants({ feature, deterministic, proposed, riskSignals: signals } as any);
}

test("registry is complete", () => {
  assert.deepEqual(
    [...DECISION_INVARIANTS.map((i: any) => i.id), ...STRUCTURAL_INVARIANTS],
    [
      "MONEY_NO_DOWNGRADE",
      "PERMISSION_DENIAL_NO_DOWNGRADE",
      "IDENTITY_FAILURE_NO_DOWNGRADE",
      "LEGAL_COMPLIANCE_NO_DOWNGRADE",
      "SAFETY_CRITICAL_NO_DOWNGRADE",
      "IRREVERSIBLE_REQUIRES_DETERMINISTIC_AUTH",
      "LOW_CONFIDENCE_NOT_CERTAINTY",
      "PROVIDER_FAILURE_FALLS_BACK",
    ],
  );
});

for (const [id, signal] of [
  ["MONEY_NO_DOWNGRADE", "money"],
  ["PERMISSION_DENIAL_NO_DOWNGRADE", "permissionDenied"],
  ["IDENTITY_FAILURE_NO_DOWNGRADE", "identityFailure"],
  ["LEGAL_COMPLIANCE_NO_DOWNGRADE", "legalCompliance"],
  ["SAFETY_CRITICAL_NO_DOWNGRADE", "safetyCritical"],
] as const) {
  test(`${id}: Jev can't make a cautious decision less cautious`, () => {
    assert.deepEqual(violated({ [signal]: true }, prometeo), [id], "ESCALATE → PROMETEO is a downgrade");
    assert.deepEqual(violated({ [signal]: true }, askUser), [id], "ESCALATE → ASK_USER is still a downgrade");
    assert.deepEqual(violated({ [signal]: true }, escalate), [], "keeping ESCALATE is fine");
    assert.deepEqual(violated({ [signal]: true }, escalate, askUser), [], "raising caution is fine");
    assert.deepEqual(violated({}, prometeo), [], "without the signal the invariant doesn't apply");
  });
}

test("IRREVERSIBLE_REQUIRES_DETERMINISTIC_AUTH: only the deterministic decision may stand", () => {
  assert.deepEqual(violated({ irreversible: true }, escalate, askUser), ["IRREVERSIBLE_REQUIRES_DETERMINISTIC_AUTH"], "even a more cautious change is refused");
  assert.deepEqual(violated({ irreversible: true }, escalate, escalate), []);
});

test("LOW_CONFIDENCE_NOT_CERTAINTY: low-confidence input can't become ACCEPT_RESULT", () => {
  const accept = { action: "ACCEPT_RESULT", confidence: 0.99, reasonCode: "JEV" };
  const showAlts = { action: "SHOW_ALTERNATIVES", confidence: 1, reasonCode: "DET" };
  assert.deepEqual(violated({ lowConfidence: true }, accept, showAlts, "vision_gate"), ["LOW_CONFIDENCE_NOT_CERTAINTY"]);
  assert.deepEqual(violated({ lowConfidence: true }, { ...accept, action: "RETRY_SCAN" }, showAlts, "vision_gate"), []);
  assert.deepEqual(violated({}, accept, showAlts, "vision_gate"), []);
});

test("PROVIDER_FAILURE_FALLS_BACK: every provider failure returns the deterministic decision", async () => {
  const env = { SEMSE_JEV_ENABLED: "true", SEMSE_JEV_AGENT_ROUTER_ENABLED: "true", SEMSE_JEV_AGENT_ROUTER_MODE: "live" };
  for (const error of [
    new DecisionProviderError("unavailable", "x"),
    new DecisionProviderError("timeout", "x"),
    new DecisionProviderError("provider_error", "x"),
    new Error("unexpected"),
  ]) {
    const service = new DecisionLayerService(
      { name: "jev", async decide() { throw error; } } as any,
      { async record() { return null; }, async recordOutcome() {} } as any,
      () => resolveDecisionLayerConfig(env),
    );
    const outcome = await service.decide({ feature: "agent_router", actor: { tenantId: "t" }, context: {}, deterministicDecision: escalate as any });
    assert.equal(outcome.action, "ESCALATE");
    assert.equal(outcome.source, "deterministic");
  }
});

test("the core applies the registry to every live decision (money case end to end)", async () => {
  const events: any[] = [];
  const service = new DecisionLayerService(
    { name: "jev", async decide() { return { raw: prometeo }; } } as any,
    { async record(e: any) { events.push(e); return "evt"; }, async recordOutcome() {} } as any,
    () => resolveDecisionLayerConfig({ SEMSE_JEV_ENABLED: "true", SEMSE_JEV_AGENT_ROUTER_ENABLED: "true", SEMSE_JEV_AGENT_ROUTER_MODE: "live" }),
  );
  const outcome = await service.decide({
    feature: "agent_router",
    actor: { tenantId: "t" },
    context: {},
    deterministicDecision: escalate as any,
    riskSignals: { money: true },
  });
  assert.equal(outcome.action, "ESCALATE");
  assert.equal(outcome.fallbackReason, "invariant_violation");
  assert.deepEqual(outcome.invariantsViolated, ["MONEY_NO_DOWNGRADE"]);
  assert.deepEqual(events[0].invariantsViolated, ["MONEY_NO_DOWNGRADE"], "blocked unsafe downgrades are observable");
});

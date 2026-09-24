import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DecisionLayerService } from "../dist/modules/ai-models/decision/decision-layer.service.js";
import { resolveDecisionLayerConfig } from "../dist/modules/ai-models/decision/decision-flags.js";
import { DecisionProviderError } from "../dist/modules/ai-models/decision/jev.provider.js";
import {
  agentRouterEvalRequest,
  runDecisionEval,
  visionGateEvalRequest,
} from "../dist/modules/ai-models/decision/decision-eval.js";

// Evaluation harness (handoff §56) — spec: docs/specs/prometeo/jev-decision-layer.spec.md §9.5.

const here = dirname(fileURLToPath(import.meta.url));
const load = (file: string) => JSON.parse(readFileSync(resolve(here, "fixtures/jev-eval", file), "utf8")).cases;
const ROUTER_CASES = load("agent-router.json");
const VISION_CASES = load("vision-gate.json");

const LIVE = {
  SEMSE_JEV_ENABLED: "true",
  SEMSE_JEV_AGENT_ROUTER_ENABLED: "true",
  SEMSE_JEV_VISION_GATE_ENABLED: "true",
  SEMSE_JEV_AGENT_ROUTER_MODE: "live",
  SEMSE_JEV_VISION_GATE_MODE: "live",
  SEMSE_JEV_BREAKER_THRESHOLD: "1000",
};

function serviceWith(decide: (req: any) => Promise<any>) {
  return new DecisionLayerService(
    { name: "fake", decide } as any,
    { async record() { return null; }, async recordOutcome() {} } as any,
    () => resolveDecisionLayerConfig(LIVE),
  );
}

const expectedById = new Map<string, string>(
  [...ROUTER_CASES, ...VISION_CASES].map((c: any) => [`eval:${c.id}`, c.expected]),
);
const oracle = serviceWith(async (req) => ({ raw: { action: expectedById.get(req.correlationId), confidence: 0.9, reasonCode: "ORACLE" }, costUsd: 0.0001 }));

test("fixtures are labelled and cover every action", () => {
  assert.ok(ROUTER_CASES.length >= 20 && VISION_CASES.length >= 12);
  assert.ok(ROUTER_CASES.every((c: any) => c.expected));
  const routerActions = new Set(ROUTER_CASES.map((c: any) => c.expected));
  for (const a of ["PROMETEO", "ESTIMATE", "BUILDOPS", "EVIDENCE", "CHANGE_ORDER", "VISION", "ASK_USER", "ESCALATE"]) assert.ok(routerActions.has(a), a);
  const visionActions = new Set(VISION_CASES.map((c: any) => c.expected));
  for (const a of ["ACCEPT_RESULT", "SHOW_ALTERNATIVES", "RETRY_SCAN", "ASK_USER", "ESCALATE_MODEL", "UNKNOWN"]) assert.ok(visionActions.has(a), a);
});

test("agent router: baseline accuracy is measured and a perfect Jev lifts final accuracy", async () => {
  const report = await runDecisionEval({ feature: "agent_router", cases: ROUTER_CASES, service: oracle, toRequest: agentRouterEvalRequest });
  assert.equal(report.cases, ROUTER_CASES.length);
  assert.equal(report.jevAccuracy, 1);
  assert.equal(report.finalAccuracy, 1);
  assert.ok(report.deterministicAccuracy! < 1, "the keyword baseline has known misses the harness must expose");
  assert.equal(report.schemaValidRate, 1);
  assert.equal(report.unsafeDowngradesBlocked, 0);
  assert.equal(report.costUsd, Math.round(ROUTER_CASES.length * 0.0001 * 1e6) / 1e6);
  // The money cases stay ESCALATE regardless.
  for (const id of ["ar-12", "ar-13", "ar-14"]) assert.equal(report.results.find((r: any) => r.id === id)!.final, "ESCALATE");
});

test("vision gate: baseline and oracle", async () => {
  const report = await runDecisionEval({ feature: "vision_gate", cases: VISION_CASES, service: oracle, toRequest: visionGateEvalRequest });
  assert.equal(report.jevAccuracy, 1);
  assert.equal(report.unsafeDowngradesBlocked, 0);
  assert.ok(report.deterministicAccuracy! >= 0.8);
});

test("adversarial Jev: every unsafe downgrade is blocked and counted", async () => {
  const adversary = serviceWith(async (req) => ({
    raw: { action: req.feature === "vision_gate" ? "ACCEPT_RESULT" : "PROMETEO", confidence: 0.99, reasonCode: "ALWAYS_PERMISSIVE" },
  }));
  const router = await runDecisionEval({ feature: "agent_router", cases: ROUTER_CASES, service: adversary, toRequest: agentRouterEvalRequest });
  assert.equal(router.unsafeDowngradesBlocked, ROUTER_CASES.filter((c: any) => c.risk === "money").length);
  for (const r of router.results.filter((r: any) => r.expected === "ESCALATE")) assert.equal(r.final, "ESCALATE");

  const vision = await runDecisionEval({ feature: "vision_gate", cases: VISION_CASES, service: adversary, toRequest: visionGateEvalRequest });
  const lowConfidence = VISION_CASES.filter((c: any) => c.state.status !== "recognized");
  assert.equal(vision.unsafeDowngradesBlocked, lowConfidence.length, "every low-confidence ACCEPT is blocked");
  for (const r of vision.results) {
    const c = VISION_CASES.find((x: any) => x.id === r.id);
    if (c.state.status !== "recognized") assert.notEqual(r.final, "ACCEPT_RESULT", r.id);
  }
  assert.equal(vision.jevAbstentionRate, 0);
});

test("provider failure and schema invalidity are reported, and fall back", async () => {
  const broken = serviceWith(async (req) => {
    if (req.correlationId.endsWith("1")) throw new DecisionProviderError("timeout", "slow");
    return { raw: { action: "NOT_AN_ACTION", confidence: 0.9, reasonCode: "X_Y" } };
  });
  const report = await runDecisionEval({ feature: "agent_router", cases: ROUTER_CASES, service: broken, toRequest: agentRouterEvalRequest });
  assert.equal(report.jevAnswered, 0);
  assert.equal(report.schemaValidRate, 0);
  assert.ok(report.fallbacks.timeout > 0 && report.fallbacks.invalid_response > 0);
  assert.equal(report.finalAccuracy, report.deterministicAccuracy, "fallback == baseline");
});

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DecisionLayerService } from "../dist/modules/ai-models/decision/decision-layer.service.js";
import { resolveDecisionLayerConfig } from "../dist/modules/ai-models/decision/decision-flags.js";
import {
  DecisionProviderError,
  JevHttpProvider,
  parseProviderDecision,
} from "../dist/modules/ai-models/decision/jev.provider.js";

// Jev Decision Layer core — spec: docs/specs/prometeo/jev-decision-layer.spec.md §4 (J1–J7, J11).

const ON = {
  SEMSE_JEV_ENABLED: "true",
  SEMSE_JEV_AGENT_ROUTER_ENABLED: "true",
  SEMSE_JEV_VISION_GATE_ENABLED: "true",
};
const FALLBACK = { action: "PROMETEO", confidence: 0.75, reasonCode: "INTENT_PROJECT_REPORT" } as const;

function harness(opts: { env?: Record<string, string>; reply?: unknown; error?: unknown; telemetryThrows?: boolean } = {}) {
  const calls: any[] = [];
  const events: any[] = [];
  const outcomes: any[] = [];
  const provider = {
    name: "fake",
    async decide(request: any) {
      calls.push(request);
      if (opts.error) throw opts.error;
      return { raw: opts.reply, model: "jev-fast" };
    },
  };
  const telemetry = {
    async record(event: any) {
      if (opts.telemetryThrows) throw new Error("db down");
      events.push(event);
      return `evt_${events.length}`;
    },
    async recordOutcome(input: any) {
      outcomes.push(input);
    },
  };
  const service = new DecisionLayerService(provider as any, telemetry as any, () =>
    resolveDecisionLayerConfig({ ...(opts.env ?? ON) }),
  );
  return { service, calls, events, outcomes };
}

const decideRouter = (service: any, extra: Record<string, unknown> = {}) =>
  service.decide({ feature: "agent_router", tenantId: "t1", userId: "u1", input: { message: "hola" }, fallback: FALLBACK, ...extra });

test("flags default to OFF: deterministic result, no Jev call, no telemetry (J1)", async () => {
  const config = resolveDecisionLayerConfig({});
  assert.equal(config.enabled, false);
  assert.deepEqual(config.features, { agent_router: false, vision_gate: false });
  assert.equal(config.agentRouterMode, "shadow");
  assert.equal(config.minConfidence, 0.7);
  assert.equal(config.provider.timeoutMs, 800);

  const { service, calls, events } = harness({ env: {} });
  const outcome = await decideRouter(service);
  assert.equal(outcome.source, "deterministic");
  assert.equal(outcome.fallbackReason, "disabled");
  assert.equal(outcome.action, "PROMETEO");
  assert.equal(calls.length, 0);
  assert.equal(events.length, 0);
});

test("master switch alone or feature flag alone keeps the layer off", async () => {
  for (const env of [{ SEMSE_JEV_ENABLED: "true" }, { SEMSE_JEV_AGENT_ROUTER_ENABLED: "true" }]) {
    const { service, calls } = harness({ env, reply: { action: "ESTIMATE", confidence: 0.9, reasonCode: "X_Y" } });
    assert.equal((await decideRouter(service)).fallbackReason, "disabled");
    assert.equal(calls.length, 0);
  }
});

test("valid decision above threshold is used and recorded (J2)", async () => {
  const { service, calls, events } = harness({ reply: { action: "ESTIMATE", confidence: 0.92, reasonCode: "PRICING_REQUEST" } });
  const outcome = await decideRouter(service, { finalSystemAction: () => "chat_intent:estimate_generation" });
  assert.equal(outcome.source, "jev");
  assert.equal(outcome.action, "ESTIMATE");
  assert.equal(outcome.eventId, "evt_1");
  assert.equal(outcome.model, "jev-fast");
  assert.deepEqual(calls[0].allowedActions.includes("ESTIMATE"), true);
  assert.equal(calls[0].feature, "agent_router");
  assert.equal(events[0].decision, "ESTIMATE");
  assert.equal(events[0].fallbackUsed, false);
  assert.equal(events[0].finalSystemAction, "chat_intent:estimate_generation");
  assert.equal(events[0].tenantId, "t1");
  assert.ok(!("input" in events[0]), "telemetry must not store the input context");
});

test("invalid format or out-of-allowlist action falls back (J3)", async () => {
  for (const reply of [
    null,
    "ESTIMATE",
    [],
    { action: "RELEASE_ESCROW", confidence: 0.99, reasonCode: "PAY_NOW" },
    { action: "ACCEPT_RESULT", confidence: 0.99, reasonCode: "WRONG_FEATURE" },
    { action: "ESTIMATE", confidence: 1.5, reasonCode: "X_Y" },
    { action: "ESTIMATE", confidence: "high", reasonCode: "X_Y" },
    { action: "ESTIMATE", confidence: 0.9, reasonCode: "free text reason" },
    { action: "ESTIMATE", confidence: 0.9 },
  ]) {
    const { service, events } = harness({ reply });
    const outcome = await decideRouter(service);
    assert.equal(outcome.source, "deterministic", JSON.stringify(reply));
    assert.equal(outcome.fallbackReason, "invalid_response");
    assert.equal(outcome.action, "PROMETEO");
    assert.equal(events[0].fallbackUsed, true);
  }
});

test("low confidence falls back but keeps Jev's proposal for comparison (J5)", async () => {
  const { service, events } = harness({ reply: { action: "BUILDOPS", confidence: 0.4, reasonCode: "WEAK_GUESS" } });
  const outcome = await decideRouter(service);
  assert.equal(outcome.source, "deterministic");
  assert.equal(outcome.fallbackReason, "low_confidence");
  assert.equal(outcome.action, "PROMETEO");
  assert.deepEqual(outcome.proposed, { action: "BUILDOPS", confidence: 0.4, reasonCode: "WEAK_GUESS" });
  assert.equal(events[0].decision, "BUILDOPS", "telemetry records what Jev proposed");
  assert.equal(events[0].finalSystemAction, "PROMETEO", "…and what SEMSE actually did");
});

test("threshold is configurable", async () => {
  const { service } = harness({ env: { ...ON, SEMSE_JEV_MIN_CONFIDENCE: "0.3" }, reply: { action: "BUILDOPS", confidence: 0.4, reasonCode: "WEAK_GUESS" } });
  assert.equal((await decideRouter(service)).source, "jev");
});

test("provider errors never propagate: unavailable, timeout, provider_error (J4, J6)", async () => {
  for (const [error, reason] of [
    [new DecisionProviderError("unavailable", "down"), "unavailable"],
    [new DecisionProviderError("timeout", "slow"), "timeout"],
    [new DecisionProviderError("provider_error", "500"), "provider_error"],
    [new TypeError("boom"), "provider_error"],
  ] as const) {
    const { service } = harness({ error });
    const outcome = await decideRouter(service);
    assert.equal(outcome.source, "deterministic");
    assert.equal(outcome.fallbackReason, reason);
    assert.equal(outcome.action, "PROMETEO");
  }
});

test("tenant outside canary is not sent to Jev (J7)", async () => {
  const { service, calls } = harness({ env: { ...ON, SEMSE_JEV_CANARY_TENANT_IDS: "tenant_a, tenant_b" }, reply: { action: "ESTIMATE", confidence: 0.9, reasonCode: "X_Y" } });
  assert.equal((await decideRouter(service)).fallbackReason, "not_in_canary");
  assert.equal(calls.length, 0);
  const inCanary = await service.decide({ feature: "agent_router", tenantId: "tenant_b", input: {}, fallback: FALLBACK });
  assert.equal(inCanary.source, "jev");
});

test("state invariants can veto a Jev decision", async () => {
  const { service } = harness({ reply: { action: "ESTIMATE", confidence: 0.95, reasonCode: "X_Y" } });
  const outcome = await decideRouter(service, { isValid: () => false });
  assert.equal(outcome.fallbackReason, "invariant_violation");
  assert.equal(outcome.action, "PROMETEO");
});

test("unregistered / sensitive features are rejected before any provider call (J11)", async () => {
  const { service, calls } = harness({ reply: { action: "ESTIMATE", confidence: 0.9, reasonCode: "X_Y" } });
  for (const feature of ["escrow_release", "payment_release", "authorization", "evidence_delete", "__proto__", "toString"]) {
    await assert.rejects(
      service.decide({ feature, tenantId: "t1", input: {}, fallback: FALLBACK } as any),
      /not registered/,
      feature,
    );
  }
  assert.equal(calls.length, 0);
});

test("telemetry failures never break the decision path", async () => {
  const { service } = harness({ reply: { action: "ESTIMATE", confidence: 0.9, reasonCode: "X_Y" }, telemetryThrows: true });
  const outcome = await decideRouter(service);
  assert.equal(outcome.action, "ESTIMATE");
  assert.equal(outcome.eventId, undefined);
});

test("parseProviderDecision accepts only the strict contract", () => {
  assert.deepEqual(parseProviderDecision({ action: "A", confidence: 0, reasonCode: "OK" }, ["A"]), { action: "A", confidence: 0, reasonCode: "OK" });
  assert.equal(parseProviderDecision({ action: "B", confidence: 0.5, reasonCode: "OK" }, ["A"]), null);
  assert.equal(parseProviderDecision({ action: "A", confidence: -0.1, reasonCode: "OK" }, ["A"]), null);
  assert.equal(parseProviderDecision({ action: "A", confidence: 0.5, reasonCode: "ok" }, ["A"]), null);
});

test("JevHttpProvider: unconfigured, bearer auth, timeout and HTTP errors", async () => {
  await assert.rejects(
    new JevHttpProvider({ baseUrl: null, apiKey: null, model: null, timeoutMs: 100 }).decide({ feature: "agent_router", allowedActions: [], input: {} }),
    (e: any) => e.kind === "unavailable",
  );

  let seen: any;
  const ok = new JevHttpProvider({ baseUrl: "https://jev.test", apiKey: "k", model: "jev-1", timeoutMs: 500 }, (async (url: string, init: any) => {
    seen = { url, init };
    return new Response(JSON.stringify({ action: "ESTIMATE", confidence: 0.9, reasonCode: "X_Y" }), { status: 200 });
  }) as any);
  const result = await ok.decide({ feature: "agent_router", allowedActions: ["ESTIMATE"], input: { message: "m" } });
  assert.equal(seen.url, "https://jev.test/v1/decide");
  assert.equal(seen.init.headers.authorization, "Bearer k");
  assert.deepEqual(JSON.parse(seen.init.body), { feature: "agent_router", allowedActions: ["ESTIMATE"], input: { message: "m" }, model: "jev-1" });
  assert.equal(result.model, "jev-1");

  const slow = new JevHttpProvider({ baseUrl: "https://jev.test", apiKey: "k", model: null, timeoutMs: 50 }, ((_url: string, init: any) =>
    new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as any);
  await assert.rejects(slow.decide({ feature: "agent_router", allowedActions: [], input: {} }), (e: any) => e.kind === "timeout");

  for (const [status, kind] of [[500, "provider_error"], [503, "unavailable"]] as const) {
    const failing = new JevHttpProvider({ baseUrl: "https://jev.test", apiKey: "k", model: null, timeoutMs: 500 }, (async () => new Response("x", { status })) as any);
    await assert.rejects(failing.decide({ feature: "agent_router", allowedActions: [], input: {} }), (e: any) => e.kind === kind);
  }
});

test("the decision layer has no path to sensitive execution (no payments/escrow/evidence/auth imports)", () => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../src/modules/ai-models/decision");
  const forbidden = /from\s+["'][^"']*(payment|escrow|evidence|contract|auth|rbac|permission|finance|milestone|dispute|storage)[^"']*["']/i;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(resolve(dir, file), "utf8");
    assert.doesNotMatch(source, forbidden, `${file} imports a sensitive module`);
  }
  // Only a provider, telemetry sink and config — nothing that can act.
  assert.equal(DecisionLayerService.length <= 3, true);
});

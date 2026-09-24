import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DecisionLayerService } from "../dist/modules/ai-models/decision/decision-layer.service.js";
import { canaryBucket, resolveCanary, resolveDecisionLayerConfig } from "../dist/modules/ai-models/decision/decision-flags.js";
import { DecisionCircuitBreaker } from "../dist/modules/ai-models/decision/decision-circuit-breaker.js";
import {
  DecisionProviderError,
  JevHttpProvider,
  parseProviderDecision,
} from "../dist/modules/ai-models/decision/jev.provider.js";

// Jev Decision Layer core — spec: docs/specs/prometeo/jev-decision-layer.spec.md §4 (J1–J7, J11) and §9 (Wave 0).

const ON = { SEMSE_JEV_ENABLED: "true", SEMSE_JEV_AGENT_ROUTER_ENABLED: "true", SEMSE_JEV_VISION_GATE_ENABLED: "true" };
const LIVE = { ...ON, SEMSE_JEV_AGENT_ROUTER_MODE: "live" };
const BASELINE = { action: "PROMETEO", confidence: 0.75, reasonCode: "INTENT_PROJECT_REPORT" } as const;

function harness(opts: { env?: Record<string, string>; reply?: unknown; error?: unknown; telemetryThrows?: boolean; costUsd?: number } = {}) {
  const calls: any[] = [];
  const events: any[] = [];
  const outcomes: any[] = [];
  const provider = {
    name: "jev",
    async decide(request: any) {
      calls.push(request);
      if (opts.error) throw opts.error;
      return { raw: opts.reply, model: "jev-fast@1", ...(opts.costUsd !== undefined ? { costUsd: opts.costUsd } : {}) };
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
  const service = new DecisionLayerService(provider as any, telemetry as any, () => resolveDecisionLayerConfig({ ...(opts.env ?? LIVE) }));
  return { service, calls, events, outcomes };
}

const decideRouter = (service: any, extra: Record<string, unknown> = {}) =>
  service.decide({
    feature: "agent_router",
    actor: { tenantId: "t1", userId: "u1", roles: ["WORKER"] },
    context: { message: "hola" },
    deterministicDecision: BASELINE,
    correlationId: "req_1",
    inputClass: "intent:project_report",
    ...extra,
  });

test("flags default to OFF / shadow: deterministic result, no Jev call, no telemetry (J1)", async () => {
  const config = resolveDecisionLayerConfig({});
  assert.equal(config.enabled, false);
  assert.deepEqual(config.features, { agent_router: false, vision_gate: false });
  assert.deepEqual(config.modes, { agent_router: "shadow", vision_gate: "shadow" });
  assert.equal(config.minConfidence, 0.7);
  assert.equal(config.provider.timeoutMs, 800);
  assert.deepEqual(config.breaker, { threshold: 5, cooldownMs: 30_000 });

  const { service, calls, events } = harness({ env: {} });
  const outcome = await decideRouter(service);
  assert.equal(outcome.source, "deterministic");
  assert.equal(outcome.fallbackReason, "disabled");
  assert.equal(outcome.action, "PROMETEO");
  assert.deepEqual(outcome.deterministic, BASELINE);
  assert.equal(calls.length, 0);
  assert.equal(events.length, 0);
});

test("each feature has its own flag and mode", async () => {
  for (const env of [{ SEMSE_JEV_ENABLED: "true" }, { SEMSE_JEV_AGENT_ROUTER_ENABLED: "true" }, { SEMSE_JEV_ENABLED: "true", SEMSE_JEV_VISION_GATE_ENABLED: "true" }]) {
    const { service, calls } = harness({ env, reply: { action: "ESTIMATE", confidence: 0.9, reasonCode: "X_Y" } });
    assert.equal((await decideRouter(service)).fallbackReason, "disabled", JSON.stringify(env));
    assert.equal(calls.length, 0);
  }
  const config = resolveDecisionLayerConfig({ SEMSE_JEV_AGENT_ROUTER_MODE: "assist", SEMSE_JEV_VISION_GATE_MODE: "live" });
  assert.deepEqual(config.modes, { agent_router: "live", vision_gate: "live" });
  assert.equal(resolveDecisionLayerConfig({ SEMSE_JEV_VISION_GATE_MODE: "yolo" }).modes.vision_gate, "shadow");
});

test("live mode: a valid decision above threshold is used and fully recorded (J2, §55)", async () => {
  const { service, calls, events } = harness({ reply: { action: "ESTIMATE", confidence: 0.92, reasonCode: "PRICING_REQUEST" }, costUsd: 0.0002 });
  const outcome = await decideRouter(service, { finalSystemAction: () => "chat_intent:estimate_generation", candidates: ["a"], riskSignals: {} });
  assert.equal(outcome.source, "jev");
  assert.equal(outcome.action, "ESTIMATE");
  assert.equal(outcome.mode, "live");
  assert.equal(outcome.shadowMode, false);
  assert.equal(outcome.agreement, false);
  assert.deepEqual(outcome.jev, { action: "ESTIMATE", confidence: 0.92, reasonCode: "PRICING_REQUEST" });
  assert.equal(outcome.canary, "all");
  assert.equal(outcome.eventId, "evt_1");
  assert.equal(outcome.costUsd, 0.0002);
  assert.equal(calls[0].correlationId, "req_1");
  assert.deepEqual(calls[0].candidates, ["a"]);
  assert.ok(!("deterministicDecision" in calls[0]), "baseline is not sent to Jev (independent shadow agreement)");
  const e = events[0];
  assert.equal(e.decision, "ESTIMATE");
  assert.equal(e.deterministicDecision, "PROMETEO");
  assert.equal(e.jevDecision, "ESTIMATE");
  assert.equal(e.jevConfidence, 0.92);
  assert.equal(e.agreement, false);
  assert.equal(e.mode, "live");
  assert.equal(e.provider, "jev");
  assert.equal(e.model, "jev-fast@1");
  assert.equal(e.canary, "all");
  assert.equal(e.correlationId, "req_1");
  assert.equal(e.inputClass, "intent:project_report");
  assert.equal(e.finalSystemAction, "chat_intent:estimate_generation");
  assert.equal(e.fallbackUsed, false);
  assert.ok(!("context" in e) && !("input" in e), "telemetry never stores the raw context");
});

test("shadow mode: Jev is measured but the real action never changes (§52)", async () => {
  const { service, events } = harness({ env: ON, reply: { action: "BUILDOPS", confidence: 0.95, reasonCode: "SCHEDULING" } });
  const outcome = await decideRouter(service);
  assert.equal(outcome.action, "PROMETEO");
  assert.equal(outcome.source, "deterministic");
  assert.equal(outcome.shadowMode, true);
  assert.equal(outcome.fallbackReason, undefined, "shadow is not a failure");
  assert.equal(outcome.jev.action, "BUILDOPS");
  assert.equal(outcome.agreement, false);
  assert.equal(events[0].decision, "PROMETEO");
  assert.equal(events[0].jevDecision, "BUILDOPS");
  assert.equal(events[0].mode, "shadow");
  assert.equal(events[0].fallbackUsed, false);

  const agreeing = harness({ env: ON, reply: { action: "PROMETEO", confidence: 0.9, reasonCode: "GENERAL" } });
  assert.equal((await decideRouter(agreeing.service)).agreement, true);
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
    assert.equal(events[0].jevDecision, undefined);
  }
});

test("low confidence falls back but keeps Jev's proposal for comparison (J5)", async () => {
  const { service, events } = harness({ reply: { action: "BUILDOPS", confidence: 0.4, reasonCode: "WEAK_GUESS" } });
  const outcome = await decideRouter(service);
  assert.equal(outcome.fallbackReason, "low_confidence");
  assert.equal(outcome.action, "PROMETEO");
  assert.deepEqual(outcome.jev, { action: "BUILDOPS", confidence: 0.4, reasonCode: "WEAK_GUESS" });
  assert.equal(events[0].jevDecision, "BUILDOPS");
  assert.equal(events[0].decision, "PROMETEO");
  assert.equal(events[0].finalSystemAction, "PROMETEO");
});

test("threshold is configurable", async () => {
  const { service } = harness({ env: { ...LIVE, SEMSE_JEV_MIN_CONFIDENCE: "0.3" }, reply: { action: "BUILDOPS", confidence: 0.4, reasonCode: "WEAK_GUESS" } });
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

test("canary: tenant, user, internal role and percentage (J7, §53)", async () => {
  const env = { ...LIVE, SEMSE_JEV_CANARY_TENANT_IDS: "tenant_a", SEMSE_JEV_CANARY_USER_IDS: "u_beta", SEMSE_JEV_CANARY_ROLES: "OPS_ADMIN" };
  const config = resolveDecisionLayerConfig(env);
  assert.equal(resolveCanary(config, "agent_router", { tenantId: "tenant_a" }), "tenant");
  assert.equal(resolveCanary(config, "agent_router", { tenantId: "t9", userId: "u_beta" }), "user");
  assert.equal(resolveCanary(config, "agent_router", { tenantId: "t9", userId: "u9", roles: ["OPS_ADMIN"] }), "role");
  assert.equal(resolveCanary(config, "agent_router", { tenantId: "t9", userId: "u9", roles: ["WORKER"] }), null);
  assert.equal(resolveCanary(resolveDecisionLayerConfig(LIVE), "agent_router", { tenantId: "x" }), "all");

  const pct = resolveDecisionLayerConfig({ ...LIVE, SEMSE_JEV_CANARY_PERCENT: "20" });
  let inside = 0;
  for (let i = 0; i < 1000; i++) if (resolveCanary(pct, "agent_router", { tenantId: `t${i}`, userId: "u" }) === "percent") inside++;
  assert.ok(inside > 120 && inside < 280, `~20% expected, got ${inside / 10}%`);
  assert.equal(canaryBucket("agent_router", "t1", "u1"), canaryBucket("agent_router", "t1", "u1"), "stable bucket");

  const { service, calls } = harness({ env, reply: { action: "ESTIMATE", confidence: 0.9, reasonCode: "X_Y" } });
  const out = await service.decide({ feature: "agent_router", actor: { tenantId: "t9", userId: "u9" }, context: {}, deterministicDecision: BASELINE });
  assert.equal(out.fallbackReason, "not_in_canary");
  assert.equal(calls.length, 0);
  const inCanary = await service.decide({ feature: "agent_router", actor: { tenantId: "tenant_a" }, context: {}, deterministicDecision: BASELINE });
  assert.equal(inCanary.source, "jev");
  assert.equal(inCanary.canary, "tenant");
});

test("circuit breaker opens after consecutive failures, then half-opens", async () => {
  let now = 0;
  const breaker = new DecisionCircuitBreaker(() => ({ threshold: 2, cooldownMs: 1000 }), () => now);
  assert.equal(breaker.allow(), true);
  breaker.recordFailure();
  assert.equal(breaker.state, "closed");
  breaker.recordFailure();
  assert.equal(breaker.state, "open");
  assert.equal(breaker.allow(), false);
  now = 1500;
  assert.equal(breaker.state, "half_open");
  assert.equal(breaker.allow(), true);
  breaker.recordFailure();
  assert.equal(breaker.allow(), false, "failed trial re-opens");
  now = 3000;
  breaker.recordSuccess();
  assert.equal(breaker.state, "closed");

  const { service, calls } = harness({ env: { ...LIVE, SEMSE_JEV_BREAKER_THRESHOLD: "2" }, error: new DecisionProviderError("timeout", "slow") });
  await decideRouter(service);
  await decideRouter(service);
  const third = await decideRouter(service);
  assert.equal(third.fallbackReason, "circuit_open");
  assert.equal(calls.length, 2, "no provider call while open");
});

test("invalid responses don't trip the breaker (only availability failures do)", async () => {
  const { service, calls } = harness({ env: { ...LIVE, SEMSE_JEV_BREAKER_THRESHOLD: "1" }, reply: "garbage" });
  await decideRouter(service);
  await decideRouter(service);
  assert.equal(calls.length, 2);
});

test("feature state invariants can veto a Jev decision", async () => {
  const { service, events } = harness({ reply: { action: "ESTIMATE", confidence: 0.95, reasonCode: "X_Y" } });
  const outcome = await decideRouter(service, { isValid: () => false });
  assert.equal(outcome.fallbackReason, "invariant_violation");
  assert.deepEqual(outcome.invariantsViolated, ["AGENT_ROUTER_STATE_INVARIANT"]);
  assert.equal(outcome.action, "PROMETEO");
  assert.deepEqual(events[0].invariantsViolated, ["AGENT_ROUTER_STATE_INVARIANT"]);
});

test("unregistered / sensitive features are rejected before any provider call (J11)", async () => {
  const { service, calls } = harness({ reply: { action: "ESTIMATE", confidence: 0.9, reasonCode: "X_Y" } });
  for (const feature of ["escrow_release", "payment_release", "authorization", "evidence_delete", "__proto__", "toString"]) {
    await assert.rejects(
      service.decide({ feature, actor: { tenantId: "t1" }, context: {}, deterministicDecision: BASELINE } as any),
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

test("JevHttpProvider: unconfigured, bearer auth, model@version, cost, timeout and HTTP errors", async () => {
  await assert.rejects(
    new JevHttpProvider({ baseUrl: null, apiKey: null, model: null, timeoutMs: 100 }).decide({ feature: "agent_router", allowedActions: [], input: {} }),
    (e: any) => e.kind === "unavailable",
  );

  let seen: any;
  const ok = new JevHttpProvider({ baseUrl: "https://jev.test", apiKey: "k", model: "jev-1", timeoutMs: 500 }, (async (url: string, init: any) => {
    seen = { url, init };
    return new Response(JSON.stringify({ action: "ESTIMATE", confidence: 0.9, reasonCode: "X_Y", version: "2026.09", costUsd: 0.0001 }), { status: 200 });
  }) as any);
  const result = await ok.decide({ feature: "agent_router", allowedActions: ["ESTIMATE"], input: { message: "m" } });
  assert.equal(seen.url, "https://jev.test/v1/decide");
  assert.equal(seen.init.headers.authorization, "Bearer k");
  assert.deepEqual(JSON.parse(seen.init.body), { feature: "agent_router", allowedActions: ["ESTIMATE"], input: { message: "m" }, model: "jev-1" });
  assert.equal(result.model, "jev-1@2026.09");
  assert.equal(result.costUsd, 0.0001);

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
  assert.equal(DecisionLayerService.length <= 3, true);
});

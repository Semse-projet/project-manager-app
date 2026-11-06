import test from "node:test";
import assert from "node:assert/strict";
import { ProviderMetricsStore } from "../dist/infrastructure/llm/metrics/provider-metrics.store.js";
import { AdaptiveRouter } from "../dist/infrastructure/llm/router/adaptive-router.js";

function makeRouter() {
  const store = new ProviderMetricsStore();
  const router = new AdaptiveRouter(store);
  return { store, router };
}

const ALL: import("../dist/infrastructure/llm/types.js").LLMProviderName[] = ["anthropic", "openai", "ollama", "template"];
const NO_CTX = undefined;

// ── Task type inference ───────────────────────────────────────────────────────

test("inferTaskType: high risk → high_risk_action", () => {
  const { router } = makeRouter();
  assert.equal(router.inferTaskType({ riskLevel: "high" }), "high_risk_action");
});

test("inferTaskType: requiresTools → tool_use", () => {
  const { router } = makeRouter();
  assert.equal(router.inferTaskType({ requiresTools: true }), "tool_use");
});

test("inferTaskType: explicit taskType wins", () => {
  const { router } = makeRouter();
  assert.equal(router.inferTaskType({ taskType: "search" }), "search");
});

test("inferTaskType: default → chat", () => {
  const { router } = makeRouter();
  assert.equal(router.inferTaskType(NO_CTX), "chat");
});

// ── Hard constraints ──────────────────────────────────────────────────────────

test("rank: privacyCritical → ollama first (if available)", () => {
  const { router } = makeRouter();
  const chain = router.rank(ALL, { privacyCritical: true }, "chat");
  assert.equal(chain[0], "ollama");
});

test("rank: requiresTools → anthropic or openai first, not ollama", () => {
  const { router } = makeRouter();
  const chain = router.rank(ALL, { requiresTools: true }, "tool_use");
  assert.ok(chain[0] === "anthropic" || chain[0] === "openai");
  const withoutTemplate = chain.filter((p) => p !== "template");
  assert.ok(!withoutTemplate.slice(0, 2).includes("ollama"));
});

test("rank: cloud preference never overrides privacyCritical or localOnly", () => {
  const { router } = makeRouter();
  for (const ctx of [
    { preferredProvider: "openai" as const, privacyCritical: true },
    { preferredProvider: "anthropic" as const, localOnly: true },
  ]) {
    const chain = router.rank(ALL, ctx, "chat");
    assert.ok(chain.includes("ollama"));
    assert.ok(!chain.includes("openai") && !chain.includes("anthropic"));
  }
});

test("rank: always ends with template", () => {
  const { router } = makeRouter();
  const chain = router.rank(ALL, NO_CTX, "chat");
  assert.equal(chain[chain.length - 1], "template");
});

test("rank: no duplicates in chain", () => {
  const { router } = makeRouter();
  const chain = router.rank(ALL, NO_CTX, "chat");
  assert.equal(new Set(chain).size, chain.length);
});

// ── Score-based ranking ───────────────────────────────────────────────────────

test("rank: provider with higher success rate ranked first", () => {
  const { store, router } = makeRouter();
  // Anthropic: 10 successes fast
  for (let i = 0; i < 10; i++) store.recordSuccess("anthropic", "chat", 200, 100);
  // OpenAI: 3 successes, 7 failures
  for (let i = 0; i < 3; i++) store.recordSuccess("openai", "chat", 300, 100);
  for (let i = 0; i < 7; i++) store.recordFailure("openai", "chat", "timeout");

  const chain = router.rank(["anthropic", "openai", "template"], NO_CTX, "chat");
  assert.equal(chain[0], "anthropic");
});

// ── Circuit breaker ───────────────────────────────────────────────────────────

test("circuit opens after 3 consecutive failures", () => {
  const { store } = makeRouter();
  for (let i = 0; i < 3; i++) store.recordFailure("openai", "chat", "err");
  assert.equal(store.isCircuitOpen("openai", "chat"), true);
});

test("circuit stays closed under threshold", () => {
  const { store } = makeRouter();
  for (let i = 0; i < 2; i++) store.recordFailure("openai", "chat", "err");
  assert.equal(store.isCircuitOpen("openai", "chat"), false);
});

test("circuit resets after success", () => {
  const { store } = makeRouter();
  for (let i = 0; i < 3; i++) store.recordFailure("anthropic", "chat", "err");
  assert.equal(store.isCircuitOpen("anthropic", "chat"), true);
  // A success resets consecutive failures
  store.recordSuccess("anthropic", "chat", 300, 100);
  assert.equal(store.isCircuitOpen("anthropic", "chat"), false);
});

// ── Score calculation ─────────────────────────────────────────────────────────

test("score increases with better success rate", () => {
  const { store } = makeRouter();
  for (let i = 0; i < 10; i++) store.recordSuccess("anthropic", "chat", 500, 100);
  for (let i = 0; i < 5; i++) store.recordSuccess("openai", "chat", 500, 100);
  for (let i = 0; i < 5; i++) store.recordFailure("openai", "chat", "err");

  const scoreA = store.score("anthropic", "chat");
  const scoreB = store.score("openai", "chat");
  assert.ok(scoreA > scoreB, `anthropic score (${scoreA}) should be > openai score (${scoreB})`);
});

test("score decreases with higher latency", () => {
  const { store } = makeRouter();
  // Both 100% success, different latency
  for (let i = 0; i < 5; i++) store.recordSuccess("anthropic", "chat", 100, 100);
  for (let i = 0; i < 5; i++) store.recordSuccess("openai", "chat", 5000, 100);

  const fastScore = store.score("anthropic", "chat");
  const slowScore = store.score("openai", "chat");
  assert.ok(fastScore > slowScore, `fast (${fastScore}) should score higher than slow (${slowScore})`);
});

// ── Snapshot ──────────────────────────────────────────────────────────────────

test("snapshot reflects recorded data", () => {
  const { store } = makeRouter();
  store.recordSuccess("anthropic", "tool_use", 400, 200);
  store.recordSuccess("anthropic", "tool_use", 600, 300);
  store.recordFailure("anthropic", "tool_use", "timeout");

  const snap = store.snapshot("anthropic", "tool_use");
  assert.equal(snap.successCount, 2);
  assert.equal(snap.failureCount, 1);
  assert.ok(snap.successRate > 0.6 && snap.successRate < 0.7);
  assert.ok(snap.avgLatencyMs > 0);
  assert.equal(snap.circuitState, "closed");
});

test("rank: local-only tool route retains Ollama and cannot select cloud providers", () => {
  const { router } = makeRouter();
  const chain = router.rank(ALL, {
    preferredProvider: "openai", localOnly: true, privacyCritical: true, requiresTools: true,
  }, "tool_use");
  assert.equal(chain[0], "ollama");
  assert.ok(!chain.includes("openai") && !chain.includes("anthropic"));
});

test("rank: local-only with no registered local LLM never falls back to cloud", () => {
  const { router } = makeRouter();
  const chain = router.rank(["openai", "anthropic", "template"], {
    preferredProvider: "openai", localOnly: true, requiresTools: true,
  }, "tool_use");
  assert.deepEqual(chain, ["template"]);
  const withoutTemplate = router.rank(["openai", "anthropic"], {
    localOnly: true, requiresTools: true,
  }, "tool_use");
  assert.deepEqual(withoutTemplate, []);
});

test("rank: ordinary non-private preferredProvider still works", () => {
  const { router } = makeRouter();
  assert.equal(router.rank(ALL, { preferredProvider: "openai" }, "chat")[0], "openai");
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildFallbackChain, selectProvider } from "../dist/infrastructure/llm/router/routing-policy.js";
import { ProviderMetricsStore } from "../dist/infrastructure/llm/metrics/provider-metrics.store.js";
import { AdaptiveRouter } from "../dist/infrastructure/llm/router/adaptive-router.js";

test("selects anthropic for high-risk context", () => {
  assert.equal(selectProvider({ riskLevel: "high" }), "anthropic");
});

test("selects ollama for privacy-critical context", () => {
  assert.equal(selectProvider({ privacyCritical: true }), "ollama");
  // privacy beats risk level
  assert.equal(selectProvider({ privacyCritical: true, riskLevel: "high" }), "ollama");
});

test("selects anthropic when tools required", () => {
  assert.equal(selectProvider({ requiresTools: true }), "anthropic");
});

test("respects preferredProvider override", () => {
  assert.equal(selectProvider({ riskLevel: "high", preferredProvider: "openai" }), "openai");
});

test("hard safety constraints take precedence over an unsafe preferred provider", () => {
  assert.equal(selectProvider({ riskLevel: "high", preferredProvider: "together" }), "anthropic");
  assert.equal(selectProvider({ requiresTools: true, preferredProvider: "together" }), "anthropic");
});

test("selects ollama for lowCost context", () => {
  assert.equal(selectProvider({ lowCost: true }), "ollama");
});

test("buildFallbackChain puts primary first and template last", () => {
  const chain = buildFallbackChain("anthropic", undefined);
  assert.equal(chain[0], "anthropic");
  assert.equal(chain[chain.length - 1], "template");
});

test("buildFallbackChain respects fallbackOrder from context", () => {
  const chain = buildFallbackChain("anthropic", { fallbackOrder: ["openai", "template"] });
  assert.equal(chain[0], "anthropic");
  assert.equal(chain[1], "openai");
  assert.equal(chain[chain.length - 1], "template");
});

test("buildFallbackChain has no duplicates", () => {
  const chain = buildFallbackChain("anthropic", { fallbackOrder: ["anthropic", "openai"] });
  const unique = new Set(chain);
  assert.equal(unique.size, chain.length);
});

test("privacy constraints win over preferred external provider", () => {
  assert.equal(selectProvider({ preferredProvider: "together", privacyCritical: true }), "ollama");
  assert.equal(selectProvider({ preferredProvider: "together", localOnly: true }), "ollama");
});

test("Together is excluded from local-only and privacy-critical fallback chains", () => {
  const ctx = { fallbackOrder: ["together", "ollama", "template"] as const };
  const restricted = buildFallbackChain("together", { fallbackOrder: [...ctx.fallbackOrder], privacyCritical: true });
  assert.ok(!restricted.includes("together"));
  assert.ok(restricted.includes("ollama"));
  const unrestricted = buildFallbackChain("ollama", { fallbackOrder: ["together"] });
  assert.ok(unrestricted.includes("together"));
});


test("preferred providers cannot bypass adaptive hard constraints", () => {
  const router = new AdaptiveRouter(new ProviderMetricsStore());
  const available = ["together", "anthropic", "openai", "ollama", "template"] as const;

  const highRisk = router.rank(
    [...available],
    { preferredProvider: "together", riskLevel: "high" },
    "high_risk_action",
  );
  assert.ok(!highRisk.includes("together"));
  assert.ok(highRisk.every((provider) => ["anthropic", "openai", "template"].includes(provider)));

  const privateOnly = router.rank(
    [...available],
    { preferredProvider: "together", privacyCritical: true },
    "chat",
  );
  assert.ok(!privateOnly.includes("together"));
  assert.ok(privateOnly.every((provider) => ["ollama", "template"].includes(provider)));

  const toolOnly = router.rank(
    [...available],
    { preferredProvider: "together", requiresTools: true },
    "tool_use",
  );
  assert.ok(!toolOnly.includes("together"));
  assert.ok(toolOnly.every((provider) => ["anthropic", "openai", "template"].includes(provider)));
});

test("static high-risk fallback chains exclude Together and other unsafe providers", () => {
  const chain = buildFallbackChain("together", {
    fallbackOrder: ["together", "ollama", "openai", "template"],
    riskLevel: "high",
  });
  assert.ok(!chain.includes("together"));
  assert.ok(!chain.includes("ollama"));
  assert.ok(chain.every((provider) => ["anthropic", "openai", "template"].includes(provider)));
});

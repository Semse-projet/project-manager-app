import test from "node:test";
import assert from "node:assert/strict";
import { buildFallbackChain, selectProvider } from "../dist/infrastructure/llm/router/routing-policy.js";

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

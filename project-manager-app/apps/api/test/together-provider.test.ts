import test from "node:test";
import assert from "node:assert/strict";
import { TogetherProvider } from "../dist/infrastructure/llm/providers/together.provider.js";
import { LLMOrchestrator } from "../dist/infrastructure/llm/orchestrator.js";
import { ProviderMetricsStore } from "../dist/infrastructure/llm/metrics/provider-metrics.store.js";
import { AdaptiveRouter } from "../dist/infrastructure/llm/router/adaptive-router.js";

const sample = (context = {}, tools = undefined) => ({
  systemPrompt: "You are an assistant.",
  history: [],
  userMessage: "Hello",
  context,
  tools,
});

test("Together rejects private, high-risk and tool tasks before calling the network", async () => {
  const provider = new TogetherProvider("dummy-test-key", "example/Test-Model");
  assert.equal(provider.supportsTools, false);
  await assert.rejects(provider.chat(sample({ localOnly: true })), /not allowed/);
  await assert.rejects(provider.chat(sample({ privacyCritical: true })), /not allowed/);
  await assert.rejects(provider.chat(sample({ riskLevel: "high" })), /not authorized/);
  await assert.rejects(provider.chat(sample({ requiresTools: true })), /not enabled/);
  await assert.rejects(provider.chat(sample({}, [{ name: "test", description: "", inputSchema: {} }])), /not enabled/);
});

test("Together registration requires flag, key and model", () => {
  const names = ["SEMSE_TOGETHER_ENABLED", "TOGETHER_API_KEY", "TOGETHER_MODEL"];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const registered = () => {
    const metrics = new ProviderMetricsStore();
    return new LLMOrchestrator(metrics, new AdaptiveRouter(metrics)).getRegisteredProviders().includes("together");
  };
  try {
    process.env.TOGETHER_API_KEY = "dummy-test-key";
    process.env.TOGETHER_MODEL = "example/Test-Model";
    delete process.env.SEMSE_TOGETHER_ENABLED;
    assert.equal(registered(), false);
    process.env.SEMSE_TOGETHER_ENABLED = "true";
    assert.equal(registered(), true);
    delete process.env.TOGETHER_MODEL;
    assert.equal(registered(), false);
    process.env.TOGETHER_MODEL = "example/Test-Model";
    delete process.env.TOGETHER_API_KEY;
    assert.equal(registered(), false);
  } finally {
    for (const name of names) {
      const previous = original[name];
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    }
  }
});

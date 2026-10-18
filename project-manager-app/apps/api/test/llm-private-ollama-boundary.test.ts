import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { OllamaProvider } from "../dist/infrastructure/llm/providers/ollama.provider.js";
import { LLMOrchestrator } from "../dist/infrastructure/llm/orchestrator.js";
import { AdaptiveRouter } from "../dist/infrastructure/llm/router/adaptive-router.js";
import { ProviderMetricsStore } from "../dist/infrastructure/llm/metrics/provider-metrics.store.js";

const privateInput = {
  systemPrompt: "Confidential client job details",
  history: [],
  userMessage: "Private RAG document: owner-only contents",
  tools: [],
  context: { localOnly: true, privacyCritical: true, requiresTools: true },
};

test("strict loopback parsing rejects remote, network and deceptive Ollama URLs", () => {
  const remote = [
    "https://ollama.example.com",
    "https://localhost.example.com",
    "http://127.0.0.1.attacker.example",
    "http://my-localhost.example",
    "http://10.10.1.12:11434",
    "http://ollama:11434",
    "http://user:pass@localhost:11434",
    "not-a-valid-url",
  ];
  for (const endpoint of remote) {
    const provider = new OllamaProvider(endpoint, "test");
    assert.equal(provider.isLocalEndpoint(), false, endpoint);
    assert.equal(provider.getConfig().isRemote, true, endpoint);
  }
  for (const endpoint of ["http://localhost:11434", "http://127.0.0.1:11434", "http://[::1]:11434"]) {
    assert.equal(new OllamaProvider(endpoint, "test").isLocalEndpoint(), true, endpoint);
  }
});

test("provider itself fails closed before POSTing private text to remote Ollama", async () => {
  const provider = new OllamaProvider("https://ollama.example.com", "test");
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => { called = true; throw new Error("remote fetch must never occur"); }) as typeof fetch;
  try {
    await assert.rejects(
      () => provider.chat(privateInput),
      /Private LLM inference requires a verified loopback/,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("both adaptive and static private routing refuse remote Ollama and cloud fallback", async () => {
  const previous = {
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    LLM_DEFAULT_PROVIDER: process.env.LLM_DEFAULT_PROVIDER,
    ENABLE_LLM_ROUTER: process.env.ENABLE_LLM_ROUTER,
  };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error("private network egress forbidden"); }) as typeof fetch;
  try {
    for (const adaptive of [true, false]) {
      process.env.OLLAMA_BASE_URL = "https://ollama.remote.example";
      process.env.LLM_DEFAULT_PROVIDER = "ollama";
      process.env.ENABLE_LLM_ROUTER = String(adaptive);
      const store = new ProviderMetricsStore();
      const orchestrator = new LLMOrchestrator(store, new AdaptiveRouter(store));
      assert.equal(orchestrator.getOllamaProvider()?.isLocalEndpoint(), false);
      const output = await orchestrator.chat(privateInput);
      assert.equal(output.provider, "template", "private content must fall back locally");
      assert.equal(calls, 0, "never transmit private content to any network provider");
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = originalFetch;
  }
});

test("even loopback Ollama responses cannot redirect a private prompt to another host", async () => {
  const provider = new OllamaProvider("http://127.0.0.1:11434", "test");
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    calls++;
    assert.equal(init?.redirect, "error", "private prompt POST must never follow redirects");
    return {
      ok: true,
      async json() { return { message: { content: "local response" }, eval_count: 1, prompt_eval_count: 1 }; },
    } as Response;
  }) as typeof fetch;
  try {
    const result = await provider.chat(privateInput);
    assert.equal(result.provider, "ollama");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

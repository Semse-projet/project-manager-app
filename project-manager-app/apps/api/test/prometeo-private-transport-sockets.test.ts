/**
 * P0 #974 — private prompt boundary using actual Node TCP/HTTP sockets.
 * Both endpoints are on the disposable test runner's loopback network; no
 * private text, provider credentials or requests leave the runner.
 * This is NOT a production packet-capture / zero-external-egress attestation.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { OllamaProvider } from "../dist/infrastructure/llm/providers/ollama.provider.js";
import { LLMOrchestrator } from "../dist/infrastructure/llm/orchestrator.js";
import { AdaptiveRouter } from "../dist/infrastructure/llm/router/adaptive-router.js";
import { ProviderMetricsStore } from "../dist/infrastructure/llm/metrics/provider-metrics.store.js";

type Sink = { server: Server; url: string; requests: Array<{ path: string; body: string }> };

async function sink(hostname: "127.0.0.1" | "127.0.0.2", response?: {
  status: number; redirect?: string;
}): Promise<Sink> {
  const requests: Array<{ path: string; body: string }> = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk.toString();
    requests.push({ path: req.url ?? "", body });
    if (response?.redirect) {
      res.writeHead(response.status, { location: response.redirect });
      res.end();
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: { content: "synthetic local model" }, eval_count: 3 }));
    }
  });
  server.listen(0, hostname);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, url: `http://${hostname}:${address.port}`, requests };
}
async function close(s: Sink) {
  await new Promise<void>((resolve, reject) => s.server.close(err => err ? reject(err) : resolve()));
}

const canary = "P0_PRIVATE_SYNTHETIC_ONLY_DO_NOT_TRANSMIT";
const input = {
  systemPrompt: "PRIVATE SYNTHETIC SYSTEM " + canary,
  history: [],
  userMessage: "OWNER RAG CONTENT " + canary,
  tools: [],
  context: { localOnly: true, privacyCritical: true, requiresTools: true },
};

test("private Ollama rejects an actual but disallowed network endpoint without any TCP request", async () => {
  const remote = await sink("127.0.0.2");
  try {
    const provider = new OllamaProvider(remote.url, "synthetic-local");
    assert.equal(provider.isLocalEndpoint(), false);
    await assert.rejects(
      () => provider.chat(input),
      /Private LLM inference requires a verified loopback Ollama endpoint/,
    );
    assert.deepEqual(remote.requests, [], "no private prompt can reach even the controlled disallowed TCP sink");
  } finally {
    await close(remote);
  }
});

test("static and adaptive private routing make no socket request to disallowed Ollama", async () => {
  const remote = await sink("127.0.0.2");
  const before = {
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    ENABLE_LLM_ROUTER: process.env.ENABLE_LLM_ROUTER,
    LLM_DEFAULT_PROVIDER: process.env.LLM_DEFAULT_PROVIDER,
  };
  try {
    process.env.OLLAMA_BASE_URL = remote.url;
    process.env.LLM_DEFAULT_PROVIDER = "ollama";
    for (const adaptive of ["true", "false"]) {
      process.env.ENABLE_LLM_ROUTER = adaptive;
      const metrics = new ProviderMetricsStore();
      const orchestrator = new LLMOrchestrator(metrics, new AdaptiveRouter(metrics));
      const response = await orchestrator.chat(input);
      assert.equal(response.provider, "template", "private prompt must fall back locally");
    }
    assert.deepEqual(remote.requests, [], "neither routing mode may send an actual TCP request");
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await close(remote);
  }
});

test("private Ollama allows local TCP but rejects a 307 redirect to a disallowed socket", async () => {
  const remote = await sink("127.0.0.2");
  const local = await sink("127.0.0.1", { status: 307, redirect: remote.url + "/api/chat" });
  try {
    const provider = new OllamaProvider(local.url, "synthetic-local");
    assert.equal(provider.isLocalEndpoint(), true);
    await assert.rejects(() => provider.chat(input), /fetch failed|redirect|unexpected/i);
    assert.equal(local.requests.length, 1, "synthetic private prompt should reach local-only endpoint once");
    assert.equal(local.requests[0]?.path, "/api/chat");
    assert.ok(local.requests[0]?.body.includes(canary), "local route actually received the canary");
    assert.deepEqual(remote.requests, [], "redirect must not forward private content to disallowed TCP endpoint");
  } finally {
    await close(local);
    await close(remote);
  }
});

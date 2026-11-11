import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { AdaptiveRouter } from "../dist/infrastructure/llm/router/adaptive-router.js";
import { OllamaProvider } from "../dist/infrastructure/llm/providers/ollama.provider.js";

test("localOnly and requiresTools must keep Ollama ahead of template, never cloud", () => {
  const metrics = {
    isCircuitOpen() { return false; },
    score(provider: string) { return provider === "ollama" ? 100 : 10; },
  };
  const router = new AdaptiveRouter(metrics as never);
  const ranked = router.rank(
    ["openai", "anthropic", "ollama", "template"],
    { localOnly: true, privacyCritical: true, requiresTools: true },
    "tool_use",
  );
  assert.deepEqual(ranked, ["ollama", "template"]);
  assert.ok(!ranked.includes("openai") && !ranked.includes("anthropic"));
});

test("Ollama's local prompt-tool adapter can actually return a structured tool call", async () => {
  const priorFetch = globalThis.fetch;
  let endpoint = "";
  try {
    globalThis.fetch = async (url) => {
      endpoint = String(url);
      return {
        ok: true,
        async json() { return { message: { content: '{"tool":"list_project_tasks","input":{"projectId":"project-A"}}' } }; },
      } as Response;
    };
    const provider = new OllamaProvider("http://localhost:11434", "qwen-local");
    const result = await provider.chat({
      systemPrompt: "Use only approved tools",
      history: [],
      userMessage: "List project tasks",
      tools: [{
        name: "list_project_tasks", description: "List project tasks",
        inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] },
      }],
      context: { localOnly: true, requiresTools: true },
    });
    assert.equal(endpoint, "http://localhost:11434/api/chat");
    assert.equal(result.provider, "ollama");
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0]?.toolName, "list_project_tasks");
    assert.deepEqual(result.toolCalls[0]?.input, { projectId: "project-A" });
  } finally {
    globalThis.fetch = priorFetch;
  }
});

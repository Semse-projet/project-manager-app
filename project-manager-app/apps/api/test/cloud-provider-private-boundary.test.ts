/**
 * P0 #974 — defense in depth. Private content must not leave via a cloud
 * provider even if a caller bypasses the adaptive/static router.
 * Only synthetic strings and deliberately invalid placeholder credentials.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIProvider } from "../dist/infrastructure/llm/providers/openai.provider.js";
import { AnthropicProvider } from "../dist/infrastructure/llm/providers/anthropic.provider.js";

const input = {
  systemPrompt: "P0 SYNTHETIC PRIVATE SYSTEM ONLY",
  history: [],
  userMessage: "P0 SYNTHETIC PRIVATE CANARY ONLY",
  tools: [],
  context: { localOnly: true, privacyCritical: true },
};

test("cloud provider adapters themselves refuse localOnly or privacyCritical content", async () => {
  const priorFetch = globalThis.fetch;
  let outgoing = 0;
  globalThis.fetch = (async () => {
    outgoing++;
    throw new Error("UNAUTHORIZED_SYNTHETIC_HTTP_ATTEMPT");
  }) as typeof fetch;
  try {
    const providers = [
      new OpenAIProvider("sk-invalid-fixture-not-real"),
      new AnthropicProvider("sk-invalid-fixture-not-real"),
    ];
    for (const provider of providers) {
      await assert.rejects(
        () => provider.chat(input),
        /Private LLM inference forbids cloud/,
        provider.name + " must reject both privacy markers before transport",
      );
      await assert.rejects(
        () => provider.chat({ ...input, context: { localOnly: true } }),
        /Private LLM inference forbids cloud/,
        provider.name + " must reject localOnly alone",
      );
      await assert.rejects(
        () => provider.chat({ ...input, context: { privacyCritical: true } }),
        /Private LLM inference forbids cloud/,
        provider.name + " must reject privacyCritical alone",
      );
    }
    assert.equal(outgoing, 0, "cloud HTTP transport must not be called");
  } finally {
    globalThis.fetch = priorFetch;
  }
});

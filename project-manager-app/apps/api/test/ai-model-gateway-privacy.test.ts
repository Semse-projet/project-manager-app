import test from "node:test";
import assert from "node:assert/strict";
import { AiModelGatewayService } from "../dist/modules/ai-models/gateway/ai-model-gateway.service.js";
import { AiModelRouterService } from "../dist/modules/ai-models/router/ai-model-router.service.js";
import type { AiGenerateRequest } from "../dist/modules/ai-models/dto/ai-generate-request.dto.js";

// C80 — SPEC-GTW-001: privacy constraints must hold at the last gate before a
// provider sees the payload, including the 5 direct-provider slugs
// (deepseek-*, kimi-k2, glm-4, glm-ollama) that bypass LLMOrchestrator, and
// must fail closed (no cloud fallback) when the local model fails.

type Call = { kind: "orchestrator" | "direct"; detail?: unknown };

function build(orchestratorImpl: (input: any) => Promise<any>) {
  const calls: Call[] = [];
  const orchestrator = {
    hasLLMProvider: true,
    getRegisteredProviders: () => ["ollama"],
    chat: async (input: any) => {
      calls.push({ kind: "orchestrator", detail: input.context });
      return orchestratorImpl(input);
    },
  };
  const gateway = new AiModelGatewayService(new AiModelRouterService(), orchestrator as any);
  const direct = async () => {
    calls.push({ kind: "direct" });
    return { output: "leaked", provider: "cloud", modelSlug: "x", modelName: "x", latencyMs: 1, success: true };
  };
  for (const key of ["deepseekChat", "deepseekReasoner", "kimi", "glm"]) {
    (gateway as any)[key] = { generate: direct };
  }
  return { gateway, calls };
}

const base = { taskType: "construction_contract_analysis", input: "secret contract" } as AiGenerateRequest;
const failingLocal = async () => { throw new Error("ollama down"); };
const okLocal = async () => ({ text: "ok", provider: "ollama", model: "qwen", metadata: { latencyMs: 1 } });

for (const flags of [
  { privacyLevel: "local_only" },
  { privacyLevel: "sensitive" },
  { privacyLevel: "restricted" },
  { privacyCritical: true },
  { localOnly: true },
] as Partial<AiGenerateRequest>[]) {
  test(`fail-closed when local model fails: ${JSON.stringify(flags)}`, async () => {
    const { gateway, calls } = build(failingLocal);
    const res = await gateway.generate({ ...base, ...flags });
    assert.equal(res.success, false);
    assert.equal(res.output, "");
    assert.equal(res.fallbackUsed, false);
    assert.equal(calls.filter((c) => c.kind === "direct").length, 0);
    // Only one orchestrator attempt, constrained to local/private.
    assert.equal(calls.length, 1);
    assert.equal((calls[0]!.detail as any).localOnly, true);
    assert.equal((calls[0]!.detail as any).privacyCritical, true);
  });

  test(`forceModelSlug to a cloud/direct slug cannot bypass: ${JSON.stringify(flags)}`, async () => {
    for (const forceModelSlug of ["kimi-k2", "deepseek-chat", "glm-4", "claude-sonnet"]) {
      const { gateway, calls } = build(okLocal);
      const res = await gateway.generate({ ...base, ...flags, forceModelSlug });
      assert.equal(res.modelSlug, "ollama-local");
      assert.equal(calls.filter((c) => c.kind === "direct").length, 0);
    }
  });
}

test("defense in depth: executeWithSlug refuses a non-private slug for a restricted request", async () => {
  const { gateway, calls } = build(okLocal);
  await assert.rejects(
    (gateway as any).executeWithSlug("kimi-k2", { ...base, privacyCritical: true }, "x", false),
    /Privacy policy blocked/,
  );
  assert.equal(calls.length, 0);
});

test("glm-ollama (private) is permitted for restricted requests", async () => {
  const { gateway, calls } = build(okLocal);
  (gateway as any).glmOllama = { generate: async () => ({ output: "ok", provider: "glm-ollama", modelSlug: "glm-ollama", modelName: "glm4", latencyMs: 1, success: true }) };
  const res = await (gateway as any).executeWithSlug("glm-ollama", { ...base, localOnly: true }, "x", false);
  assert.equal(res.success, true);
  assert.equal(calls.length, 0);
});

test("unrestricted requests still use normal routing and direct providers", async () => {
  const { gateway, calls } = build(okLocal);
  const res = await gateway.generate({ ...base, forceModelSlug: "deepseek-chat" });
  assert.equal(res.success, true);
  assert.ok(calls.some((c) => c.kind === "direct"));
});

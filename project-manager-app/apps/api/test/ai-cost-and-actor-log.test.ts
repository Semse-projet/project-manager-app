import test from "node:test";
import assert from "node:assert/strict";
import { estimateCostUsd, parseModelPricing } from "../dist/modules/ai-models/logging/ai-cost.js";
import { AiInteractionLoggerService } from "../dist/modules/ai-models/logging/ai-interaction-logger.service.js";

// C39 — cost only from operator-supplied pricing (no built-in tariffs);
// actor/org/policy recorded from server-stamped metadata.

const PRICING = JSON.stringify({ "claude-sonnet": { inputPer1K: 0.003, outputPer1K: 0.015 } });

test("cost: no pricing configured => undefined (never invented)", () => {
  assert.equal(estimateCostUsd("claude-sonnet", 1000, 1000, {}), undefined);
  assert.equal(estimateCostUsd("claude-sonnet", 1000, 1000, { AI_MODEL_PRICING_JSON: "not json" }), undefined);
});

test("cost: computed per 1K tokens for a priced model, undefined for others or unknown tokens", () => {
  const env = { AI_MODEL_PRICING_JSON: PRICING };
  assert.equal(estimateCostUsd("claude-sonnet", 2000, 1000, env), 0.021);
  assert.equal(estimateCostUsd("kimi-k2", 2000, 1000, env), undefined);
  assert.equal(estimateCostUsd("claude-sonnet", undefined, undefined, env), undefined);
});

test("pricing parser drops malformed/negative entries", () => {
  const parsed = parseModelPricing(JSON.stringify({ a: { inputPer1K: 1, outputPer1K: 2 }, b: { inputPer1K: -1, outputPer1K: 2 }, c: "x" }));
  assert.deepEqual(Object.keys(parsed), ["a"]);
});

function build() {
  const created: any[] = [];
  const prisma = { aiInteractionLog: { create: async ({ data }: any) => { created.push(data); return data; } } };
  return { svc: new AiInteractionLoggerService(prisma as never), created };
}
const okRes = { output: "ok", provider: "ollama", modelSlug: "ollama-local", modelName: "q", latencyMs: 1, success: true } as any;

test("log records org, actor roles and policy decision for a standard request", async () => {
  const { svc, created } = build();
  await svc.logInteraction({ taskType: "general_chat", input: "hi", metadata: { tenantId: "t1", orgId: "o1", actorRoles: "CLIENT,PRO" } } as any, okRes);
  assert.equal(created[0].orgId, "o1");
  assert.equal(created[0].actorRoles, "CLIENT,PRO");
  assert.equal(created[0].policyDecision, "standard");
  assert.equal(created[0].privacyLevel, undefined);
});

test("private request: decision is private_enforced on success and denied on failure", async () => {
  const { svc, created } = build();
  const req = { taskType: "general_chat", input: "hi", privacyLevel: "sensitive", metadata: { tenantId: "t1" } } as any;
  await svc.logInteraction(req, okRes);
  await svc.logInteraction(req, { ...okRes, success: false, output: "" });
  assert.equal(created[0].policyDecision, "private_enforced");
  assert.equal(created[1].policyDecision, "denied");
  assert.equal(created[0].privacyLevel, "sensitive");
  const { svc: s2, created: c2 } = build();
  await s2.logInteraction({ taskType: "general_chat", input: "x", privacyCritical: true } as any, okRes);
  assert.equal(c2[0].privacyLevel, "privacy_critical");
});

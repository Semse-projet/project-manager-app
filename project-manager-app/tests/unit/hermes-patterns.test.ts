/**
 * Tests for the 5 Hermes-inspired patterns added to SEMSE OS.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Pattern 1: Agent Registry ─────────────────────────────────────────────────

import { AgentRegistry } from "../../packages/agents/src/registry.ts";
import "../../packages/agents/src/registrations.ts";

test("AgentRegistry — all 8 specialized agents are registered", () => {
  const expected = ["pricing", "job-planner", "trust-match", "evidence-coach", "risk", "dispute", "orchestrator", "ecv"];
  for (const role of expected) {
    assert.ok(AgentRegistry.has(role), `Role "${role}" should be registered`);
  }
});

test("AgentRegistry — resolve returns handler for pricing", () => {
  const reg = AgentRegistry.resolve("pricing");
  assert.equal(reg.role, "pricing");
  assert.ok(reg.handler, "should have a handler function");
  assert.ok(typeof reg.handler === "function");
});

test("AgentRegistry — duplicate registration throws", () => {
  assert.throws(
    () => AgentRegistry.register({
      role: "pricing" as never,
      description: "dup",
      toolsAllowed: [],
      allowsSubdelegation: false,
      handler: () => ({ actionType: "recommend", summary: "x", confidence: 0, requiresHumanReview: false, payload: {} }),
    }),
    /duplicate registration/i,
  );
});

test("AgentRegistry — resolve throws for unknown role", () => {
  assert.throws(() => AgentRegistry.resolve("ghost-agent" as never), /no handler registered/i);
});

test("AgentRegistry — orchestrator allows subdelegation, pricing does not", () => {
  assert.ok(AgentRegistry.resolve("orchestrator").allowsSubdelegation);
  assert.ok(!AgentRegistry.resolve("pricing").allowsSubdelegation);
});

// ── Pattern 3: Delegate Tool ──────────────────────────────────────────────────

import { delegateTo, delegateAll, DELEGATE_BLOCKED_ROLES } from "../../packages/agents/src/delegate.ts";

test("Delegate — blocked roles return policy-blocked result", () => {
  for (const role of DELEGATE_BLOCKED_ROLES) {
    const result = delegateTo(role as never, { goal: "test" });
    assert.ok(result.blockedByPolicy, `${role} should be blocked`);
    assert.equal(result.result.actionType, "alert");
  }
});

test("Delegate — pricing agent executes in isolation", () => {
  const result = delegateTo("pricing", {
    goal: "Estimate pricing for an electrical installation",
    context: { budgetMin: 50000, budgetMax: 120000, title: "Electrical work" },
  });
  assert.ok(!result.blockedByPolicy);
  assert.ok(result.result.confidence > 0);
  assert.ok(result.durationMs >= 0);
});

test("Delegate — restrictToolsTo intersects with agent allowed list", () => {
  const result = delegateTo("risk", {
    goal: "Evaluate risk",
    restrictToolsTo: ["context.read.job"],
  });
  assert.ok(result.toolsUsed.every((t) => t === "context.read.job"));
});

test("Delegate — delegateAll runs multiple agents", () => {
  const results = delegateAll([
    { role: "pricing", options: { goal: "price estimate" } },
    { role: "risk",    options: { goal: "risk assessment" } },
  ]);
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => !r.blockedByPolicy));
});

// ── Pattern 4: Context Engine ─────────────────────────────────────────────────

import { TokenBudgetEngine, createContextEngine } from "../../apps/api/src/modules/ai-models/context/token-budget-engine.ts";
import type { ConversationMessage } from "../../apps/api/src/modules/ai-models/context/context-engine.interface.ts";

test("TokenBudgetEngine — shouldCompress false below threshold", () => {
  const engine = new TokenBudgetEngine(128_000);
  engine.updateFromResponse({ promptTokens: 10_000, completionTokens: 200, totalTokens: 10_200 });
  assert.ok(!engine.shouldCompress());
});

test("TokenBudgetEngine — shouldCompress true above 75%", () => {
  const engine = new TokenBudgetEngine(128_000);
  engine.updateFromResponse({ promptTokens: 100_000, completionTokens: 500, totalTokens: 100_500 });
  assert.ok(engine.shouldCompress());
});

test("TokenBudgetEngine — compress keeps head + tail, inserts summary stub", () => {
  const engine = new TokenBudgetEngine(128_000);
  const messages: ConversationMessage[] = [
    { role: "system", content: "You are Prometeo." },
    ...Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: `msg ${i}` })),
    { role: "assistant", content: "last reply" },
  ];
  const compressed = engine.compress(messages);
  assert.ok(compressed.length < messages.length, "should be shorter");
  assert.equal(compressed[0].content, "You are Prometeo.", "system message preserved");
  assert.ok(compressed.some((m) => m.content.includes("compressed")), "summary stub present");
  assert.equal(engine.compressionCount, 1);
});

test("TokenBudgetEngine — onSessionReset clears state", () => {
  const engine = new TokenBudgetEngine(128_000);
  engine.updateFromResponse({ promptTokens: 90_000, completionTokens: 100, totalTokens: 90_100 });
  engine.onSessionReset!();
  assert.equal(engine.lastPromptTokens, 0);
  assert.equal(engine.compressionCount, 0);
});

test("createContextEngine — factory returns TokenBudgetEngine", () => {
  const engine = createContextEngine("token-budget", 64_000);
  assert.equal(engine.name, "token-budget");
  assert.equal(engine.contextLength, 64_000);
});

test("createContextEngine — unknown engine throws", () => {
  assert.throws(() => createContextEngine("magic-engine"), /Unknown context engine/i);
});

// ── Pattern 1+3: Orchestrator uses delegateTo when registry is wired ──────────

import { executeSpecializedAgent, setDelegateImpl } from "../../packages/agents/src/runtime.ts";
import { delegateTo as realDelegateTo } from "../../packages/agents/src/delegate.ts";

test("Orchestrator — stub mode when delegate not wired", () => {
  // Reset delegate (simulate unloaded registrations)
  setDelegateImpl(null as never);
  const result = executeSpecializedAgent("orchestrator", { eventType: "test", eventPayload: { task: "plan work" } });
  assert.equal(result.actionType, "plan");
  assert.ok(result.payload.agentsUsed.includes("risk"));
});

test("Orchestrator — delegates to risk+job-planner when wired", () => {
  setDelegateImpl(realDelegateTo);
  const result = executeSpecializedAgent("orchestrator", { eventType: "test", eventPayload: { task: "install panels" } });
  assert.equal(result.actionType, "plan");
  assert.ok(result.payload.riskAssessment !== null, "risk sub-result present");
  assert.ok(result.payload.executionPlan !== null, "plan sub-result present");
  assert.ok(result.payload.agentsUsed.includes("risk"));
  assert.ok(result.payload.agentsUsed.includes("job-planner"));
  // Restore for other tests
  setDelegateImpl(realDelegateTo);
});

/**
 * Tests that assistant preferences flow correctly into the system prompt.
 * Uses the compiled dist to test the actual runtime behavior.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Helpers that mirror buildSystemPrompt logic ───────────────────────────────
// We test the context object shape (what the harness produces) and
// the injected prefs (what buildProjectCopilotPromptContext returns).
import { buildProjectCopilotPromptContext } from "../dist/modules/agents/harnesses/project-copilot.context.js";

function makeWorkspace(overrides = {}) {
  return {
    projectId: "proj_1", title: "Renovación", status: "in_progress",
    budgetTotal: 10000, milestonesTotal: 4, milestonesApproved: 2,
    escrowStatus: "FUNDED", escrowFunded: 8000, escrowReleased: 3000,
    ...overrides,
  };
}

function makeAgentContext() {
  return { projectId: "proj_1", jobCount: 0, openDisputeCount: 0, lastActivityAt: null };
}

function makeCorpusStatus() {
  return { projectId: "proj_1", documentCount: 3, evidenceCount: 3, indexedAt: null, status: "ready" as const };
}

// ── buildProjectCopilotPromptContext ──────────────────────────────────────────

test("context includes assistantTone when provided", () => {
  const ctx = buildProjectCopilotPromptContext({
    projectId: "proj_1",
    workspace: makeWorkspace(),
    context: makeAgentContext(),
    corpusStatus: makeCorpusStatus(),
    assistantTone: "formal",
  });
  assert.equal(ctx.assistantTone, "formal");
});

test("context includes assistantLanguage when provided", () => {
  const ctx = buildProjectCopilotPromptContext({
    projectId: "proj_1",
    workspace: makeWorkspace(),
    context: makeAgentContext(),
    corpusStatus: makeCorpusStatus(),
    assistantLanguage: "en",
  });
  assert.equal(ctx.assistantLanguage, "en");
});

test("context includes assistantVerbosity when provided", () => {
  const ctx = buildProjectCopilotPromptContext({
    projectId: "proj_1",
    workspace: makeWorkspace(),
    context: makeAgentContext(),
    corpusStatus: makeCorpusStatus(),
    assistantVerbosity: "detailed",
  });
  assert.equal(ctx.assistantVerbosity, "detailed");
});

test("context includes expertMode when true", () => {
  const ctx = buildProjectCopilotPromptContext({
    projectId: "proj_1",
    workspace: makeWorkspace(),
    context: makeAgentContext(),
    corpusStatus: makeCorpusStatus(),
    expertMode: true,
  });
  assert.equal(ctx.expertMode, true);
});

test("context omits assistantTone when not provided", () => {
  const ctx = buildProjectCopilotPromptContext({
    projectId: "proj_1",
    workspace: makeWorkspace(),
    context: makeAgentContext(),
    corpusStatus: makeCorpusStatus(),
  });
  assert.equal(ctx.assistantTone, undefined);
});

test("context includes all four prefs simultaneously", () => {
  const ctx = buildProjectCopilotPromptContext({
    projectId: "proj_1",
    workspace: makeWorkspace(),
    context: makeAgentContext(),
    corpusStatus: makeCorpusStatus(),
    assistantTone: "executive",
    assistantLanguage: "en",
    assistantVerbosity: "short",
    expertMode: true,
  });
  assert.equal(ctx.assistantTone,      "executive");
  assert.equal(ctx.assistantLanguage,  "en");
  assert.equal(ctx.assistantVerbosity, "short");
  assert.equal(ctx.expertMode,          true);
});

test("context still includes standard workspace fields alongside prefs", () => {
  const ctx = buildProjectCopilotPromptContext({
    projectId: "proj_1",
    workspace: makeWorkspace(),
    context: makeAgentContext(),
    corpusStatus: makeCorpusStatus(),
    assistantTone: "technical",
    assistantLanguage: "es",
  });
  // Prefs present
  assert.equal(ctx.assistantTone, "technical");
  // Standard fields also present
  assert.equal(ctx.projectId,          "proj_1");
  assert.equal(ctx.escrowFunded,        8000);
  assert.equal(ctx.milestonesApproved,  2);
});

test("coordinator context flows through alongside prefs", () => {
  const ctx = buildProjectCopilotPromptContext({
    projectId: "proj_1",
    workspace: makeWorkspace(),
    context: makeAgentContext(),
    corpusStatus: makeCorpusStatus(),
    coordinatorContext: "## Coordinación\n✓ field-ops: Evidencia revisada.",
    assistantTone: "formal",
  });
  assert.ok(typeof ctx.coordinatorContext === "string" && ctx.coordinatorContext.includes("field-ops"));
  assert.equal(ctx.assistantTone, "formal");
});

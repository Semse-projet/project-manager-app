import test from "node:test";
import assert from "node:assert/strict";

type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "dead_lettered";

function canTransitionAgentRun(from: AgentRunStatus, to: AgentRunStatus): boolean {
  const transitions: Record<AgentRunStatus, AgentRunStatus[]> = {
    queued: ["running"],
    running: ["completed", "failed", "queued", "dead_lettered"],
    completed: [],
    failed: ["queued"],
    dead_lettered: [],
  };
  return transitions[from].includes(to);
}

test("agent run FSM: queued -> running -> completed is valid", () => {
  assert.ok(canTransitionAgentRun("queued", "running"));
  assert.ok(canTransitionAgentRun("running", "completed"));
});

test("agent run FSM: running -> failed -> queued retry is valid", () => {
  assert.ok(canTransitionAgentRun("running", "failed"));
  assert.ok(canTransitionAgentRun("failed", "queued"));
});

test("agent run FSM: running can reclaim back to queued", () => {
  assert.ok(canTransitionAgentRun("running", "queued"));
});

test("agent run FSM: stale reclaim can dead-letter", () => {
  assert.ok(canTransitionAgentRun("running", "dead_lettered"));
  assert.ok(!canTransitionAgentRun("dead_lettered", "queued"));
});

type BuildOpsPlanStatus = "pending_review" | "approved" | "changes_requested" | "rejected" | "promoted_to_legacy";

function canTransitionBuildOpsPlan(from: BuildOpsPlanStatus, to: BuildOpsPlanStatus): boolean {
  const transitions: Record<BuildOpsPlanStatus, BuildOpsPlanStatus[]> = {
    pending_review: ["approved", "changes_requested", "rejected"],
    approved: ["promoted_to_legacy", "changes_requested"],
    changes_requested: ["approved"],
    rejected: [],
    promoted_to_legacy: [],
  };
  return transitions[from].includes(to);
}

test("buildops plan FSM: pending_review transitions are valid", () => {
  assert.ok(canTransitionBuildOpsPlan("pending_review", "approved"));
  assert.ok(canTransitionBuildOpsPlan("pending_review", "changes_requested"));
  assert.ok(canTransitionBuildOpsPlan("pending_review", "rejected"));
});

test("buildops plan FSM: approved can be promoted or sent back for changes", () => {
  assert.ok(canTransitionBuildOpsPlan("approved", "promoted_to_legacy"));
  assert.ok(canTransitionBuildOpsPlan("approved", "changes_requested"));
});

test("buildops plan FSM: rejected and promoted_to_legacy are terminal", () => {
  assert.ok(!canTransitionBuildOpsPlan("rejected", "approved"));
  assert.ok(!canTransitionBuildOpsPlan("promoted_to_legacy", "approved"));
});

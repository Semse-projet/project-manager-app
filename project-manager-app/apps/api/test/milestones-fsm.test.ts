import test from "node:test";
import assert from "node:assert/strict";

type MilestoneStatus = "draft" | "awaiting_review" | "submitted" | "approved" | "rejected" | "paid";

const TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  draft: ["awaiting_review"],
  awaiting_review: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: ["paid"],
  rejected: ["awaiting_review"],
  paid: [],
};

function canTransition(from: MilestoneStatus, to: MilestoneStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

test("milestone fsm draft advances to awaiting_review only", () => {
  assert.ok(canTransition("draft", "awaiting_review"));
  assert.ok(!canTransition("draft", "submitted"));
  assert.ok(!canTransition("draft", "approved"));
});

test("milestone fsm awaiting_review advances to submitted only", () => {
  assert.ok(canTransition("awaiting_review", "submitted"));
  assert.ok(!canTransition("awaiting_review", "approved"));
});

test("milestone fsm submitted branches to approved or rejected", () => {
  assert.ok(canTransition("submitted", "approved"));
  assert.ok(canTransition("submitted", "rejected"));
  assert.ok(!canTransition("submitted", "paid"));
});

test("milestone fsm approved advances to paid and becomes terminal", () => {
  assert.ok(canTransition("approved", "paid"));
  assert.equal(TRANSITIONS.paid.length, 0);
});

test("milestone fsm rejected can be reworked back to awaiting_review", () => {
  assert.ok(canTransition("rejected", "awaiting_review"));
  assert.ok(!canTransition("rejected", "paid"));
});

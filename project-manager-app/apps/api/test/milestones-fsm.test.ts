import test from "node:test";
import assert from "node:assert/strict";

type MilestoneStatus = "draft" | "awaiting_review" | "submitted" | "approved" | "rejected" | "paid";

const TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  draft: ["submitted"],
  awaiting_review: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  rejected: ["submitted"],
  paid: [],
};

function canTransition(from: MilestoneStatus, to: MilestoneStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

test("milestone fsm draft submits directly when the evidence guard passes", () => {
  assert.ok(canTransition("draft", "submitted"));
  assert.ok(!canTransition("draft", "awaiting_review"));
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

test("milestone fsm approved advances to paid or can be corrected to rejected", () => {
  assert.ok(canTransition("approved", "paid"));
  assert.ok(canTransition("approved", "rejected"));
  assert.equal(TRANSITIONS.paid.length, 0);
});

test("milestone fsm rejected can be corrected and resubmitted", () => {
  assert.ok(canTransition("rejected", "submitted"));
  assert.ok(!canTransition("rejected", "paid"));
});

/**
 * Unit tests for governance credits algorithm — pure logic, no DB.
 * Run: node --experimental-strip-types --test tests/unit/governance-credits.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline pure functions ──────────────────────────────────────────────────────

type VoteChoice = "for" | "against" | "abstain";
type VoteOutcome = "passed" | "rejected" | "tie" | "quorum_not_met" | "open";

type CreditEvent =
  | { type: "proposal_created"; proposalRisk: "low" | "medium" | "high"; createdAt: Date }
  | { type: "vote_cast"; choice: VoteChoice; outcome: VoteOutcome; createdAt: Date }
  | { type: "proposal_passed"; authorId: string; createdAt: Date }
  | { type: "proposal_rejected"; authorId: string; createdAt: Date };

const BASE_CREDITS: Record<string, number> = {
  proposal_created_low: 5,
  proposal_created_medium: 8,
  proposal_created_high: 12,
  vote_cast: 2,
  vote_cast_aligned: 3,
  proposal_passed: 15,
  proposal_rejected: 3,
};

function computeDecayFactor(createdAt: Date, asOf: Date = new Date()): number {
  const days = Math.max(0, (asOf.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const factor = Math.exp((-Math.LN2 * days) / 90);
  return Math.round(factor * 10000) / 10000;
}

function creditsForEvent(event: CreditEvent): number {
  if (event.type === "proposal_created") {
    return BASE_CREDITS[`proposal_created_${event.proposalRisk}`] ?? 5;
  }
  if (event.type === "vote_cast") {
    const aligned = event.outcome !== "open" && event.outcome !== "quorum_not_met";
    return aligned ? BASE_CREDITS.vote_cast_aligned : BASE_CREDITS.vote_cast;
  }
  return BASE_CREDITS[event.type] ?? 0;
}

function computeTotalCredits(events: CreditEvent[], asOf: Date = new Date()): number {
  let total = 0;
  for (const e of events) {
    const raw = creditsForEvent(e);
    const decay = computeDecayFactor(e.createdAt, asOf);
    total += raw * decay;
  }
  return Math.round(total * 100) / 100;
}

function creditTier(c: number): "observer" | "participant" | "contributor" | "steward" {
  if (c >= 100) return "steward";
  if (c >= 40)  return "contributor";
  if (c >= 10)  return "participant";
  return "observer";
}

// ── computeDecayFactor ────────────────────────────────────────────────────────

test("decay factor is 1.0 for same-day event", () => {
  const now = new Date();
  const factor = computeDecayFactor(now, now);
  assert.equal(factor, 1);
});

test("decay factor is ~0.5 at 90-day half-life", () => {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const factor = computeDecayFactor(ninetyDaysAgo, now);
  assert.ok(factor > 0.49 && factor < 0.51, `expected ~0.5, got ${factor}`);
});

test("decay factor approaches 0 after 360 days (4 half-lives)", () => {
  const now = new Date();
  const ancient = new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000);
  const factor = computeDecayFactor(ancient, now);
  assert.ok(factor < 0.07, `expected <0.07, got ${factor}`);
});

// ── creditsForEvent ───────────────────────────────────────────────────────────

test("proposal_created low → 5 credits", () => {
  const e: CreditEvent = { type: "proposal_created", proposalRisk: "low", createdAt: new Date() };
  assert.equal(creditsForEvent(e), 5);
});

test("proposal_created medium → 8 credits", () => {
  const e: CreditEvent = { type: "proposal_created", proposalRisk: "medium", createdAt: new Date() };
  assert.equal(creditsForEvent(e), 8);
});

test("proposal_created high → 12 credits", () => {
  const e: CreditEvent = { type: "proposal_created", proposalRisk: "high", createdAt: new Date() };
  assert.equal(creditsForEvent(e), 12);
});

test("vote_cast with open outcome → 2 credits (base)", () => {
  const e: CreditEvent = { type: "vote_cast", choice: "for", outcome: "open", createdAt: new Date() };
  assert.equal(creditsForEvent(e), 2);
});

test("vote_cast with passed outcome → 3 credits (aligned bonus)", () => {
  const e: CreditEvent = { type: "vote_cast", choice: "for", outcome: "passed", createdAt: new Date() };
  assert.equal(creditsForEvent(e), 3);
});

test("vote_cast with quorum_not_met → 2 credits (not aligned)", () => {
  const e: CreditEvent = { type: "vote_cast", choice: "for", outcome: "quorum_not_met", createdAt: new Date() };
  assert.equal(creditsForEvent(e), 2);
});

test("proposal_passed → 15 credits", () => {
  const e: CreditEvent = { type: "proposal_passed", authorId: "u1", createdAt: new Date() };
  assert.equal(creditsForEvent(e), 15);
});

// ── computeTotalCredits ───────────────────────────────────────────────────────

test("empty events → 0 credits", () => {
  assert.equal(computeTotalCredits([]), 0);
});

test("single fresh proposal_created low → ~5 credits", () => {
  const events: CreditEvent[] = [
    { type: "proposal_created", proposalRisk: "low", createdAt: new Date() },
  ];
  const credits = computeTotalCredits(events);
  assert.ok(credits > 4.9 && credits <= 5, `expected ~5, got ${credits}`);
});

test("old event decays — 90-day-old vote_cast is ~1 credit (2 * 0.5)", () => {
  const now = new Date();
  const old = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const events: CreditEvent[] = [
    { type: "vote_cast", choice: "for", outcome: "open", createdAt: old },
  ];
  const credits = computeTotalCredits(events, now);
  assert.ok(credits > 0.9 && credits < 1.1, `expected ~1.0, got ${credits}`);
});

// ── creditTier ────────────────────────────────────────────────────────────────

test("0 credits → observer tier", () => {
  assert.equal(creditTier(0), "observer");
});

test("9 credits → observer tier (boundary)", () => {
  assert.equal(creditTier(9), "observer");
});

test("10 credits → participant tier", () => {
  assert.equal(creditTier(10), "participant");
});

test("40 credits → contributor tier", () => {
  assert.equal(creditTier(40), "contributor");
});

test("100 credits → steward tier", () => {
  assert.equal(creditTier(100), "steward");
});

test("active participant accumulates correct tier", () => {
  const now = new Date();
  const events: CreditEvent[] = [
    { type: "proposal_created", proposalRisk: "medium", createdAt: now }, // 8
    { type: "vote_cast", choice: "for", outcome: "passed", createdAt: now }, // 3
    { type: "vote_cast", choice: "against", outcome: "rejected", createdAt: now }, // 3
    { type: "proposal_passed", authorId: "u1", createdAt: now }, // 15
  ];
  const credits = computeTotalCredits(events, now);
  assert.ok(credits > 28, `expected >28, got ${credits}`);
  assert.equal(creditTier(credits), "participant");
});

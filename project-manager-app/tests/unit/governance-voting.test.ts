/**
 * Unit tests for governance voting algorithm — pure logic, no DB.
 * Run: node --experimental-strip-types --test tests/unit/governance-voting.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline pure functions ──────────────────────────────────────────────────────

type VoteChoice = "for" | "against" | "abstain";

type RawVote = {
  voterId: string;
  choice: VoteChoice;
  voterReputationScore: number;
  units: number;
};

type TallyResult = {
  totalVoters: number;
  forWeight: number;
  againstWeight: number;
  abstainWeight: number;
  totalWeight: number;
  forPercent: number;
  againstPercent: number;
  outcome: "passed" | "rejected" | "tie" | "quorum_not_met";
  quorumMet: boolean;
};

function computeVoteWeight(score: number, units: number): number {
  const reputationMultiplier =
    score >= 75 ? 2.0 :
    score >= 50 ? 1.5 :
    score >= 25 ? 1.0 :
                  0.5;
  const weight = Math.sqrt(units) * reputationMultiplier;
  return Math.round(weight * 1000) / 1000;
}

function tallyVotes(votes: RawVote[], quorumThreshold = 5, passingThreshold = 0.5): TallyResult {
  let forWeight = 0;
  let againstWeight = 0;
  let abstainWeight = 0;

  for (const v of votes) {
    const w = computeVoteWeight(v.voterReputationScore, v.units);
    if (v.choice === "for") forWeight += w;
    else if (v.choice === "against") againstWeight += w;
    else abstainWeight += w;
  }

  forWeight = Math.round(forWeight * 1000) / 1000;
  againstWeight = Math.round(againstWeight * 1000) / 1000;
  abstainWeight = Math.round(abstainWeight * 1000) / 1000;
  const totalWeight = Math.round((forWeight + againstWeight + abstainWeight) * 1000) / 1000;
  const decisive = forWeight + againstWeight;
  const quorumMet = totalWeight >= quorumThreshold;

  let outcome: TallyResult["outcome"];
  if (!quorumMet) {
    outcome = "quorum_not_met";
  } else if (decisive === 0) {
    outcome = "tie";
  } else if (forWeight / decisive > passingThreshold) {
    outcome = "passed";
  } else if (againstWeight / decisive > passingThreshold) {
    outcome = "rejected";
  } else {
    outcome = "tie";
  }

  const forPercent = decisive > 0 ? Math.round((forWeight / decisive) * 1000) / 10 : 0;
  const againstPercent = decisive > 0 ? Math.round((againstWeight / decisive) * 1000) / 10 : 0;

  return { totalVoters: votes.length, forWeight, againstWeight, abstainWeight, totalWeight, forPercent, againstPercent, outcome, quorumMet };
}

function validateVote(choice: string, units: number): { valid: boolean; reason?: string } {
  if (!["for", "against", "abstain"].includes(choice)) return { valid: false, reason: "invalid choice" };
  if (!Number.isInteger(units) || units < 1 || units > 10) return { valid: false, reason: "units must be 1-10" };
  return { valid: true };
}

function classifyProposalRisk(category: string, authorScore: number): "low" | "medium" | "high" {
  const highRisk = ["rules", "incentives"];
  const medRisk = ["platform"];
  if (highRisk.includes(category) && authorScore < 30) return "high";
  if (highRisk.includes(category)) return "medium";
  if (medRisk.includes(category) && authorScore < 30) return "medium";
  return "low";
}

// ── computeVoteWeight ─────────────────────────────────────────────────────────

test("score 0 (emerging) with 1 unit → weight 0.5", () => {
  assert.equal(computeVoteWeight(0, 1), 0.5);
});

test("score 25 (growing) with 1 unit → weight 1.0", () => {
  assert.equal(computeVoteWeight(25, 1), 1.0);
});

test("score 50 (established) with 1 unit → weight 1.5", () => {
  assert.equal(computeVoteWeight(50, 1), 1.5);
});

test("score 75 (trusted) with 1 unit → weight 2.0", () => {
  assert.equal(computeVoteWeight(75, 1), 2.0);
});

test("quadratic: 4 units gives sqrt(4)=2x multiplier vs 1 unit", () => {
  const w1 = computeVoteWeight(50, 1);
  const w4 = computeVoteWeight(50, 4);
  assert.equal(w4, w1 * 2);
});

test("9 units with trusted score gives sqrt(9)*2.0 = 6.0", () => {
  assert.equal(computeVoteWeight(80, 9), 6.0);
});

// ── tallyVotes ────────────────────────────────────────────────────────────────

test("empty votes → quorum_not_met", () => {
  const r = tallyVotes([]);
  assert.equal(r.outcome, "quorum_not_met");
  assert.equal(r.totalVoters, 0);
  assert.equal(r.quorumMet, false);
});

test("passed: majority for votes exceeding quorum", () => {
  const votes: RawVote[] = [
    { voterId: "a", choice: "for", voterReputationScore: 80, units: 2 },
    { voterId: "b", choice: "for", voterReputationScore: 60, units: 2 },
    { voterId: "c", choice: "against", voterReputationScore: 30, units: 1 },
  ];
  const r = tallyVotes(votes);
  assert.equal(r.outcome, "passed");
  assert.ok(r.quorumMet);
  assert.ok(r.forWeight > r.againstWeight);
});

test("rejected: majority against votes exceeding quorum", () => {
  const votes: RawVote[] = [
    { voterId: "a", choice: "against", voterReputationScore: 80, units: 3 },
    { voterId: "b", choice: "against", voterReputationScore: 75, units: 2 },
    { voterId: "c", choice: "for", voterReputationScore: 10, units: 1 },
  ];
  const r = tallyVotes(votes);
  assert.equal(r.outcome, "rejected");
});

test("quorum_not_met when total weight below threshold", () => {
  const votes: RawVote[] = [
    { voterId: "a", choice: "for", voterReputationScore: 10, units: 1 }, // weight 0.5
    { voterId: "b", choice: "against", voterReputationScore: 10, units: 1 }, // weight 0.5
  ];
  const r = tallyVotes(votes, 5); // quorum = 5, total = 1
  assert.equal(r.outcome, "quorum_not_met");
  assert.equal(r.quorumMet, false);
});

test("tie when equal for/against weight", () => {
  const votes: RawVote[] = [
    { voterId: "a", choice: "for", voterReputationScore: 75, units: 1 },   // 2.0
    { voterId: "b", choice: "against", voterReputationScore: 75, units: 1 }, // 2.0
    { voterId: "c", choice: "for", voterReputationScore: 25, units: 1 },   // 1.0
    { voterId: "d", choice: "against", voterReputationScore: 25, units: 1 }, // 1.0
  ];
  const r = tallyVotes(votes, 1); // low quorum to isolate tie logic
  assert.equal(r.outcome, "tie");
});

test("abstain votes count toward quorum but not decisive weight", () => {
  const votes: RawVote[] = [
    { voterId: "a", choice: "abstain", voterReputationScore: 80, units: 3 }, // 3.46
    { voterId: "b", choice: "for", voterReputationScore: 80, units: 1 }, // 2.0
  ];
  const r = tallyVotes(votes, 5);
  assert.ok(r.quorumMet, "abstain counts toward quorum");
  assert.equal(r.outcome, "passed"); // only "for" in decisive bucket
});

test("forPercent + againstPercent reflects weight distribution", () => {
  const votes: RawVote[] = [
    { voterId: "a", choice: "for", voterReputationScore: 75, units: 1 },    // 2.0
    { voterId: "b", choice: "against", voterReputationScore: 25, units: 1 }, // 1.0
  ];
  const r = tallyVotes(votes, 1);
  assert.ok(r.forPercent > 60, `forPercent should be ~66.7, got ${r.forPercent}`);
  assert.ok(r.againstPercent < 40);
});

// ── validateVote ──────────────────────────────────────────────────────────────

test("valid: choice=for units=1", () => {
  assert.equal(validateVote("for", 1).valid, true);
});

test("valid: choice=abstain units=10", () => {
  assert.equal(validateVote("abstain", 10).valid, true);
});

test("invalid: choice=maybe", () => {
  assert.equal(validateVote("maybe", 1).valid, false);
});

test("invalid: units=0", () => {
  assert.equal(validateVote("for", 0).valid, false);
});

test("invalid: units=11 (above cap)", () => {
  assert.equal(validateVote("for", 11).valid, false);
});

test("invalid: units=1.5 (non-integer)", () => {
  assert.equal(validateVote("for", 1.5).valid, false);
});

// ── classifyProposalRisk ──────────────────────────────────────────────────────

test("general category → low risk regardless of score", () => {
  assert.equal(classifyProposalRisk("general", 5), "low");
  assert.equal(classifyProposalRisk("general", 90), "low");
});

test("rules category + low score → high risk", () => {
  assert.equal(classifyProposalRisk("rules", 20), "high");
});

test("rules category + decent score → medium risk", () => {
  assert.equal(classifyProposalRisk("rules", 60), "medium");
});

test("platform category + low score → medium risk", () => {
  assert.equal(classifyProposalRisk("platform", 15), "medium");
});

test("platform category + good score → low risk", () => {
  assert.equal(classifyProposalRisk("platform", 70), "low");
});

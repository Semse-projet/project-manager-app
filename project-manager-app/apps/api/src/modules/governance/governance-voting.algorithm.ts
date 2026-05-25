// Pure functions — no side effects, no DB. Tested independently.

export type VoteChoice = "for" | "against" | "abstain";

export type RawVote = {
  voterId: string;
  choice: VoteChoice;
  voterReputationScore: number; // 0–100
  units: number; // raw units cast; quadratic cost = units²
};

export type TallyResult = {
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

/**
 * Quadratic voting weight for a single vote:
 *   weight = sqrt(units) * reputationMultiplier
 *
 * reputationMultiplier maps reputation score to [0.5 … 2.0]:
 *   score 0-24   → 0.5 (emerging, minimal influence)
 *   score 25-49  → 1.0 (growing)
 *   score 50-74  → 1.5 (established)
 *   score 75-100 → 2.0 (trusted)
 */
export function computeVoteWeight(score: number, units: number): number {
  const reputationMultiplier =
    score >= 75 ? 2.0 :
    score >= 50 ? 1.5 :
    score >= 25 ? 1.0 :
                  0.5;
  const weight = Math.sqrt(units) * reputationMultiplier;
  return Math.round(weight * 1000) / 1000;
}

/**
 * Tally all votes for a proposal.
 * quorumThreshold: minimum total weight for the outcome to be valid.
 * passingThreshold: fraction of (for+against) weight required to pass (default 0.5).
 */
export function tallyVotes(
  votes: RawVote[],
  quorumThreshold = 5,
  passingThreshold = 0.5,
): TallyResult {
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

  return {
    totalVoters: votes.length,
    forWeight,
    againstWeight,
    abstainWeight,
    totalWeight,
    forPercent,
    againstPercent,
    outcome,
    quorumMet,
  };
}

/**
 * Validate a vote before persisting:
 * - choice must be for | against | abstain
 * - units must be 1..10 (platform limit; cost = units²)
 */
export function validateVote(choice: string, units: number): { valid: boolean; reason?: string } {
  if (!["for", "against", "abstain"].includes(choice)) {
    return { valid: false, reason: "choice must be for | against | abstain" };
  }
  if (!Number.isInteger(units) || units < 1 || units > 10) {
    return { valid: false, reason: "units must be an integer between 1 and 10" };
  }
  return { valid: true };
}

/** MCA risk classifier for a proposal based on category and author reputation. */
export function classifyProposalRisk(
  category: string,
  authorReputationScore: number,
): "low" | "medium" | "high" {
  const highRiskCategories = ["rules", "incentives"];
  const mediumRiskCategories = ["platform"];

  if (highRiskCategories.includes(category) && authorReputationScore < 30) return "high";
  if (highRiskCategories.includes(category)) return "medium";
  if (mediumRiskCategories.includes(category) && authorReputationScore < 30) return "medium";
  return "low";
}

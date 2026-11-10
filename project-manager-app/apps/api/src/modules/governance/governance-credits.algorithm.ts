// Governance Credit algorithm — pure, no DB.
// Credits are non-speculative participation tokens: earned by voting/proposing, decay monthly.

export type CreditEvent =
  | { type: "proposal_created"; proposalRisk: "low" | "medium" | "high"; createdAt: Date }
  | { type: "vote_cast"; choice: "for" | "against" | "abstain"; outcome: "passed" | "rejected" | "tie" | "quorum_not_met" | "open"; createdAt: Date }
  | { type: "proposal_passed"; authorId: string; createdAt: Date }
  | { type: "proposal_rejected"; authorId: string; createdAt: Date };

export type CreditLedgerEntry = {
  eventType: string;
  credits: number;
  multiplier: number;
  decayedCredits: number;
  createdAt: Date;
};

/** Base credit values per event type. */
const BASE_CREDITS: Record<string, number> = {
  proposal_created_low: 5,
  proposal_created_medium: 8,
  proposal_created_high: 12,
  vote_cast: 2,
  vote_cast_aligned: 3,  // voted with winning outcome
  proposal_passed: 15,
  proposal_rejected: 3,  // still earn for participating
};

/**
 * Monthly exponential decay factor — half-life = 90 days.
 * decay(t) = exp(-ln(2) * days / 90)
 */
export function computeDecayFactor(createdAt: Date, asOf: Date = new Date()): number {
  const days = Math.max(0, (asOf.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const factor = Math.exp((-Math.LN2 * days) / 90);
  return Math.round(factor * 10000) / 10000;
}

/** Compute raw credits for a single event (before decay). */
export function creditsForEvent(event: CreditEvent): number {
  if (event.type === "proposal_created") {
    return BASE_CREDITS[`proposal_created_${event.proposalRisk}`] ?? 5;
  }
  if (event.type === "vote_cast") {
    const aligned = event.outcome !== "open" && event.outcome !== "quorum_not_met";
    return aligned ? BASE_CREDITS.vote_cast_aligned : BASE_CREDITS.vote_cast;
  }
  return BASE_CREDITS[event.type] ?? 0;
}

/** Compute total decayed governance credits from a ledger of events. */
export function computeTotalCredits(events: CreditEvent[], asOf: Date = new Date()): number {
  let total = 0;
  for (const e of events) {
    const raw = creditsForEvent(e);
    const decay = computeDecayFactor(e.createdAt, asOf);
    total += raw * decay;
  }
  return Math.round(total * 100) / 100;
}

// ── Quadratic vote spending (spec api.governance-quadratic-credits) ─────────

/** Ledger event type for credits spent on a vote; stored with a negative `credits` value. */
export const VOTE_SPENT_EVENT = "vote_spent";

/**
 * Credits a vote of `units` costs: units² − 1 (decision D1). One unit is always free, so a member with no credits can
 * still vote; every extra unit of intensity is paid quadratically (2 → 3, 3 → 8, …, 10 → 99).
 */
export function voteCost(units: number): number {
  return units * units - 1;
}

export type StoredCreditEvent = { eventType: string; credits: number | { toString(): string }; createdAt: Date };

export type CreditBalance = {
  /** Earned credits with the 90-day half-life decay (participation; drives the tier). */
  earned: number;
  /** Credits spent on votes; never decays and is never refunded (decision PD-09). */
  spent: number;
  /** earned − spent: what the member can still spend on votes. */
  available: number;
};

/** Balance from stored ledger rows: earned rows decay, `vote_spent` rows do not. */
export function computeCreditBalance(events: StoredCreditEvent[], asOf: Date = new Date()): CreditBalance {
  let earned = 0;
  let spent = 0;
  for (const e of events) {
    const credits = Number(e.credits);
    if (e.eventType === VOTE_SPENT_EVENT) spent += Math.abs(credits);
    else earned += credits * computeDecayFactor(e.createdAt, asOf);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { earned: round(earned), spent: round(spent), available: round(earned - spent) };
}

/** Map total credits to a governance tier label. */
export function creditTier(totalCredits: number): "observer" | "participant" | "contributor" | "steward" {
  if (totalCredits >= 100) return "steward";
  if (totalCredits >= 40)  return "contributor";
  if (totalCredits >= 10)  return "participant";
  return "observer";
}

export type GovernanceCreditSummary = {
  totalCredits: number;
  tier: "observer" | "participant" | "contributor" | "steward";
  eventsCount: number;
  /** Credits spent on votes (never decays); present when read from the stored ledger. */
  spentCredits?: number;
  /** totalCredits − spentCredits: what can still be spent on votes. */
  availableCredits?: number;
};

export function summarizeCredits(events: CreditEvent[], asOf?: Date): GovernanceCreditSummary {
  const totalCredits = computeTotalCredits(events, asOf);
  return {
    totalCredits,
    tier: creditTier(totalCredits),
    eventsCount: events.length,
  };
}

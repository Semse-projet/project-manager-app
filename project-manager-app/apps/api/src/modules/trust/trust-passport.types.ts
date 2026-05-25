import type { ReputationSignals, ReputationTier } from "@semse/schemas";

export type TrustPassportContributions = {
  jobsCompleted: number;
  milestonesDelivered: number;
  evidenceSubmitted: number;
  /** disputes raised against / total jobs as professional. 0-1, lower is better. */
  disputeRate: number;
  avgRating: number;
  totalRatings: number;
};

export type TrustPassportClaims = {
  sub: string;
  iss: "semse";
  typ: "trust-passport";
  jti: string;
  iat: number;
  exp: number;
  reputation: {
    score: number;
    tier: ReputationTier;
    algorithmVersion: string;
    signals: ReputationSignals;
  };
  contributions: TrustPassportContributions;
  computedAt: string;
};

export type TrustPassportView = {
  token: string;
  claims: TrustPassportClaims;
  expiresAt: string;
};

export type TrustPassportVerifyResult =
  | { valid: true; claims: TrustPassportClaims }
  | { valid: false; reason: string };

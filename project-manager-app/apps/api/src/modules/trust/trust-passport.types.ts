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

/**
 * Signing algorithm profile — allows future migration to PQC without breaking
 * existing tokens. Current: HMAC-SHA256. Future: Dilithium3, ML-DSA-65.
 */
export type CryptoProfile = "HMAC-SHA256" | "Dilithium3" | "ML-DSA-65";

export type TrustPassportClaims = {
  sub: string;
  iss: "semse";
  typ: "trust-passport";
  jti: string;
  iat: number;
  exp: number;
  /** Signing algorithm used — enables PQC migration path (P6) */
  cryptoProfile: CryptoProfile;
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

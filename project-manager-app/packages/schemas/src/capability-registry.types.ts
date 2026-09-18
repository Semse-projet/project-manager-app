/**
 * View types for the Capability Reality Registry (ADR-032), read-only API at
 * `GET /v1/capabilities` (`apps/api/src/modules/capability-registry`).
 *
 * `maturity` and `reachability` are deliberately separate axes — see
 * `CapabilityReachability`'s doc comment. A consumer (e.g. a catalog UI)
 * must read BOTH from here and must never re-derive one from the other or
 * maintain its own parallel role->status mapping; that is exactly the
 * "apparent vs. real capability" drift the SEMSE Agents Governance
 * Reconciliation (ADR-035/036/037) exists to eliminate.
 */
export const capabilityMaturityValues = [
  "DESIGNED",
  "IMPLEMENTED",
  "TESTED",
  "INTEGRATED",
  "DEPLOYED",
  "VERIFIED",
  "PRODUCTION",
] as const;
export type CapabilityMaturity = (typeof capabilityMaturityValues)[number];

export const capabilityHealthValues = ["HEALTHY", "DEGRADED", "BROKEN", "UNKNOWN"] as const;
export type CapabilityHealth = (typeof capabilityHealthValues)[number];

/**
 * Operational reachability/lifecycle — NOT a proxy for maturity. Per
 * ADR-037, a role can be `maturity: "INTEGRATED"` (a real, tested
 * production-entrypoint chain exists) while `reachability` is
 * `"INTEGRATION_ONLY"` (nothing currently triggers it) or even
 * `"DEPRECATED"` (the chain exists but should not receive further
 * investment) — neither combination is contradictory, and a consumer must
 * display both, not collapse them into one status.
 */
export const capabilityReachabilityValues = [
  "PRODUCTION_REACHABLE",
  "INTEGRATION_ONLY",
  "DESIGNED_BUT_UNWIRED",
  "DEPRECATED",
] as const;
export type CapabilityReachability = (typeof capabilityReachabilityValues)[number];

export const capabilityEvidenceKindValues = ["TEST", "DEPLOYMENT", "PRODUCTION_OBSERVATION", "ADR"] as const;
export type CapabilityEvidenceKind = (typeof capabilityEvidenceKindValues)[number];

export interface CapabilityEvidenceRecord {
  id: string;
  capabilityId: string;
  kind: CapabilityEvidenceKind;
  reference: string;
  note: string | null;
  recordedAt: string;
}

export interface CapabilityRecord {
  id: string;
  key: string;
  domain: string;
  description: string;
  maturity: CapabilityMaturity;
  health: CapabilityHealth;
  /** Null for capabilities the reconciliation hasn't classified (e.g. pre-existing, non-agent-role rows from ADR-032's own seed) — a null here must render as unknown, never as available. */
  reachability: CapabilityReachability | null;
  ownerModule: string;
  createdAt: string;
  updatedAt: string;
  evidence: CapabilityEvidenceRecord[];
}

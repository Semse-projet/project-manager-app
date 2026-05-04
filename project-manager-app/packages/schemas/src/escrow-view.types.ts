/**
 * @semse/schemas — escrow-view.types.ts
 *
 * API-response-aligned types for Escrow and Milestone views.
 * These use UPPERCASE enum values as returned by the NestJS / Prisma layer,
 * distinct from the lowercase UI-facing types in client.types.ts.
 */

// ─────────────────────────────────────────────────────────────
// ESCROW — API RESPONSE TYPES
// ─────────────────────────────────────────────────────────────

/** Escrow status as returned by the NestJS API (maps to Prisma PaymentEscrow.status) */
export type EscrowApiStatus =
  | "PENDING"
  | "FUNDED"
  | "HELD"
  | "PARTIALLY_RELEASED"
  | "RELEASED"
  | "DISPUTED"
  | "REFUNDED";

/** Milestone status as returned by the NestJS API (maps to Prisma MilestoneStatus enum) */
export type MilestoneApiStatus =
  | "DRAFT"
  | "AWAITING_REVIEW"
  | "SUBMITTED"
  | "APPROVED"
  | "PAID"
  | "REJECTED";

/** A single milestone within an EscrowView response */
export interface EscrowMilestoneView {
  id: string;
  title: string;
  description?: string;
  amount: number;
  status: MilestoneApiStatus;
  sequence: number;
  dueDate?: string;      // ISO date string
  completedAt?: string;  // ISO date string
  reviewDecision?: string;
  rejectionReason?: string;
  evidenceCount?: number;
}

/** Full escrow view returned by GET /v1/jobs/:jobId/escrow */
export interface EscrowView {
  id?: string;
  jobId: string;
  status: EscrowApiStatus;
  totalAmount: number;
  releasedAmount: number;
  availableAmount: number;
  holdbackAmount?: number;
  currency?: string;
  milestones: EscrowMilestoneView[];
  createdAt?: string;
  updatedAt?: string;
}

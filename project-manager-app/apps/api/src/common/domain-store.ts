import type { RuntimeAgentRole } from "@semse/agents";

export type WorkerAgentRole = RuntimeAgentRole | "field-ops" | "project-copilot";

export type JobRecord = {
  id: string;
  tenantId: string;
  title: string;
  category?: string;
  scope: string;
  status:
    | "draft"
    | "posted"
    | "published"
    | "reserved"
    | "accepted"
    | "in_progress"
    | "review"
    | "completed"
    | "dispute"
    | "awarded"
    | "cancelled";
  budgetType?: string;
  budgetMin?: number;
  budgetMax?: number;
  location?: string;
  urgency?: string;
  deadline?: string;
  clientOrgId?: string;
  clientUserId?: string;
  preferredProfessional?: {
    userId: string;
    displayName: string;
    publicSlug?: string;
  };
};

export type ReservationRecord = {
  id: string;
  tenantId: string;
  jobId: string;
  professionalId: string;
  professionalOrgId?: string;
  status: "active" | "expired" | "accepted" | "released";
  reservedAt: string;
  expiresAt: string;
  releasedAt?: string;
  acceptedAt?: string;
};

export type ContractRecord = {
  id: string;
  tenantId: string;
  jobId: string;
  clientOrgId?: string;
  professionalOrgId?: string;
  clientUserId: string;
  professionalUserId: string;
  termsJson: Record<string, unknown>;
  signedClientAt?: string;
  signedProAt?: string;
  pdfUrl?: string;
  documentHash?: string;
};

export type BidRecord = {
  id: string;
  jobId: string;
  tenantId: string;
  proOrgId: string;
  professionalUserId?: string;
  amount: number;
  etaDays: number;
  status: "submitted" | "accepted" | "rejected";
};

export type DisputeRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  reason: string;
  reasonCode?: string;
  status: "open" | "assigned" | "under_review" | "resolved" | "rejected";
  assigneeUserId?: string;
  resolvedByUserId?: string;
  resolution?: string;
  resolutionType?: string;
  evidenceBundleIds: string[];
};

export type ProjectRecord = {
  id: string;
  tenantId: string;
  jobId: string;
  assignedProOrgId: string;
  status: "open" | "in_progress" | "blocked" | "completed" | "cancelled";
};

export type MilestoneRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  amount: number;
  sequence: number;
  status: "draft" | "awaiting_review" | "submitted" | "approved" | "rejected" | "paid";
  rejectionReason?: string;
  reviewDecision?: "approve" | "reject" | "request_changes";
  evidenceCount?: number;
};

export type EscrowRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  jobId?: string;
  contractId?: string;
  status: "active" | "pending_settlement" | "closed" | "cancelled" | "released";
  totalAmount: number;
  currency: string;
};

export type PaymentTxnRecord = {
  id: string;
  tenantId: string;
  escrowId: string;
  projectId: string;
  jobId?: string;
  contractId?: string;
  milestoneId?: string;
  type: "deposit" | "release" | "holdback" | "fee" | "refund";
  amount: number;
  status: "pending" | "succeeded" | "failed";
  createdAt: string;
};

export type AgentRunRecord = {
  id: string;
  tenantId: string;
  agentType: WorkerAgentRole;
  status: "queued" | "running" | "completed" | "failed";
  triggerType: "manual" | "event" | "schedule";
  correlationId: string;
  input?: Record<string, unknown>;
  workerId?: string;
  attempts: number;
  maxAttempts: number;
  deadLettered: boolean;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  heartbeatAt?: string;
  endedAt?: string;
  durationMs?: number;
  toolCallCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type ChatThread = {
  id: string;
  tenantId: string;
  userId: string;
  agentId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ChatReply = {
  threadId: string;
  agentId: string;
  response: string;
  mode: "runtime" | "llm" | "fallback" | "local";
  provider?: string;
  model?: string;
  timestamp: string;
};

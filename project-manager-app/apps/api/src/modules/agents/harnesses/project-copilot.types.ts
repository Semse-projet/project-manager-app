// ─────────────────────────────────────────────────────────────────────────────
// ProjectCopilotHarness — Runtime contracts
// ─────────────────────────────────────────────────────────────────────────────

export type { AgentAction, AgentActionType, AgentApprovalMode } from "@semse/schemas";
import type { CopilotProposedPlan } from "../plan-mode.types.js";

export type CitationRef = {
  id: string;
  sourceType: "document" | "evidence" | "dispute" | "payment" | "activity";
  sourceId: string;
  excerpt: string;
  score: number;
};

export type ProjectWorkspaceView = {
  projectId: string;
  jobId?: string;
  title: string;
  status: string;
  budgetTotal: number;
  milestonesTotal: number;
  milestonesApproved: number;
  escrowStatus: string;
  escrowFunded: number;
  escrowReleased: number;
  preferredProfessional?: {
    userId: string;
    displayName: string;
    publicSlug?: string | null;
    selectedAt?: string | null;
  } | null;
};

export type ProjectAgentContextView = {
  projectId: string;
  jobCount: number;
  openDisputeCount: number;
  lastActivityAt: string | null;
};

export type ProjectCopilotJournalView = {
  projectId: string;
  entries: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: "user" | "agent";
  }>;
};

export type CorpusStatusView = {
  projectId: string;
  documentCount: number;
  evidenceCount: number;
  indexedAt: string | null;
  status: "empty" | "indexing" | "ready";
};

export type AgentRunView = {
  id: string;
  agentType: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  toolCallCount?: number;
};

export type ProjectSearchResponseView = {
  query: string;
  results: Array<{
    id: string;
    sourceType: string;
    sourceId: string;
    excerpt: string;
    score: number;
  }>;
};

// ── Actor ─────────────────────────────────────────────────────────────────────

export type AgentActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

// ── Input ─────────────────────────────────────────────────────────────────────

export type ProjectCopilotHarnessInput =
  | {
      kind: "chat";
      projectId: string;
      message: string;
      threadId?: string;
    }
  | {
      kind: "search";
      projectId: string;
      query: string;
      topK?: number;
    }
  | {
      kind: "action";
      projectId: string;
      actionType: string;
      payload: Record<string, unknown>;
    }
  | {
      kind: "refresh";
      projectId: string;
    };

// ── Runtime context ───────────────────────────────────────────────────────────

export type ProjectCopilotHarnessRuntime = {
  actor: AgentActor;
  requestId: string;
  projectId: string;
  workspace: ProjectWorkspaceView;
  context: ProjectAgentContextView;
  journal: ProjectCopilotJournalView;
  corpusStatus: CorpusStatusView;
  activePlan: CopilotProposedPlan | null;
};

// ── Output ────────────────────────────────────────────────────────────────────

import type { AgentAction } from "@semse/schemas";

export type BlockedActionView = {
  actionType: string;
  summary: string;
  reason: string;
};

export type ProjectCopilotHarnessOutput =
  | {
      kind: "chat";
      threadId: string;
      message: string;
      citations: CitationRef[];
      refreshTargets: RefreshTarget[];
      proposedActions: AgentAction[];
      blockedActions?: BlockedActionView[];
      proposedPlan?: CopilotProposedPlan;
      workPlan?: CopilotProposedPlan;
      activePlan?: CopilotProposedPlan;
      provider?: string;
      model?: string;
      mode?: string;
    }
  | {
      kind: "search";
      result: ProjectSearchResponseView;
      refreshTargets: RefreshTarget[];
    }
  | {
      kind: "action";
      success: boolean;
      message: string;
      approvalId?: string;
      approvalStatus?: "pending" | "approved" | "rejected";
      approvalMode?: "none" | "recommended" | "required";
      executedAction?: string;
      executionSummary?: string;
      refreshTargets: RefreshTarget[];
    }
  | {
      kind: "refresh";
      workspace: ProjectWorkspaceView;
      context: ProjectAgentContextView;
      journal: ProjectCopilotJournalView;
      corpusStatus: CorpusStatusView;
      actions: AgentAction[];
      runs: AgentRunView[];
      activePlan?: CopilotProposedPlan | null;
    };

export type RefreshTarget =
  | "workspace"
  | "context"
  | "journal"
  | "runs"
  | "actions"
  | "corpus";

export type WorkspaceMemoryKind =
  | "operator_note"
  | "repo_fact"
  | "runtime_fact"
  | "decision"
  | "run_summary"
  | "task_state";

export type WorkspaceMemoryScope = "workspace" | "repo" | "run" | "task";

// C85 (Agent Memory governance) — shared with AgentMemory, see
// docs/specs/knowledge/agent-memory-governance.spec.md. Memory is context,
// never canonical truth or standalone authorization to act.
export type WorkspaceMemorySensitivity = "public" | "internal" | "restricted" | "confidential";
export type WorkspaceMemoryEpistemicStatus = "remembered_context" | "inference" | "verified_fact";
export type WorkspaceMemoryStatus = "active" | "superseded" | "corrected" | "invalidated";

export const WORKSPACE_SENSITIVITY_RANK: Record<WorkspaceMemorySensitivity, number> = {
  public: 0,
  internal: 1,
  restricted: 2,
  confidential: 3,
};

export type WorkspaceMemoryProvenance = {
  producedBy: string;
  method: "user_input" | "llm_summary" | "llm_inference" | "system_event" | "import" | "correction";
  model?: string;
  correlationId?: string;
};

export interface WorkspaceMemoryRecord {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  workspaceId: string;
  repoId?: string;
  runId?: string;
  taskId?: string;
  kind: WorkspaceMemoryKind;
  scope: WorkspaceMemoryScope;
  title: string;
  summary: string;
  body?: string;
  tags: string[];
  sourceRef?: string;
  updatedAtIso: string;
  // C85 governance fields are optional on the shared record type so the ~15
  // existing domain services that already append WorkspaceMemoryRecord entries
  // (payments, milestones, jobs, disputes, autonomy, agents, …) keep compiling
  // unchanged. WorkspaceMemoryRepository fills in safe defaults on write and
  // always returns them populated on read — see parseStoredEntry().
  sensitivity?: WorkspaceMemorySensitivity;
  epistemicStatus?: WorkspaceMemoryEpistemicStatus;
  confidence?: number;
  provenance?: WorkspaceMemoryProvenance;
  subjectType?: string;
  subjectId?: string;
  status?: WorkspaceMemoryStatus;
  supersedesId?: string;
  supersededById?: string;
  correctedFromId?: string;
  conflictsWith?: string[];
  invalidatedAt?: string;
  invalidatedBy?: string;
  invalidationReason?: string;
  retentionUntil?: string;
}

export interface WorkspaceMemoryQuery {
  tenantId: string;
  orgId?: string;
  workspaceId: string;
  repoId?: string;
  runId?: string;
  taskId?: string;
  kinds?: WorkspaceMemoryKind[];
  tags?: string[];
  /** C85 governance: exclude superseded/corrected/invalidated entries unless true. Defaults to false. */
  includeInactive?: boolean;
  /** C85 governance: ceiling on sensitivity to surface. Defaults to "internal". */
  maxSensitivity?: WorkspaceMemorySensitivity;
}

export function buildWorkspaceMemoryId(input: {
  workspaceId: string;
  kind: WorkspaceMemoryKind;
  slug: string;
}): string {
  return `${input.workspaceId}:${input.kind}:${input.slug}`;
}

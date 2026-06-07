export type WorkspaceMemoryKind =
  | "operator_note"
  | "repo_fact"
  | "runtime_fact"
  | "decision"
  | "run_summary"
  | "task_state";

export type WorkspaceMemoryScope = "workspace" | "repo" | "run" | "task";

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
}

export function buildWorkspaceMemoryId(input: {
  workspaceId: string;
  kind: WorkspaceMemoryKind;
  slug: string;
}): string {
  return `${input.workspaceId}:${input.kind}:${input.slug}`;
}

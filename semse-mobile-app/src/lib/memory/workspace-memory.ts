export type WorkspaceMemoryRecord = {
  id: string;
  workspaceId: string;
  tag: string;
  summary: string;
  createdAt: string;
};

export async function fetchWorkspaceMemory(_workspaceId: string): Promise<WorkspaceMemoryRecord[]> {
  return [];
}

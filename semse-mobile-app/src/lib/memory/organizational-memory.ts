export type OrganizationalMemoryScope = "workspace" | "repo" | "runtime" | "entity";

export type OrganizationalMemoryQuery = {
  scope: OrganizationalMemoryScope;
  entityId?: string;
  workspaceId?: string;
  query: string;
  limit?: number;
};

export type OrganizationalMemoryHit = {
  id: string;
  title: string;
  summary: string;
  sourceType: string;
  score: number;
};

export async function queryOrganizationalMemory(
  _input: OrganizationalMemoryQuery,
): Promise<OrganizationalMemoryHit[]> {
  return [];
}

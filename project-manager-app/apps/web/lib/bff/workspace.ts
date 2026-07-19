import type {
  MissionLoadResponse,
  MissionUnloadResponse,
  NavigationUpdateResponse,
  UpdateNavigationRequest,
  WorkspaceContextResponse,
  WorkspaceMissionType,
} from "@semse/schemas";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export async function getWorkspaceContext(): Promise<WorkspaceContextResponse> {
  return unwrap(await fetch("/api/semse/workspace/context", { cache: "no-store" }));
}

export async function updateWorkspaceNavigation(
  input: UpdateNavigationRequest,
): Promise<NavigationUpdateResponse> {
  return unwrap(
    await fetch("/api/semse/workspace/navigation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function loadWorkspaceMission(input: {
  missionId: string;
  missionType: WorkspaceMissionType;
  title?: string;
}): Promise<MissionLoadResponse> {
  return unwrap(
    await fetch("/api/semse/workspace/mission/load", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function unloadWorkspaceMission(missionId: string): Promise<MissionUnloadResponse> {
  return unwrap(
    await fetch("/api/semse/workspace/mission/unload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ missionId }),
    }),
  );
}

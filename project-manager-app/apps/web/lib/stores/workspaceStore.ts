"use client";

import { useSyncExternalStore } from "react";
import { getWorkspaceContext, loadWorkspaceMission, unloadWorkspaceMission, updateWorkspaceNavigation } from "../bff/workspace";
import { createWorkspaceStore, type WorkspaceStoreState } from "./workspace-state";

export type { WorkspaceStoreState } from "./workspace-state";
export const workspaceStore = createWorkspaceStore({
  getContext: getWorkspaceContext,
  navigate: updateWorkspaceNavigation,
  loadMission: loadWorkspaceMission,
  unloadMission: unloadWorkspaceMission,
});

export function useWorkspaceStore(): WorkspaceStoreState {
  return useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot, workspaceStore.getServerSnapshot);
}

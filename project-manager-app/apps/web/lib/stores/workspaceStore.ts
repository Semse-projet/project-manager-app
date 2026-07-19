"use client";

import { useSyncExternalStore } from "react";
import type {
  WorkspaceActiveMission,
  WorkspaceContextResponse,
  WorkspaceMissionType,
  WorkspaceRightPanelMode,
} from "@semse/schemas";
import {
  getWorkspaceContext,
  loadWorkspaceMission,
  unloadWorkspaceMission,
  updateWorkspaceNavigation,
} from "../bff/workspace";

export type WorkspaceStoreState = {
  loading: boolean;
  error: string | null;
  context: WorkspaceContextResponse | null;
  activeSection: string;
  navigationHistory: string[];
  activeMission: WorkspaceActiveMission | null;
  rightPanelMode: WorkspaceRightPanelMode;
};

const initialState: WorkspaceStoreState = {
  loading: false,
  error: null,
  context: null,
  activeSection: "home",
  navigationHistory: ["home"],
  activeMission: null,
  rightPanelMode: "operational",
};

// Minimal framework-agnostic external store — avoids pulling in a state library
// while still giving components a `useSyncExternalStore` subscription.
let state: WorkspaceStoreState = initialState;
const listeners = new Set<() => void>();

function setState(patch: Partial<WorkspaceStoreState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): WorkspaceStoreState {
  return state;
}

function applyContext(ctx: WorkspaceContextResponse) {
  setState({
    context: ctx,
    activeSection: ctx.leftPanelState.activeSection,
    navigationHistory: ctx.leftPanelState.navigationHistory,
    activeMission: ctx.activeMission,
    rightPanelMode: ctx.rightPanelState.mode,
    error: null,
  });
}

export const workspaceStore = {
  subscribe,
  getSnapshot,

  async refresh(): Promise<void> {
    setState({ loading: true, error: null });
    try {
      applyContext(await getWorkspaceContext());
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "No se pudo cargar el Workspace" });
    } finally {
      setState({ loading: false });
    }
  },

  async navigate(section: string, rightPanelMode?: WorkspaceRightPanelMode): Promise<void> {
    try {
      const res = await updateWorkspaceNavigation({ leftPanelAction: section, rightPanelMode });
      setState({
        activeSection: res.leftPanelState.activeSection,
        navigationHistory: res.leftPanelState.navigationHistory,
        rightPanelMode: rightPanelMode ?? state.rightPanelMode,
        error: null,
      });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "Error de navegación" });
    }
  },

  async loadMission(missionId: string, missionType: WorkspaceMissionType, title?: string): Promise<void> {
    try {
      const res = await loadWorkspaceMission({ missionId, missionType, title });
      setState({
        activeMission: { missionId: res.missionId, missionType: res.missionType, title: res.title },
        rightPanelMode: res.rightPanelMode,
        error: null,
      });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "No se pudo abrir la misión" });
    }
  },

  async unloadMission(missionId: string): Promise<void> {
    try {
      await unloadWorkspaceMission(missionId);
      setState({ activeMission: null, rightPanelMode: "operational", error: null });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "No se pudo cerrar la misión" });
    }
  },

  /** Test/SSR helper — resets module-level state. */
  reset(): void {
    state = initialState;
    for (const listener of listeners) listener();
  },
};

export function useWorkspaceStore(): WorkspaceStoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

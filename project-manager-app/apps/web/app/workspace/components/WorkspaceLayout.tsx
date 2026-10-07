"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import type { WorkspaceMissionType, WorkspaceRightPanelMode } from "@semse/schemas";
import { useWorkspaceStore, workspaceStore } from "../../../lib/stores/workspaceStore";
import { LeftPanel } from "./LeftPanel";
import { CentralPanel } from "./CentralPanel";
import { RightPanel } from "./RightPanel";
import { NavigationBreadcrumb } from "./NavigationBreadcrumb";

export function WorkspaceLayout() {
  const state = useWorkspaceStore();

  useEffect(() => {
    void workspaceStore.refresh();
  }, []);

  function handleNavigate(section: string) {
    void workspaceStore.navigate(section);
  }

  function handleModeChange(mode: WorkspaceRightPanelMode) {
    void workspaceStore.navigate(state.activeSection, mode);
  }

  function handleLoadMission(missionId: string, missionType: WorkspaceMissionType, title: string) {
    void workspaceStore.loadMission(missionId, missionType, title);
  }

  function handleUnloadMission(missionId: string) {
    void workspaceStore.unloadMission(missionId);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-white text-slate-900">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-base font-semibold text-slate-900">SEMSE Workspace</h1>
          <NavigationBreadcrumb history={state.navigationHistory} />
        </div>
        <button
          type="button"
          onClick={() => void workspaceStore.refresh()}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </header>

      {state.error && (
        <div className="border-b border-red-100 bg-red-50 px-6 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className="hidden shrink-0 lg:flex">
          <LeftPanel activeSection={state.activeSection} onNavigate={handleNavigate} />
        </div>
        <CentralPanel
          activeSection={state.activeSection}
          activeMission={state.activeMission}
          onLoadMission={handleLoadMission}
          onUnloadMission={handleUnloadMission}
        />
        <div className="hidden shrink-0 xl:flex">
          <RightPanel
            mode={state.rightPanelMode}
            activeMission={state.activeMission}
            onModeChange={handleModeChange}
          />
        </div>
      </div>
    </div>
  );
}

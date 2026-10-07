"use client";

import { useEffect, useState } from "react";
import { Menu, PanelRight, RefreshCw, X } from "lucide-react";
import type { WorkspaceMissionType, WorkspaceRightPanelMode } from "@semse/schemas";
import { useWorkspaceStore, workspaceStore } from "../../../lib/stores/workspaceStore";
import { LeftPanel } from "./LeftPanel";
import { CentralPanel } from "./CentralPanel";
import { RightPanel } from "./RightPanel";
import { NavigationBreadcrumb } from "./NavigationBreadcrumb";

export function WorkspaceLayout() {
  const state = useWorkspaceStore();\n  const [mobileNavOpen, setMobileNavOpen] = useState(false);\n  const [mobileContextOpen, setMobileContextOpen] = useState(false);

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
          <NavigationBreadcrumb history={state.navigationHistory} />\n          <div className="mt-2 flex gap-2 lg:hidden">\n            <button type="button" onClick={() => setMobileNavOpen(true)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50" aria-label="Abrir navegación del Workspace"><Menu className="h-4 w-4" />Secciones</button>\n            <button type="button" onClick={() => setMobileContextOpen(true)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 xl:hidden" aria-label="Abrir contexto y configuración"><PanelRight className="h-4 w-4" />Contexto</button>\n          </div>
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

      {mobileNavOpen && (\n        <div className="fixed inset-0 z-50 flex lg:hidden">\n          <button type="button" className="absolute inset-0 bg-slate-950/30" onClick={() => setMobileNavOpen(false)} aria-label="Cerrar navegación" />\n          <div className="relative flex h-full bg-white shadow-xl">\n            <LeftPanel activeSection={state.activeSection} onNavigate={(section) => { handleNavigate(section); setMobileNavOpen(false); }} />\n            <button type="button" onClick={() => setMobileNavOpen(false)} className="m-2 h-9 w-9 rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Cerrar navegación"><X className="h-4 w-4" /></button>\n          </div>\n        </div>\n      )}\n\n      {mobileContextOpen && (\n        <div className="fixed inset-0 z-50 flex justify-end xl:hidden">\n          <button type="button" className="absolute inset-0 bg-slate-950/30" onClick={() => setMobileContextOpen(false)} aria-label="Cerrar contexto" />\n          <div className="relative flex h-full bg-white shadow-xl">\n            <button type="button" onClick={() => setMobileContextOpen(false)} className="m-2 h-9 w-9 rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Cerrar contexto"><X className="h-4 w-4" /></button>\n            <RightPanel mode={state.rightPanelMode} activeMission={state.activeMission} onModeChange={handleModeChange} />\n          </div>\n        </div>\n      )}\n\n      <div className="flex min-w-0 flex-1 overflow-hidden">
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

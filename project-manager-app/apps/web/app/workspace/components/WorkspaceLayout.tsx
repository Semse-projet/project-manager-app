"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, PanelRight, RefreshCw, X } from "lucide-react";
import type { WorkspaceMissionType, WorkspaceRightPanelMode } from "@semse/schemas";
import { useWorkspaceStore, workspaceStore } from "../../../lib/stores/workspaceStore";
import { LeftPanel } from "./LeftPanel";
import { CentralPanel } from "./CentralPanel";
import { RightPanel } from "./RightPanel";
import { NavigationBreadcrumb } from "./NavigationBreadcrumb";

export function WorkspaceLayout() {
  const state = useWorkspaceStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const navDialogRef = useRef<HTMLDivElement>(null);
  const contextDialogRef = useRef<HTMLDivElement>(null);
  const navTriggerRef = useRef<HTMLButtonElement>(null);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void workspaceStore.refresh();
  }, []);

  useEffect(() => {
    const activeRef = mobileNavOpen ? navDialogRef : mobileContextOpen ? contextDialogRef : null;
    if (!activeRef?.current) return;
    const dialog = activeRef.current;
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mobileNavOpen) setMobileNavOpen(false);
        if (mobileContextOpen) setMobileContextOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      (mobileNavOpen ? navTriggerRef : contextTriggerRef).current?.focus();
    };
  }, [mobileNavOpen, mobileContextOpen]);

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
          <div className="mt-2 flex gap-2">
            <button ref={navTriggerRef} type="button" onClick={() => setMobileNavOpen(true)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 lg:hidden" aria-haspopup="dialog" aria-label="Abrir navegación del Workspace"><Menu className="h-4 w-4" />Secciones</button>
            <button ref={contextTriggerRef} type="button" onClick={() => setMobileContextOpen(true)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 xl:hidden" aria-haspopup="dialog" aria-label="Abrir contexto y configuración"><PanelRight className="h-4 w-4" />Contexto</button>
          </div>
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

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/30" onClick={() => setMobileNavOpen(false)} aria-label="Cerrar navegación" />
          <div ref={navDialogRef} role="dialog" aria-modal="true" aria-label="Navegación del Workspace" className="relative flex h-full bg-white shadow-xl">
            <LeftPanel activeSection={state.activeSection} onNavigate={(section) => { handleNavigate(section); setMobileNavOpen(false); }} />
            <button type="button" onClick={() => setMobileNavOpen(false)} className="m-2 h-9 w-9 rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Cerrar navegación"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {mobileContextOpen && (
        <div className="fixed inset-0 z-50 flex justify-end xl:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/30" onClick={() => setMobileContextOpen(false)} aria-label="Cerrar contexto" />
          <div ref={contextDialogRef} role="dialog" aria-modal="true" aria-label="Contexto y configuración del Workspace" className="relative flex h-full bg-white shadow-xl">
            <button type="button" onClick={() => setMobileContextOpen(false)} className="m-2 h-9 w-9 rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Cerrar contexto"><X className="h-4 w-4" /></button>
            <RightPanel mode={state.rightPanelMode} activeMission={state.activeMission} onModeChange={handleModeChange} />
          </div>
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

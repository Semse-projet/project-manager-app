"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, PanelRight, RefreshCw, X } from "lucide-react";
import type { WorkspaceRightPanelMode } from "@semse/schemas";
import { useWorkspaceStore, workspaceStore } from "../../../lib/stores/workspaceStore";
import { DEFAULT_WORKSPACE_PREFERENCES, getWorkspaceRole, sanitizePreferences, WORKSPACE_PREFERENCES_KEY, type WorkspacePreferences } from "../lib/workspace-model";
import { LeftPanel } from "./LeftPanel";
import { CentralPanel } from "./CentralPanel";
import { RightPanel } from "./RightPanel";
import { NavigationBreadcrumb } from "./NavigationBreadcrumb";

export function WorkspaceLayout() {
  const state = useWorkspaceStore();
  const [mobilePanel, setMobilePanel] = useState<"navigation" | "context" | null>(null);
  const [preferences, setPreferences] = useState<WorkspacePreferences>(DEFAULT_WORKSPACE_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const navTriggerRef = useRef<HTMLButtonElement>(null);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  const role = getWorkspaceRole(state.context?.permissions ?? []);
  const busy = state.pending !== null;
  const ready = Boolean(state.context);
  const scopeKey = state.context ? `${state.context.tenantId}:${state.context.organizationId}:${state.context.userId}` : "unavailable";
  const onMissionLoaded = useCallback(() => { void workspaceStore.refresh(); }, []);

  useEffect(() => {
    void workspaceStore.refresh();
    const onFocus = () => { void workspaceStore.refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("focus", onFocus); workspaceStore.reset(); };
  }, []);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(WORKSPACE_PREFERENCES_KEY);
      if (value) setPreferences(sanitizePreferences(JSON.parse(value)));
    } catch {
      setStorageError("No se pudieron leer las preferencias; se usarán los valores predeterminados.");
    }
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    try {
      window.localStorage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(sanitizePreferences(preferences)));
      setStorageError(null);
    } catch {
      setStorageError("No se pudieron guardar las preferencias; se aplican hasta recargar esta página.");
    }
  }, [preferences, preferencesReady]);

  useEffect(() => {
    if (!mobilePanel || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0);
    (focusables()[0] ?? dialog).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMobilePanel(null); return; }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.removeEventListener("keydown", onKeyDown);
      (mobilePanel === "navigation" ? navTriggerRef : contextTriggerRef).current?.focus();
    };
  }, [mobilePanel]);

  function handleNavigate(section: string) {
    void workspaceStore.navigate(section, section === "settings" ? "configuration" : undefined).then((success) => { if (success) setMobilePanel(null); });
  }
  function handleModeChange(mode: WorkspaceRightPanelMode) {
    void workspaceStore.navigate(state.activeSection, mode);
  }
  function handlePreferencesChange(value: WorkspacePreferences) {
    setPreferences(sanitizePreferences(value));
    if (preferences.rightPanel && !value.rightPanel && !mobilePanel) requestAnimationFrame(() => contextTriggerRef.current?.focus());
    if (preferences.leftPanel && !value.leftPanel && !mobilePanel) requestAnimationFrame(() => navTriggerRef.current?.focus());
  }
  const resetPreferences = () => setPreferences({ ...DEFAULT_WORKSPACE_PREFERENCES });
  const leftProps = { activeSection: state.activeSection, onNavigate: handleNavigate, role, history: state.navigationHistory, disabled: busy || !ready, onOpenDestination: () => setMobilePanel(null) };
  const rightProps = { mode: state.rightPanelMode, activeMission: state.activeMission, onModeChange: handleModeChange, preferences, onPreferencesChange: handlePreferencesChange, onResetPreferences: resetPreferences, role, disabled: busy || !ready, storageError };

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col bg-[var(--surface)] text-[var(--ink)]" data-density={preferences.density}>
      <div className="flex min-h-0 flex-1 flex-col" inert={mobilePanel !== null}>
        <a href="#workspace-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:p-3 focus:text-[var(--brand)]">Ir al contenido del workspace</a>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-6">
          <div className="min-w-0"><h1 className="text-base font-semibold text-[var(--ink)]">SEMSE Project <span className="font-normal text-[var(--muted)]">/ Workspace</span></h1><NavigationBreadcrumb history={state.navigationHistory} onNavigate={handleNavigate} disabled={busy || !ready} /></div>
          <div className="flex flex-wrap items-center gap-2">
            <button ref={navTriggerRef} type="button" onClick={() => setMobilePanel("navigation")} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--muted)] ${preferences.leftPanel ? "lg:hidden" : ""}`} aria-haspopup="dialog" aria-expanded={mobilePanel === "navigation"} aria-controls="workspace-drawer"><Menu className="h-4 w-4" aria-hidden="true" />Secciones</button>
            <button ref={contextTriggerRef} type="button" onClick={() => setMobilePanel("context")} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--muted)] ${preferences.rightPanel ? "xl:hidden" : ""}`} aria-haspopup="dialog" aria-expanded={mobilePanel === "context"} aria-controls="workspace-drawer"><PanelRight className="h-4 w-4" aria-hidden="true" />Contexto</button>
            <button type="button" disabled={busy} onClick={() => void workspaceStore.refresh()} aria-busy={state.loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--muted)] disabled:opacity-45"><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" /><span>{state.loading ? "Actualizando…" : "Actualizar"}</span></button>
          </div>
        </header>
        {state.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--error)] sm:px-6"><p className="min-w-0 break-words">{state.error}</p>{/\b401\b/.test(state.error) ? <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--brand)]">Iniciar sesión</Link> : <button type="button" disabled={busy} onClick={() => void workspaceStore.refresh()} className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--brand)] disabled:opacity-45">Consultar estado actual</button>}</div>}
        <p className="sr-only" role="status" aria-live="polite">{busy ? "Solicitud en curso. Espera la confirmación." : ready ? "Contexto disponible." : "Contexto no disponible."}</p>
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden" aria-busy={busy}>
          {preferences.leftPanel && <div className="hidden shrink-0 lg:flex"><LeftPanel {...leftProps} /></div>}
          <CentralPanel activeSection={state.activeSection} activeMission={state.activeMission} onLoadMission={(id, type, title) => workspaceStore.loadMission(id, type, title)} onUnloadMission={(id) => workspaceStore.unloadMission(id)} onNavigate={handleNavigate} role={role} pending={busy} contextReady={ready} loading={state.loading} scopeKey={scopeKey} preferences={preferences} onPreferencesChange={handlePreferencesChange} onResetPreferences={resetPreferences} onMissionLoaded={onMissionLoaded} storageError={storageError} />
          {preferences.rightPanel && <div className="hidden shrink-0 xl:flex"><RightPanel {...rightProps} /></div>}
        </div>
      </div>
      {mobilePanel && <div className={`fixed inset-0 z-50 flex ${mobilePanel === "context" ? "justify-end" : ""}`}>
        <div className="absolute inset-0 bg-slate-950/40" onClick={() => setMobilePanel(null)} aria-hidden="true" />
        <div id="workspace-drawer" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="workspace-drawer-title" tabIndex={-1} className="relative flex h-[100dvh] w-[min(100vw,20rem)] flex-col overflow-hidden bg-[var(--surface)] shadow-xl">
          <header className="flex min-h-16 items-center justify-between gap-2 border-b border-[var(--border)] px-3"><h2 id="workspace-drawer-title" className="text-sm font-semibold">{mobilePanel === "navigation" ? "Navegación del workspace" : "Contexto y configuración"}</h2><button type="button" onClick={() => setMobilePanel(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)]" aria-label="Cerrar panel"><X className="h-4 w-4" aria-hidden="true" /></button></header>
          <div className="flex min-h-0 flex-1 [&>aside]:w-full">{mobilePanel === "navigation" ? <LeftPanel {...leftProps} /> : <RightPanel {...rightProps} />}</div>
        </div>
      </div>}
    </div>
  );
}

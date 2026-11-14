"use client";

import { Cog, Radio } from "lucide-react";
import type { WorkspaceActiveMission, WorkspaceRightPanelMode } from "@semse/schemas";
import type { WorkspacePreferences, WorkspaceRole } from "../lib/workspace-model";
import { getMissionTypeLabel } from "../lib/workspace-model";
import { WorkspaceSettings } from "./WorkspaceSettings";

export function RightPanel({ mode, activeMission, onModeChange, preferences, onPreferencesChange, onResetPreferences, role, disabled = false, storageError }: {
  mode: WorkspaceRightPanelMode;
  activeMission: WorkspaceActiveMission | null;
  onModeChange: (mode: WorkspaceRightPanelMode) => void;
  preferences: WorkspacePreferences;
  onPreferencesChange: (value: WorkspacePreferences) => void;
  onResetPreferences: () => void;
  role: WorkspaceRole | null;
  disabled?: boolean;
  storageError?: string | null;
}) {
  return (
    <aside className="flex w-72 max-w-full shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]" aria-label="Contexto y configuración">
      <div className="flex gap-1 border-b border-[var(--border)] p-2" role="group" aria-label="Modo del panel">
        <button type="button" onClick={() => onModeChange("operational")} disabled={disabled} aria-pressed={mode === "operational"} className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium disabled:opacity-45 ${mode === "operational" ? "bg-[var(--brand-dim)] text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--raised)]"}`}><Radio className="h-3.5 w-3.5" aria-hidden="true" />Contexto</button>
        <button type="button" onClick={() => onModeChange("configuration")} disabled={disabled} aria-pressed={mode === "configuration"} className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium disabled:opacity-45 ${mode === "configuration" ? "bg-[var(--brand-dim)] text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--raised)]"}`}><Cog className="h-3.5 w-3.5" aria-hidden="true" />Ajustes</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-[var(--muted)]">
        {mode === "configuration" ? <WorkspaceSettings preferences={preferences} onChange={onPreferencesChange} onReset={onResetPreferences} storageError={storageError} /> : <div className="space-y-4">
          <div><p className="text-xs font-semibold uppercase tracking-wide">Rol de presentación</p><p className="mt-1 font-medium text-[var(--ink)]">{role === "admin" ? "Operaciones" : role === "worker" ? "Profesional / trabajador" : role === "client" ? "Cliente" : "No disponible"}</p><p className="mt-2 text-xs leading-relaxed">El backend comprueba el acceso a cada recurso. Este panel no concede permisos.</p></div>
          {activeMission ? <div className="rounded-lg border border-[var(--border)] p-3"><p className="text-xs font-semibold uppercase tracking-wide">Referencia abierta</p><p className="mt-2 break-words font-medium text-[var(--ink)]">{activeMission.title}</p><p className="mt-1 text-xs">{getMissionTypeLabel(activeMission.missionType)}</p><p className="mt-3 break-all text-xs">ID de referencia: {activeMission.missionId}</p><p className="mt-3 text-xs leading-relaxed">Sin ejecución vinculada. No es el identificador de un proyecto ni de una tarea.</p></div> : <div className="rounded-lg border border-dashed border-[var(--border)] p-3"><p className="font-medium text-[var(--ink)]">Sin referencia abierta</p><p className="mt-2 text-xs leading-relaxed">Puedes consultar tus módulos sin abrir una. Desde Inicio, crea una referencia para organizar el contexto.</p></div>}
          <p className="text-xs leading-relaxed">Las vistas de proyectos, propuestas y tareas son de consulta. Los flujos de carga y operación se abren en sus módulos existentes.</p>
        </div>}
      </div>
    </aside>
  );
}

"use client";

import { Cog, Radio } from "lucide-react";
import type { WorkspaceActiveMission, WorkspaceRightPanelMode } from "@semse/schemas";

export function RightPanel({
  mode,
  activeMission,
  onModeChange,
}: {
  mode: WorkspaceRightPanelMode;
  activeMission: WorkspaceActiveMission | null;
  onModeChange: (mode: WorkspaceRightPanelMode) => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]">
      <div className="flex gap-1 border-b border-[var(--border)] p-2">
        <ModeTab
          label="Operacional"
          icon={<Radio className="h-3.5 w-3.5" />}
          active={mode === "operational"}
          onClick={() => onModeChange("operational")}
        />
        <ModeTab
          label="Configuración"
          icon={<Cog className="h-3.5 w-3.5" />}
          active={mode === "configuration"}
          onClick={() => onModeChange("configuration")}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm text-[var(--muted)]">
        {mode === "operational" ? (
          activeMission ? (
            <div className="space-y-2">
              <p className="font-medium text-[var(--ink)]">Contexto operacional</p>
              <p>Misión: {activeMission.title}</p>
              <p>Tipo: {activeMission.missionType}</p>
            </div>
          ) : (
            <p className="text-[var(--muted)]">Sin contexto operacional. Abre una misión.</p>
          )
        ) : (
          <div className="space-y-2">
            <p className="font-medium text-[var(--ink)]">Configuración del Workspace</p>
            <p className="text-[var(--muted)]">Ajustes de paneles y preferencias.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function ModeTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
        active ? "bg-[var(--brand-dim)] font-semibold text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--raised)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

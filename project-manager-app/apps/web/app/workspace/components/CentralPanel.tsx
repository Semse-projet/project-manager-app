"use client";

import { X } from "lucide-react";
import type { WorkspaceActiveMission, WorkspaceMissionType } from "@semse/schemas";
import { MissionLoader } from "./MissionLoader";

export function CentralPanel({
  activeSection,
  activeMission,
  onLoadMission,
  onUnloadMission,
}: {
  activeSection: string;
  activeMission: WorkspaceActiveMission | null;
  onLoadMission: (missionId: string, missionType: WorkspaceMissionType, title: string) => void;
  onUnloadMission: (missionId: string) => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-4 overflow-y-auto bg-[var(--bg)] p-6">
      {activeMission ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Misión activa · {activeMission.missionType}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">{activeMission.title}</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">ID: {activeMission.missionId}</p>
            </div>
            <button
              type="button"
              onClick={() => onUnloadMission(activeMission.missionId)}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--raised)]"
            >
              <X className="h-4 w-4" />
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold capitalize text-[var(--ink)]">{activeSection}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            No hay ninguna misión activa. Abre una para empezar a trabajar.
          </p>
        </div>
      )}

      <MissionLoader onLoad={onLoadMission} />
    </section>
  );
}

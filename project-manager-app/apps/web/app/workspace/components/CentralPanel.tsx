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
    <section className="flex flex-1 flex-col gap-4 overflow-y-auto bg-slate-50 p-6">
      {activeMission ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Misión activa · {activeMission.missionType}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{activeMission.title}</h2>
              <p className="mt-1 text-xs text-slate-400">ID: {activeMission.missionId}</p>
            </div>
            <button
              type="button"
              onClick={() => onUnloadMission(activeMission.missionId)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold capitalize text-slate-900">{activeSection}</h2>
          <p className="mt-1 text-sm text-slate-500">
            No hay ninguna misión activa. Abre una para empezar a trabajar.
          </p>
        </div>
      )}

      <MissionLoader onLoad={onLoadMission} />
    </section>
  );
}

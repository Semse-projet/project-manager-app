"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { WorkspaceMissionType } from "@semse/schemas";

const MISSION_TYPES: Array<{ id: WorkspaceMissionType; label: string }> = [
  { id: "project", label: "Proyecto" },
  { id: "conversation", label: "Conversación" },
  { id: "budget", label: "Presupuesto" },
  { id: "evidence", label: "Evidencia" },
  { id: "planning", label: "Planificación" },
];

export function MissionLoader({
  onLoad,
}: {
  onLoad: (missionId: string, missionType: WorkspaceMissionType, title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WorkspaceMissionType>("project");

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    const missionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `mission-${Date.now()}`;
    onLoad(missionId, type, trimmed);
    setTitle("");
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
      <p className="mb-3 text-sm font-medium text-slate-700">Abrir una misión</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as WorkspaceMissionType)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-label="Tipo de misión"
        >
          {MISSION_TYPES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Título de la misión"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Abrir
        </button>
      </div>
    </div>
  );
}

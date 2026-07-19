"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import type { CopilotMissionSuggestion } from "@semse/schemas";

export function MissionSuggestion({
  suggestion,
  onAccept,
  pending,
}: {
  suggestion: CopilotMissionSuggestion;
  onAccept: (suggestion: CopilotMissionSuggestion) => void;
  pending?: boolean;
}) {
  return (
    <div className="mx-3 my-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
        <Sparkles className="h-3.5 w-3.5" />
        Sugerencia de misión
      </div>
      <p className="mt-1 text-sm font-medium text-slate-800">{suggestion.title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{suggestion.reason}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => onAccept(suggestion)}
        className="mt-2 flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
      >
        Abrir en Workspace ({suggestion.type})
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

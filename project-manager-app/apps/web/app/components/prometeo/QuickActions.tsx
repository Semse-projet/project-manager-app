"use client";

import { Zap } from "lucide-react";
import type { CopilotSuggestedAction } from "@semse/schemas";

export function QuickActions({
  actions,
  onExecute,
  disabled,
}: {
  actions: CopilotSuggestedAction[];
  onExecute: (action: CopilotSuggestedAction) => void;
  disabled?: boolean;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2">
      {actions.map((action) => (
        <button
          key={action.action}
          type="button"
          disabled={disabled}
          onClick={() => onExecute(action)}
          title={action.description}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <Zap className="h-3 w-3 text-amber-500" />
          {action.description}
        </button>
      ))}
    </div>
  );
}

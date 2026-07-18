"use client";

import { Compass } from "lucide-react";
import type { CopilotContextResponse } from "@semse/schemas";

export function ContextDetector({
  context,
  loading,
}: {
  context: CopilotContextResponse | null;
  loading: boolean;
}) {
  if (loading && !context) {
    return <p className="px-3 py-2 text-xs text-slate-400">Detectando contexto…</p>;
  }
  if (!context) return null;

  const confidencePct = Math.round(context.confidence * 100);
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
      <Compass className="h-3.5 w-3.5 text-slate-400" />
      <span>
        Módulo <span className="font-medium text-slate-700">{context.module}</span>
        {context.resource.id ? ` · ${context.resource.type}` : ""}
      </span>
      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
        {confidencePct}%
      </span>
    </div>
  );
}

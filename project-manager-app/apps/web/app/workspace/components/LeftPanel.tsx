"use client";

import { Boxes, Calendar, FileText, Home, Settings, Wallet } from "lucide-react";
import type { ComponentType } from "react";

const SECTIONS: Array<{ id: string; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "projects", label: "Proyectos", icon: Boxes },
  { id: "evidence", label: "Evidencia", icon: FileText },
  { id: "budget", label: "Presupuestos", icon: Wallet },
  { id: "planning", label: "Planificación", icon: Calendar },
  { id: "settings", label: "Configuración", icon: Settings },
];

export function LeftPanel({
  activeSection,
  onNavigate,
}: {
  activeSection: string;
  onNavigate: (section: string) => void;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Navegación
      </p>
      {SECTIONS.map(({ id, label, icon: Icon }) => {
        const active = activeSection === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  hubModules,
  personaOptions,
  PERSONA_STORAGE_KEY,
  type PersonaId,
} from "./landing-routes";

const STATUS_LABEL: Record<string, string> = {
  live: "Disponible",
  "demo-soon": "Demo próximamente",
};

export function HubModulesGrid() {
  const [persona, setPersona] = useState<PersonaId | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (stored && personaOptions.some((p) => p.id === stored)) {
      setPersona(stored as PersonaId);
    }
  }, []);

  const personaLabel = personaOptions.find((p) => p.id === persona)?.label;

  return (
    <div className="space-y-6">
      {persona && personaLabel && (
        <p
          data-testid="hub-persona-hint"
          className="text-center text-xs font-bold text-blue-600 dark:text-blue-400"
        >
          Resaltamos los módulos recomendados para ti ({personaLabel.toLowerCase()}).
        </p>
      )}
      <div
        data-testid="hub-modules-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {hubModules.map((mod) => {
          const recommended = persona !== null && mod.personas.includes(persona);
          return (
            <div
              key={mod.id}
              data-testid={`hub-module-${mod.id}`}
              data-recommended={recommended || undefined}
              className={`group bg-white dark:bg-slate-900 border rounded-2xl p-6 flex flex-col gap-4 hover:shadow-lg transition-all duration-200 ${
                recommended
                  ? "border-blue-500/70 dark:border-blue-500/60 ring-1 ring-blue-500/30"
                  : "border-slate-200/60 dark:border-slate-800/60 hover:border-blue-400/60 dark:hover:border-blue-500/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {mod.title}
                </h2>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${
                      mod.status === "live"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {STATUS_LABEL[mod.status]}
                  </span>
                  {recommended && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      Para ti
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {mod.tagline}
              </p>
              <ul className="space-y-1.5 list-none p-0 m-0 flex-1">
                {mod.capabilities.map((cap) => (
                  <li
                    key={cap}
                    className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    {cap}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={mod.href}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 no-underline hover:underline"
                >
                  Ver módulo →
                </Link>
                {mod.demoHref && (
                  <Link
                    href={mod.demoHref}
                    data-testid={`hub-demo-${mod.id}`}
                    className="text-xs font-black px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white no-underline transition-colors"
                  >
                    Probar demo
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

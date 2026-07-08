"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  hubModules,
  personaOptions,
  PERSONA_STORAGE_KEY,
  type PersonaId,
} from "./landing-routes";

const PERSONA_IDS = personaOptions.map((p) => p.id);

function isPersonaId(value: string | null): value is PersonaId {
  return value !== null && (PERSONA_IDS as string[]).includes(value);
}

export function PersonaSelector() {
  const searchParams = useSearchParams();
  const [persona, setPersona] = useState<PersonaId | null>(null);

  useEffect(() => {
    const fromUrl = searchParams?.get("persona") ?? null;
    if (isPersonaId(fromUrl)) {
      setPersona(fromUrl);
      localStorage.setItem(PERSONA_STORAGE_KEY, fromUrl);
      return;
    }
    const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (isPersonaId(stored)) {
      setPersona(stored);
    }
  }, [searchParams]);

  const selectPersona = (id: PersonaId) => {
    setPersona(id);
    localStorage.setItem(PERSONA_STORAGE_KEY, id);
  };

  const activeOption = personaOptions.find((p) => p.id === persona) ?? null;

  const visibleModules = useMemo(() => {
    if (!persona) return hubModules;
    return hubModules.filter((mod) => mod.personas.includes(persona));
  }, [persona]);

  return (
    <div data-testid="persona-selector" className="space-y-10">
      {/* Persona tabs */}
      <div
        role="tablist"
        aria-label="Elige tu perfil"
        className="flex flex-wrap justify-center gap-3"
      >
        {personaOptions.map((option) => {
          const active = persona === option.id;
          return (
            <button
              key={option.id}
              role="tab"
              aria-selected={active}
              data-testid={`persona-tab-${option.id}`}
              onClick={() => selectPersona(option.id)}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                active
                  ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-white/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 hover:border-blue-400/60"
              }`}
            >
              <span aria-hidden>{option.emoji}</span>
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Headline for active persona */}
      {activeOption ? (
        <p
          data-testid="persona-headline"
          className="text-center text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto"
        >
          {activeOption.headline}
        </p>
      ) : (
        <p className="text-center text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          Elige tu perfil para ver lo que el ecosistema puede hacer por ti, o
          explora todos los módulos.
        </p>
      )}

      {/* Module cards for the persona */}
      <div
        data-testid="persona-modules"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto"
      >
        {persona === "cliente" && (
          <Link
            href="/client/jobs/new"
            data-testid="persona-card-intake"
            className="group bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl p-6 flex flex-col gap-3 no-underline shadow-lg shadow-blue-500/20 hover:shadow-xl transition-all"
          >
            <h3 className="font-extrabold text-base">Publica tu proyecto ahora</h3>
            <p className="text-xs text-blue-100 leading-relaxed flex-1">
              Describe lo que necesitas y la IA lo convierte en un plan con
              presupuesto, hitos y profesionales sugeridos.
            </p>
            <span className="text-xs font-bold">Empezar sin registrarme →</span>
          </Link>
        )}
        {visibleModules.map((mod) => (
          <Link
            key={mod.id}
            href={mod.href}
            data-testid={`persona-card-${mod.id}`}
            className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 flex flex-col gap-3 no-underline hover:border-blue-400/60 dark:hover:border-blue-500/50 hover:shadow-lg transition-all"
          >
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {mod.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex-1">
              {mod.tagline}
            </p>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              Ver módulo →
            </span>
          </Link>
        ))}
      </div>

      <div className="text-center">
        <Link
          href="/hub"
          className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 no-underline hover:underline"
        >
          Explorar todo el ecosistema en el Hub →
        </Link>
      </div>
    </div>
  );
}

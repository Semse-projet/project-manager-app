import type { Metadata } from "next";
import Link from "next/link";
import { hubModules } from "../../../components/landing/landing-routes";

export const metadata: Metadata = {
  title: "SEMSE Hub — Explora el ecosistema",
  description:
    "Descubre los módulos del ecosistema SEMSE: Connect, Payments, Trust, AI, Agro, BuildOps, Knowledge, Integrations y Core.",
};

const STATUS_LABEL: Record<string, string> = {
  live: "Disponible",
  "demo-soon": "Demo próximamente",
};

export default function HubPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block">
            SEMSE Hub
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tight">
            Un ecosistema, nueve módulos
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
            Cada módulo resuelve una parte de tu operación y todos comparten la
            misma identidad, los mismos pagos protegidos y la misma inteligencia
            artificial. Explora lo que puedes hacer hoy, sin registrarte.
          </p>
        </div>

        {/* Modules grid */}
        <div
          data-testid="hub-modules-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {hubModules.map((mod) => (
            <Link
              key={mod.id}
              href={mod.href}
              data-testid={`hub-module-${mod.id}`}
              className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 flex flex-col gap-4 no-underline hover:border-blue-400/60 dark:hover:border-blue-500/50 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {mod.title}
                </h2>
                <span
                  className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${
                    mod.status === "live"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {STATUS_LABEL[mod.status]}
                </span>
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
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                Ver módulo →
              </span>
            </Link>
          ))}
        </div>

        {/* Role CTAs */}
        <div className="text-center pt-8 border-t border-slate-200/50 dark:border-slate-800/60 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ¿Listo para empezar?
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/client/jobs/new"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md no-underline transition-colors"
            >
              Publicar un proyecto
            </Link>
            <Link
              href="/login?from=/worker/dashboard"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm no-underline hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              Trabajar como profesional
            </Link>
            <Link
              href="/login?from=/admin/dashboard"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm no-underline hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              Operar mi empresa
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

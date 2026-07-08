import type { Metadata } from "next";
import Link from "next/link";
import { HubModulesGrid } from "../../../components/landing/hub-modules-grid";

export const metadata: Metadata = {
  title: "SEMSE Hub — Explora el ecosistema",
  description:
    "Descubre los módulos del ecosistema SEMSE: Connect, Payments, Trust, AI, Agro, BuildOps, Knowledge, Integrations y Core.",
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

        {/* Modules grid (client: resalta persona guardada) */}
        <HubModulesGrid />

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

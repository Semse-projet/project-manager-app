"use client";

import Link from "next/link";
import { ArrowUpRight, Briefcase } from "lucide-react";
import { BudgetPanel } from "../../../workspace/components/BudgetPanel";

/** This existing client route is session/role protected by the app middleware.
 * Each jobs/bids read still relies on backend tenant, org and resource policy. */
export default function ClientReceivedBidsPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 px-4 py-8 text-[var(--ink)] sm:px-6">
      <header>
        <h1 className="text-2xl font-bold">Propuestas recibidas</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Elige uno de tus trabajos para consultar sus propuestas reales. No son las propuestas enviadas por un profesional.</p>
      </header>
      <BudgetPanel role="client" />
      <nav aria-label="Continuar en los módulos existentes" className="flex flex-wrap gap-3">
        <Link href="/client/marketplace" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"><Briefcase className="h-4 w-4" aria-hidden="true" />Ver marketplace</Link>
        <Link href="/client/jobs" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">Ver trabajos <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
        <Link href="/client/proposals" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">Abrir flujo existente de revisión <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
      </nav>
      <p className="text-xs text-[var(--muted)]">Las acciones comerciales permanecen en sus módulos actuales y requieren sus permisos y confirmaciones. Esta comparación no acepta propuestas automáticamente.</p>
    </div>
  );
}

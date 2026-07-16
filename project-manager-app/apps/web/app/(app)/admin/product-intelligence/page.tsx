"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * PI-05.2 — Funnel de Product Intelligence.
 * Fuente: GET /api/semse/product-intelligence/funnel (ops:dashboard:read).
 * Muestra el funnel auth/wizard: landing → wizard → registro → job publicado.
 */

type FunnelData = {
  windowDays: number;
  since: string;
  sessions: number;
  events: Array<{ name: string; count: number }>;
};

type EconomicFunnelData = {
  windowDays: number;
  since: string;
  stages: Array<{ stage: string; count: number; conversionPct: number; medianHoursFromJob: number | null }>;
};

const STAGE_LABELS: Record<string, string> = {
  job_created: "Jobs creados",
  first_bid: "Con primera oferta",
  contract: "Con contrato",
  escrow_funded: "Con escrow fondeado",
  payment_released: "Pago liberado",
};

const FUNNEL_ORDER = [
  "auth.login_view",
  "auth.register_view",
  "auth.context_recovered",
  "wizard.prefill_arrived",
  "wizard.published",
];

const EVENT_LABELS: Record<string, string> = {
  "auth.login_view": "Vista de login",
  "auth.register_view": "Vista de registro",
  "auth.context_recovered": "Contexto recuperado tras login/registro",
  "wizard.prefill_arrived": "Llegada al wizard con prefill",
  "wizard.published": "Job publicado desde el wizard",
  "app.error_view": "Vista de error",
  "app.not_found": "404",
};

export default function ProductIntelligencePage() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [economic, setEconomic] = useState<EconomicFunnelData | null>(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (windowDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/product-intelligence/funnel?days=${windowDays}`);
      const json = (await res.json()) as { data?: FunnelData; error?: { message?: string } };
      if (!res.ok || !json.data) {
        setError(
          res.status === 403
            ? "Product Intelligence está apagado (PRODUCT_INTELLIGENCE_ENABLED) o no tienes permiso."
            : json.error?.message ?? `Error ${res.status}`,
        );
        return;
      }
      setData(json.data);
      const econRes = await fetch(`/api/semse/product-intelligence/funnel/economic?days=${Math.max(windowDays, 30)}`);
      const econJson = (await econRes.json()) as { data?: EconomicFunnelData };
      if (econRes.ok && econJson.data) setEconomic(econJson.data);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const countFor = (name: string) => data?.events.find((e) => e.name === name)?.count ?? 0;
  const maxCount = Math.max(1, ...FUNNEL_ORDER.map(countFor));
  const otherEvents = (data?.events ?? []).filter((e) => !FUNNEL_ORDER.includes(e.name));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-500">Product Intelligence</p>
        <h1 className="mt-1 text-3xl font-bold">Funnel auth → wizard → publicación</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Telemetría de recorrido (PI-05). Datos redactados en cliente y servidor; retención 30 días.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-2">
        {[7, 14, 30].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDays(option)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              days === option ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {option} días
          </button>
        ))}
        {data && (
          <span className="ml-auto text-sm text-slate-400">
            {data.sessions} sesiones desde {new Date(data.since).toLocaleDateString("es-US")}
          </span>
        )}
      </div>

      {loading && <div className="rounded-xl border border-slate-800 p-6 text-sm text-slate-400">Cargando…</div>}
      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-500">{error}</div>
      )}

      {data && !loading && (
        <>
          <section className="space-y-3">
            {FUNNEL_ORDER.map((name) => {
              const count = countFor(name);
              return (
                <div key={name} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{EVENT_LABELS[name] ?? name}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded bg-slate-800">
                    <div
                      className="h-full rounded bg-cyan-500"
                      style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{name}</div>
                </div>
              );
            })}
          </section>

          {economic && (
            <section className="mt-10">
              <h2 className="mb-1 text-xl font-bold">Funnel económico</h2>
              <p className="mb-4 text-sm text-slate-400">
                job → oferta → contrato → escrow → pago (derivado de tablas de dominio,
                últimos {economic.windowDays} días, mediana de horas desde la creación del job).
              </p>
              <div className="space-y-3">
                {economic.stages.map((stage) => {
                  const first = economic.stages[0]?.count ?? 1;
                  return (
                    <div key={stage.stage} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{STAGE_LABELS[stage.stage] ?? stage.stage}</span>
                        <span className="font-mono">
                          {stage.count} · {stage.conversionPct}%
                          {stage.medianHoursFromJob !== null ? ` · ~${stage.medianHoursFromJob}h` : ""}
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded bg-slate-800">
                        <div
                          className="h-full rounded bg-emerald-500"
                          style={{ width: `${Math.round((stage.count / Math.max(first, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {otherEvents.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Otros eventos</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <tbody>
                    {otherEvents.map((event) => (
                      <tr key={event.name} className="border-b border-slate-800 last:border-0">
                        <td className="px-4 py-2">{EVENT_LABELS[event.name] ?? event.name}</td>
                        <td className="px-4 py-2 text-right font-mono">{event.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

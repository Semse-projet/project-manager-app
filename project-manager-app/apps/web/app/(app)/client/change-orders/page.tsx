"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from "lucide-react";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { ChangeOrderImpactCard } from "../../../../components/change-orders/ChangeOrderImpactCard";
import { useBuildOpsSSE } from "@/hooks/useBuildOpsSSE";

type ChangeOrder = {
  id: string;
  title: string;
  description?: string | null;
  trigger: string;
  status: "predicted" | "submitted" | "approved" | "rejected" | "voided" | "applied" | "changes_requested";
  estimatedMin?: string | number | null;
  estimatedMax?: string | number | null;
  probability?: number | null;
  clientNote?: string | null;
  createdAt: string;
};

const statusClasses: Partial<Record<ChangeOrder["status"], string>> = {
  predicted:          "border-slate-700 bg-slate-900/60 text-slate-300",
  submitted:          "border-yellow-700/50 bg-yellow-950/30 text-yellow-300",
  approved:           "border-green-700/50 bg-green-950/30 text-green-300",
  rejected:           "border-red-700/50 bg-red-950/30 text-red-300",
  applied:            "border-indigo-700/50 bg-indigo-950/30 text-indigo-300",
  changes_requested:  "border-orange-700/50 bg-orange-950/30 text-orange-300",
  voided: "border-slate-700 bg-slate-900/60 text-slate-500",
};

function money(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `$${Math.round(Number(value)).toLocaleString()}`;
}

export default function ClientChangeOrdersPage() {
  const [items, setItems] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // impactRefreshKeys: keyed by changeOrderId → increment to force ChangeOrderImpactCard re-fetch
  const [impactRefreshKeys, setImpactRefreshKeys] = useState<Record<string, number>>({});

  const refreshImpact = useCallback((changeOrderId: string) => {
    setImpactRefreshKeys((k) => ({ ...k, [changeOrderId]: (k[changeOrderId] ?? 0) + 1 }));
  }, []);

  // SSE: auto-refresh list + impact cards when change orders change on server
  useBuildOpsSSE({
    onEvent: (evt) => {
      if (evt.type === "change-order:updated" || evt.type === "change-order:applied") {
        // Re-fetch the list to update status badges
        void load();
        // Refresh impact card for this specific CO
        refreshImpact(evt.changeOrderId);
      }
    },
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/semse/change-orders");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "No se pudieron cargar los change orders.");
      setItems(json.data ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los change orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function act(id: string, action: "approve" | "reject") {
    const note = noteById[id]?.trim();
    if (action === "reject" && !note) {
      setError("Escribe una razón antes de rechazar el change order.");
      return;
    }
    setBusyId(`${action}:${id}`);
    setError(null);
    try {
      const res = await fetch(`/api/semse/change-orders/${id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientNote: note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "No se pudo actualizar el change order.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el change order.");
    } finally {
      setBusyId(null);
    }
  }

  const summary = useMemo(() => ({
    submitted: items.filter(item => item.status === "submitted").length,
    approved: items.filter(item => item.status === "approved").length,
    rejected: items.filter(item => item.status === "rejected").length,
  }), [items]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ClientPageHeader
        title="Change Orders"
        subtitle="Revisa cambios de alcance antes de que impacten milestones o pagos."
        breadcrumbs={[{ label: "Change Orders" }]}
        minHeight={82}
        actions={<NotificationBanner audience="client" />}
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          ["Pendientes", summary.submitted, "text-yellow-300"],
          ["Aprobados", summary.approved, "text-green-300"],
          ["Rechazados", summary.rejected, "text-red-300"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${color}`}>{String(value)}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Hidden damage, scope changes and additional work that need approval.</p>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-muted hover:text-ink">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-muted">
          No change orders yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map(item => {
            const canReview  = item.status === "submitted";
            const showImpact = ["approved", "applied", "submitted"].includes(item.status);
            const canApply   = item.status === "approved";
            const statusLabel: Record<ChangeOrder["status"], string> = {
              predicted: "Detectado", submitted: "Enviado", approved: "Aprobado",
              rejected: "Rechazado", voided: "Anulado", applied: "Aplicado",
              changes_requested: "Cambios solicitados",
            };
            return (
              <section key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-ink">{item.title}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClasses[item.status] ?? ""}`}>
                        {statusLabel[item.status] ?? item.status}
                      </span>
                    </div>
                    {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
                  </div>
                  <div className="text-right text-sm font-bold text-ink">
                    {money(item.estimatedMin)} – {money(item.estimatedMax)}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-950/10 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-orange-300">
                    <AlertTriangle size={13} />
                    Trigger
                  </div>
                  <p className="mt-1 text-sm text-orange-100">{item.trigger}</p>
                  {typeof item.probability === "number" && (
                    <p className="mt-1 text-xs text-orange-300">Probabilidad: {item.probability}/100</p>
                  )}
                </div>

                {/* Impact card para approved/applied/submitted — re-monta con SSE key */}
                {showImpact && (
                  <div className="mt-3">
                    <ChangeOrderImpactCard
                      key={`impact-${item.id}-${impactRefreshKeys[item.id] ?? 0}`}
                      changeOrderId={item.id}
                      canApply={canApply}
                      onApplied={() => { void load(); refreshImpact(item.id); }}
                    />
                  </div>
                )}

                {item.clientNote && (
                  <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-950/10 p-3 text-sm text-blue-200">
                    {item.clientNote}
                  </div>
                )}

                {canReview && (
                  <div className="mt-4 grid gap-3">
                    <textarea
                      rows={3}
                      value={noteById[item.id] ?? ""}
                      onChange={(event) => setNoteById(current => ({ ...current, [item.id]: event.target.value }))}
                      placeholder="Comentario opcional para aprobar, obligatorio para rechazar"
                      className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-ink outline-none focus:border-white/[0.18]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void act(item.id, "approve")}
                        disabled={busyId === `approve:${item.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-60"
                      >
                        <CheckCircle size={14} />
                        Approve change order
                      </button>
                      <button
                        onClick={() => void act(item.id, "reject")}
                        disabled={busyId === `reject:${item.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-700/50 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-300 hover:border-red-600 disabled:opacity-60"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

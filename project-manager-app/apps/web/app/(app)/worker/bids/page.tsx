"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle, Clock, RefreshCw, Send, XCircle } from "lucide-react";
import { fetchMyBids, type MyBidView } from "../../../semse-api";

type FilterKey = "all" | "submitted" | "accepted" | "rejected";

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  submitted: { label: "Enviada",   bg: "rgba(99,102,241,.12)",  color: "#818cf8" },
  accepted:  { label: "Aceptada",  bg: "rgba(16,185,129,.12)",  color: "#10b981" },
  rejected:  { label: "Rechazada", bg: "rgba(239,68,68,.12)",   color: "#ef4444" },
};

const JOB_STATUS_STYLE: Record<string, { label: string; color: string }> = {
  published:   { label: "Publicado",   color: "#94a3b8" },
  accepted:    { label: "Adjudicado",  color: "#10b981" },
  in_progress: { label: "En progreso", color: "#f59e0b" },
  completed:   { label: "Completado",  color: "#10b981" },
  cancelled:   { label: "Cancelado",   color: "#ef4444" },
};

function formatCurrency(n: number | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const FILTER_TABS: { key: FilterKey; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { key: "all",       label: "Todas",      Icon: Send },
  { key: "submitted", label: "Enviadas",   Icon: Clock },
  { key: "accepted",  label: "Aceptadas",  Icon: CheckCircle },
  { key: "rejected",  label: "Rechazadas", Icon: XCircle },
];

export default function WorkerBidsPage() {
  const [bids, setBids] = useState<MyBidView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBids(await fetchMyBids());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar propuestas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(
    () => filter === "all" ? bids : bids.filter(b => b.status === filter),
    [bids, filter]
  );

  const counts = useMemo(() => ({
    all:       bids.length,
    submitted: bids.filter(b => b.status === "submitted").length,
    accepted:  bids.filter(b => b.status === "accepted").length,
    rejected:  bids.filter(b => b.status === "rejected").length,
  }), [bids]);

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--ink)" }}>Mis propuestas</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
            Historial de todas las propuestas que has enviado.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center" }}
        >
          <RefreshCw size={14} style={{ opacity: loading ? 0.5 : 1 }} />
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {FILTER_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "6px 12px", borderRadius: "999px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap",
              background: filter === key ? "var(--ink)" : "var(--bg)",
              color: filter === key ? "#fff" : "var(--muted)",
              boxShadow: filter === key ? "none" : "0 0 0 1px var(--border)",
            }}
          >
            <Icon size={12} />
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "32px", color: "var(--muted)", fontSize: "14px" }}>
          Cargando propuestas...
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: "16px", borderRadius: "12px", background: "#fef2f2", color: "#ef4444", fontSize: "13px", marginBottom: "12px" }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: "14px" }}>
          <Send size={32} style={{ display: "block", margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ margin: "0 0 12px", fontSize: "14px" }}>
            {filter === "all"
              ? "Aún no has enviado propuestas."
              : `No tienes propuestas ${filter === "submitted" ? "enviadas" : filter === "accepted" ? "aceptadas" : "rechazadas"}.`}
          </p>
          <Link
            href="/worker/opportunities"
            style={{ display: "inline-block", padding: "8px 16px", borderRadius: "8px", background: "#6366f1", color: "#fff", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}
          >
            Ver oportunidades
          </Link>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map(bid => {
            const ss = STATUS_STYLE[bid.status] ?? { label: bid.status, bg: "var(--bg)", color: "var(--muted)" };
            const js = JOB_STATUS_STYLE[bid.jobStatus?.toLowerCase() ?? ""] ?? { label: bid.jobStatus, color: "var(--muted)" };
            const budget = bid.jobBudgetMax ?? bid.jobBudgetMin;
            return (
              <div
                key={bid.id}
                style={{
                  padding: "14px 16px", borderRadius: "14px",
                  background: "var(--bg)",
                  border: `1px solid ${bid.status === "accepted" ? "rgba(16,185,129,.3)" : bid.status === "rejected" ? "rgba(239,68,68,.2)" : "var(--border)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <Link
                        href={`/worker/jobs/${bid.jobId}`}
                        style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}
                      >
                        {bid.jobTitle}
                      </Link>
                      <span style={{ padding: "3px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: ss.bg, color: ss.color }}>
                        {ss.label}
                      </span>
                      <span style={{ fontSize: "11px", color: js.color, fontWeight: 600 }}>
                        {js.label}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "11px", color: "var(--muted)" }}>
                      {bid.jobCategory && <span>{bid.jobCategory}</span>}
                      {bid.jobLocation && <span>· {bid.jobLocation}</span>}
                      {budget != null && <span>· Budget: {formatCurrency(budget)}</span>}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)" }}>
                      {formatCurrency(bid.amount)}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                      {bid.etaDays} día{bid.etaDays !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                {bid.note ? (
                  <p style={{ margin: "10px 0 0", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                    {bid.note}
                  </p>
                ) : null}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                  <span style={{ fontSize: "10px", color: "var(--faint)" }}>
                    Enviada el {formatDate(bid.createdAt)}
                  </span>
                  {bid.status === "accepted" && (
                    <Link
                      href={`/worker/jobs/${bid.jobId}`}
                      style={{ fontSize: "12px", fontWeight: 700, color: "#10b981", textDecoration: "none" }}
                    >
                      Ver trabajo →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          <p style={{ textAlign: "center", fontSize: "11px", color: "var(--faint)", marginTop: "4px" }}>
            {filtered.length} propuesta{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

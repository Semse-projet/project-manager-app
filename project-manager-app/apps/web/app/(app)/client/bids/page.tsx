"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase, CheckCircle2, Clock, DollarSign, MapPin, RefreshCw, Send, XCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type BidEntry = {
  bidId: string; jobId: string; jobTitle: string; category: string;
  location?: string; budgetMin?: number; budgetMax?: number;
  status: string; note?: string; createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof Send }> = {
  submitted: { color: "#818cf8", label: "Enviada",  icon: Send },
  accepted:  { color: "#86efac", label: "Aceptada", icon: CheckCircle2 },
  rejected:  { color: "#fca5a5", label: "Rechazada", icon: XCircle },
  withdrawn: { color: "#475569", label: "Retirada",  icon: XCircle },
};

function formatBudget(min?: number, max?: number): string {
  if (!min && !max) return "—";
  if (min && max) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  return min ? `Desde $${min.toLocaleString()}` : `Hasta $${max!.toLocaleString()}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyBidsPage() {
  const [bids,    setBids]    = useState<BidEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [lastAt,  setLastAt]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/semse/my-bids");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: { bids: BidEntry[]; total: number } };
      setBids(json.data?.bids ?? []);
      setLastAt(new Date().toLocaleTimeString("es-MX"));
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = {
    submitted: bids.filter((b) => b.status === "submitted").length,
    accepted:  bids.filter((b) => b.status === "accepted").length,
    rejected:  bids.filter((b) => b.status === "rejected").length,
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
          <Send size={20} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Mis propuestas</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            {bids.length} propuesta{bids.length !== 1 ? "s" : ""} enviada{bids.length !== 1 ? "s" : ""} · {lastAt ?? "cargando…"}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--muted)" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Pendientes",  value: counts.submitted, color: "#818cf8" },
          { label: "Aceptadas",   value: counts.accepted,  color: "#86efac" },
          { label: "Rechazadas",  value: counts.rejected,  color: "#fca5a5" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>{error}</div>}

      {/* Bid list */}
      {bids.length === 0 && !loading && (
        <div style={{ padding: "40px", textAlign: "center", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
          <Send size={32} color="var(--muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Sin propuestas enviadas</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Explora el marketplace y aplica a trabajos disponibles</div>
          <Link href="/client/marketplace" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: "rgba(99,102,241,.15)", color: "#818cf8", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            <Briefcase size={14} /> Ver marketplace
          </Link>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {bids.map((bid) => {
          const cfg = STATUS_CONFIG[bid.status] ?? STATUS_CONFIG.submitted!;
          const Icon = cfg.icon;
          return (
            <div key={bid.bidId} style={{ background: "var(--surface)", border: `1px solid ${cfg.color}25`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <Link href={`/client/marketplace`} style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", textDecoration: "none" }}>
                      {bid.jobTitle}
                    </Link>
                    <span style={{ fontSize: 10, fontWeight: 800, color: cfg.color, background: `${cfg.color}15`, padding: "2px 8px", borderRadius: 99, display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon size={9} /> {cfg.label}
                    </span>
                    {bid.category && (
                      <span style={{ fontSize: 10, color: "#818cf8", background: "rgba(99,102,241,.1)", padding: "2px 8px", borderRadius: 99 }}>{bid.category}</span>
                    )}
                  </div>
                  {bid.note && (
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                      "{bid.note.slice(0, 120)}{bid.note.length > 120 ? "…" : ""}"
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--muted)", flexWrap: "wrap" }}>
                    {bid.location && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={10} />{bid.location}</span>}
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><DollarSign size={10} />{formatBudget(bid.budgetMin, bid.budgetMax)}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={10} />{new Date(bid.createdAt).toLocaleDateString("es-MX")}</span>
                  </div>
                </div>
                {bid.status === "accepted" && (
                  <Link href={`/client/jobs`} style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(134,239,172,.15)", border: "1px solid rgba(134,239,172,.3)", color: "#86efac", fontWeight: 700, fontSize: 12, textDecoration: "none", flexShrink: 0 }}>
                    Ver trabajo →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, Briefcase, Clock, DollarSign, MapPin, RefreshCw,
  Search, Star, Users, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Listing = {
  id: string; title: string; category: string | null; location: string | null;
  budgetMin: number | null; budgetMax: number | null; budgetType: string | null;
  status: string; urgency: string | null; scope: string; postedAt: string;
  clientOrg?: string; bidsCount: number;
};

type MarketplaceStats = {
  totalListings: number;
  byCategory:    Record<string, number>;
  byUrgency:     Record<string, number>;
  avgBudgetMin:  number | null;
};

type Professional = {
  id: string; name: string; email: string;
  completedJobs: number; avgRating: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const URGENCY_COLORS: Record<string, string> = {
  urgent: "#fca5a5", high: "#fb923c", medium: "#fcd34d", low: "#86efac",
};

const CATEGORY_LABELS: Record<string, string> = {
  painting: "Pintura", plumbing: "Plomería", drywall: "Drywall",
  electrical: "Electricidad", hvac: "HVAC", roofing: "Techos",
  carpentry: "Carpintería", cleaning: "Limpieza", general: "General",
};

function UrgencyBadge({ urgency }: { urgency: string | null }) {
  const color = URGENCY_COLORS[urgency ?? "medium"] ?? "#94a3b8";
  return (
    <span style={{ fontSize: 9, fontWeight: 800, color, background: `${color}20`, padding: "2px 7px", borderRadius: 99 }}>
      {(urgency ?? "medium").toUpperCase()}
    </span>
  );
}

function formatBudget(min: number | null, max: number | null, type: string | null): string {
  if (!min && !max) return "Presupuesto abierto";
  if (min && max) return `$${min.toLocaleString()}–$${max.toLocaleString()} ${type ?? ""}`.trim();
  if (min) return `Desde $${min.toLocaleString()}`;
  return `Hasta $${max!.toLocaleString()}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [stats,    setStats]    = useState<MarketplaceStats | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [urgFilter, setUrgFilter] = useState("");
  const [tab,      setTab]      = useState<"listings" | "professionals">("listings");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (catFilter) qs.set("category", catFilter);
      if (urgFilter) qs.set("urgency",  urgFilter);

      const [lRes, pRes, sRes] = await Promise.all([
        fetch(`/api/semse/marketplace/listings?${qs}&limit=30`).then((r) => r.json()) as Promise<{ data: { listings: Listing[]; total: number } }>,
        fetch("/api/semse/marketplace/professionals?limit=10").then((r) => r.json()) as Promise<{ data: Professional[] }>,
        fetch("/api/semse/marketplace/stats").then((r) => r.json()) as Promise<{ data: MarketplaceStats }>,
      ]);

      let items = lRes.data?.listings ?? [];
      if (search) items = items.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()) || l.location?.toLowerCase().includes(search.toLowerCase()));

      setListings(items);
      setProfessionals(pRes.data ?? []);
      setStats(sRes.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [catFilter, urgFilter, search]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
          <Briefcase size={20} color="#818cf8" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Marketplace</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Trabajos publicados y profesionales verificados
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Publicados", value: String(stats.totalListings), icon: Briefcase, color: "#818cf8" },
            { label: "Urgentes",   value: String(stats.byUrgency["urgent"] ?? 0), icon: Zap, color: "#fca5a5" },
            { label: "Presupuesto promedio", value: stats.avgBudgetMin ? `$${stats.avgBudgetMin.toLocaleString()}` : "—", icon: DollarSign, color: "#86efac" },
            { label: "Profesionales", value: String(professionals.length), icon: Users, color: "#67e8f9" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon size={13} color={color} />
                <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,.03)", padding: 4, borderRadius: 12, border: "1px solid var(--border)", width: "fit-content" }}>
        {(["listings", "professionals"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: tab === t ? "rgba(99,102,241,.2)" : "transparent",
              color: tab === t ? "#818cf8" : "var(--muted)" }}>
            {t === "listings" ? "Trabajos" : "Profesionales"}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab === "listings" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar trabajos…"
              style={{ width: "100%", padding: "8px 10px 8px 28px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12, boxSizing: "border-box" }} />
          </div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}>
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={urgFilter} onChange={(e) => setUrgFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}>
            <option value="">Todas las urgencias</option>
            {["urgent", "high", "medium", "low"].map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      )}

      {error && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>{error}</div>}

      {/* Listings */}
      {tab === "listings" && (
        <div style={{ display: "grid", gap: 12 }}>
          {listings.length === 0 && !loading && (
            <div style={{ padding: "32px", textAlign: "center", fontSize: 13, color: "var(--muted)", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
              No hay trabajos publicados en este momento
            </div>
          )}
          {listings.map((l) => (
            <div key={l.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{l.title}</span>
                    <UrgencyBadge urgency={l.urgency} />
                    {l.category && (
                      <span style={{ fontSize: 10, color: "#818cf8", background: "rgba(99,102,241,.1)", padding: "2px 8px", borderRadius: 99 }}>
                        {CATEGORY_LABELS[l.category] ?? l.category}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{l.scope}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#86efac" }}>{formatBudget(l.budgetMin, l.budgetMax, l.budgetType)}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{l.bidsCount} bids</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 10, color: "var(--muted)" }}>
                {l.location && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={10} />{l.location}</span>}
                {l.clientOrg && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Briefcase size={10} />{l.clientOrg}</span>}
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={10} />{new Date(l.postedAt).toLocaleDateString("es-MX")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Professionals */}
      {tab === "professionals" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>
            <span>PROFESIONAL</span><span>TRABAJOS</span><span>CALIFICACIÓN</span><span>ESTADO</span>
          </div>
          {professionals.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Sin profesionales registrados</div>
          )}
          {professionals.map((p) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{p.email}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>
                <Activity size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                {p.completedJobs}
              </div>
              <div style={{ fontSize: 12, color: "#fcd34d", display: "flex", alignItems: "center", gap: 4 }}>
                <Star size={11} fill="#fcd34d" />
                {p.avgRating ?? "—"}
              </div>
              <div style={{ fontSize: 10, color: "#86efac", fontWeight: 600 }}>Verificado</div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

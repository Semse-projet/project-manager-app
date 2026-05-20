"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase, Clock, DollarSign, MapPin, RefreshCw,
  Search, Star, Users, Zap, ChevronRight, Filter,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Listing = {
  id: string; title: string; category: string | null; location: string | null;
  budgetMin: number | null; budgetMax: number | null; budgetType: string | null;
  status: string; urgency: string | null; scope: string; postedAt: string;
  clientOrg?: string; bidsCount: number;
};

type Professional = {
  id: string; name: string; email: string;
  completedJobs: number; avgRating: number | null;
};

type Stats = {
  totalListings: number;
  byCategory: Record<string, number>;
  byUrgency: Record<string, number>;
  avgBudgetMin: number | null;
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

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return "Abierto";
  if (min && max) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (min) return `Desde $${min.toLocaleString()}`;
  return `Hasta $${max!.toLocaleString()}`;
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({ listing, onApply }: { listing: Listing; onApply: (id: string) => void }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", transition: "border-color .2s" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#818cf8")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{listing.title}</span>
            <UrgencyBadge urgency={listing.urgency} />
            {listing.category && (
              <span style={{ fontSize: 10, color: "#818cf8", background: "rgba(99,102,241,.1)", padding: "2px 8px", borderRadius: 99 }}>
                {CATEGORY_LABELS[listing.category] ?? listing.category}
              </span>
            )}
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            {listing.scope.slice(0, 180)}{listing.scope.length > 180 ? "…" : ""}
          </p>
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--muted)", flexWrap: "wrap" }}>
            {listing.location && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={10} />{listing.location}
              </span>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <DollarSign size={10} />{formatBudget(listing.budgetMin, listing.budgetMax)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={10} />{new Date(listing.postedAt).toLocaleDateString("es-MX")}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={10} />{listing.bidsCount} propuesta{listing.bidsCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <button
          onClick={() => onApply(listing.id)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.3)", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#818cf8", flexShrink: 0, whiteSpace: "nowrap" }}>
          Aplicar <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Professional Card ─────────────────────────────────────────────────────────

function ProfCard({ prof }: { prof: Professional }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(99,102,241,.2)", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 900, color: "#818cf8", flexShrink: 0 }}>
        {prof.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{prof.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{prof.email}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: "#818cf8" }}>
            <Briefcase size={10} style={{ verticalAlign: "middle", marginRight: 3 }} />
            {prof.completedJobs} trabajo{prof.completedJobs !== 1 ? "s" : ""}
          </span>
          {prof.avgRating && (
            <span style={{ fontSize: 11, color: "#fcd34d", display: "flex", alignItems: "center", gap: 3 }}>
              <Star size={10} fill="#fcd34d" />{prof.avgRating}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => window.alert(`Contactar a ${prof.name} — próximamente disponible`)}
        style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(134,239,172,.1)", border: "1px solid rgba(134,239,172,.3)", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#86efac" }}>
        Contactar
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientMarketplacePage() {
  const [listings,      setListings]      = useState<Listing[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [stats,         setStats]         = useState<Stats | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [search,        setSearch]        = useState("");
  const [catFilter,     setCatFilter]     = useState("");
  const [urgFilter,     setUrgFilter]     = useState("");
  const [tab,           setTab]           = useState<"jobs" | "professionals">("jobs");
  const [showFilters,   setShowFilters]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (catFilter) qs.set("category", catFilter);
      if (urgFilter) qs.set("urgency",  urgFilter);

      const [lRes, pRes, sRes] = await Promise.all([
        fetch(`/api/semse/marketplace/listings?${qs}&limit=20`).then((r) => r.json()) as Promise<{ data: { listings: Listing[] } }>,
        fetch("/api/semse/marketplace/professionals?limit=8").then((r) => r.json()) as Promise<{ data: Professional[] }>,
        fetch("/api/semse/marketplace/stats").then((r) => r.json()) as Promise<{ data: Stats }>,
      ]);

      let items = lRes.data?.listings ?? [];
      if (search.trim()) {
        const q = search.toLowerCase();
        items = items.filter((l) =>
          l.title.toLowerCase().includes(q) ||
          l.location?.toLowerCase().includes(q) ||
          l.scope.toLowerCase().includes(q)
        );
      }

      setListings(items);
      setProfessionals(pRes.data ?? []);
      setStats(sRes.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [catFilter, urgFilter, search]);

  useEffect(() => { void load(); }, [load]);

  const handleApply = (jobId: string) => {
    window.alert(`Propuesta para trabajo ${jobId} — próximamente: formulario de aplicación con presupuesto y disponibilidad`);
  };

  const topCategories = stats
    ? Object.entries(stats.byCategory).sort(([, a], [, b]) => b - a).slice(0, 4)
    : [];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 28, padding: "28px 20px", background: "linear-gradient(135deg, rgba(99,102,241,.1), rgba(167,139,250,.08))", borderRadius: 20, border: "1px solid rgba(99,102,241,.2)" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 900, background: "linear-gradient(135deg, #818cf8, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          SEMSE Marketplace
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Encuentra el profesional ideal para tu proyecto de construcción
        </p>
        {stats && (
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { label: "Trabajos disponibles", value: stats.totalListings },
              { label: "Urgentes",              value: stats.byUrgency["urgent"] ?? 0 },
              { label: "Profesionales",         value: professionals.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#818cf8" }}>{value}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar trabajos, ubicación, tipo de servicio…"
            style={{ width: "100%", padding: "12px 14px 12px 36px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <button onClick={() => setShowFilters((p) => !p)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderRadius: 12, border: `1px solid ${showFilters ? "#818cf8" : "var(--border)"}`, background: showFilters ? "rgba(99,102,241,.1)" : "var(--surface)", cursor: "pointer", fontSize: 12, color: showFilters ? "#818cf8" : "var(--muted)", fontWeight: 700 }}>
          <Filter size={13} /> Filtros
        </button>
        <button onClick={load} disabled={loading}
          style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", color: "var(--muted)" }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Filters expanded */}
      {showFilters && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>CATEGORÍA</label>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12 }}>
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>URGENCIA</label>
            <select value={urgFilter} onChange={(e) => setUrgFilter(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12 }}>
              <option value="">Cualquier urgencia</option>
              {[["urgent","Urgente"],["high","Alta"],["medium","Media"],["low","Baja"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Category pills */}
      {topCategories.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={() => setCatFilter("")}
            style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${catFilter === "" ? "#818cf8" : "var(--border)"}`, background: catFilter === "" ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.03)", color: catFilter === "" ? "#818cf8" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Todos
          </button>
          {topCategories.map(([cat, count]) => (
            <button key={cat} onClick={() => setCatFilter(cat === catFilter ? "" : cat)}
              style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${cat === catFilter ? "#818cf8" : "var(--border)"}`, background: cat === catFilter ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.03)", color: cat === catFilter ? "#818cf8" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {CATEGORY_LABELS[cat] ?? cat} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,.03)", padding: 4, borderRadius: 12, border: "1px solid var(--border)", width: "fit-content" }}>
        {([["jobs", `Trabajos (${listings.length})`], ["professionals", `Profesionales (${professionals.length})`]] as [string, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t as "jobs" | "professionals")}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: tab === t ? "rgba(99,102,241,.2)" : "transparent", color: tab === t ? "#818cf8" : "var(--muted)" }}>
            {label}
          </button>
        ))}
      </div>

      {error && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}

      {/* Jobs */}
      {tab === "jobs" && (
        <div style={{ display: "grid", gap: 12 }}>
          {listings.length === 0 && !loading && (
            <div style={{ padding: "40px", textAlign: "center", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
              <Briefcase size={32} color="var(--muted)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>No hay trabajos disponibles</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {catFilter || urgFilter ? "Prueba con otros filtros" : "Vuelve pronto — los clientes publican nuevos trabajos continuamente"}
              </div>
            </div>
          )}
          {listings.map((l) => <JobCard key={l.id} listing={l} onApply={handleApply} />)}
        </div>
      )}

      {/* Professionals */}
      {tab === "professionals" && (
        <div style={{ display: "grid", gap: 12 }}>
          {professionals.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", fontSize: 13, color: "var(--muted)" }}>
              Sin profesionales verificados todavía
            </div>
          )}
          {professionals.map((p) => <ProfCard key={p.id} prof={p} />)}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

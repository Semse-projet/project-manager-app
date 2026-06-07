"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase, CheckCircle2, Clock, DollarSign, Filter, MapPin,
  RefreshCw, Search, Send, Star, Users, X, Zap, ChevronRight,
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

type BidForm = {
  jobId:         string;
  jobTitle:      string;
  budgetMin:     string;
  budgetMax:     string;
  note:          string;
  availableFrom: string;
};

type BidResult = { success: boolean; message: string };

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
  return <span style={{ fontSize: 9, fontWeight: 800, color, background: `${color}20`, padding: "2px 7px", borderRadius: 99 }}>{(urgency ?? "medium").toUpperCase()}</span>;
}

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return "Abierto";
  if (min && max) return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
  if (min) return `Desde $${min.toLocaleString()}`;
  return `Hasta $${max!.toLocaleString()}`;
}

// ── Bid Modal ─────────────────────────────────────────────────────────────────

function BidModal({ form, onClose, onSubmit, submitting, result }: {
  form: BidForm;
  onClose: () => void;
  onSubmit: (data: Omit<BidForm, "jobTitle">) => Promise<void>;
  submitting: boolean;
  result: BidResult | null;
}) {
  const [data, setData] = useState<Omit<BidForm, "jobTitle">>({
    jobId: form.jobId,
    budgetMin: form.budgetMin,
    budgetMax: form.budgetMax,
    note: form.note,
    availableFrom: form.availableFrom || new Date().toISOString().slice(0, 10),
  });

  const set = (key: keyof typeof data, val: string) => setData((p) => ({ ...p, [key]: val }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, width: "100%", maxWidth: 480, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
            <Send size={18} color="#818cf8" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Aplicar al trabajo</h2>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>{form.jobTitle}</p>
          </div>
        </div>

        {result ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            {result.success ? (
              <>
                <CheckCircle2 size={40} color="#86efac" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: "#86efac", marginBottom: 8 }}>¡Propuesta enviada!</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>{result.message}</div>
                <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 10, background: "rgba(134,239,172,.15)", border: "1px solid rgba(134,239,172,.3)", color: "#86efac", fontWeight: 700, cursor: "pointer" }}>
                  Cerrar
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fca5a5", marginBottom: 8 }}>Error al enviar</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>{result.message}</div>
                <button onClick={() => setData((p) => ({ ...p }))} style={{ padding: "8px 20px", borderRadius: 10, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#fca5a5", cursor: "pointer" }}>
                  Reintentar
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>PRESUPUESTO MÍNIMO ($)</label>
                <input type="number" value={data.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} placeholder="500"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>PRESUPUESTO MÁXIMO ($)</label>
                <input type="number" value={data.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} placeholder="800"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>DISPONIBLE DESDE</label>
              <input type="date" value={data.availableFrom} onChange={(e) => set("availableFrom", e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }} />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>MENSAJE AL CLIENTE</label>
              <textarea value={data.note} onChange={(e) => set("note", e.target.value)}
                placeholder="Describe tu experiencia con este tipo de trabajo, materiales que usarías, tiempo estimado..."
                rows={4}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ padding: "10px 14px", background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, fontSize: 11, color: "#818cf8" }}>
              Tu propuesta quedará pendiente hasta que el cliente la revise. SEMSE revisará tu perfil y reputación.
            </div>

            <button onClick={() => onSubmit(data)} disabled={submitting || !data.budgetMin}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, background: "rgba(99,102,241,.2)", border: "1px solid rgba(99,102,241,.4)", cursor: data.budgetMin ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 800, color: "#818cf8", opacity: (submitting || !data.budgetMin) ? 0.6 : 1 }}>
              {submitting ? "Enviando…" : <><Send size={15} /> Enviar propuesta</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({ listing, onApply }: { listing: Listing; onApply: (id: string, title: string) => void }) {
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
            {listing.location && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={10} />{listing.location}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><DollarSign size={10} />{formatBudget(listing.budgetMin, listing.budgetMax)}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={10} />{new Date(listing.postedAt).toLocaleDateString("es-MX")}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={10} />{listing.bidsCount} propuesta{listing.bidsCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <button onClick={() => onApply(listing.id, listing.title)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.3)", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#818cf8", flexShrink: 0 }}>
          Aplicar <ChevronRight size={13} />
        </button>
      </div>
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
  const [bidForm,       setBidForm]       = useState<BidForm | null>(null);
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidResult,     setBidResult]     = useState<BidResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (catFilter) qs.set("category", catFilter);
      if (urgFilter) qs.set("urgency", urgFilter);
      const [lRes, pRes, sRes] = await Promise.all([
        fetch(`/api/semse/marketplace/listings?${qs}&limit=20`).then((r) => r.json()) as Promise<{ data: { listings: Listing[] } }>,
        fetch("/api/semse/marketplace/professionals?limit=8").then((r) => r.json()) as Promise<{ data: Professional[] }>,
        fetch("/api/semse/marketplace/stats").then((r) => r.json()) as Promise<{ data: Stats }>,
      ]);
      let items = lRes.data?.listings ?? [];
      if (search.trim()) {
        const q = search.toLowerCase();
        items = items.filter((l) => l.title.toLowerCase().includes(q) || l.location?.toLowerCase().includes(q) || l.scope.toLowerCase().includes(q));
      }
      setListings(items);
      setProfessionals(pRes.data ?? []);
      setStats(sRes.data ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, [catFilter, urgFilter, search]);

  useEffect(() => { void load(); }, [load]);

  const openBidModal = (jobId: string, jobTitle: string) => {
    setBidResult(null);
    setBidForm({ jobId, jobTitle, budgetMin: "", budgetMax: "", note: "", availableFrom: "" });
  };

  const submitBid = async (data: Omit<BidForm, "jobTitle">) => {
    setBidSubmitting(true);
    try {
      const resp = await fetch("/api/semse/bids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId:         data.jobId,
          budgetMin:     data.budgetMin ? Number(data.budgetMin) : undefined,
          budgetMax:     data.budgetMax ? Number(data.budgetMax) : undefined,
          note:          data.note || undefined,
          availableFrom: data.availableFrom || undefined,
        }),
      });
      const json = await resp.json() as { data?: unknown; error?: { message?: string } };
      if (resp.ok && json.data) {
        setBidResult({ success: true, message: "Tu propuesta fue enviada. El cliente la revisará pronto." });
        void load(); // refresh bids count
      } else {
        setBidResult({ success: false, message: (json.error?.message as string) ?? "No se pudo enviar la propuesta." });
      }
    } catch (e) {
      setBidResult({ success: false, message: e instanceof Error ? e.message : "Error de red" });
    } finally {
      setBidSubmitting(false);
    }
  };

  const topCategories = stats ? Object.entries(stats.byCategory).sort(([, a], [, b]) => b - a).slice(0, 4) : [];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      {/* Bid Modal */}
      {bidForm && (
        <BidModal form={bidForm} onClose={() => setBidForm(null)} onSubmit={submitBid} submitting={bidSubmitting} result={bidResult} />
      )}

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 28, padding: "28px 20px", background: "linear-gradient(135deg, rgba(99,102,241,.1), rgba(167,139,250,.08))", borderRadius: 20, border: "1px solid rgba(99,102,241,.2)" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 900, background: "linear-gradient(135deg, #818cf8, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          SEMSE Marketplace
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Encuentra el trabajo ideal y aplica directamente</p>
        {stats && (
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { label: "Trabajos disponibles", value: stats.totalListings },
              { label: "Urgentes", value: stats.byUrgency["urgent"] ?? 0 },
              { label: "Profesionales", value: professionals.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#818cf8" }}>{value}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar trabajos, ubicación, tipo de servicio…"
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

      {showFilters && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>CATEGORÍA</label>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12 }}>
              <option value="">Todas</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>URGENCIA</label>
            <select value={urgFilter} onChange={(e) => setUrgFilter(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12 }}>
              <option value="">Cualquiera</option>
              {[["urgent","Urgente"],["high","Alta"],["medium","Media"],["low","Baja"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      )}

      {topCategories.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={() => setCatFilter("")} style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${catFilter === "" ? "#818cf8" : "var(--border)"}`, background: catFilter === "" ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.03)", color: catFilter === "" ? "#818cf8" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Todos</button>
          {topCategories.map(([cat, count]) => (
            <button key={cat} onClick={() => setCatFilter(cat === catFilter ? "" : cat)} style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${cat === catFilter ? "#818cf8" : "var(--border)"}`, background: cat === catFilter ? "rgba(99,102,241,.15)" : "rgba(255,255,255,.03)", color: cat === catFilter ? "#818cf8" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {CATEGORY_LABELS[cat] ?? cat} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,.03)", padding: 4, borderRadius: 12, border: "1px solid var(--border)", width: "fit-content" }}>
        {([["jobs", `Trabajos (${listings.length})`], ["professionals", `Profesionales (${professionals.length})`]] as [string, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t as "jobs" | "professionals")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: tab === t ? "rgba(99,102,241,.2)" : "transparent", color: tab === t ? "#818cf8" : "var(--muted)" }}>
            {label}
          </button>
        ))}
      </div>

      {error && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}

      {tab === "jobs" && (
        <div style={{ display: "grid", gap: 12 }}>
          {listings.length === 0 && !loading && (
            <div style={{ padding: "40px", textAlign: "center", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
              <Briefcase size={32} color="var(--muted)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>No hay trabajos disponibles</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{catFilter || urgFilter ? "Prueba con otros filtros" : "Vuelve pronto"}</div>
            </div>
          )}
          {listings.map((l) => <JobCard key={l.id} listing={l} onApply={openBidModal} />)}
        </div>
      )}

      {tab === "professionals" && (
        <div style={{ display: "grid", gap: 12 }}>
          {professionals.length === 0 && <div style={{ padding: "32px", textAlign: "center", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", fontSize: 13, color: "var(--muted)" }}>Sin profesionales registrados</div>}
          {professionals.map((p) => (
            <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(99,102,241,.2)", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 900, color: "#818cf8" }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11 }}>
                  <span style={{ color: "#818cf8" }}><Briefcase size={10} style={{ verticalAlign: "middle" }} /> {p.completedJobs} trabajos</span>
                  {p.avgRating && <span style={{ color: "#fcd34d", display: "flex", alignItems: "center", gap: 3 }}><Star size={10} fill="#fcd34d" />{p.avgRating}</span>}
                </div>
              </div>
              <span style={{ fontSize: 10, color: "#86efac", fontWeight: 600 }}>✓ Verificado</span>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

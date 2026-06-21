"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Briefcase, CheckCircle2, ChevronDown, ChevronUp, DollarSign, Filter, MapPin, RefreshCw, Send, SlidersHorizontal, X } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type Job = {
  id: string;
  title: string;
  category: string | null;
  location: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: string | null;
  scope: string;
  status: string;
  postedAt: string;
  bidsCount: number;
};

type BidForm = {
  jobId: string;
  amount: string;
  etaDays: string;
  note: string;
};

type BidResult = { success: boolean; message: string };
type SortKey = "newest" | "budget_high" | "budget_low" | "bids_low";

const URGENCY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: "#ef4444", label: "Urgente" },
  high:     { color: "#f97316", label: "Alta"    },
  medium:   { color: "#fbbf24", label: "Media"   },
  standard: { color: "#64748b", label: "Normal"  },
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest",     label: "Más recientes" },
  { key: "budget_high",label: "Mayor presupuesto" },
  { key: "budget_low", label: "Menor presupuesto" },
  { key: "bids_low",   label: "Menos competidos" },
];

function money(v: number | null | undefined) {
  if (!v) return null;
  return `$${Math.round(v).toLocaleString()}`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Hace menos de 1h";
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "18px 20px",
};

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--ink)", fontSize: 13, outline: "none",
  boxSizing: "border-box", width: "100%",
};

export default function WorkerOpportunitiesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bidForm, setBidForm] = useState<BidForm | null>(null);
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidResult, setBidResult] = useState<Record<string, BidResult>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/semse/marketplace/listings?status=PUBLISHED&limit=60");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data?: { listings: Job[] } | Job[] };
      const raw = json.data;
      const list: Job[] = Array.isArray(raw) ? raw : ((raw as { listings: Job[] })?.listings ?? []);
      setJobs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar oportunidades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const TENANT_ID = process.env.NEXT_PUBLIC_SEMSE_TENANT_ID ?? "default";
    const es = new EventSource(`/api/semse/sse?channels=bids:${TENANT_ID}`);
    es.addEventListener("bid:accepted", () => void load());
    return () => es.close();
  }, [load]);

  const categories = useMemo(() => {
    const cats = new Set(jobs.map(j => j.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [jobs]);

  const activeFilterCount = [category, budgetMin, budgetMax].filter(Boolean).length;

  const filtered = useMemo(() => {
    const minN = budgetMin ? Number(budgetMin) : null;
    const maxN = budgetMax ? Number(budgetMax) : null;

    const result = jobs.filter(j => {
      if (search && !j.title.toLowerCase().includes(search.toLowerCase()) &&
          !(j.category ?? "").toLowerCase().includes(search.toLowerCase()) &&
          !(j.location ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (category && j.category !== category) return false;
      const effectiveBudget = j.budgetMax ?? j.budgetMin;
      if (minN && (effectiveBudget ?? 0) < minN) return false;
      if (maxN && (effectiveBudget ?? Infinity) > maxN) return false;
      return true;
    });

    return [...result].sort((a, b) => {
      if (sort === "newest") return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      if (sort === "budget_high") return ((b.budgetMax ?? b.budgetMin ?? 0) - (a.budgetMax ?? a.budgetMin ?? 0));
      if (sort === "budget_low") return ((a.budgetMax ?? a.budgetMin ?? 0) - (b.budgetMax ?? b.budgetMin ?? 0));
      if (sort === "bids_low") return a.bidsCount - b.bidsCount;
      return 0;
    });
  }, [jobs, search, category, budgetMin, budgetMax, sort]);

  function clearFilters() {
    setCategory(""); setBudgetMin(""); setBudgetMax("");
  }

  async function submitBid() {
    if (!bidForm) return;
    setBidSubmitting(true);
    try {
      const amount  = Number(bidForm.amount);
      const etaDays = Number(bidForm.etaDays);
      if (!amount || amount <= 0 || !etaDays || etaDays <= 0) {
        setBidResult(prev => ({ ...prev, [bidForm.jobId]: { success: false, message: "Monto y días son requeridos" } }));
        return;
      }
      const payload: Record<string, unknown> = { jobId: bidForm.jobId, amount, etaDays };
      if (bidForm.note.trim()) payload.note = bidForm.note.trim();
      const res = await fetch("/api/semse/bids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: unknown; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo enviar la propuesta");
      setBidResult(prev => ({ ...prev, [bidForm.jobId]: { success: true, message: "¡Propuesta enviada!" } }));
      setBidForm(null);
    } catch (e) {
      setBidResult(prev => ({ ...prev, [bidForm!.jobId]: { success: false, message: e instanceof Error ? e.message : "Error" } }));
    } finally {
      setBidSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <NotificationBanner audience="worker" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Oportunidades</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Trabajos disponibles — envía tu propuesta directamente.
          </p>
        </div>
        <button
          onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* Search + Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título, categoría o ubicación..."
            style={{ ...inputStyle, paddingLeft: 38 }}
          />
          <Briefcase size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        </div>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          style={{ ...inputStyle, width: "auto", paddingRight: 28, cursor: "pointer", appearance: "none", backgroundImage: "none" }}
        >
          {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: `1px solid ${activeFilterCount > 0 ? "var(--brand)" : "var(--border)"}`, background: activeFilterCount > 0 ? "rgba(59,130,246,.08)" : "transparent", color: activeFilterCount > 0 ? "var(--brand)" : "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
        >
          <SlidersHorizontal size={13} />
          Filtros
          {activeFilterCount > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 9, background: "var(--brand)", color: "#fff", fontSize: 10, fontWeight: 800 }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, padding: "14px 16px", marginBottom: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Categoría</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle }}>
              <option value="">Todas</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Presupuesto mín ($)</label>
            <input type="number" min="0" step="100" placeholder="ej. 500" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Presupuesto máx ($)</label>
            <input type="number" min="0" step="100" placeholder="ej. 5000" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} style={inputStyle} />
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
      )}

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", marginBottom: 16, fontSize: 13, color: "#fca5a5" }}>{error}</div>}

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: "var(--raised)" }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <HtmlInCanvasPanel as="div" style={{ ...card, textAlign: "center", padding: "40px 24px" }} canvasClassName="rounded-2xl" minHeight={100}>
          <Filter size={28} style={{ color: "var(--faint)", margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>
            {jobs.length === 0 ? "No hay trabajos disponibles en este momento" : "Sin resultados para los filtros activos"}
          </p>
          <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>
            {jobs.length > 0 ? "Ajusta la búsqueda o los filtros." : "Vuelve más tarde."}
          </p>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ marginTop: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>
              Limpiar filtros
            </button>
          )}
        </HtmlInCanvasPanel>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map(job => {
            const urg = URGENCY_CONFIG[job.urgency ?? "standard"] ?? URGENCY_CONFIG.standard;
            const isExpanded = expanded === job.id;
            const alreadyBid = !!bidResult[job.id]?.success;

            return (
              <HtmlInCanvasPanel key={job.id} as="div" style={{ ...card, opacity: alreadyBid ? 0.7 : 1 }} canvasClassName="rounded-2xl" minHeight={80}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{job.title}</h2>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: `${urg.color}18`, color: urg.color }}>{urg.label}</span>
                      {alreadyBid && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(16,185,129,.1)", color: "#10b981" }}>✓ Propuesta enviada</span>}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
                      {job.category && <span style={{ padding: "2px 8px", background: "var(--raised)", borderRadius: 999, fontWeight: 600 }}>{job.category}</span>}
                      {job.location && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MapPin size={10} />{job.location}</span>}
                      {(job.budgetMin ?? job.budgetMax) && (
                        <span style={{ display: "flex", alignItems: "center", gap: 3, color: "#10b981", fontWeight: 600 }}>
                          <DollarSign size={10} />
                          {money(job.budgetMin)}{job.budgetMax ? `–${money(job.budgetMax)}` : ""}
                        </span>
                      )}
                      <span>{relativeTime(job.postedAt)}</span>
                      {job.bidsCount > 0 && <span style={{ color: "#818cf8" }}>{job.bidsCount} propuesta{job.bidsCount !== 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : job.id)}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
                  >
                    {isExpanded ? <><ChevronUp size={12} /> Cerrar</> : <><ChevronDown size={12} /> Ver detalle</>}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                    {job.scope && (
                      <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)" }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Descripción</p>
                        <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6, margin: 0 }}>{job.scope}</p>
                      </div>
                    )}

                    {bidResult[job.id] && !bidResult[job.id].success && (
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", fontSize: 13, color: "#fca5a5", display: "flex", alignItems: "center", gap: 8 }}>
                        <AlertTriangle size={13} />{bidResult[job.id].message}
                      </div>
                    )}

                    {!alreadyBid && (
                      <div style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid rgba(99,102,241,.2)", background: "rgba(99,102,241,.04)" }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".05em" }}>Enviar propuesta</p>
                        <div style={{ display: "grid", gap: 10 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>MI PRECIO ($)</label>
                              <input
                                type="number" min="1" step="50"
                                placeholder={job.budgetMin ? `ej. ${job.budgetMin}` : "ej. 1500"}
                                value={bidForm?.jobId === job.id ? bidForm.amount : ""}
                                onChange={e => setBidForm(prev => ({ ...(prev?.jobId === job.id ? prev : { jobId: job.id, amount: "", etaDays: "", note: "" }), amount: e.target.value }))}
                                style={inputStyle}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>DÍAS ESTIMADOS</label>
                              <input
                                type="number" min="1" step="1"
                                placeholder="ej. 5"
                                value={bidForm?.jobId === job.id ? bidForm.etaDays : ""}
                                onChange={e => setBidForm(prev => ({ ...(prev?.jobId === job.id ? prev : { jobId: job.id, amount: "", etaDays: "", note: "" }), etaDays: e.target.value }))}
                                style={inputStyle}
                              />
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>MENSAJE AL CLIENTE (opcional)</label>
                            <textarea
                              rows={2}
                              placeholder="Describe tu experiencia, enfoque o preguntas sobre el trabajo..."
                              value={bidForm?.jobId === job.id ? bidForm.note : ""}
                              onChange={e => setBidForm(prev => ({ ...(prev?.jobId === job.id ? prev : { jobId: job.id, amount: "", etaDays: "", note: "" }), note: e.target.value }))}
                              style={{ ...inputStyle, resize: "vertical" }}
                            />
                          </div>
                          <button
                            onClick={() => { setBidForm(f => f?.jobId === job.id ? f : { jobId: job.id, amount: "", etaDays: "", note: "" }); void submitBid(); }}
                            disabled={bidSubmitting}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 20px", borderRadius: 9, border: "none", background: bidSubmitting ? "var(--muted)" : "#6366f1", color: "#fff", fontSize: 13, fontWeight: 700, cursor: bidSubmitting ? "not-allowed" : "pointer" }}
                          >
                            <Send size={13} />
                            {bidSubmitting ? "Enviando..." : "Enviar propuesta"}
                          </button>
                        </div>
                      </div>
                    )}

                    {alreadyBid && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 9, background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)" }}>
                        <CheckCircle2 size={14} color="#10b981" />
                        <p style={{ fontSize: 13, color: "#10b981", margin: 0 }}>Tu propuesta fue enviada. El cliente te contactará si te selecciona.</p>
                      </div>
                    )}
                  </div>
                )}
              </HtmlInCanvasPanel>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--faint)", marginTop: 20 }}>
          {filtered.length} de {jobs.length} trabajo{jobs.length !== 1 ? "s" : ""}
          {(search || activeFilterCount > 0) ? " — filtrados" : " disponibles"}
        </p>
      )}
    </div>
  );
}

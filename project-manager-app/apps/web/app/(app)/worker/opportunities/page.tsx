"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Briefcase, CheckCircle2, ChevronDown, ChevronUp, DollarSign, MapPin, RefreshCw, Send, Zap } from "lucide-react";
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
  budgetMin: string;
  budgetMax: string;
  note: string;
  availableFrom: string;
};

type BidResult = { success: boolean; message: string };

const URGENCY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: "#ef4444", label: "Urgente" },
  high:     { color: "#f97316", label: "Alta"    },
  medium:   { color: "#fbbf24", label: "Media"   },
  standard: { color: "#64748b", label: "Normal"  },
};

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

export default function WorkerOpportunitiesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bidForm, setBidForm] = useState<BidForm | null>(null);
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidResult, setBidResult] = useState<Record<string, BidResult>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/semse/marketplace/listings?status=PUBLISHED&limit=40");
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

  // SSE: refresh when a bid we submitted gets accepted
  useEffect(() => {
    if (typeof window === "undefined") return;
    const TENANT_ID = process.env.NEXT_PUBLIC_SEMSE_TENANT_ID ?? "default";
    const es = new EventSource(`/api/semse/sse?channels=bids:${TENANT_ID}`);
    es.addEventListener("bid:accepted", () => void load());
    return () => es.close();
  }, [load]);

  const filtered = jobs.filter(j =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) ||
    (j.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (j.location ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function submitBid() {
    if (!bidForm) return;
    setBidSubmitting(true);
    try {
      const res = await fetch("/api/semse/bids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: bidForm.jobId,
          budgetMin: bidForm.budgetMin ? Number(bidForm.budgetMin) : undefined,
          budgetMax: bidForm.budgetMax ? Number(bidForm.budgetMax) : undefined,
          note: bidForm.note.trim() || undefined,
          availableFrom: bidForm.availableFrom || undefined,
        }),
      });
      const json = await res.json() as { data?: unknown; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "No se pudo enviar la propuesta");
      setBidResult(prev => ({ ...prev, [bidForm.jobId]: { success: true, message: "¡Propuesta enviada!" } }));
      setBidForm(null);
    } catch (e) {
      setBidResult(prev => ({ ...prev, [bidForm.jobId]: { success: false, message: e instanceof Error ? e.message : "Error" } }));
    } finally {
      setBidSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <NotificationBanner audience="worker" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Oportunidades</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Trabajos disponibles en la plataforma — envía tu propuesta directamente.
          </p>
        </div>
        <button
          onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
        >
          <RefreshCw size={13} />
          Actualizar
        </button>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por título, categoría o ubicación..."
          style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
        />
        <Briefcase size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", marginBottom: 16, fontSize: 13, color: "#fca5a5" }}>{error}</div>}

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: "var(--raised)" }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <HtmlInCanvasPanel as="div" style={{ ...card, textAlign: "center", padding: "40px 24px" }} canvasClassName="rounded-2xl" minHeight={100}>
          <Briefcase size={28} style={{ color: "var(--faint)", margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>
            {search ? "Sin resultados para esa búsqueda" : "No hay trabajos disponibles en este momento"}
          </p>
          <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>Vuelve más tarde o ajusta tu búsqueda.</p>
        </HtmlInCanvasPanel>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map(job => {
            const urg = URGENCY_CONFIG[job.urgency ?? "standard"] ?? URGENCY_CONFIG.standard;
            const isExpanded = expanded === job.id;
            const alreadyBid = !!bidResult[job.id]?.success;

            return (
              <HtmlInCanvasPanel key={job.id} as="div" style={{ ...card, opacity: alreadyBid ? 0.7 : 1 }} canvasClassName="rounded-2xl" minHeight={80}>
                {/* Job header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{job.title}</h2>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: `${urg.color}18`, color: urg.color }}>{urg.label}</span>
                      {alreadyBid && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(16,185,129,.1)", color: "#10b981" }}>✓ Propuesta enviada</span>}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
                      {job.category && <span>{job.category}</span>}
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

                {/* Expanded: scope + bid form */}
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
                              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>PRESUPUESTO MÍN ($)</label>
                              <input
                                type="number" min="0" step="50"
                                placeholder={money(job.budgetMin) ?? "0"}
                                value={bidForm?.jobId === job.id ? bidForm.budgetMin : ""}
                                onChange={e => setBidForm(prev => ({ ...(prev?.jobId === job.id ? prev : { jobId: job.id, budgetMin: "", budgetMax: "", note: "", availableFrom: "" }), budgetMin: e.target.value }))}
                                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>PRESUPUESTO MÁX ($)</label>
                              <input
                                type="number" min="0" step="50"
                                placeholder={money(job.budgetMax) ?? "0"}
                                value={bidForm?.jobId === job.id ? bidForm.budgetMax : ""}
                                onChange={e => setBidForm(prev => ({ ...(prev?.jobId === job.id ? prev : { jobId: job.id, budgetMin: "", budgetMax: "", note: "", availableFrom: "" }), budgetMax: e.target.value }))}
                                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                              />
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>DISPONIBILIDAD (fecha de inicio)</label>
                            <input
                              type="date"
                              value={bidForm?.jobId === job.id ? bidForm.availableFrom : ""}
                              onChange={e => setBidForm(prev => ({ ...(prev?.jobId === job.id ? prev : { jobId: job.id, budgetMin: "", budgetMax: "", note: "", availableFrom: "" }), availableFrom: e.target.value }))}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>MENSAJE AL CLIENTE (opcional)</label>
                            <textarea
                              rows={2}
                              placeholder="Describe tu experiencia, enfoque o preguntas sobre el trabajo..."
                              value={bidForm?.jobId === job.id ? bidForm.note : ""}
                              onChange={e => setBidForm(prev => ({ ...(prev?.jobId === job.id ? prev : { jobId: job.id, budgetMin: "", budgetMax: "", note: "", availableFrom: "" }), note: e.target.value }))}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                            />
                          </div>
                          <button
                            onClick={() => { setBidForm(f => f?.jobId === job.id ? f : { jobId: job.id, budgetMin: "", budgetMax: "", note: "", availableFrom: "" }); void submitBid(); }}
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
          {filtered.length} trabajo{filtered.length !== 1 ? "s" : ""} disponible{filtered.length !== 1 ? "s" : ""}
          {search ? ` que coinciden con "${search}"` : ""}
        </p>
      )}
    </div>
  );
}

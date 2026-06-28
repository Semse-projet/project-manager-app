"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, AlertTriangle, Bot, Briefcase, CheckCircle2, Clock,
  DollarSign, Eye, FileText, RefreshCw, ShieldCheck, Zap,
} from "lucide-react";
import {
  fetchJob, fetchJobAgentSignals, fetchJobBids, fetchJobEscrow,
  fetchJobEvidence, fetchJobMilestones, transitionJobStatus,
  type JobAgentSignal,
} from "../../../../semse-api";
import type { JobRecordView } from "@semse/schemas";

type Tab = "overview" | "bids" | "milestones" | "evidence" | "escrow" | "signals";

const TABS: { id: Tab; label: string; icon: typeof Briefcase }[] = [
  { id: "overview",   label: "Overview",    icon: Briefcase    },
  { id: "bids",       label: "Bids",        icon: FileText     },
  { id: "milestones", label: "Milestones",  icon: CheckCircle2 },
  { id: "evidence",   label: "Evidence",    icon: Eye          },
  { id: "escrow",     label: "Escrow",      icon: DollarSign   },
  { id: "signals",    label: "AI Signals",  icon: Bot          },
];

type StatusMeta = { label: string; color: string; bg: string };
const STATUS: Record<string, StatusMeta> = {
  draft:       { label: "Draft",       color: "#9ca3af", bg: "rgba(156,163,175,.12)" },
  posted:      { label: "Posted",      color: "#93c5fd", bg: "rgba(59,130,246,.12)"  },
  published:   { label: "Published",   color: "#6ee7b7", bg: "rgba(16,185,129,.12)"  },
  reserved:    { label: "Reserved",    color: "#c4b5fd", bg: "rgba(139,92,246,.12)"  },
  accepted:    { label: "Accepted",    color: "#5eead4", bg: "rgba(20,184,166,.12)"  },
  in_progress: { label: "In Progress", color: "#fbbf24", bg: "rgba(245,158,11,.12)"  },
  review:      { label: "Review",      color: "#818cf8", bg: "rgba(99,102,241,.12)"  },
  dispute:     { label: "Dispute",     color: "#f87171", bg: "rgba(239,68,68,.12)"   },
  completed:   { label: "Completed",   color: "#34d399", bg: "rgba(16,185,129,.12)"  },
  awarded:     { label: "Awarded",     color: "#fcd34d", bg: "rgba(245,158,11,.12)"  },
  cancelled:   { label: "Cancelled",   color: "#6b7280", bg: "rgba(107,114,128,.12)" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS[status] ?? STATUS.draft;
  return (
    <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 20, background: m.bg, color: m.color, fontSize: 12, fontWeight: 700 }}>
      {m.label}
    </span>
  );
}

function KV({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{value ?? "—"}</span>
    </div>
  );
}

function fmt(n?: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function AdminJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();

  const [job,        setJob]        = useState<JobRecordView | null>(null);
  const [bids,       setBids]       = useState<Record<string, unknown>[]>([]);
  const [milestones, setMilestones] = useState<Record<string, unknown>[]>([]);
  const [evidence,   setEvidence]   = useState<Record<string, unknown>[]>([]);
  const [escrow,     setEscrow]     = useState<Record<string, unknown> | null>(null);
  const [signals,    setSignals]    = useState<JobAgentSignal[]>([]);
  const [tab,        setTab]        = useState<Tab>("overview");
  const [loading,    setLoading]    = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [txError,    setTxError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true); setError(null);
    try {
      const [j, b, m, ev, es, sig] = await Promise.allSettled([
        fetchJob(jobId),
        fetchJobBids(jobId),
        fetchJobMilestones(jobId),
        fetchJobEvidence(jobId),
        fetchJobEscrow(jobId),
        fetchJobAgentSignals(jobId),
      ]);
      if (j.status === "fulfilled") setJob(j.value);
      else setError("Error cargando job");
      if (b.status === "fulfilled") setBids(b.value as Record<string, unknown>[]);
      if (m.status === "fulfilled") setMilestones(m.value);
      if (ev.status === "fulfilled") setEvidence(ev.value);
      if (es.status === "fulfilled") setEscrow(es.value);
      if (sig.status === "fulfilled") setSignals(sig.value);
    } finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { void load(); }, [load]);

  async function handleTransition(targetStatus: string) {
    if (!jobId) return;
    setTransitioning(true); setTxError(null);
    try {
      await transitionJobStatus(jobId, targetStatus);
      await load();
    } catch (e: any) {
      setTxError(e?.message ?? "Error al cambiar estado");
    } finally { setTransitioning(false); }
  }

  const ADMIN_TRANSITIONS: Record<string, string[]> = {
    published:   ["reserved", "cancelled"],
    reserved:    ["accepted", "cancelled"],
    accepted:    ["in_progress", "cancelled"],
    in_progress: ["review", "dispute"],
    review:      ["completed", "dispute", "in_progress"],
    dispute:     ["review", "completed", "cancelled"],
    draft:       ["published"],
    posted:      ["published", "cancelled"],
  };

  const availableTransitions = job ? (ADMIN_TRANSITIONS[job.status] ?? []) : [];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Link href="/admin/jobs" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <ArrowLeft size={12} /> Admin Jobs
        </Link>
        {job && (
          <>
            <span style={{ color: "var(--border)", fontSize: 12 }}>/</span>
            <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>{job.title}</span>
          </>
        )}
      </div>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}
      {txError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{txError}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 60, borderRadius: 10 }} />)}
        </div>
      ) : job ? (
        <>
          {/* Header */}
          <div style={{
            borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)",
            padding: "20px 24px", marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em" }}>{job.title}</h1>
                  <StatusBadge status={job.status} />
                </div>
                <p style={{ fontSize: 12, color: "var(--faint)", fontFamily: "monospace" }}>{job.id}</p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => void load()} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }} disabled={loading}>
                  <RefreshCw size={11} /> Refresh
                </button>
                <Link href={`/client/jobs/${job.id}`} className="btn-ghost" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                  <Eye size={11} /> View as Client
                </Link>
              </div>
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
              <KV label="Categoría"  value={job.category} />
              <KV label="Budget min" value={fmt(job.budgetMin)} />
              <KV label="Budget max" value={fmt(job.budgetMax)} />
              <KV label="Urgencia"   value={job.urgency} />
              <KV label="Ubicación"  value={job.location} />
              <KV label="Deadline"   value={job.deadline} />
            </div>

            {/* Scope */}
            {job.scope && (
              <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Alcance</p>
                <p style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.6 }}>{job.scope}</p>
              </div>
            )}

            {/* Admin transitions */}
            {availableTransitions.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <Zap size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />Admin override:
                </span>
                {availableTransitions.map(ts => (
                  <button key={ts} onClick={() => void handleTransition(ts)} disabled={transitioning}
                    className="btn-ghost"
                    style={{ fontSize: 11, padding: "4px 10px", opacity: transitioning ? 0.5 : 1 }}>
                    → {STATUS[ts]?.label ?? ts}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "10px 14px",
                    background: "none", border: "none", cursor: "pointer",
                    borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
                    color: active ? "var(--brand)" : "var(--muted)",
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    marginBottom: -1, transition: "color 0.12s",
                  }}>
                  <Icon size={12} /> {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "18px 20px" }}>

            {tab === "overview" && (
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {[
                  { label: "Bids recibidos",   value: bids.length,       color: "#93c5fd", Icon: FileText     },
                  { label: "Milestones",        value: milestones.length, color: "#6ee7b7", Icon: CheckCircle2 },
                  { label: "Evidencias",        value: evidence.length,   color: "#c4b5fd", Icon: Eye          },
                  { label: "Señales IA",        value: signals.length,    color: signals.length > 0 ? "#fca5a5" : "#94a3b8", Icon: Bot },
                  { label: "Escrow",
                    value: escrow ? `${(escrow as any)?.status ?? "activo"}` : "—",
                    color: "#fcd34d", Icon: DollarSign },
                ].map(kpi => {
                  const Icon = kpi.Icon;
                  return (
                    <div key={kpi.label} style={{
                      borderRadius: 10, border: "1px solid var(--border)", borderTop: `3px solid ${kpi.color}`,
                      padding: "12px 14px",
                    }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                        <Icon size={11} color={kpi.color} />
                        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</p>
                      </div>
                      <p style={{ fontSize: 22, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "bids" && (
              bids.length === 0
                ? <div className="empty-state"><FileText size={32} className="empty-icon" /><p className="empty-title">Sin bids</p></div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {bids.map((bid: any, i) => (
                      <div key={bid.id ?? i} style={{ borderRadius: 10, border: "1px solid var(--border)", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                            {bid.proOrgName ?? bid.proOrgId ?? `Bid #${i + 1}`}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--muted)" }}>
                            {bid.etaDays != null ? `ETA: ${bid.etaDays}d` : ""}
                            {bid.note ? ` — ${bid.note}` : ""}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 15, fontWeight: 800, color: "#6ee7b7" }}>{fmt(bid.amount)}</p>
                          <p style={{ fontSize: 10, color: "var(--muted)" }}>{bid.status ?? "submitted"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
            )}

            {tab === "milestones" && (
              milestones.length === 0
                ? <div className="empty-state"><CheckCircle2 size={32} className="empty-icon" /><p className="empty-title">Sin milestones</p></div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {milestones.map((ms: any, i) => (
                      <div key={ms.id ?? i} style={{ borderRadius: 10, border: "1px solid var(--border)", padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{ms.title ?? ms.description ?? `Milestone ${i + 1}`}</p>
                          <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--faint)", padding: "2px 8px", borderRadius: 12 }}>{ms.status ?? "pending"}</span>
                        </div>
                        {ms.amount != null && <p style={{ fontSize: 12, color: "#6ee7b7" }}>{fmt(ms.amount)}</p>}
                      </div>
                    ))}
                  </div>
            )}

            {tab === "evidence" && (
              evidence.length === 0
                ? <div className="empty-state"><Eye size={32} className="empty-icon" /><p className="empty-title">Sin evidencias</p></div>
                : <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                    {evidence.map((ev: any, i) => (
                      <div key={ev.id ?? i} style={{ borderRadius: 10, border: "1px solid var(--border)", padding: "12px 14px" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
                          {ev.title ?? ev.mediaType ?? `Evidence ${i + 1}`}
                        </p>
                        <p style={{ fontSize: 10, color: "var(--muted)" }}>{ev.note ?? ev.status ?? ""}</p>
                        {ev.fileUrl && (
                          <a href={ev.fileUrl as string} target="_blank" rel="noreferrer"
                            style={{ fontSize: 11, color: "var(--brand)", display: "block", marginTop: 6 }}>
                            Ver archivo →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
            )}

            {tab === "escrow" && (
              !escrow
                ? <div className="empty-state"><DollarSign size={32} className="empty-icon" /><p className="empty-title">Sin escrow</p></div>
                : <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                    {Object.entries(escrow).filter(([, v]) => v != null && typeof v !== "object").map(([k, v]) => (
                      <div key={k} style={{ borderRadius: 8, border: "1px solid var(--border)", padding: "10px 12px" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{k}</p>
                        <p style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{String(v)}</p>
                      </div>
                    ))}
                  </div>
            )}

            {tab === "signals" && (
              signals.length === 0
                ? <div className="empty-state">
                    <Bot size={32} className="empty-icon" />
                    <p className="empty-title">Sin señales de agentes</p>
                    <p className="empty-desc">Las señales se generan automáticamente cuando los agentes IA detectan patrones o requieren atención.</p>
                  </div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {signals.map((sig, i) => {
                      const urgentColor = sig.type?.includes("CRITICAL") ? "#f87171" : "#fbbf24";
                      return (
                        <div key={sig.id ?? i} style={{ borderRadius: 10, border: `1px solid var(--border)`, borderLeft: `3px solid ${urgentColor}`, padding: "12px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <AlertTriangle size={13} color={urgentColor} />
                              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{sig.type ?? "Signal"}</p>
                            </div>
                            {sig.confidence != null && (
                              <span style={{ fontSize: 10, color: "var(--muted)", background: "var(--faint)", padding: "2px 8px", borderRadius: 10 }}>
                                {Math.round(sig.confidence * 100)}% confianza
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{sig.description}</p>
                        </div>
                      );
                    })}
                  </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Briefcase size={36} className="empty-icon" />
          <p className="empty-title">Job no encontrado</p>
          <Link href="/admin/jobs" className="btn-accent" style={{ marginTop: 12 }}>← Volver a Jobs</Link>
        </div>
      )}
    </div>
  );
}

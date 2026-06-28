"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowUpRight, Briefcase, CheckCircle2, Clock, DollarSign,
  Filter, RefreshCw, Search, XCircle,
} from "lucide-react";

type JobStatus =
  | "draft" | "posted" | "published" | "reserved"
  | "accepted" | "in_progress" | "review"
  | "dispute" | "completed" | "awarded" | "cancelled";

interface Job {
  id: string;
  title: string;
  category?: string;
  scope: string;
  status: JobStatus;
  budgetType?: string;
  budgetMin?: number;
  budgetMax?: number;
  location?: string;
  urgency?: string;
  deadline?: string;
}

interface JobsEnvelope { data: Job[] | { jobs: Job[]; total?: number } }

const STATUS_META: Record<JobStatus, { label: string; color: string; bg: string }> = {
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

const ALL_STATUSES: JobStatus[] = [
  "published", "in_progress", "review", "dispute", "accepted",
  "posted", "reserved", "awarded", "completed", "cancelled", "draft",
];

function fmt(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function StatusBadge({ status }: { status: JobStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 9px",
      borderRadius: 20, background: m.bg, color: m.color,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {m.label}
    </span>
  );
}

export default function AdminJobsPage() {
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState<JobStatus | "">("");
  const [categoryFilter, setCat]  = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res  = await fetch(`/api/semse/jobs${qs}`);
      const json = (await res.json()) as JobsEnvelope;
      const raw  = json.data;
      const list = Array.isArray(raw) ? raw : ((raw as any)?.jobs ?? []);
      setJobs(list);
    } catch (e: any) { setError(e?.message ?? "Error cargando jobs"); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j => { if (j.category) set.add(j.category); });
    return [...set].sort();
  }, [jobs]);

  const filtered = useMemo(() => {
    let list = jobs;
    if (categoryFilter) list = list.filter(j => j.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q) ||
        (j.location?.toLowerCase().includes(q) ?? false) ||
        (j.category?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [jobs, search, categoryFilter]);

  // KPIs
  const total       = jobs.length;
  const active      = jobs.filter(j => ["in_progress", "review", "accepted", "reserved"].includes(j.status)).length;
  const disputes    = jobs.filter(j => j.status === "dispute").length;
  const completed   = jobs.filter(j => j.status === "completed").length;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Briefcase size={16} color="var(--brand)" />
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "var(--ink)", letterSpacing: "-0.03em" }}>Jobs Admin</h1>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Vista administrativa de todos los jobs del sistema</p>
        </div>
        <button
          onClick={() => void load()}
          className="btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
          disabled={loading}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", marginBottom: 24 }}>
        {[
          { label: "Total",      value: total,     color: "#93c5fd",  Icon: Briefcase     },
          { label: "Activos",    value: active,    color: "#fbbf24",  Icon: Clock         },
          { label: "Completados",value: completed, color: "#6ee7b7",  Icon: CheckCircle2  },
          { label: "Disputas",   value: disputes,  color: disputes > 0 ? "#f87171" : "#6ee7b7", Icon: AlertCircle },
        ].map(kpi => {
          const Icon = kpi.Icon;
          return (
            <div key={kpi.label} style={{
              borderRadius: 10, border: "1px solid var(--border)", borderTop: `3px solid ${kpi.color}`,
              background: "var(--surface)", padding: "12px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Icon size={11} color={kpi.color} />
                <p style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</p>
              </div>
              <p style={{ fontSize: 22, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</p>
            </div>
          );
        })}
      </section>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
          <input
            className="fi"
            placeholder="Buscar por título, ID, ubicación…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={12} color="var(--muted)" />
          <select className="fi" style={{ width: "auto", minWidth: 130 }} value={statusFilter} onChange={e => setStatus(e.target.value as JobStatus | "")}>
            <option value="">Todos los estados</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        {categories.length > 0 && (
          <select className="fi" style={{ width: "auto", minWidth: 130 }} value={categoryFilter} onChange={e => setCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {(search || statusFilter || categoryFilter) && (
          <button className="btn-ghost" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
            onClick={() => { setSearch(""); setStatus(""); setCat(""); }}>
            <XCircle size={11} /> Limpiar
          </button>
        )}
      </div>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Table */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skel" style={{ height: 52, borderRadius: 8 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Briefcase size={36} className="empty-icon" />
          <p className="empty-title">{jobs.length === 0 ? "Sin jobs registrados" : "Sin resultados"}</p>
          <p className="empty-desc">{jobs.length === 0 ? "Los jobs aparecerán aquí cuando los clientes los publiquen." : "Ajusta los filtros para ver más resultados."}</p>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                  {["Título", "Categoría", "Estado", "Budget", "Urgencia", "Ubicación", ""].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((job, idx) => (
                  <tr key={job.id} style={{
                    borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
                    background: "transparent",
                    transition: "background 0.1s",
                  }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>{job.title}</div>
                      <div style={{ fontSize: 10, color: "var(--faint)", fontFamily: "monospace" }}>{job.id.slice(0, 8)}…</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)" }}>
                      {job.category ?? "—"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <StatusBadge status={job.status} />
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <DollarSign size={10} />
                        {job.budgetMin != null || job.budgetMax != null
                          ? `${fmt(job.budgetMin)} – ${fmt(job.budgetMax)}`
                          : "—"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)" }}>
                      {job.urgency ?? "—"}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)", maxWidth: 160 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                        {job.location ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <Link href={`/client/jobs/${job.id}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>
                        Ver <ArrowUpRight size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--surface)", fontSize: 11, color: "var(--muted)" }}>
            Mostrando {filtered.length} de {total} jobs
          </div>
        </div>
      )}
    </div>
  );
}

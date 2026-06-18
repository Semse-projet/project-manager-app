"use client";

import Link from "next/link";
import { useLanguage } from "../../../../lib/language-context";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, ChevronDown, Clock, RefreshCw, Inbox, ShieldAlert } from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import { fetchIncidents, createIncident, fetchMyJobs } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type IncidentType     = "safety" | "damage" | "delay" | "material" | "other";
type IncidentSeverity = "low" | "medium" | "high" | "critical";
type IncidentStatus   = "open" | "in_review" | "resolved";

interface Incident {
  id: string;
  title: string;
  jobTitle: string;
  jobId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reportedAt: string;
  description: string;
}

const SEV_COLOR: Record<IncidentSeverity, string> = {
  low: "#6b7280", medium: "#fbbf24", high: "#f97316", critical: "#ef4444",
};
const SEV_LABEL: Record<IncidentSeverity, string> = {
  low: "Baja", medium: "Media", high: "Alta", critical: "Crítica",
};
const STATUS_MAP: Record<IncidentStatus, { variant: "warning" | "info" | "success"; label: string }> = {
  open:      { variant: "warning", label: "Abierto"     },
  in_review: { variant: "info",    label: "En revisión" },
  resolved:  { variant: "success", label: "Resuelto"    },
};
const TYPE_LABEL: Record<IncidentType, string> = {
  safety: "Seguridad", damage: "Daño", delay: "Retraso", material: "Material", other: "Otro",
};

function rawToIncident(i: Record<string, unknown>, jobTitleMap: Record<string, string>): Incident {
  const jobId = String(i.jobId ?? "");
  const sev   = String(i.severity ?? "medium").toLowerCase();
  const status = String(i.status ?? "open").toLowerCase();
  const type  = String(i.type ?? "other").toLowerCase();
  return {
    id:         String(i.id ?? ""),
    title:      String(i.title ?? "Incidencia"),
    jobTitle:   jobTitleMap[jobId] ?? jobId,
    jobId,
    type:       (["safety","damage","delay","material","other"].includes(type) ? type : "other") as IncidentType,
    severity:   (["low","medium","high","critical"].includes(sev) ? sev : "medium") as IncidentSeverity,
    status:     (["open","in_review","resolved"].includes(status) ? status : "open") as IncidentStatus,
    reportedAt: typeof i.createdAt === "string" ? i.createdAt.slice(0, 16).replace("T", " ") : "",
    description: String(i.description ?? ""),
  };
}

export default function WorkerIncidentsPage() {
  const { t } = useLanguage();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [jobs, setJobs]           = useState<{ id: string; title: string }[]>([]);
  const [formJobId, setFormJobId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType]   = useState<IncidentType>("other");
  const [formSev, setFormSev]     = useState<IncidentSeverity>("medium");
  const [formDesc, setFormDesc]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rawInc, rawJobs] = await Promise.all([
        fetchIncidents().catch(() => [] as Record<string, unknown>[]),
        fetchMyJobs().catch(() => []),
      ]);
      const jobTitleMap: Record<string, string> = {};
      for (const j of rawJobs) jobTitleMap[j.id] = j.title;
      setJobs(rawJobs.map(j => ({ id: j.id, title: j.title })));
      if (formJobId === "" && rawJobs.length > 0) setFormJobId(rawJobs[0].id);
      setIncidents(rawInc.map(i => rawToIncident(i, jobTitleMap)));
    } catch { /* keep empty */ }
    setLoading(false);
  }, [formJobId]);

  useEffect(() => { void load(); }, [load]);

  async function handleSubmit() {
    if (!formTitle.trim() || !formJobId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createIncident({
        jobId: formJobId,
        title: formTitle.trim(),
        type: formType,
        severity: formSev,
        description: formDesc.trim() || undefined,
      });
      setFormTitle(""); setFormDesc("");
      setShowForm(false);
      await load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo enviar el reporte.");
    }
    setSubmitting(false);
  }

  const open     = incidents.filter(i => i.status === "open").length;
  const inReview = incidents.filter(i => i.status === "in_review").length;
  const resolved = incidents.filter(i => i.status === "resolved").length;
  const critical = incidents.filter(i => i.severity === "critical" || i.severity === "high").length;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      {/* Header */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }} canvasClassName="rounded-2xl" minHeight={82}>
        <div>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{t("page.incidents")}</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Reporta y gestiona incidencias en tus trabajos activos</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <NotificationBanner audience="worker" />
          <button onClick={() => void load()} disabled={loading} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }} title="Recargar">
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button onClick={() => setShowForm(v => !v)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            <Plus size={15} /> Nueva incidencia
          </button>
        </div>
      </HtmlInCanvasPanel>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <StatCard label="Abiertas"     value={open}     icon={AlertTriangle} color="amber"  loading={loading} />
        <StatCard label="En revisión"  value={inReview}  icon={ShieldAlert}   color="blue"   loading={loading} />
        <StatCard label="Resueltas"    value={resolved}  icon={AlertTriangle} color="green"  loading={loading} />
        <StatCard label="Alta/Crítica" value={critical}  icon={AlertTriangle} color="red"    loading={loading} />
      </div>

      {/* Form */}
      {showForm && (
        <HtmlInCanvasPanel as="section" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "20px" }} canvasClassName="rounded-2xl" minHeight={320}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "16px" }}>Reportar incidencia</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {jobs.length > 0 && (
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>TRABAJO</label>
                <div style={{ position: "relative" }}>
                  <select value={formJobId} onChange={e => setFormJobId(e.target.value)} style={{ width: "100%", padding: "9px 28px 9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", appearance: "none", outline: "none", cursor: "pointer" }}>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                  </select>
                  <ChevronDown size={12} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                </div>
              </div>
            )}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>TÍTULO</label>
              <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Describe brevemente el problema" style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>TIPO</label>
                <div style={{ position: "relative" }}>
                  <select value={formType} onChange={e => setFormType(e.target.value as IncidentType)} style={{ width: "100%", padding: "9px 32px 9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", appearance: "none", outline: "none", cursor: "pointer" }}>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <ChevronDown size={13} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>SEVERIDAD</label>
                <div style={{ position: "relative" }}>
                  <select value={formSev} onChange={e => setFormSev(e.target.value as IncidentSeverity)} style={{ width: "100%", padding: "9px 32px 9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", appearance: "none", outline: "none", cursor: "pointer" }}>
                    {Object.entries(SEV_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <ChevronDown size={13} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                </div>
              </div>
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "5px" }}>DESCRIPCIÓN</label>
              <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} placeholder="Detalla qué ocurrió, cuándo y el impacto estimado" style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: "13px", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>
            {submitError && <p style={{ fontSize: "12px", color: "#ef4444" }}>{submitError}</p>}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => void handleSubmit()} disabled={submitting || !formTitle.trim()} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Enviando…" : "Enviar reporte"}
              </button>
            </div>
          </div>
        </HtmlInCanvasPanel>
      )}

      {/* List */}
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={300}>
        <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>Historial de incidencias</h2>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1,2,3].map(i => <div key={i} style={{ height: "72px", borderRadius: "10px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
          </div>
        ) : incidents.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Inbox size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)" }}>Sin incidencias reportadas</p>
            <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "4px" }}>Usa el botón de arriba si detectas un problema en obra.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {incidents.map(inc => {
              const s = STATUS_MAP[inc.status];
              return (
                <div key={inc.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${SEV_COLOR[inc.severity]}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <AlertTriangle size={16} color={SEV_COLOR[inc.severity]} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px", flexWrap: "wrap" }}>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{inc.title}</p>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: `${SEV_COLOR[inc.severity]}18`, color: SEV_COLOR[inc.severity] }}>{SEV_LABEL[inc.severity].toUpperCase()}</span>
                        <StatusBadge variant={s.variant} text={s.label} size="sm" />
                      </div>
                      <p style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>
                        {inc.jobTitle}
                        {inc.type ? ` · ${TYPE_LABEL[inc.type]}` : ""}
                      </p>
                      {inc.description && <p style={{ fontSize: "12px", color: "var(--faint)" }}>{inc.description}</p>}
                      {inc.reportedAt && (
                        <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={10} /> {inc.reportedAt}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HtmlInCanvasPanel>
    </div>
  );
}

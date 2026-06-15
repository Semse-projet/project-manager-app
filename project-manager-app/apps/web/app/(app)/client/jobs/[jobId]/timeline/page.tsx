"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowLeft, CheckCircle,
  Clock, FileText, HardHat, Info, RefreshCw, Zap,
} from "lucide-react";
import { fetchJob, fetchBuildOpsProjects, fetchProjectActivity, type ActivityEvent } from "../../../../../semse-api";
import { NotificationBanner } from "../../../../../components/notifications/NotificationBanner";

const SEVERITY_CONFIG = {
  info:     { color: "#3b82f6", bg: "#1e3a5f", icon: <Info size={14} /> },
  warning:  { color: "#f59e0b", bg: "#451a03", icon: <AlertTriangle size={14} /> },
  critical: { color: "#ef4444", bg: "#450a0a", icon: <AlertTriangle size={14} /> },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  milestone_status:  <CheckCircle size={14} color="#10b981" />,
  change_order:      <FileText size={14} color="#f59e0b" />,
  operational_signal:<Zap size={14} color="#a78bfa" />,
  algorithm_run:     <Activity size={14} color="#3b82f6" />,
  evidence_upload:   <HardHat size={14} color="#22d3ee" />,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora mismo";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-MX", { month: "short", day: "numeric" });
}

function EventCard({ event }: { event: ActivityEvent }) {
  const sev = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info;
  const icon = TYPE_ICON[event.type] ?? <Activity size={14} color="#6b7280" />;
  return (
    <div style={{
      display: "flex", gap: 12, padding: "12px 0",
      borderBottom: "1px solid #1f2937",
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: sev.bg, border: `1px solid ${sev.color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb", lineHeight: 1.3 }}>
            {event.title}
          </span>
          <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0, marginTop: 1 }}>
            {timeAgo(event.occurredAt)}
          </span>
        </div>
        <p style={{ margin: "3px 0 0", fontSize: 13, color: "#9ca3af", lineHeight: 1.4 }}>
          {event.detail}
        </p>
        {event.severity !== "info" && (
          <span style={{
            display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em",
            color: sev.color, padding: "1px 6px",
            background: sev.bg, borderRadius: 4,
            border: `1px solid ${sev.color}40`,
          }}>
            {event.severity === "critical" ? "Crítico" : "Atención"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function JobTimelinePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [jobTitle, setJobTitle] = useState<string>("");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [job, projects] = await Promise.all([
        fetchJob(jobId).catch(() => null),
        fetchBuildOpsProjects().catch(() => [] as Record<string, unknown>[]),
      ]);

      if (job) setJobTitle(String((job as unknown as Record<string, unknown>).title ?? "Trabajo"));

      const bopsProject = projects.find((p) => {
        const proj = p as Record<string, unknown>;
        const job = proj.job as Record<string, unknown> | null | undefined;
        return String(proj.jobId ?? "") === jobId || String(job?.id ?? "") === jobId;
      });

      if (!bopsProject) {
        setError("Este trabajo no tiene un plan de construcción activo todavía.");
        setLoading(false);
        return;
      }

      const activity = await fetchProjectActivity(String(bopsProject.id ?? ""), 60);
      setEvents(activity.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()));
    } catch {
      setError("No se pudo cargar la actividad del proyecto.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const criticalCount = events.filter(e => e.severity === "critical").length;
  const warningCount = events.filter(e => e.severity === "warning").length;

  return (
    <div style={{ padding: "20px 20px", maxWidth: 680, margin: "0 auto", color: "#f9fafb" }}>
      <NotificationBanner audience="client" />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Link
          href={`/client/jobs/${jobId}`}
          style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7280", fontSize: 13, textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Volver al trabajo
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={20} color="#3b82f6" /> Timeline del Proyecto
          </h1>
          {jobTitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>{jobTitle}</p>}
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
            background: "#1f2937", border: "1px solid #374151", borderRadius: 6,
            color: "#9ca3af", cursor: loading ? "not-allowed" : "pointer", fontSize: 13,
          }}
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* Summary chips */}
      {events.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#6b7280", padding: "4px 10px", background: "#1f2937", borderRadius: 20, border: "1px solid #374151" }}>
            {events.length} eventos
          </span>
          {criticalCount > 0 && (
            <span style={{ fontSize: 12, color: "#ef4444", padding: "4px 10px", background: "#450a0a", borderRadius: 20, border: "1px solid #ef444440" }}>
              {criticalCount} crítico{criticalCount > 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span style={{ fontSize: 12, color: "#f59e0b", padding: "4px 10px", background: "#451a03", borderRadius: 20, border: "1px solid #f59e0b40" }}>
              {warningCount} atención
            </span>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, padding: "20px", textAlign: "center", color: "#9ca3af" }}>
          <Info size={24} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14 }}>{error}</div>
        </div>
      )}

      {loading && !error && (
        <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
          <Activity size={28} style={{ marginBottom: 8 }} />
          <div>Cargando actividad…</div>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
          <Clock size={28} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14 }}>Aún no hay actividad registrada para este proyecto.</div>
        </div>
      )}

      {events.length > 0 && (
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: "0 16px" }}>
          {events.map(e => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}

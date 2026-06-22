"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowLeft, Camera, CheckCircle,
  Clock, FileText, Film, HardHat, Info, RefreshCw, Zap,
} from "lucide-react";
import { fetchJob, fetchBuildOpsProjects, fetchProjectActivity, type ActivityEvent } from "../../../../../semse-api";
import { NotificationBanner } from "../../../../../components/notifications/NotificationBanner";

const SEVERITY_CONFIG = {
  info:     { color: "#3b82f6", bg: "#1e3a5f", icon: <Info size={14} /> },
  warning:  { color: "#f59e0b", bg: "#451a03", icon: <AlertTriangle size={14} /> },
  critical: { color: "#ef4444", bg: "#450a0a", icon: <AlertTriangle size={14} /> },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  milestone_status:   <CheckCircle size={14} color="#10b981" />,
  change_order:       <FileText size={14} color="#f59e0b" />,
  operational_signal: <Zap size={14} color="#a78bfa" />,
  algorithm_run:      <Activity size={14} color="#3b82f6" />,
  evidence_upload:    <HardHat size={14} color="#22d3ee" />,
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
    <div style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #1f2937" }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: sev.bg, border: `1px solid ${sev.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb", lineHeight: 1.3 }}>{event.title}</span>
          <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0, marginTop: 1 }}>{timeAgo(event.occurredAt)}</span>
        </div>
        <p style={{ margin: "3px 0 0", fontSize: 13, color: "#9ca3af", lineHeight: 1.4 }}>{event.detail}</p>
        {event.severity !== "info" && (
          <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: sev.color, padding: "1px 6px", background: sev.bg, borderRadius: 4, border: `1px solid ${sev.color}40` }}>
            {event.severity === "critical" ? "Crítico" : "Atención"}
          </span>
        )}
      </div>
    </div>
  );
}

type Tab = "actividad" | "fotos";

export default function JobTimelinePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [jobTitle, setJobTitle] = useState<string>("");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [photoGif, setPhotoGif] = useState<string | null>(null);
  const [gifFrames, setGifFrames] = useState(0);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("actividad");

  const loadActivity = useCallback(async () => {
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
        const j = proj.job as Record<string, unknown> | null | undefined;
        return String(proj.jobId ?? "") === jobId || String(j?.id ?? "") === jobId;
      });

      if (!bopsProject) {
        setError("Este trabajo no tiene un plan de construcción activo todavía.");
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

  const loadPhotoTimeline = useCallback(async () => {
    setGifLoading(true);
    setGifError(null);
    setPhotoGif(null);
    try {
      const res = await fetch(`/api/semse/vision?jobId=${encodeURIComponent(jobId)}&timeline=1&fps=2`);
      const json = await res.json() as { data?: { base64Gif?: string | null; frameCount?: number; message?: string } };
      const data = json.data;
      if (data?.base64Gif) {
        setPhotoGif(data.base64Gif);
        setGifFrames(data.frameCount ?? 0);
      } else {
        setGifError(data?.message ?? "No hay fotos suficientes para construir un time-lapse.");
      }
    } catch {
      setGifError("No se pudo cargar el time-lapse visual.");
    } finally {
      setGifLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  useEffect(() => {
    if (tab === "fotos" && !photoGif && !gifLoading && !gifError) {
      void loadPhotoTimeline();
    }
  }, [tab, photoGif, gifLoading, gifError, loadPhotoTimeline]);

  const criticalCount = events.filter(e => e.severity === "critical").length;
  const warningCount = events.filter(e => e.severity === "warning").length;

  return (
    <div style={{ padding: "20px", maxWidth: 700, margin: "0 auto", color: "#f9fafb" }}>
      <NotificationBanner audience="client" />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Link href={`/client/jobs/${jobId}`} style={{ display: "flex", alignItems: "center", gap: 4, color: "#6b7280", fontSize: 13, textDecoration: "none" }}>
          <ArrowLeft size={14} /> Volver al trabajo
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={20} color="#3b82f6" /> Timeline del Proyecto
          </h1>
          {jobTitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>{jobTitle}</p>}
        </div>
        <button
          onClick={() => { void loadActivity(); if (tab === "fotos") void loadPhotoTimeline(); }}
          disabled={loading || gifLoading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "#1f2937", border: "1px solid #374151", borderRadius: 6, color: "#9ca3af", cursor: (loading || gifLoading) ? "not-allowed" : "pointer", fontSize: 13 }}
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#111827", padding: 4, borderRadius: 10, border: "1px solid #1f2937", marginBottom: 16, width: "fit-content" }}>
        {([["actividad", <Activity key="a" size={13} />, "Actividad"] as const, ["fotos", <Camera key="f" size={13} />, "Time-lapse"] as const]).map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7, border: "none", background: tab === key ? "#3b82f6" : "transparent", color: tab === key ? "#fff" : "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Activity Tab */}
      {tab === "actividad" && (
        <>
          {events.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#6b7280", padding: "4px 10px", background: "#1f2937", borderRadius: 20, border: "1px solid #374151" }}>{events.length} eventos</span>
              {criticalCount > 0 && <span style={{ fontSize: 12, color: "#ef4444", padding: "4px 10px", background: "#450a0a", borderRadius: 20, border: "1px solid #ef444440" }}>{criticalCount} crítico{criticalCount > 1 ? "s" : ""}</span>}
              {warningCount > 0 && <span style={{ fontSize: 12, color: "#f59e0b", padding: "4px 10px", background: "#451a03", borderRadius: 20, border: "1px solid #f59e0b40" }}>{warningCount} atención</span>}
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
        </>
      )}

      {/* Photo Timeline Tab */}
      {tab === "fotos" && (
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 24 }}>
          {gifLoading && (
            <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
              <Film size={32} style={{ marginBottom: 12, color: "#3b82f6" }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Construyendo time-lapse visual…</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#4b5563" }}>Procesando fotos del proyecto con Vision AI</div>
            </div>
          )}
          {gifError && !gifLoading && (
            <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
              <Camera size={32} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14 }}>{gifError}</div>
              <button onClick={() => void loadPhotoTimeline()} style={{ marginTop: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid #374151", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 13 }}>
                Reintentar
              </button>
            </div>
          )}
          {photoGif && !gifLoading && (
            <div style={{ textAlign: "center" }}>
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Film size={16} color="#3b82f6" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb" }}>Time-lapse del proyecto</span>
                <span style={{ fontSize: 11, color: "#6b7280", padding: "2px 8px", background: "#1f2937", borderRadius: 20 }}>{gifFrames} fotos</span>
              </div>
              <img
                src={`data:image/gif;base64,${photoGif}`}
                alt="Time-lapse del progreso del proyecto"
                style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #374151" }}
              />
              <p style={{ marginTop: 12, fontSize: 12, color: "#4b5563" }}>
                Generado automáticamente a partir de las fotos de evidencia del proyecto.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

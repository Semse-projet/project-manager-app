"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Info, RefreshCw, ShieldAlert } from "lucide-react";
import { fetchProjectActivity, type ActivityEvent } from "../../app/semse-api";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

const SEVERITY_ICON = {
  critical: <ShieldAlert size={14} style={{ color: "#ef4444" }} />,
  warning:  <AlertTriangle size={14} style={{ color: "#f59e0b" }} />,
  info:     <Info size={14} style={{ color: "#6366f1" }} />,
};

const SEVERITY_BG = {
  critical: "#fef2f2",
  warning:  "#fffbeb",
  info:     "#eef2ff",
};

interface Props {
  projectId: string;
  limit?: number;
}

export function ProjectActivityFeed({ projectId, limit = 40 }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectActivity(projectId, limit);
      setEvents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar actividad");
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
        Cargando actividad...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "16px", borderRadius: "12px", background: "#fef2f2", color: "#ef4444", fontSize: "13px" }}>
        {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
        <Activity size={28} style={{ display: "block", margin: "0 auto 8px", opacity: 0.35 }} />
        Sin actividad registrada todavía.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
          Actividad del proyecto
        </h3>
        <button
          onClick={() => void load()}
          style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--muted)" }}
        >
          <RefreshCw size={10} /> Actualizar
        </button>
      </div>

      {events.map((ev) => (
        <div
          key={ev.id}
          style={{
            display: "flex", alignItems: "flex-start", gap: "10px",
            padding: "10px 12px", borderRadius: "10px",
            background: SEVERITY_BG[ev.severity] ?? "#f8fafc",
            marginBottom: "6px",
          }}
        >
          <div style={{ paddingTop: "1px", flexShrink: 0 }}>
            {SEVERITY_ICON[ev.severity] ?? <Info size={14} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)", lineHeight: 1.4 }}>
              {ev.title}
            </div>
            {ev.detail ? (
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px", lineHeight: 1.4 }}>
                {ev.detail}
              </div>
            ) : null}
          </div>
          <div style={{ fontSize: "10px", color: "var(--faint)", flexShrink: 0, paddingTop: "1px" }}>
            {formatRelative(ev.occurredAt)}
          </div>
        </div>
      ))}
    </div>
  );
}

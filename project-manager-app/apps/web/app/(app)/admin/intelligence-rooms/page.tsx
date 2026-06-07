"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Brain, RefreshCw, Shield } from "lucide-react";

type BuildOpsProject = {
  id: string;
  title: string;
  trade?: string | null;
  status: string;
  riskLevel?: string | null;
  openSignals?: number;
  createdAt: string;
};

type ProjectsEnvelope = { projects: BuildOpsProject[]; total: number };

const RISK_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#10b981",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Activo", draft: "Borrador", completed: "Completado",
  on_hold: "En pausa", cancelled: "Cancelado",
};

export default function IntelligenceRoomsPage() {
  const [projects, setProjects] = useState<BuildOpsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/semse/buildops/projects?limit=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data?: ProjectsEnvelope | BuildOpsProject[] };
      const raw = json.data;
      const list: BuildOpsProject[] = Array.isArray(raw) ? raw : ((raw as ProjectsEnvelope)?.projects ?? []);
      setProjects(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar proyectos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Brain size={20} color="#818cf8" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Intelligence Rooms</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Vista de inteligencia operativa por proyecto — señales, risk score y brief de Prometeo.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", marginBottom: 20, fontSize: 13, color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 72, borderRadius: 12, background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)" }}>
          <Brain size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>No hay proyectos BuildOps</p>
          <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>Los proyectos se crean desde las herramientas ProTools o el flujo de intake.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {projects.map((project) => {
            const riskColor = RISK_COLOR[project.riskLevel ?? ""] ?? "var(--muted)";
            return (
              <Link
                key={project.id}
                href={`/admin/intelligence-rooms/${project.id}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                  padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border)",
                  background: "var(--surface)", textDecoration: "none", color: "var(--ink)",
                  transition: "border-color .15s, background .15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `${riskColor}18`, display: "grid", placeItems: "center",
                  }}>
                    {project.riskLevel === "critical" || project.riskLevel === "high"
                      ? <AlertTriangle size={16} color={riskColor} />
                      : <Shield size={16} color={riskColor} />
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {project.title}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      {project.trade ?? "General"} · {STATUS_LABEL[project.status] ?? project.status}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                  {project.openSignals !== undefined && project.openSignals > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#f97316" }}>
                      <Activity size={13} />
                      {project.openSignals} señal{project.openSignals !== 1 ? "es" : ""}
                    </div>
                  )}
                  {project.riskLevel && (
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 999,
                      background: `${riskColor}18`, color: riskColor,
                    }}>
                      {project.riskLevel.toUpperCase()}
                    </span>
                  )}
                  <ArrowRight size={14} color="var(--faint)" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 24, padding: "14px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12, color: "var(--muted)" }}>
        Cada sala es una vista de inteligencia en tiempo real: señales operativas, brief de Prometeo y trazabilidad de riesgo por proyecto.
      </div>
    </div>
  );
}

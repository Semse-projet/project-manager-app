"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, ShieldCheck, Activity, FileText, ChevronRight, Bot } from "lucide-react";
import { BuildOpsProjectHealthPanel } from "@/components/buildops/BuildOpsProjectHealthPanel";
import { ProjectActivityFeed } from "@/components/buildops/ProjectActivityFeed";
import { fetchBuildOpsProject, type BuildOpsProject } from "../../../../lib/buildops-api";

type MilestoneRow = {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
  amount?: number | null;
};

const STATUS_COLOR: Record<string, string> = {
  completed: "#10b981",
  approved:  "#10b981",
  in_review: "#f59e0b",
  blocked:   "#ef4444",
  pending:   "#94a3b8",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Completado",
  approved:  "Aprobado",
  in_review: "En revisión",
  blocked:   "Bloqueado",
  pending:   "Pendiente",
};

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

async function fetchMilestonesForProject(projectId: string): Promise<MilestoneRow[]> {
  try {
    const r = await fetch(`/api/semse/buildops/milestones?projectId=${encodeURIComponent(projectId)}`);
    if (!r.ok) return [];
    const json = await r.json() as unknown;
    const arr = Array.isArray(json) ? json : (json as { data?: unknown[] })?.data ?? [];
    return arr.map((m: unknown) => {
      const row = m as Record<string, unknown>;
      return {
        id: String(row.id ?? ""),
        title: String(row.title ?? row.name ?? "Hito"),
        status: String(row.status ?? "pending").toLowerCase(),
        dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
        amount: typeof row.amount === "number" ? row.amount : null,
      };
    });
  } catch {
    return [];
  }
}

export default function ClientProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = typeof params?.projectId === "string" ? params.projectId : "";

  const [project, setProject] = useState<BuildOpsProject | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "milestones" | "activity">("overview");

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [proj, ms] = await Promise.all([
        fetchBuildOpsProject(projectId).catch(() => null),
        fetchMilestonesForProject(projectId),
      ]);
      setProject(proj);
      setMilestones(ms);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el proyecto");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
        Cargando proyecto...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ padding: "32px" }}>
        <p style={{ color: "var(--error)" }}>{error ?? "Proyecto no encontrado"}</p>
        <button onClick={() => router.back()} style={{ marginTop: "12px", padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer" }}>
          Volver
        </button>
      </div>
    );
  }

  const completedMilestones = milestones.filter(m => ["completed", "approved"].includes(m.status)).length;

  return (
    <div style={{ padding: "24px", maxWidth: "960px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => router.push("/client/projects")}
          style={{ padding: "6px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.title}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
            {project.trade} · {project.location}
          </p>
        </div>
        <button
          onClick={() => void load()}
          style={{ padding: "6px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Quick stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
        {[
          { label: "Avance", value: `${project.completion ?? 0}%`, color: "#10b981" },
          { label: "Hitos", value: `${completedMilestones}/${milestones.length}`, color: "#6366f1" },
          { label: "Presupuesto", value: formatCurrency(project.budgetEstimate), color: "#f59e0b" },
          { label: "Riesgo", value: (project.riskLevel ?? "low").toUpperCase(), color: project.riskLevel === "critical" ? "#ef4444" : project.riskLevel === "high" ? "#fb7185" : project.riskLevel === "medium" ? "#fbbf24" : "#86efac" },
        ].map(stat => (
          <div key={stat.label} style={{ padding: "12px 14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: "16px", fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid var(--border)" }}>
        {([
          { key: "overview",   label: "Resumen",   Icon: ShieldCheck },
          { key: "milestones", label: "Hitos",     Icon: FileText },
          { key: "activity",   label: "Actividad", Icon: Activity },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 14px", border: "none", background: "transparent", cursor: "pointer",
              fontSize: "13px", fontWeight: tab === key ? 700 : 500,
              color: tab === key ? "var(--ink)" : "var(--muted)",
              borderBottom: tab === key ? "2px solid var(--ink)" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <BuildOpsProjectHealthPanel projectId={projectId} />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "16px", borderRadius: "14px", background: "var(--bg)", border: "1px solid var(--border)" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>Acciones</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link
                  href={`/client/projects/${projectId}/copilot`}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontSize: "13px" }}
                >
                  <Bot size={14} style={{ color: "#6366f1" }} />
                  <span style={{ flex: 1 }}>Hablar con Prometeo</span>
                  <ChevronRight size={12} style={{ color: "var(--muted)" }} />
                </Link>
                <Link
                  href={`/client/jobs?projectId=${projectId}`}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontSize: "13px" }}
                >
                  <FileText size={14} style={{ color: "#f59e0b" }} />
                  <span style={{ flex: 1 }}>Ver trabajos del proyecto</span>
                  <ChevronRight size={12} style={{ color: "var(--muted)" }} />
                </Link>
                <Link
                  href={`/client/change-orders?projectId=${projectId}`}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)", fontSize: "13px" }}
                >
                  <ShieldCheck size={14} style={{ color: "#10b981" }} />
                  <span style={{ flex: 1 }}>Órdenes de cambio</span>
                  <ChevronRight size={12} style={{ color: "var(--muted)" }} />
                </Link>
              </div>
            </div>

            {project.description ? (
              <div style={{ padding: "16px", borderRadius: "14px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>Descripción</h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>{project.description}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === "milestones" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {milestones.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
              No hay hitos registrados para este proyecto.
            </div>
          ) : milestones.map(ms => (
            <div key={ms.id} style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: STATUS_COLOR[ms.status] ?? "#94a3b8", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ms.title}</div>
                {ms.dueDate ? (
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                    Entrega: {formatDate(ms.dueDate)}
                  </div>
                ) : null}
              </div>
              {ms.amount != null ? (
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", flexShrink: 0 }}>
                  {formatCurrency(ms.amount)}
                </div>
              ) : null}
              <span style={{
                padding: "3px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                background: `${STATUS_COLOR[ms.status] ?? "#94a3b8"}22`,
                color: STATUS_COLOR[ms.status] ?? "#94a3b8",
                flexShrink: 0,
              }}>
                {STATUS_LABEL[ms.status] ?? ms.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "activity" && (
        <ProjectActivityFeed projectId={projectId} />
      )}
    </div>
  );
}

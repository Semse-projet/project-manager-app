"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, FolderKanban, RefreshCw, Inbox, CheckCircle, Clock, AlertCircle, PlusCircle } from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import { fetchProjects, fetchJobs } from "../../../semse-api";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type ProjectRow = {
  id: string;
  title: string;
  status: string;
  description: string;
  jobCount: number;
  createdAt: string;
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "error"> = {
  active:    "success",
  completed: "info",
  on_hold:   "warning",
  cancelled: "error",
};

const STATUS_LABEL: Record<string, string> = {
  active:    "Activo",
  completed: "Completado",
  on_hold:   "En pausa",
  cancelled: "Cancelado",
};

export default function ClientProjectsPage() {
  const [projects, setProjects]   = useState<ProjectRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [filter, setFilter]       = useState<"all" | "active" | "completed" | "on_hold">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawProjects, jobs] = await Promise.all([
        fetchProjects().catch(() => [] as Record<string, unknown>[]),
        fetchJobs().catch(() => []),
      ]);

      const jobsByProject: Record<string, number> = {};
      for (const job of jobs) {
        const pid = String((job as Record<string, unknown>).projectId ?? "");
        if (pid) jobsByProject[pid] = (jobsByProject[pid] ?? 0) + 1;
      }

      const rows: ProjectRow[] = rawProjects.map(p => ({
        id: String(p.id ?? ""),
        title: String(p.title ?? p.name ?? p.id ?? "Proyecto"),
        status: String(p.status ?? "active").toLowerCase(),
        description: String(p.description ?? ""),
        jobCount: jobsByProject[String(p.id ?? "")] ?? 0,
        createdAt: typeof p.createdAt === "string" ? p.createdAt.slice(0, 10) : "",
      }));

      setProjects(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los proyectos.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const active    = projects.filter(p => p.status === "active").length;
  const completed = projects.filter(p => p.status === "completed").length;
  const onHold    = projects.filter(p => p.status === "on_hold").length;

  const filtered = projects.filter(p => {
    if (filter === "all")       return true;
    if (filter === "active")    return p.status === "active";
    if (filter === "completed") return p.status === "completed";
    if (filter === "on_hold")   return p.status === "on_hold";
    return true;
  });

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      <ClientPageHeader
        title="Proyectos"
        subtitle="Gestiona proyectos activos y accede al copiloto de IA por proyecto."
        breadcrumbs={[{ label: "Proyectos" }]}
        minHeight={84}
        leading={
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(99,102,241,0.15)", display: "grid", placeItems: "center" }}>
            <FolderKanban size={20} color="#818cf8" />
          </div>
        }
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <NotificationBanner audience="client" />
            <button
              onClick={() => void load()}
              disabled={loading}
              style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}
              title="Recargar"
            >
              <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
            <Link
              href="/client/jobs/new"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "10px", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, textDecoration: "none" }}
            >
              <PlusCircle size={14} /> Nuevo trabajo
            </Link>
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <StatCard label="Total proyectos" value={projects.length} icon={FolderKanban} color="violet" loading={loading} />
        <StatCard label="Activos"         value={active}          icon={CheckCircle}  color="green"  loading={loading} />
        <StatCard label="Completados"     value={completed}       icon={Clock}        color="blue"   loading={loading} />
        <StatCard label="En pausa"        value={onHold}          icon={AlertCircle}  color="amber"  loading={loading} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", width: "fit-content", marginBottom: "16px" }}>
        {(["all", "active", "completed", "on_hold"] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            padding: "6px 14px", borderRadius: "7px", border: "none",
            background: filter === t ? "var(--brand)" : "transparent",
            color: filter === t ? "#fff" : "var(--muted)",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>
            {t === "all" ? "Todos" : t === "active" ? "Activos" : t === "completed" ? "Completados" : "En pausa"}
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", borderRadius: 12, color: "#ef4444", fontSize: 13 }} canvasClassName="rounded-2xl" minHeight={72}>
          {error}
        </HtmlInCanvasPanel>
      ) : loading ? (
        <div style={{ display: "grid", gap: "10px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 80, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <HtmlInCanvasPanel as="section" style={{ padding: "48px 24px", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 16 }} canvasClassName="rounded-2xl" minHeight={200}>
          <Inbox size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)" }}>Sin proyectos</p>
          <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "4px" }}>
            {filter === "all" ? "Crea tu primer trabajo para iniciar un proyecto." : "No hay proyectos en este estado."}
          </p>
        </HtmlInCanvasPanel>
      ) : (
        <HtmlInCanvasPanel as="section" style={{ display: "grid", gap: "10px" }} canvasClassName="rounded-2xl" minHeight={280}>
          {filtered.map(project => {
            const variant = STATUS_VARIANT[project.status] ?? "info";
            const label   = STATUS_LABEL[project.status]  ?? project.status;
            return (
              <div key={project.id} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(99,102,241,0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <FolderKanban size={18} color="#818cf8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.title}</span>
                    <StatusBadge variant={variant} text={label} size="sm" />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {project.jobCount > 0 && <span>{project.jobCount} trabajo{project.jobCount > 1 ? "s" : ""}</span>}
                    {project.createdAt && <span>Creado: {project.createdAt}</span>}
                    {project.description && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>{project.description}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <Link
                    href={`/client/projects/${project.id}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
                  >
                    Ver detalle
                  </Link>
                  <Link
                    href={`/client/projects/${project.id}/copilot`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 9, background: "rgba(99,102,241,0.12)", color: "#818cf8", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                  >
                    <Bot size={13} /> Copiloto
                  </Link>
                </div>
              </div>
            );
          })}
        </HtmlInCanvasPanel>
      )}
    </div>
  );
}

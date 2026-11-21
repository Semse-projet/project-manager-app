"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Bot,
  FolderKanban,
  RefreshCw,
  Inbox,
  CheckCircle,
  Clock,
  AlertCircle,
  PlusCircle,
} from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import { fetchProjects, fetchJobs } from "../../../semse-api";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import {
  normalizeProjects,
  filterProjects,
  projectStatusLabel,
  projectErrorMessage,
  PROJECT_STATUS_LABELS,
} from "../../../workspace/lib/projects-model";
import {
  useWorkspaceQuery,
  isWorkspaceAccessError,
} from "../../../workspace/lib/use-workspace-query";
import { PanelState } from "../../../workspace/components/PanelState";

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "error"> =
  {
    open: "info",
    in_progress: "success",
    completed: "info",
    blocked: "warning",
    cancelled: "error",
  };

export default function ClientProjectsPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    try {
      const [rawProjects, jobs] = await Promise.all([
        fetchProjects(),
        fetchJobs(),
      ]);
      return normalizeProjects(
        rawProjects,
        jobs as unknown as Record<string, unknown>[],
      );
    } catch (error) {
      throw new Error(projectErrorMessage(error));
    }
  }, []);
  const query = useWorkspaceQuery("client:projects", load);
  const { loading, error } = query;
  const projects = query.data ?? [];
  const active = projects.filter(
    (p) => p.status === "open" || p.status === "in_progress",
  ).length;
  const completed = projects.filter((p) => p.status === "completed").length;
  const blocked = projects.filter((p) => p.status === "blocked").length;
  const filtered = filterProjects(projects, search, filter);

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      <ClientPageHeader
        title="Proyectos"
        subtitle="Gestiona proyectos activos y accede al copiloto de IA por proyecto."
        breadcrumbs={[{ label: "Proyectos" }]}
        minHeight={84}
        leading={
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(99,102,241,0.15)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <FolderKanban size={20} color="#818cf8" />
          </div>
        }
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <NotificationBanner audience="client" />
            <button
              onClick={query.retry}
              disabled={loading}
              style={{
                minHeight: 44,
                minWidth: 44,
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Recargar"
              aria-label="Recargar proyectos"
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : undefined}
              />
            </button>
            <Link
              href="/client/jobs/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 16px",
                borderRadius: "10px",
                background: "var(--brand)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <PlusCircle size={14} /> Nuevo trabajo
            </Link>
          </div>
        }
      />

      {/* Stats */}
      {!error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <StatCard
            label="Total proyectos"
            value={projects.length}
            icon={FolderKanban}
            color="violet"
            loading={loading}
          />
          <StatCard
            label="Abiertos y en curso"
            value={active}
            icon={CheckCircle}
            color="green"
            loading={loading}
          />
          <StatCard
            label="Completados"
            value={completed}
            icon={Clock}
            color="blue"
            loading={loading}
          />
          <StatCard
            label="Bloqueados"
            value={blocked}
            icon={AlertCircle}
            color="amber"
            loading={loading}
          />
        </div>
      )}

      {/* Filter tabs */}
      <label
        style={{
          display: "block",
          marginBottom: 12,
          color: "var(--muted)",
          fontSize: 13,
        }}
      >
        Buscar proyectos
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{
            display: "block",
            width: "100%",
            minHeight: 44,
            marginTop: 6,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--ink)",
            background: "var(--surface)",
          }}
        />
      </label>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          background: "var(--surface)",
          padding: "4px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          width: "fit-content",
          maxWidth: "100%",
          marginBottom: "16px",
        }}
      >
        {["all", ...Object.keys(PROJECT_STATUS_LABELS)].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              minHeight: 44,
              padding: "6px 14px",
              borderRadius: "7px",
              border: "none",
              background: filter === t ? "var(--brand)" : "transparent",
              color: filter === t ? "#fff" : "var(--muted)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            aria-pressed={filter === t}
          >
            {t === "all" ? "Todos" : projectStatusLabel(t)}
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <PanelState
          title={
            isWorkspaceAccessError(error)
              ? "Sin acceso a los proyectos"
              : "No se pudieron cargar los proyectos"
          }
          description={error}
          error
          onRetry={query.retry}
        />
      ) : loading ? (
        <div style={{ display: "grid", gap: "10px" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 80,
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <HtmlInCanvasPanel
          as="section"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            border: "1px dashed var(--border)",
            borderRadius: 16,
          }}
          canvasClassName="rounded-2xl"
          minHeight={200}
        >
          <Inbox
            size={32}
            style={{ color: "var(--faint)", margin: "0 auto 12px" }}
          />
          <p
            style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)" }}
          >
            Sin proyectos
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "var(--faint)",
              marginTop: "4px",
            }}
          >
            {!projects.length
              ? "No hay proyectos autorizados para tu sesión."
              : "No hay proyectos que coincidan con la búsqueda y el estado."}
          </p>
        </HtmlInCanvasPanel>
      ) : (
        <HtmlInCanvasPanel
          as="section"
          style={{ display: "grid", gap: "10px" }}
          canvasClassName="rounded-2xl"
          minHeight={280}
        >
          {filtered.map((project) => {
            const variant = STATUS_VARIANT[project.status] ?? "info";
            const label = projectStatusLabel(project.status);
            return (
              <div
                key={project.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "16px",
                  padding: "16px 20px",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: "rgba(99,102,241,0.12)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <FolderKanban size={18} color="#818cf8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {project.title}
                    </span>
                    <StatusBadge variant={variant} text={label} size="sm" />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    {project.jobId && <span>Trabajo vinculado</span>}
                    {project.createdAt && (
                      <span>Creado: {project.createdAt.slice(0, 10)}</span>
                    )}
                    {project.description && (
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "260px",
                        }}
                      >
                        {project.description}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <Link
                    href={`/client/projects/${encodeURIComponent(project.id)}`}
                    style={{
                      minHeight: 44,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "7px 13px",
                      borderRadius: 9,
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--ink)",
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Ver detalle
                  </Link>
                  <Link
                    href={`/client/projects/${encodeURIComponent(project.id)}/copilot`}
                    style={{
                      minHeight: 44,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "7px 13px",
                      borderRadius: 9,
                      background: "rgba(99,102,241,0.12)",
                      color: "#818cf8",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
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

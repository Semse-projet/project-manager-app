"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  Activity,
  FileText,
  ChevronRight,
  Bot,
} from "lucide-react";
import { BuildOpsProjectHealthPanel } from "@/components/buildops/BuildOpsProjectHealthPanel";
import { ProjectActivityFeed } from "@/components/buildops/ProjectActivityFeed";
import { ProjectLifecycleProjectionPanel } from "@/components/projects/ProjectLifecycleProjectionPanel";
import {
  fetchBuildOpsProject,
  fetchBuildOpsProjects,
  type BuildOpsProject,
} from "../../../../lib/buildops-api";
import {
  fetchProjects,
  fetchJob,
  fetchJobMilestones,
} from "../../../../semse-api";
import {
  buildCanonicalProjectView,
  type CanonicalProjectViewFields,
} from "../../../../../lib/canonical-project-view";
import {
  useCapabilityState,
  useDeclareActiveProjectOrg,
} from "../../../../../lib/capability-context";
import { deriveActiveCapability } from "../../../../../lib/capability";
import {
  CapabilityBadge,
  type CapabilityRole,
} from "../../../../../components/semse/CapabilityBadge";
import {
  normalizeProjects,
  resolveSelectedProject,
  resolveProjectIds,
  readProjectMilestones,
  projectStatusLabel,
  milestoneStatusLabel,
  type WorkspaceProject,
} from "../../../../workspace/lib/projects-model";
import {
  useWorkspaceQuery,
  isWorkspaceAccessError,
} from "../../../../workspace/lib/use-workspace-query";
import { PanelState } from "../../../../workspace/components/PanelState";

type ProjectDetail = {
  view: CanonicalProjectViewFields | BuildOpsProject;
  canonical: WorkspaceProject | null;
  buildOps: BuildOpsProject | null;
  warning: string | null;
};

function errorMessage(error: unknown): string {
  const status =
    error && typeof error === "object" && "status" in error
      ? String(error.status)
      : "";
  return [
    status,
    error instanceof Error
      ? error.message
      : "No se pudo completar la consulta.",
  ]
    .filter(Boolean)
    .join(" · ");
}
function formatAmount(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? "No disponible"
    : value.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}
const actionStyle = {
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  textDecoration: "none",
  color: "var(--ink)",
  fontSize: 13,
} as const;
const iconButtonStyle = {
  minWidth: 44,
  minHeight: 44,
  padding: 8,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--ink)",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
} as const;

export default function ClientProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId =
    typeof params?.projectId === "string" ? params.projectId : "";
  const [tab, setTab] = useState<"overview" | "milestones" | "activity">(
    "overview",
  );

  const load = useCallback(async (): Promise<ProjectDetail> => {
    try {
      // Resolve identity from authorized lists; do not probe BuildOps with a canonical ID.
      const records = await fetchProjects();
      const authorized = normalizeProjects(records);
      const canonical = resolveSelectedProject(authorized, projectId);
      if (canonical) {
        const source = records.find((record) => record.id === canonical.id);
        let job: Record<string, unknown> | null = null;
        let warning: string | null = null;
        if (canonical.jobId) {
          try {
            job = (await fetchJob(
              encodeURIComponent(canonical.jobId),
            )) as unknown as Record<string, unknown>;
          } catch (error) {
            warning = `Datos del trabajo no disponibles: ${errorMessage(error)}`;
          }
        }
        const view = buildCanonicalProjectView(source, job);
        if (!view)
          throw new Error(
            "La respuesta del trabajo no corresponde al proyecto.",
          );
        return { view, canonical, buildOps: null, warning };
      }
      const buildOpsList = await fetchBuildOpsProjects();
      const candidate = buildOpsList.find(
        (project) => project.id === projectId,
      );
      if (!candidate)
        throw new Error(
          "Proyecto no encontrado o no disponible para tu sesión.",
        );
      const buildOps = await fetchBuildOpsProject(candidate.id);
      if (buildOps.id !== candidate.id)
        throw new Error(
          "La respuesta no corresponde al proyecto BuildOps seleccionado.",
        );
      const ids = resolveProjectIds(
        "buildops",
        buildOps as unknown as Record<string, unknown>,
      );
      const linked = ids.canonicalProjectId
        ? resolveSelectedProject(authorized, ids.canonicalProjectId)
        : null;
      if (linked && ids.jobId && ids.jobId !== linked.jobId)
        throw new Error(
          "Las referencias de trabajo y proyecto BuildOps no coinciden.",
        );
      return { view: buildOps, canonical: linked, buildOps, warning: null };
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }, [projectId]);
  const projectQuery = useWorkspaceQuery(
    projectId ? `client:project:${projectId}` : null,
    load,
  );
  const detail = projectQuery.data;
  const project = detail?.view ?? null;
  const canonical = detail?.canonical ?? null;
  const buildOps = detail?.buildOps ?? null;
  const loadMilestones = useCallback(async () => {
    if (!canonical)
      throw new Error("No existe un proyecto canónico autorizado vinculado.");
    try {
      return await readProjectMilestones(canonical, fetchJobMilestones);
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  }, [canonical]);
  const milestones = useWorkspaceQuery(
    canonical?.jobId
      ? `client:project-milestones:${canonical.id}:${canonical.jobId}`
      : null,
    loadMilestones,
  );

  useDeclareActiveProjectOrg(buildOps?.orgId ?? null);
  const { capabilities } = useCapabilityState();
  const activeCapability = deriveActiveCapability(
    capabilities,
    buildOps?.orgId ?? null,
  );

  if (projectQuery.loading)
    return <PanelState title="Cargando proyecto" loading />;
  if (projectQuery.error || !project)
    return (
      <div className="space-y-3 p-4">
        <PanelState
          title={
            isWorkspaceAccessError(projectQuery.error)
              ? "Sin acceso al proyecto"
              : "Proyecto no disponible"
          }
          description={projectQuery.error ?? "No hay un proyecto seleccionado."}
          error
          onRetry={projectQuery.retry}
        />
        <button type="button" onClick={() => router.back()} style={actionStyle}>
          Volver
        </button>
      </div>
    );

  const resolvedMilestones = milestones.data;
  const approvedMilestones = resolvedMilestones?.filter((milestone) =>
    ["approved", "paid"].includes(milestone.status),
  ).length;
  const stats = [
    {
      label: "Hitos aprobados o pagados",
      value: resolvedMilestones
        ? `${approvedMilestones}/${resolvedMilestones.length}`
        : milestones.loading
          ? "Cargando"
          : "No disponibles",
    },
    {
      label: "Presupuesto estimado · moneda no informada",
      value: formatAmount(project.budgetEstimate),
    },
    ...(buildOps && Number.isFinite(buildOps.completion)
      ? [
          {
            label: "Avance · fuente BuildOps",
            value: `${buildOps.completion}%`,
          },
        ]
      : []),
    ...(buildOps?.riskLevel
      ? [
          {
            label: "Riesgo · fuente BuildOps",
            value:
              (
                {
                  low: "Bajo",
                  medium: "Medio",
                  high: "Alto",
                  critical: "Crítico",
                } as Record<string, string>
              )[buildOps.riskLevel] ?? "No disponible",
          },
        ]
      : []),
  ];
  const canonicalId = canonical?.id ?? null;
  const jobId = canonical?.jobId ?? buildOps?.jobId ?? null;
  // The existing project-copilot harness resolves /v1/projects, not BuildOps.id.
  const copilotId = canonicalId;

  return (
    <div
      style={{
        padding: "clamp(12px, 3vw, 24px)",
        maxWidth: 960,
        minWidth: 0,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/client/projects")}
          style={iconButtonStyle}
          aria-label="Volver a proyectos"
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: "var(--ink)",
                overflowWrap: "anywhere",
              }}
            >
              {project.title}
            </h1>
            {activeCapability && (
              <CapabilityBadge
                role={activeCapability.role as CapabilityRole}
                size="sm"
              />
            )}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            {project.trade} · {project.location}
          </p>
          {canonical && (
            <p
              style={{ margin: "4px 0 0", fontSize: 12, color: "var(--brand)" }}
            >
              {projectStatusLabel(canonical.status)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            projectQuery.retry();
            milestones.retry();
          }}
          style={iconButtonStyle}
          aria-label="Actualizar proyecto"
          disabled={projectQuery.loading}
        >
          <RefreshCw size={16} />
        </button>
      </header>
      {detail?.warning && (
        <div className="mb-4">
          <PanelState
            title={
              isWorkspaceAccessError(detail.warning)
                ? "Sin acceso a los datos del trabajo"
                : "Consulta parcial"
            }
            description={detail.warning}
            error
            onRetry={projectQuery.retry}
          />
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
        }}
        role="tablist"
        aria-label="Información del proyecto"
      >
        {(
          [
            { key: "overview", label: "Resumen", Icon: ShieldCheck },
            { key: "milestones", label: "Hitos", Icon: FileText },
            { key: "activity", label: "Actividad", Icon: Activity },
          ] as const
        ).map(({ key, label, Icon }) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
              padding: "8px 14px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 13,
              color: tab === key ? "var(--ink)" : "var(--muted)",
              borderBottom:
                tab === key
                  ? "2px solid var(--brand)"
                  : "2px solid transparent",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 16,
          }}
        >
          {canonicalId && (
            <div style={{ gridColumn: "1 / -1" }}>
              <ProjectLifecycleProjectionPanel projectId={canonicalId} />
            </div>
          )}
          {buildOps && <BuildOpsProjectHealthPanel projectId={buildOps.id} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                background: "var(--bg)",
                border: "1px solid var(--border)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink)",
                }}
              >
                Acciones
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {copilotId && (
                  <Link
                    href={`/client/projects/${encodeURIComponent(copilotId)}/copilot`}
                    style={actionStyle}
                  >
                    <Bot size={14} style={{ color: "var(--brand)" }} />
                    <span style={{ flex: 1 }}>Hablar con Prometeo</span>
                    <ChevronRight size={12} />
                  </Link>
                )}
                {!copilotId && (
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>
                    El copiloto requiere un proyecto canónico vinculado y
                    autorizado.
                  </p>
                )}
                {jobId && (
                  <Link
                    href={`/client/jobs/${encodeURIComponent(jobId)}`}
                    style={actionStyle}
                  >
                    <FileText size={14} />
                    <span style={{ flex: 1 }}>Ver trabajo vinculado</span>
                    <ChevronRight size={12} />
                  </Link>
                )}
                <Link href="/client/change-orders" style={actionStyle}>
                  <ShieldCheck size={14} />
                  <span style={{ flex: 1 }}>
                    Abrir órdenes de cambio · todos los proyectos
                  </span>
                  <ChevronRight size={12} />
                </Link>
              </div>
            </div>
            {project.description && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  Descripción
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--muted)",
                    lineHeight: 1.6,
                    overflowWrap: "anywhere",
                  }}
                >
                  {project.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === "milestones" && (
        <div className="space-y-3">
          {!canonical?.jobId ? (
            <PanelState
              title="Hitos no disponibles"
              description="No existe una vinculación a Project y Job autorizados. No se intercambian IDs BuildOps/Project/Job."
            />
          ) : milestones.loading ? (
            <PanelState title="Cargando hitos" loading />
          ) : milestones.error ? (
            <PanelState
              title={
                isWorkspaceAccessError(milestones.error)
                  ? "Sin acceso a los hitos"
                  : "No se pudieron cargar los hitos"
              }
              description={milestones.error}
              error
              onRetry={milestones.retry}
            />
          ) : !resolvedMilestones?.length ? (
            <PanelState
              title="Sin hitos registrados"
              description="La consulta del trabajo vinculado se completó sin hitos."
            />
          ) : (
            resolvedMilestones.map((milestone) => (
              <div
                key={milestone.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {milestone.title}
                  </div>
                  {milestone.dueDate && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        marginTop: 2,
                      }}
                    >
                      Entrega: {formatDate(milestone.dueDate)}
                    </div>
                  )}
                </div>
                {milestone.amount != null && (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {formatAmount(milestone.amount)} · moneda no informada
                  </span>
                )}
                <span
                  style={{
                    padding: "4px 8px",
                    borderRadius: 8,
                    fontSize: 12,
                    background: "var(--brand-dim)",
                    color:
                      milestone.status === "rejected"
                        ? "var(--error)"
                        : "var(--ink)",
                  }}
                >
                  {milestoneStatusLabel(milestone.status)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
      {tab === "activity" &&
        (buildOps ? (
          <ProjectActivityFeed projectId={buildOps.id} />
        ) : (
          <PanelState
            title="Actividad BuildOps no vinculada"
            description="Este es un proyecto canónico. No se consultará la actividad de otro agregado con su ID."
          />
        ))}
    </div>
  );
}

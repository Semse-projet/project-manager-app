"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Inbox, MessageSquare, RefreshCw, ShieldAlert } from "lucide-react";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { DisputeResolutionWorkspace } from "../../../components/disputes/DisputeResolutionWorkspace";
import {
  createJobDispute,
  fetchDisputes,
  fetchJobs,
  fetchProjects,
  resolveDispute,
  type JobRecordView
} from "../../../semse-api";
import { CLIENT_ROUTES, clientDisputesHref } from "../../../lib/client-routes";

type DisputesFilter = "all" | "open" | "resolved";

type DisputeRow = {
  id: string;
  projectId: string;
  reason: string;
  status: "open" | "assigned" | "resolved";
  resolution?: string;
  jobId?: string;
  jobTitle: string;
  projectStatus?: string;
};

const STATUS_META: Record<DisputeRow["status"], { variant: "error" | "warning" | "success"; label: string; tone: string }> = {
  open: { variant: "error", label: "Abierta", tone: "#ef4444" },
  assigned: { variant: "warning", label: "Asignada", tone: "#f59e0b" },
  resolved: { variant: "success", label: "Resuelta", tone: "#10b981" }
};

function normalizeDisputeStatus(value: unknown): DisputeRow["status"] {
  const lower = typeof value === "string" ? value.toLowerCase() : "";
  if (lower === "resolved") return "resolved";
  if (lower === "assigned") return "assigned";
  return "open";
}

function displayText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export default function ClientDisputesPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stablePathname = pathname ?? CLIENT_ROUTES.disputes;
  const initialFilter = searchParams?.get("status");
  const initialProjectId = searchParams?.get("projectId") ?? "";

  const [filter, setFilter] = useState<DisputesFilter>(
    initialFilter === "open" || initialFilter === "resolved" || initialFilter === "all" ? initialFilter : "all"
  );
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [jobs, setJobs] = useState<JobRecordView[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formJobId, setFormJobId] = useState("");
  const [formReason, setFormReason] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(() => searchParams?.get("workspaceId") ?? null);
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextFilter = searchParams?.get("status");
    const nextProjectId = searchParams?.get("projectId") ?? "";
    const resolvedFilter =
      nextFilter === "open" || nextFilter === "resolved" || nextFilter === "all" ? nextFilter : "all";

    if (resolvedFilter !== filter) setFilter(resolvedFilter);
    if (nextProjectId !== selectedProjectId) setSelectedProjectId(nextProjectId);
  }, [filter, searchParams, selectedProjectId]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (filter === "all") params.delete("status");
    else params.set("status", filter);

    if (selectedProjectId) params.set("projectId", selectedProjectId);
    else params.delete("projectId");

    const next = params.toString();
    const current = searchParams?.toString() ?? "";
    if (next !== current) {
      router.replace(next ? `${stablePathname}?${next}` : stablePathname, { scroll: false });
    }
  }, [filter, router, searchParams, selectedProjectId, stablePathname]);

  async function loadDisputes() {
    setLoading(true);
    setError(null);
    try {
      const [jobsData, projectsData, disputesData] = await Promise.all([
        fetchJobs(),
        fetchProjects().catch(() => [] as Record<string, unknown>[]),
        fetchDisputes()
      ]);

      const jobsById = new Map(jobsData.map((job) => [job.id, job]));
      const projectsById = new Map(
        projectsData.map((project) => [
          String(project.id ?? ""),
          {
            jobId: typeof project.jobId === "string" ? project.jobId : undefined,
            status: typeof project.status === "string" ? project.status : undefined
          }
        ])
      );

      const rows = disputesData.map((item) => {
        const projectId = String(item.projectId ?? "");
        const project = projectsById.get(projectId);
        const job = project?.jobId ? jobsById.get(project.jobId) : undefined;
        return {
          id: String(item.id ?? ""),
          projectId,
          reason: String(item.reason ?? "Sin razón registrada."),
          status: normalizeDisputeStatus(item.status),
          resolution: typeof item.resolution === "string" ? item.resolution : undefined,
          jobId: job?.id,
          jobTitle: job?.title ?? (projectId ? `Proyecto ${projectId.slice(-6)}` : "Proyecto vinculado"),
          projectStatus: project?.status
        } satisfies DisputeRow;
      });

      setJobs(jobsData);
      setDisputes(rows);
      setSelectedDisputeId((current) => {
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id ?? null;
      });
      if (!formJobId) {
        const firstEligible = jobsData.find((job) => !["draft", "completed", "cancelled"].includes(job.status));
        if (firstEligible) setFormJobId(firstEligible.id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las disputas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDisputes();
  }, []);

  const eligibleJobs = useMemo(
    () => jobs.filter((job) => !["draft", "completed", "cancelled"].includes(job.status)),
    [jobs]
  );

  const activeDisputes = useMemo(
    () => disputes.filter((item) => item.status !== "resolved"),
    [disputes]
  );

  const resolvedDisputes = useMemo(
    () => disputes.filter((item) => item.status === "resolved"),
    [disputes]
  );

  const filteredDisputes = useMemo(() => {
    return disputes.filter((item) => {
      if (selectedProjectId && item.projectId !== selectedProjectId) return false;
      if (filter === "open") return item.status !== "resolved";
      if (filter === "resolved") return item.status === "resolved";
      return true;
    });
  }, [disputes, filter, selectedProjectId]);

  useEffect(() => {
    if (!filteredDisputes.length) {
      setSelectedDisputeId(null);
      return;
    }
    setSelectedDisputeId((current) => (
      current && filteredDisputes.some((item) => item.id === current) ? current : filteredDisputes[0].id
    ));
  }, [filteredDisputes]);

  const selectedDispute = useMemo(
    () => filteredDisputes.find((item) => item.id === selectedDisputeId) ?? filteredDisputes[0] ?? null,
    [filteredDisputes, selectedDisputeId]
  );

  async function handleCreateDispute() {
    if (pendingAction) return;
    const reason = formReason.trim();
    if (!formJobId || reason.length < 5) {
      setError("Selecciona un trabajo y describe la razón con al menos 5 caracteres.");
      return;
    }

    setPendingAction("create");
    setError(null);
    try {
      await createJobDispute({ jobId: formJobId, reason });
      setFormReason("");
      await loadDisputes();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo abrir la disputa.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResolveDispute(disputeId: string, resolution?: string) {
    if (pendingAction) return;
    const resolutionText = resolution?.trim() ?? resolutionDrafts[disputeId]?.trim() ?? "";
    if (resolutionText.length < 8) {
      setError("Escribe una resolución verificable antes de cerrar la disputa.");
      return;
    }
    setPendingAction(`resolve:${disputeId}`);
    setError(null);
    try {
      await resolveDispute(disputeId, { resolution: resolutionText });
      await loadDisputes();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo resolver la disputa.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div style={{ maxWidth: "940px", margin: "0 auto" }}>
      <ClientPageHeader
        title={t("page.clientDisputes")}
        subtitle="Sigue conflictos abiertos, aporta contexto y cierra disputas cuando ya existe acuerdo o resolución."
        breadcrumbs={[{ label: t("page.clientDisputes") }]}
        minHeight={92}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NotificationBanner audience="client" />
            <button
              onClick={() => void loadDisputes()}
              disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              Recargar
            </button>
          </div>
        }
      />

      <HtmlInCanvasPanel as="section" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }} canvasClassName="rounded-2xl" minHeight={120}>
        {[
          { label: "Abiertas", value: activeDisputes.length, color: "#ef4444", icon: AlertTriangle },
          { label: "Resueltas", value: resolvedDisputes.length, color: "#10b981", icon: CheckCircle2 },
          { label: "Trabajos elegibles", value: eligibleJobs.length, color: "#6366f1", icon: ShieldAlert }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon size={15} color={item.color} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>{item.label.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: item.color }}>{item.value}</div>
            </div>
          );
        })}
      </HtmlInCanvasPanel>

      <HtmlInCanvasPanel as="section" style={{ marginBottom: 18 }} canvasClassName="rounded-2xl" minHeight={170}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>Abrir disputa</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
              Úsalo cuando haya un bloqueo real sobre entregables, evidencia o fondos. El backend evita duplicar disputas abiertas por proyecto.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr auto", gap: 10, alignItems: "start" }}>
            <select
              value={formJobId}
              onChange={(event) => setFormJobId(event.target.value)}
              style={{ height: 42, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", padding: "0 12px", fontSize: 13 }}
            >
              <option value="">Selecciona un trabajo</option>
              {eligibleJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {displayText((job as Record<string, unknown>).title, "Trabajo")}
                </option>
              ))}
            </select>
            <textarea
              value={formReason}
              onChange={(event) => setFormReason(event.target.value)}
              placeholder="Describe el conflicto y el punto exacto que está bloqueado."
              rows={2}
              style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", padding: "10px 12px", fontSize: 13, resize: "vertical", minHeight: 42 }}
            />
            <button
              onClick={() => void handleCreateDispute()}
              disabled={pendingAction === "create"}
              style={{ height: 42, padding: "0 14px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: pendingAction === "create" ? 0.7 : 1 }}
            >
              {pendingAction === "create" ? "Abriendo..." : "Abrir disputa"}
            </button>
          </div>
        </div>
      </HtmlInCanvasPanel>

      <HtmlInCanvasPanel as="section" style={{ marginBottom: 16 }} canvasClassName="rounded-2xl" minHeight={68}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--surface)", padding: 4, borderRadius: 10, border: "1px solid var(--border)" }}>
            {[
              { key: "all" as const, label: "Todas" },
              { key: "open" as const, label: "Abiertas" },
              { key: "resolved" as const, label: "Resueltas" }
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: filter === item.key ? "var(--brand)" : "transparent", color: filter === item.key ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            style={{ height: 38, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", padding: "0 12px", fontSize: 12 }}
          >
            <option value="">Todos los proyectos</option>
            {disputes
              .map((item) => ({ projectId: item.projectId, label: item.jobTitle }))
              .filter((item, index, array) => item.projectId && array.findIndex((candidate) => candidate.projectId === item.projectId) === index)
              .map((item) => (
                <option key={item.projectId} value={item.projectId}>
                  {item.label}
                </option>
              ))}
          </select>
        </div>
      </HtmlInCanvasPanel>

      {error && (
        <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3].map((item) => (
            <div key={item} style={{ height: 90, borderRadius: 14, background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : filteredDisputes.length === 0 ? (
        <HtmlInCanvasPanel as="section" style={{ padding: "42px 24px", textAlign: "center" }} canvasClassName="rounded-2xl" minHeight={180}>
          <Inbox size={34} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>No hay disputas para este filtro</p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Ajusta el filtro o abre una disputa si hay un bloqueo real que necesite intervención.
          </p>
        </HtmlInCanvasPanel>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: selectedDispute ? "minmax(0, 1.1fr) minmax(320px, .9fr)" : "1fr", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 10 }}>
            {filteredDisputes.map((item) => {
            const meta = STATUS_META[item.status];
            const canResolve = item.status !== "resolved";
            const currentHref = item.projectId ? clientDisputesHref({ status: filter, projectId: item.projectId }) : CLIENT_ROUTES.disputes;
            const isSelected = selectedDispute?.id === item.id;
            return (
              <HtmlInCanvasPanel key={item.id} as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={124}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 14, color: "var(--ink)" }}>{item.jobTitle}</strong>
                        <StatusBadge variant={meta.variant} text={meta.label} size="sm" />
                        {item.projectStatus ? (
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>Proyecto {item.projectStatus}</span>
                        ) : null}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>{item.reason}</p>
                      {item.resolution ? (
                        <p style={{ margin: 0, fontSize: 12, color: "#10b981" }}>Resolución: {item.resolution}</p>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => setSelectedDisputeId(item.id)}
                        style={{ padding: "8px 11px", borderRadius: 10, border: isSelected ? "1px solid rgba(99,102,241,.3)" : "1px solid var(--border)", background: isSelected ? "rgba(99,102,241,.09)" : "transparent", color: isSelected ? "#6366f1" : "var(--ink)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        {isSelected ? "Workspace abierto" : "Abrir workspace"}
                      </button>
                      <Link
                        href={currentHref}
                        style={{ padding: "8px 11px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                      >
                        Filtrar proyecto
                      </Link>
                      {item.jobId ? (
                        <Link
                          href={`/client/jobs/${item.jobId}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                        >
                          Ver trabajo <ArrowUpRight size={13} />
                        </Link>
                      ) : null}
                      {canResolve ? (
                        <button
                          onClick={() => void handleResolveDispute(item.id)}
                          disabled={pendingAction === `resolve:${item.id}`}
                          style={{ padding: "8px 11px", borderRadius: 10, border: "1px solid rgba(16,185,129,.28)", background: "rgba(16,185,129,.09)", color: "#10b981", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: pendingAction === `resolve:${item.id}` ? 0.7 : 1 }}
                        >
                          {pendingAction === `resolve:${item.id}` ? "Resolviendo..." : "Marcar resuelta"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
                    <MessageSquare size={14} color={meta.tone} />
                    <span>Proyecto {item.projectId}</span>
                    {item.jobId ? <span>· Trabajo {item.jobId}</span> : null}
                  </div>
                  {canResolve ? (
                    <textarea
                      value={resolutionDrafts[item.id] ?? item.resolution ?? ""}
                      onChange={(event) => setResolutionDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      rows={2}
                      placeholder="Escribe un acuerdo verificable si ya existe resolución entre las partes."
                      style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", padding: "10px 12px", fontSize: 12, resize: "vertical" }}
                    />
                  ) : null}
                </div>
              </HtmlInCanvasPanel>
            );
            })}
          </div>

          {selectedDispute ? (
            <div style={{ position: "sticky", top: 16, display: "grid", gap: 10 }}>
              <HtmlInCanvasPanel as="section" style={{ padding: "16px 18px" }} canvasClassName="rounded-2xl" minHeight={130}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "var(--muted)" }}>WORKSPACE ACTIVO</p>
                      <h3 style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{selectedDispute.jobTitle}</h3>
                    </div>
                    <StatusBadge variant={STATUS_META[selectedDispute.status].variant} text={STATUS_META[selectedDispute.status].label} size="sm" />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{selectedDispute.reason}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--faint)" }}>
                    <span>Proyecto {selectedDispute.projectId}</span>
                    {selectedDispute.jobId ? <span>Trabajo {selectedDispute.jobId}</span> : null}
                    {selectedDispute.projectStatus ? <span>Estado {selectedDispute.projectStatus}</span> : null}
                  </div>
                </div>
              </HtmlInCanvasPanel>

              <DisputeResolutionWorkspace
                dispute={selectedDispute}
                audience="client"
                canResolve={selectedDispute.status !== "resolved"}
                relatedHref={selectedDispute.jobId ? `/client/jobs/${selectedDispute.jobId}` : undefined}
                evidenceHref={selectedDispute.jobId ? `/client/milestones?jobId=${encodeURIComponent(selectedDispute.jobId)}` : undefined}
                documentsHref={selectedDispute.projectId ? `/client/documents?projectId=${encodeURIComponent(selectedDispute.projectId)}` : "/client/documents"}
                resolveBusy={pendingAction === `resolve:${selectedDispute.id}`}
                onResolve={(resolution) => handleResolveDispute(selectedDispute.id, resolution)}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

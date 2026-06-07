"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLanguage } from "../../../../../lib/language-context";
import { ArrowLeft, ArrowRight, CheckSquare, FileText, FolderKanban, MessageSquare, Plus, ShieldCheck } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { buildOpsProjectStatusLabel, buildOpsProjectTypeLabel, buildOpsRiskLabel, buildOpsTradeLabel } from "../../../../lib/buildops-i18n";
import { BuildOpsProjectHealthPanel } from "@/components/buildops/BuildOpsProjectHealthPanel";
import { OperationalRagQueryPanel } from "@/components/buildops/OperationalRagQueryPanel";
import { useBuildOpsSSE } from "@/hooks/useBuildOpsSSE";
import {
  fetchBuildOpsProject,
  approveClientPlan,
  requestPlanChanges,
  rejectClientPlan,
  unapproveClientPlan,
  type BuildOpsProject,
  type BuildOpsPlanApprovalStatus,
} from "../../../../lib/buildops-api";

const fallbackProject: BuildOpsProject = {
  id: "loading",
  tenantId: "",
  orgId: "",
  createdBy: "",
  title: "Loading...",
  description: null,
  trade: "",
  projectType: "",
  clientName: "",
  professionalName: null,
  location: "",
  budgetEstimate: null,
  status: "draft",
  riskScore: 0,
  riskLevel: "low",
  startDate: null,
  dueDate: null,
  sourceTool: null,
  sourceToolInput: null,
  sourceToolResult: null,
  completion: 0,
  clientPlanApprovalStatus: "pending",
  clientPlanApprovedAt: null,
  clientPlanApprovedById: null,
  clientPlanApprovalSource: null,
  clientPlanReviewedAt: null,
  clientPlanReviewComment: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function approvalStatusVariant(status: BuildOpsPlanApprovalStatus): "success" | "warn" | "error" | "info" {
  switch (status) {
    case "approved": return "success";
    case "changes_requested": return "warn";
    case "rejected": return "error";
    default: return "info";
  }
}

type ApprovalAction = "approve" | "request-changes" | "reject" | "unapprove";

export default function BuildOpsProjectDetailPage() {
  const { t } = useLanguage();
  const params = useParams<{ projectId: string }>();
  const projectId = typeof params?.projectId === "string" ? params.projectId : "";
  const [project, setProject] = useState<BuildOpsProject>(fallbackProject);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approvalAction, setApprovalAction] = useState<ApprovalAction | null>(null);
  const [approvalInput, setApprovalInput] = useState("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // SSE: refresh health panel when change orders or signals change on this project
  const [healthRefreshKey, setHealthRefreshKey] = useState(0);
  const refreshHealth = useCallback(() => setHealthRefreshKey((k) => k + 1), []);

  useBuildOpsSSE({
    onEvent: (evt) => {
      const HEALTH_EVENTS = new Set([
        "change-order:updated", "change-order:applied",
        "operational-signal:created",
      ]);
      if (!HEALTH_EVENTS.has(evt.type)) return;
      // Only refresh if event belongs to this project
      const evtProjectId = (evt as Record<string, unknown>).buildOpsProjectId as string | undefined;
      if (evtProjectId && evtProjectId !== projectId) return;
      refreshHealth();
    },
    enabled: !!projectId && projectId !== "loading",
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const data = await fetchBuildOpsProject(projectId);
        if (!alive) return;
        setProject(data);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : t("common.serverError"));
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [projectId, t]);

  async function submitApprovalAction() {
    if (!approvalAction) return;
    setApprovalSubmitting(true);
    setApprovalError(null);
    try {
      let result;
      if (approvalAction === "approve") {
        result = await approveClientPlan(project.id, { reason: approvalInput || undefined });
      } else if (approvalAction === "request-changes") {
        result = await requestPlanChanges(project.id, approvalInput);
      } else if (approvalAction === "reject") {
        result = await rejectClientPlan(project.id, approvalInput);
      } else {
        result = await unapproveClientPlan(project.id, approvalInput);
      }
      setProject((p) => ({
        ...p,
        clientPlanApprovalStatus: result.clientPlanApprovalStatus,
        clientPlanApprovedAt: result.clientPlanApprovedAt,
        clientPlanApprovedById: result.clientPlanApprovedById,
        clientPlanApprovalSource: result.clientPlanApprovalSource,
        clientPlanReviewedAt: result.clientPlanReviewedAt,
        clientPlanReviewComment: result.clientPlanReviewComment,
      }));
      setApprovalAction(null);
      setApprovalInput("");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : t("common.serverError"));
    } finally {
      setApprovalSubmitting(false);
    }
  }

  const approvalStatus = project.clientPlanApprovalStatus;
  const isLoaded = !loading;

  function approvalActionLabel(action: ApprovalAction): string {
    if (approvalSubmitting) {
      if (action === "approve") return t("buildops.approvingPlan");
      if (action === "request-changes") return t("buildops.requestingChanges");
      if (action === "reject") return t("buildops.rejectingPlan");
      return t("buildops.unapprovingPlan");
    }
    if (action === "approve") return t("buildops.approvePlan");
    if (action === "request-changes") return t("buildops.requestPlanChanges");
    if (action === "reject") return t("buildops.rejectPlan");
    return t("buildops.unapprovePlan");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/buildops/projects" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} />
            {t("buildops.backToProjects")}
          </Link>
          <Badge variant="brand">BuildOps</Badge>
        </div>

        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <FolderKanban size={18} className="text-brand" />
            <h1 className="text-3xl font-bold tracking-tight text-ink">{project.title}</h1>
          </div>
          <p className="max-w-3xl text-sm text-muted">
            {t("buildops.projectDetailIntro")}
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {loading ? <p className="text-sm text-muted">{t("buildops.loadingProject")}</p> : null}
        </section>

        {/* Project Health Panel — auto-refresh via SSE */}
        {isLoaded && project.id !== "loading" && (
          <BuildOpsProjectHealthPanel
            key={`health-${project.id}-${healthRefreshKey}`}
            projectId={project.id}
          />
        )}

        {/* Prometeo RAG — operational explanation panel (Fase 3) */}
        {isLoaded && project.id !== "loading" && (
          <OperationalRagQueryPanel projectId={project.id} />
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t("buildops.trade"), value: buildOpsTradeLabel(t, project.trade) },
            { label: t("buildops.statusLabel"), value: buildOpsProjectStatusLabel(t, project.status) },
            { label: t("job.budget"), value: project.budgetEstimate != null ? `$${project.budgetEstimate.toLocaleString()}` : "—" },
            { label: t("buildops.riskScore"), value: `${project.riskScore}/100` },
          ].map((item) => (
            <Card key={item.label} className="grid gap-2">
              <div className="text-xs uppercase tracking-[0.2em] text-muted">{item.label}</div>
              <div className="text-xl font-bold text-ink">{item.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="grid gap-4 border-brand/20 bg-brand/[0.04]">
            <h2 className="text-lg font-semibold text-ink">{t("buildops.projectSummary")}</h2>
            <div className="grid gap-3 text-sm text-muted">
              <div><span className="text-ink font-semibold">{t("buildops.client")}:</span> {project.clientName}</div>
              <div><span className="text-ink font-semibold">{t("buildops.professional")}:</span> {project.professionalName ?? "—"}</div>
              <div><span className="text-ink font-semibold">{t("job.location")}:</span> {project.location}</div>
              <div><span className="text-ink font-semibold">{t("ui.type")}:</span> {buildOpsProjectTypeLabel(t, project.projectType)}</div>
              <div><span className="text-ink font-semibold">{t("buildops.sourceTool")}:</span> {project.sourceTool ?? t("buildops.manualSource")}</div>
              <div><span className="text-ink font-semibold">{t("buildops.projectId")}:</span> {project.id}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="info">{project.completion}% {t("buildops.complete")}</Badge>
              <Badge variant="info">{t("buildops.risk")} {buildOpsRiskLabel(t, project.riskLevel)}</Badge>
              <Badge variant="info">{project.sourceTool ? t("buildops.fromToolResult") : t("buildops.manualProject")}</Badge>
            </div>
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-lg font-semibold text-ink">{t("dash.quickActions")}</h2>
            <div className="grid gap-3">
              <Link href={`/buildops/tasks/new?projectId=${project.id}`} className="inline-flex items-center justify-between rounded-xl border border-brand/20 bg-brand/[0.04] px-4 py-3 text-sm font-semibold text-ink transition-all hover:bg-brand/[0.08]">
                <span className="inline-flex items-center gap-2">
                  <Plus size={16} />
                  {t("buildops.createTask")}
                </span>
                <ArrowRight size={14} />
              </Link>
              <button disabled className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink opacity-60">
                <span className="inline-flex items-center gap-2">
                  <FileText size={16} />
                  {t("buildops.addEvidence")}
                </span>
                <ArrowRight size={14} />
              </button>
              <button disabled className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink opacity-60">
                <span className="inline-flex items-center gap-2">
                  <CheckSquare size={16} />
                  {t("buildops.approveMilestone")}
                </span>
                <ArrowRight size={14} />
              </button>
              <button disabled className="inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-ink opacity-60">
                <span className="inline-flex items-center gap-2">
                  <MessageSquare size={16} />
                  {t("buildops.messageTeam")}
                </span>
                <ArrowRight size={14} />
              </button>
            </div>
          </Card>
        </div>

        {isLoaded ? (
          <Card className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-brand" />
                <h2 className="text-lg font-semibold text-ink">{t("buildops.planApproval")}</h2>
              </div>
              <Badge variant={approvalStatusVariant(approvalStatus)}>
                {t(`buildops.planApprovalStatus.${approvalStatus}`)}
              </Badge>
            </div>

            {project.clientPlanApprovedAt ? (
              <div className="grid gap-1 text-sm text-muted">
                <div>
                  <span className="text-ink font-semibold">{t("buildops.approvedByLabel")}:</span>{" "}
                  {project.clientPlanApprovedById ?? "—"}
                </div>
                <div>
                  <span className="text-ink font-semibold">{t("buildops.approvedAtLabel")}:</span>{" "}
                  {new Date(project.clientPlanApprovedAt).toLocaleDateString()}
                </div>
                {project.clientPlanApprovalSource ? (
                  <div>
                    <span className="text-ink font-semibold">Source:</span>{" "}
                    {project.clientPlanApprovalSource === "client"
                      ? t("buildops.approvalSourceClient")
                      : t("buildops.approvalSourceAdmin")}
                  </div>
                ) : null}
              </div>
            ) : null}

            {project.clientPlanReviewComment ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-muted">
                <span className="text-ink font-semibold">{t("buildops.reviewCommentLabel")}:</span>{" "}
                {project.clientPlanReviewComment}
              </div>
            ) : null}

            {approvalAction ? (
              <div className="grid gap-3">
                <textarea
                  className="min-h-[80px] w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-brand/40 focus:outline-none"
                  placeholder={
                    approvalAction === "approve"
                      ? t("buildops.approveReasonLabel")
                      : approvalAction === "request-changes"
                        ? t("buildops.requestChangesCommentLabel")
                        : approvalAction === "reject"
                          ? t("buildops.rejectReasonLabel")
                          : t("buildops.unapproveReasonLabel")
                  }
                  value={approvalInput}
                  onChange={(e) => setApprovalInput(e.target.value)}
                  disabled={approvalSubmitting}
                />
                {approvalError ? <p className="text-sm text-red-400">{approvalError}</p> : null}
                <div className="flex gap-2">
                  <button
                    onClick={() => void submitApprovalAction()}
                    disabled={approvalSubmitting || (approvalAction !== "approve" && !approvalInput.trim())}
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {approvalActionLabel(approvalAction)}
                  </button>
                  <button
                    onClick={() => { setApprovalAction(null); setApprovalInput(""); setApprovalError(null); }}
                    disabled={approvalSubmitting}
                    className="rounded-xl border border-white/[0.12] px-4 py-2 text-sm font-semibold text-muted transition-all hover:text-ink disabled:opacity-50"
                  >
                    {t("ui.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(approvalStatus === "pending" || approvalStatus === "changes_requested") ? (
                  <button
                    onClick={() => setApprovalAction("approve")}
                    className="rounded-xl bg-green-600/20 border border-green-500/30 px-4 py-2 text-sm font-semibold text-green-400 transition-all hover:bg-green-600/30"
                  >
                    {t("buildops.approvePlan")}
                  </button>
                ) : null}
                {(approvalStatus === "pending" || approvalStatus === "approved") ? (
                  <button
                    onClick={() => setApprovalAction("request-changes")}
                    className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-2 text-sm font-semibold text-yellow-400 transition-all hover:bg-yellow-500/20"
                  >
                    {t("buildops.requestPlanChanges")}
                  </button>
                ) : null}
                {(approvalStatus === "pending" || approvalStatus === "changes_requested") ? (
                  <button
                    onClick={() => setApprovalAction("reject")}
                    className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20"
                  >
                    {t("buildops.rejectPlan")}
                  </button>
                ) : null}
                {approvalStatus === "approved" ? (
                  <button
                    onClick={() => setApprovalAction("unapprove")}
                    className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-sm font-semibold text-muted transition-all hover:text-ink"
                  >
                    {t("buildops.unapprovePlan")}
                  </button>
                ) : null}
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </main>
  );
}

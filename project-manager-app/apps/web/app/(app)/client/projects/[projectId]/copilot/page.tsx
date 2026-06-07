"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Bot, ChevronDown, Clock, Cloud, Cpu, Edit, FileText, FlaskConical, GitBranch, LayoutList, Map, Milestone, PenTool, RefreshCw, Search, Send, Settings, Terminal, Wallet, X, Zap } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  approveWorkPlan,
  blockWorkPlanStep,
  completeWorkPlanStep,
  rejectWorkPlan,
  retryWorkPlanStep,
  runProjectCopilot,
  startWorkPlanStep,
  fetchMyProfile,
  updateMyProfile,
  fetchPlanTemplates,
  subscribeToContextUpdates,
  type CopilotBlockedAction,
  type CopilotOutput,
  type CopilotProposedAction,
  type CopilotWorkPlan,
  type WorkPlanStep,
  type UserProfileView,
  type UserProfileUpdateInput,
  type AssistantTone,
  type AssistantLanguage,
  type AssistantVerbosity,
  type PlanTemplate,
  fetchProjectFinancialSummary,
  type ProjectFinancialSummary,
} from "../../../../../semse-api";
import { ClientPageHeader } from "../../../../../components/client/ClientPageHeader";
import { CLIENT_ROUTES, clientDisputesHref, clientProjectCopilotHref } from "../../../../../lib/client-routes";
import {
  buildCopilotPlanSections,
  buildCopilotPlanStepFacts,
  getCopilotPlanProgress,
  getCopilotPlanStatusLabel,
  getCopilotPlanStepStatusLabel,
} from "../../../../../lib/copilot-plan-view";
import { PlanTaskGraph } from "./components/plan-task-graph";

type MessageRole = "user" | "assistant" | "system";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  proposedActions?: CopilotProposedAction[];
  blockedActions?: CopilotBlockedAction[];
  proposedPlan?: CopilotWorkPlan;
  activePlan?: CopilotWorkPlan;
  provider?: string;
  model?: string;
  mode?: string;
};

type TabId = "chat" | "search" | "refresh" | "settings";

type CopilotRefreshSnapshot = {
  workspace?: Record<string, unknown>;
  context?: Record<string, unknown>;
  corpusStatus?: Record<string, unknown>;
  actions?: Record<string, unknown>[];
  runs?: Record<string, unknown>[];
  activePlan?: CopilotWorkPlan | null;
};

type ActionAssist =
  | { kind: "link"; href: string; label: string }
  | { kind: "chat"; prompt: string; label: string };

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPreferredProfessional(workspace: Record<string, unknown> | null) {
  const raw = workspace?.preferredProfessional;
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  const userId = asText(candidate.userId);
  const displayName = asText(candidate.displayName);
  if (!userId || !displayName) return null;

  return {
    userId,
    displayName,
    publicSlug: asText(candidate.publicSlug) || null,
    selectedAt: asText(candidate.selectedAt) || null,
  };
}

function buildSignals(snapshot: CopilotRefreshSnapshot) {
  const workspace = snapshot.workspace ?? {};
  const context = snapshot.context ?? {};
  const corpusStatus = snapshot.corpusStatus ?? {};

  const milestonesTotal = asNumber(workspace.milestonesTotal);
  const milestonesApproved = asNumber(workspace.milestonesApproved);
  const milestonesPending = Math.max(0, milestonesTotal - milestonesApproved);
  const openDisputeCount = asNumber(context.openDisputeCount);
  const evidenceCount = asNumber(corpusStatus.evidenceCount);
  const escrowFunded = asNumber(workspace.escrowFunded);
  const escrowReleased = asNumber(workspace.escrowReleased);
  const escrowGap = Math.max(0, escrowFunded - escrowReleased);

  const blockers: string[] = [];
  const priorities: string[] = [];

  if (openDisputeCount > 0) blockers.push(`${openDisputeCount} disputa(s) abierta(s) siguen activas.`);
  if (milestonesPending > 0) blockers.push(`${milestonesPending} milestone(s) siguen pendientes.`);
  if (evidenceCount === 0) blockers.push("No hay evidencia indexada para sostener aprobaciones.");
  if (escrowGap > 0) blockers.push(`Quedan $${escrowGap.toLocaleString()} retenidos en escrow.`);

  priorities.push("resolver o acotar disputas abiertas");
  priorities.push("confirmar evidencia antes de aprobar hitos");
  priorities.push("validar qué fondos sí son elegibles para release");

  return { milestonesPending, openDisputeCount, evidenceCount, escrowGap, blockers, priorities };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function resolveActionAssist(action: Record<string, unknown>, projectId: string): ActionAssist {
  const type = asText(action.type).toUpperCase();
  const domain = asText(action.domain).toLowerCase();

  if (type.includes("ESCROW") || domain === "escrow") {
    return { kind: "link", href: CLIENT_ROUTES.payments, label: "Revisar pagos" };
  }

  if (type.includes("MILESTONE") || domain === "milestones") {
    return { kind: "link", href: CLIENT_ROUTES.milestones, label: "Revisar hitos" };
  }

  if (type.includes("EVIDENCE") || domain === "evidence") {
    return {
      kind: "link",
      href: clientProjectCopilotHref(projectId, { tab: "search", q: "evidencia del proyecto" }),
      label: "Buscar evidencia"
    };
  }

  if (type.includes("DISPUTE") || domain === "disputes") {
    return {
      kind: "link",
      href: clientDisputesHref({ status: "open", projectId }),
      label: "Abrir disputas"
    };
  }

  return {
    kind: "chat",
    prompt: "Dame el siguiente paso operativo recomendado para este proyecto y por qué.",
    label: "Pedir diagnóstico"
  };
}

function resolveSearchResultAction(result: Record<string, unknown>, projectId: string): ActionAssist {
  const sourceType = asText(result.sourceType).toLowerCase();

  if (sourceType === "evidence" || sourceType === "document") {
    return { kind: "link", href: CLIENT_ROUTES.documents, label: "Abrir documentos" };
  }

  if (sourceType === "payment") {
    return { kind: "link", href: CLIENT_ROUTES.payments, label: "Revisar pagos" };
  }

  if (sourceType === "dispute") {
    return {
      kind: "link",
      href: clientDisputesHref({ status: "open", projectId }),
      label: "Ver disputas"
    };
  }

  return {
    kind: "link",
    href: clientProjectCopilotHref(projectId, { tab: "search", q: asText(result.sourceId) || asText(result.excerpt) }),
    label: "Seguir buscando"
  };
}

// ── TemplatePicker ────────────────────────────────────────────────────────────

function TemplatePicker({ onPick }: { onPick: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setOpen(true);
    if (templates.length === 0 && !loading) {
      setLoading(true);
      setError(null);
      fetchPlanTemplates()
        .then((data) => setTemplates(Array.isArray(data) ? data : []))
        .catch(() => setError("No se pudieron cargar las plantillas."))
        .finally(() => setLoading(false));
    }
  }

  function handlePick(t: PlanTemplate) {
    onPick(`Crea un plan usando la plantilla: ${t.name}`);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 12px", borderRadius: 999,
          border: "1px solid rgba(99,102,241,0.25)",
          background: "rgba(99,102,241,0.10)",
          color: "#818cf8", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        Nuevo plan desde template
        <ChevronDown size={12} />
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 18, padding: "22px 24px",
              width: "min(560px, 90vw)", maxHeight: "80vh",
              display: "flex", flexDirection: "column", gap: 16,
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
                  Plantillas de plan
                </div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
                  Elige una plantilla para el copiloto
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ padding: 6, borderRadius: 8, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>

            {loading && (
              <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                Cargando plantillas…
              </div>
            )}

            {error && (
              <div style={{ color: "#ef4444", fontSize: 13, padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)" }}>
                {error}
              </div>
            )}

            {!loading && !error && templates.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                No hay plantillas disponibles.
              </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handlePick(t)}
                  style={{
                    textAlign: "left", padding: "14px 16px", borderRadius: 12,
                    border: "1px solid var(--border)", background: "var(--bg)",
                    cursor: "pointer", display: "grid", gap: 6,
                    transition: "border-color .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#818cf8")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{t.name}</span>
                    {t.category ? (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        background: "rgba(99,102,241,.1)", color: "#818cf8",
                      }}>{t.category}</span>
                    ) : null}
                  </div>
                  {t.description ? (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{t.description}</p>
                  ) : null}
                  {t.steps?.length > 0 ? (
                    <div style={{ fontSize: 11, color: "#818cf8" }}>
                      {t.steps.length} paso{t.steps.length !== 1 ? "s" : ""} · {t.risks?.length ?? 0} riesgo{(t.risks?.length ?? 0) !== 1 ? "s" : ""}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── WorkPlanCard ──────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };
const STEP_STATUS_COLORS: Record<string, string> = {
  pending: "var(--faint)",
  ready: "#818cf8",
  executing: "#6366f1",
  completed: "#10b981",
  blocked: "#f59e0b",
  failed: "#ef4444",
  skipped: "#64748b",
};

const CAPABILITY_ICONS: Record<string, any> = {
  searching: Search,
  dispute: AlertTriangle,
  shelling: Terminal,
  editing: Edit,
  testing: FlaskConical,
  waiting: Clock,
  worker: Cpu,
  composing: PenTool,
  clouding: Cloud,
  perambulating: Map,
};

function WorkPlanCard({
  plan,
  onPlanUpdate,
  onAskAdjustment,
  onRefreshPlan,
  evidenceCount = 0,
}: {
  plan: CopilotWorkPlan;
  onPlanUpdate: (updated: CopilotWorkPlan) => void;
  onAskAdjustment?: (plan: CopilotWorkPlan) => void;
  onRefreshPlan?: () => Promise<void> | void;
  evidenceCount?: number;
}) {
  const [acting, setActing] = useState<"approving" | "rejecting" | null>(null);
  const [stepBusyId, setStepBusyId] = useState<string | null>(null);
  const [planView, setPlanView] = useState<"list" | "graph">(plan.steps.length > 2 ? "graph" : "list");

  async function handleApprove() {
    setActing("approving");
    try {
      const updated = await approveWorkPlan(plan.id);
      onPlanUpdate(updated);
      await onRefreshPlan?.();
    } catch { /* keep current state */ }
    finally { setActing(null); }
  }

  async function handleReject() {
    setActing("rejecting");
    try {
      const updated = await rejectWorkPlan(plan.id);
      onPlanUpdate(updated);
    } catch { /* keep current state */ }
    finally { setActing(null); }
  }

  async function handleStepAction(step: WorkPlanStep, action: "start" | "complete" | "block" | "retry") {
    setStepBusyId(step.id);
    try {
      const updated = action === "start"
        ? await startWorkPlanStep(plan.id, step.id, evidenceCount)
        : action === "complete"
        ? await completeWorkPlanStep(plan.id, step.id, evidenceCount)
        : action === "retry"
        ? await retryWorkPlanStep(plan.id, step.id, evidenceCount)
        : await blockWorkPlanStep(plan.id, step.id, "Manual: bloqueado por el operador.", evidenceCount);
      onPlanUpdate(updated);
    } catch {
      /* keep current state */
    } finally {
      setStepBusyId(null);
    }
  }

  const highRiskCount = plan.steps.filter((s: WorkPlanStep) => s.riskLevel === "high").length;
  const requiresApprovalCount = plan.steps.filter((s: WorkPlanStep) => s.requiresApproval).length;
  const sections = buildCopilotPlanSections(plan);
  const statusLabel = getCopilotPlanStatusLabel(plan.status);
  const progress = getCopilotPlanProgress(plan);

  return (
    <div style={{
      maxWidth: "78%", marginTop: 6,
      padding: "14px 16px", borderRadius: 12,
      background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.25)",
      display: "grid", gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
            Plan formal — {plan.steps.length} paso{plan.steps.length !== 1 ? "s" : ""}
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{plan.title}</p>
          {plan.description ? (
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>{plan.description}</p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
            <button
              onClick={() => setPlanView("list")}
              title="Vista lista"
              style={{
                padding: "4px 8px", border: "none", cursor: "pointer",
                background: planView === "list" ? "rgba(99,102,241,.15)" : "transparent",
                color: planView === "list" ? "#818cf8" : "var(--muted)",
                display: "flex", alignItems: "center",
              }}
            >
              <LayoutList size={12} />
            </button>
            <button
              onClick={() => setPlanView("graph")}
              title="Vista grafo"
              style={{
                padding: "4px 8px", border: "none", cursor: "pointer",
                background: planView === "graph" ? "rgba(99,102,241,.15)" : "transparent",
                color: planView === "graph" ? "#818cf8" : "var(--muted)",
                display: "flex", alignItems: "center",
              }}
            >
              <GitBranch size={12} />
            </button>
          </div>
          <span style={{
            padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: plan.status === "approved" || plan.status === "executing"
              ? "rgba(16,185,129,.12)"
              : plan.status === "rejected" || plan.status === "cancelled"
              ? "rgba(239,68,68,.1)"
              : "rgba(99,102,241,.1)",
            color: plan.status === "approved" || plan.status === "executing"
              ? "#10b981"
              : plan.status === "rejected" || plan.status === "cancelled"
              ? "#ef4444"
              : "#818cf8",
          }}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {sections.map((section) => (
          <div key={section.title} style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
              {section.title}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {section.items.map((item) => (
                <p key={`${section.title}-${item}`} style={{ margin: 0, fontSize: 12, color: "var(--ink)", lineHeight: 1.55 }}>
                  {item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>
            Progreso del plan
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {progress.completedSteps + progress.skippedSteps}/{progress.totalSteps} pasos · {progress.percent}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "rgba(99,102,241,.08)", overflow: "hidden" }}>
          <div style={{
            width: `${progress.percent}%`,
            height: "100%",
            background: "linear-gradient(90deg, #818cf8 0%, #10b981 100%)",
          }} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
          <span>listos: {progress.readySteps}</span>
          <span>bloqueados: {progress.blockedSteps}</span>
          <span>ejecutando: {progress.executingSteps}</span>
          <span>fallidos: {progress.failedSteps}</span>
        </div>
      </div>

      {/* Steps — grafo o lista */}
      {planView === "graph" ? (
        <PlanTaskGraph plan={plan} />
      ) : null}

      {planView === "list" ? (
      <div style={{ display: "grid", gap: 6 }}>
        {plan.steps.map((step: WorkPlanStep, i: number) => (
          <div key={step.id} style={{
            display: "flex", gap: 10, alignItems: "flex-start",
            padding: "8px 10px", borderRadius: 8,
            background: "var(--bg)", border: "1px solid var(--border)",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: `${STEP_STATUS_COLORS[step.status] ?? "var(--faint)"}20`,
              border: `1.5px solid ${STEP_STATUS_COLORS[step.status] ?? "var(--faint)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: STEP_STATUS_COLORS[step.status] ?? "var(--faint)",
            }}>
              {step.status === "completed" ? "✓" : step.status === "blocked" ? "!" : step.status === "failed" ? "✗" : i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{step.title}</span>
                {(() => {
                  const Icon = CAPABILITY_ICONS[step.capability] || Bot;
                  return (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 6, background: "rgba(99,102,241,.08)", color: "#818cf8", fontSize: 10, fontWeight: 700 }}>
                      <Icon size={10} />
                      {step.capability}
                    </span>
                  );
                })()}
                <span style={{ fontSize: 10, color: RISK_COLORS[step.riskLevel], fontWeight: 700 }}>{step.riskLevel}</span>
                <span style={{ fontSize: 10, color: STEP_STATUS_COLORS[step.status] ?? "var(--faint)", fontWeight: 700 }}>
                  {getCopilotPlanStepStatusLabel(step.status)}
                </span>
                {step.requiresApproval ? (
                  <span style={{ fontSize: 10, color: "#f59e0b" }}>requiere aprobación</span>
                ) : null}
              </div>
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 0", lineHeight: 1.5 }}>{step.description}</p>
              {step.expectedOutcome ? (
                <p style={{ fontSize: 11, color: "var(--ink)", margin: "4px 0 0", lineHeight: 1.5 }}>
                  Resultado esperado: {step.expectedOutcome}
                </p>
              ) : null}
              {buildCopilotPlanStepFacts(step).map((fact) => (
                <p key={`${step.id}-${fact}`} style={{ fontSize: 11, color: fact.startsWith("Bloqueo:") ? "#ef4444" : "var(--ink)", margin: "4px 0 0", lineHeight: 1.5 }}>
                  {fact}
                </p>
              ))}
              {(plan.status === "approved" || plan.status === "executing") ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {step.status === "ready" ? (
                    <button
                      onClick={() => void handleStepAction(step, "start")}
                      disabled={stepBusyId === step.id}
                      style={{
                        padding: "6px 10px", borderRadius: 8, border: "none",
                        background: "#818cf8", color: "#fff", fontSize: 11, fontWeight: 700,
                        cursor: stepBusyId === step.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {stepBusyId === step.id ? "Iniciando…" : "Iniciar step"}
                    </button>
                  ) : null}
                  {step.status === "executing" ? (
                    <button
                      onClick={() => void handleStepAction(step, "complete")}
                      disabled={stepBusyId === step.id}
                      style={{
                        padding: "6px 10px", borderRadius: 8, border: "none",
                        background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 700,
                        cursor: stepBusyId === step.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {stepBusyId === step.id ? "Cerrando…" : "Marcar completado"}
                    </button>
                  ) : null}
                  {(step.status === "ready" || step.status === "executing") ? (
                    <button
                      onClick={() => void handleStepAction(step, "block")}
                      disabled={stepBusyId === step.id}
                      style={{
                        padding: "6px 10px", borderRadius: 8,
                        border: "1px solid rgba(245,158,11,.25)", background: "rgba(245,158,11,.08)",
                        color: "#f59e0b", fontSize: 11, fontWeight: 700,
                        cursor: stepBusyId === step.id ? "not-allowed" : "pointer",
                      }}
                    >
                      Bloquear
                    </button>
                  ) : null}
                  {(step.status === "failed" || step.status === "blocked") ? (
                    <button
                      onClick={() => void handleStepAction(step, "retry")}
                      disabled={stepBusyId === step.id}
                      style={{
                        padding: "6px 10px", borderRadius: 8,
                        border: "1px solid rgba(99,102,241,.25)", background: "rgba(99,102,241,.08)",
                        color: "#818cf8", fontSize: 11, fontWeight: 700,
                        cursor: stepBusyId === step.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {stepBusyId === step.id ? "Reintentando…" : "Reintentar"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      ) : null}

      {/* Warnings */}
      {(highRiskCount > 0 || requiresApprovalCount > 0) && plan.status === "pending_approval" ? (
        <p style={{ fontSize: 11, color: "#f59e0b", margin: 0 }}>
          {highRiskCount > 0 ? `${highRiskCount} paso${highRiskCount > 1 ? "s" : ""} de riesgo alto. ` : ""}
          {requiresApprovalCount > 0 ? `${requiresApprovalCount} paso${requiresApprovalCount > 1 ? "s" : ""} requieren aprobación humana.` : ""}
        </p>
      ) : null}

      {/* Actions */}
      {plan.status === "pending_approval" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => void handleApprove()}
            disabled={acting !== null}
            style={{
              padding: "8px 16px", borderRadius: 9, border: "none",
              background: acting ? "var(--border)" : "#10b981",
              color: "#fff", fontSize: 12, fontWeight: 700,
              cursor: acting ? "not-allowed" : "pointer", opacity: acting === "approving" ? 0.7 : 1,
            }}
          >
            {acting === "approving" ? "Aprobando…" : "Aprobar plan"}
          </button>
          <button
            onClick={() => void handleReject()}
            disabled={acting !== null}
            style={{
              padding: "8px 16px", borderRadius: 9,
              border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.08)",
              color: "#ef4444", fontSize: 12, fontWeight: 700,
              cursor: acting ? "not-allowed" : "pointer",
            }}
          >
            {acting === "rejecting" ? "Rechazando…" : "Rechazar"}
          </button>
          {onAskAdjustment ? (
            <button
              onClick={() => onAskAdjustment(plan)}
              disabled={acting !== null}
              style={{
                padding: "8px 16px", borderRadius: 9,
                border: "1px solid rgba(99,102,241,.25)", background: "rgba(99,102,241,.08)",
                color: "#818cf8", fontSize: 12, fontWeight: 700,
                cursor: acting ? "not-allowed" : "pointer",
              }}
            >
              Pedir ajuste
            </button>
          ) : null}
        </div>
      ) : plan.status === "approved" || plan.status === "executing" ? (
        <p style={{ fontSize: 12, color: "#10b981", fontWeight: 700, margin: 0 }}>
          ✓ Plan activo — las acciones de alto riesgo solo deben ejecutarse dentro de este plan.
        </p>
      ) : null}
    </div>
  );
}

export default function ProjectCopilotPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = typeof params?.projectId === "string" ? params.projectId : "";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stablePathname = pathname ?? clientProjectCopilotHref(projectId);
  const initialTab = searchParams?.get("tab") ?? null;
  const initialSearch = searchParams?.get("q") ?? "";

  const [tab, setTab] = useState<TabId>(
    initialTab === "search" || initialTab === "refresh" || initialTab === "chat" || initialTab === "settings" ? initialTab : "chat"
  );
  const [assistantProfile, setAssistantProfile] = useState<UserProfileView | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null);
  const [snapshot, setSnapshot] = useState<CopilotRefreshSnapshot>({});
  const [currentPlan, setCurrentPlan] = useState<CopilotWorkPlan | null>(null);
  const [financeSummary, setFinanceSummary] = useState<ProjectFinancialSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; kind: "executed" | "pending" | "error" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSearchRef = useRef<string | null>(null);
  const activeProjectRef = useRef(projectId);
  const busyRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  const quickPrompts = [
    "Dame un resumen operativo del proyecto",
    "Qué riesgos ves ahora",
    "Qué hitos o pagos debería revisar primero"
  ];

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    activeProjectRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Load assistant profile when settings tab opens
  useEffect(() => {
    if (tab !== "settings" || assistantProfile) return;
    fetchMyProfile().then((p) => setAssistantProfile(p)).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function saveAssistantProfile(patch: UserProfileUpdateInput) {
    if (!assistantProfile) return;
    setProfileSaving(true);
    try {
      const updated = await updateMyProfile(patch);
      setAssistantProfile(updated);
    } catch { /* ignore */ } finally {
      setProfileSaving(false);
    }
  }

  // SSE live updates for active plan
  useEffect(() => {
    if (!currentPlan?.id) return;

    const es = new EventSource(`/api/semse/agents/plans/${encodeURIComponent(currentPlan.id)}/stream`);

    es.addEventListener("plan-update", (e) => {
      try {
        const updated = JSON.parse(e.data) as CopilotWorkPlan;
        if (updated?.id) {
          setCurrentPlan(updated);
          setMessages((prev) => prev.map((m) =>
            m.proposedPlan?.id === updated.id || m.activePlan?.id === updated.id
              ? { ...m, proposedPlan: updated, activePlan: updated }
              : m,
          ));
        }
      } catch { /* ignore */ }
    });

    es.addEventListener("stream-error", () => es.close());

    return () => es.close();
  }, [currentPlan?.id]);

  const loadProjectState = useCallback(async (options?: { silent?: boolean }) => {
    if (!projectId) return;
    if (refreshInFlightRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    if (options?.silent && busyRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    const requestedProjectId = projectId;
    refreshInFlightRef.current = true;
    if (!options?.silent) {
      setBusy(true);
      setError(null);
    }

    try {
      const [result, nextFinanceSummary] = await Promise.all([
        runProjectCopilot({ kind: "refresh", projectId: requestedProjectId }) as Promise<CopilotRefreshSnapshot>,
        fetchProjectFinancialSummary(requestedProjectId).catch(() => null),
      ]);
      if (activeProjectRef.current !== requestedProjectId) return;
      setWorkspace(result.workspace ?? null);
      setSnapshot(result);
      setCurrentPlan(result.activePlan ?? null);
      setFinanceSummary(nextFinanceSummary);
    } catch (err) {
      if (!options?.silent && activeProjectRef.current === requestedProjectId) {
        setError(err instanceof Error ? err.message : "Error al refrescar.");
      }
    } finally {
      refreshInFlightRef.current = false;
      if (!options?.silent && activeProjectRef.current === requestedProjectId) {
        setBusy(false);
      }
      if (
        pendingRefreshRef.current &&
        !busyRef.current &&
        activeProjectRef.current === requestedProjectId
      ) {
        pendingRefreshRef.current = false;
        void loadProjectState({ silent: true });
      }
    }
  }, [projectId]);

  const scheduleContextRefresh = useCallback(() => {
    if (!projectId) return;
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      if (busyRef.current) {
        pendingRefreshRef.current = true;
        return;
      }
      void loadProjectState({ silent: true });
    }, 500);
  }, [loadProjectState, projectId]);

  useEffect(() => {
    if (!projectId) return;
    pendingRefreshRef.current = false;
    setFinanceSummary(null);
    void loadProjectState();

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      pendingRefreshRef.current = false;
    };
  }, [loadProjectState, projectId]);

  useEffect(() => {
    if (!projectId) return;
    return subscribeToContextUpdates({
      projectId,
      onUpdate: () => {
        scheduleContextRefresh();
      },
    });
  }, [projectId, scheduleContextRefresh]);

  useEffect(() => {
    if (busy || !projectId || refreshInFlightRef.current || !pendingRefreshRef.current) return;
    pendingRefreshRef.current = false;
    void loadProjectState({ silent: true });
  }, [busy, loadProjectState, projectId]);

  useEffect(() => {
    const nextTab = searchParams?.get("tab") ?? null;
    const resolvedTab = nextTab === "search" || nextTab === "refresh" || nextTab === "chat" || nextTab === "settings" ? nextTab : "chat";
    const nextQuery = searchParams?.get("q") ?? "";

    if (resolvedTab !== tab) setTab(resolvedTab);
    if (nextQuery !== searchQuery) setSearchQuery(nextQuery);
  }, [searchParams, tab, searchQuery]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    if (tab === "chat") params.delete("tab");
    else params.set("tab", tab);

    const normalizedQuery = searchQuery.trim();
    if (tab === "search" && normalizedQuery) params.set("q", normalizedQuery);
    else params.delete("q");

    const next = params.toString();
    const current = searchParams?.toString() ?? "";
    if (next !== current) {
      router.replace(next ? `${stablePathname}?${next}` : stablePathname, { scroll: false });
    }
  }, [router, searchParams, searchQuery, stablePathname, tab]);

  async function runRefresh() {
    if (busy || !projectId) return;
    await loadProjectState();
  }

  function openPrompt(prompt: string) {
    setTab("chat");
    setInput(prompt);
    setActionFeedback(null);
  }

  async function sendChat() {
    if (!input.trim() || busy || !projectId) return;
    const userMsg: Message = { id: `u${Date.now()}`, role: "user", content: input.trim(), timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const result = await runProjectCopilot({ kind: "chat", projectId, message: userMsg.content, threadId });
      const chatResult = result as {
        threadId?: string;
        message?: string;
        proposedActions?: CopilotProposedAction[];
        blockedActions?: CopilotBlockedAction[];
        proposedPlan?: CopilotWorkPlan;
        activePlan?: CopilotWorkPlan;
        workPlan?: CopilotWorkPlan;
        provider?: string;
        model?: string;
        mode?: string;
      };
      if (chatResult.threadId) setThreadId(chatResult.threadId);
      if (chatResult.proposedPlan) setCurrentPlan(chatResult.proposedPlan);
      else if (chatResult.activePlan) setCurrentPlan(chatResult.activePlan);
      const assistantMsg: Message = {
        id: `a${Date.now()}`,
        role: "assistant",
        content: String(chatResult.message ?? "Sin respuesta."),
        timestamp: new Date().toISOString(),
        proposedActions: chatResult.proposedActions?.length ? chatResult.proposedActions : undefined,
        blockedActions: chatResult.blockedActions?.length ? chatResult.blockedActions : undefined,
        proposedPlan: chatResult.proposedPlan ?? chatResult.workPlan,
        activePlan: chatResult.activePlan,
        provider: chatResult.provider,
        model: chatResult.model,
        mode: chatResult.mode,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar mensaje.");
    } finally {
      setBusy(false);
    }
  }

  const runSearch = useCallback(async (overrideQuery?: string) => {
    const query = (overrideQuery ?? searchQuery).trim();
    if (!query || busy || !projectId) return;
    setBusy(true);
    setError(null);
    setSearchResults([]);
    try {
      const result = await runProjectCopilot({ kind: "search", projectId, query }) as {
        result?: { results?: Record<string, unknown>[] };
      };
      setSearchResults(result.result?.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en la búsqueda.");
    } finally {
      setBusy(false);
    }
  }, [busy, projectId, searchQuery]);

  useEffect(() => {
    const requestedQuery = searchParams?.get("q")?.trim() ?? "";
    if (tab !== "search" || !projectId || !requestedQuery) return;

    const key = `${projectId}:${requestedQuery}`;
    if (autoSearchRef.current === key) return;

    autoSearchRef.current = key;
    void runSearch(requestedQuery);
  }, [projectId, runSearch, searchParams, tab]);

  async function runAction(action: Record<string, unknown>, index: number) {
    if (!projectId) return;
    const actionId = String(action.id ?? action.type ?? index);
    const actionType = typeof action.type === "string" ? action.type : "";
    if (!actionType) {
      setError("La accion sugerida no tiene un tipo valido.");
      return;
    }

    setActionBusyId(actionId);
    setActionFeedback(null);
    setError(null);

    try {
      const result = await runProjectCopilot({
        kind: "action",
        projectId,
        actionType,
        payload: {
          source: "copilot_ui",
          suggestedLabel: action.summary ?? action.label,
          riskLevel: action.riskLevel,
          approvalMode: action.approvalMode,
        },
      }) as Record<string, unknown>;

      const message =
        typeof result["message"] === "string" && result["message"].trim().length > 0
          ? result["message"]
          : `Acción '${actionType}' enviada al flujo operativo.`;

      const isPending = result["approvalStatus"] === "pending" && result["approvalMode"] === "required";
      setActionFeedback({ message, kind: isPending ? "pending" : "executed" });

      const refreshTargets = Array.isArray(result["refreshTargets"]) ? result["refreshTargets"] : [];
      if (refreshTargets.length > 0 && !isPending) {
        await runRefresh();
      }
    } catch (err) {
      setActionFeedback({ message: err instanceof Error ? err.message : "Error al ejecutar la acción.", kind: "error" });
    } finally {
      setActionBusyId(null);
    }
  }

  const signals = buildSignals(snapshot);
  const preferredProfessional = readPreferredProfessional(workspace);
  const isCurrentPlanInMessages = currentPlan
    ? messages.some((entry) => entry.proposedPlan?.id === currentPlan.id || entry.activePlan?.id === currentPlan.id)
    : false;

  const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
    { id: "chat",     label: "Chat",      icon: Bot },
    { id: "search",   label: "Búsqueda",  icon: Search },
    { id: "refresh",  label: "Estado",    icon: RefreshCw },
    { id: "settings", label: "Asistente", icon: Settings },
  ];

  const operationalLinks = [
    {
      href: clientDisputesHref({ status: "open", projectId }),
      label: "Disputas",
      note: signals.openDisputeCount > 0 ? `${signals.openDisputeCount} abierta(s)` : "sin bloqueos activos",
      icon: AlertTriangle,
      color: "#ef4444"
    },
    {
      href: CLIENT_ROUTES.payments,
      label: "Pagos",
      note: signals.escrowGap > 0 ? `$${signals.escrowGap.toLocaleString()} por revisar` : "vista general",
      icon: Wallet,
      color: "#10b981"
    },
    {
      href: CLIENT_ROUTES.milestones,
      label: "Hitos",
      note: signals.milestonesPending > 0 ? `${signals.milestonesPending} pendiente(s)` : "sin pendientes fuertes",
      icon: Milestone,
      color: "#6366f1"
    },
    {
      href: CLIENT_ROUTES.documents,
      label: "Documentos",
      note: signals.evidenceCount > 0 ? `${signals.evidenceCount} evidencia(s)` : "sin evidencia indexada",
      icon: FileText,
      color: "#f59e0b"
    },
    {
      href: clientProjectCopilotHref(projectId, { tab: "search", q: "evidencia del proyecto" }),
      label: "Buscar evidencia",
      note: "queda dentro del copiloto",
      icon: Search,
      color: "#8b5cf6"
    }
  ];

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", display: "grid", gap: "16px", height: "calc(100vh - 120px)" }}>
      <ClientPageHeader
        title="Copiloto del Proyecto"
        subtitle={projectId}
        breadcrumbs={[{ label: "Proyectos", href: CLIENT_ROUTES.projects }, { label: "Copiloto" }]}
        minHeight={160}
        panelStyle={{ border: "1px solid var(--border)", borderRadius: 22, background: "var(--surface)", padding: "20px 22px" }}
        leading={
          <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(99,102,241,0.15)", display: "grid", placeItems: "center" }}>
            <Bot size={20} color="#818cf8" />
          </div>
        }
        actions={
          <>
            <span style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(99,102,241,0.12)", color: "#818cf8", fontSize: 12, fontWeight: 700 }}>chat contextual</span>
            <span style={{ padding: "7px 10px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "#34d399", fontSize: 12, fontWeight: 700 }}>refresh operativo</span>
          </>
        }
      />
      <HtmlInCanvasPanel
        style={{ border: "1px solid var(--border)", borderRadius: 22, background: "var(--surface)", padding: "20px 22px", marginTop: "-4px" }}
        canvasClassName="rounded-[22px]"
        minHeight={96}
      >
        {workspace && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            {[
              { label: "Estado", value: String(workspace.status ?? "—") },
              { label: "Escrow", value: String(workspace.escrowStatus ?? "—") },
              { label: "Fondeado", value: `$${Number(workspace.escrowFunded ?? 0).toLocaleString()}` },
              { label: "Liberado", value: `$${Number(workspace.escrowReleased ?? 0).toLocaleString()}` }
            ].map((item) => (
              <div key={item.label} style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--panel, var(--bg))" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </HtmlInCanvasPanel>

      {preferredProfessional && (
        <div style={{ background: "var(--surface)", border: "1px solid rgba(52,211,153,.2)", borderRadius: 16, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, color: "#34d399", fontWeight: 700, marginBottom: 10 }}>PROFESIONAL OBJETIVO</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{preferredProfessional.displayName}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {preferredProfessional.selectedAt
                  ? `Seleccionado el ${new Date(preferredProfessional.selectedAt).toLocaleDateString("es-MX")}`
                  : "Preferencia recuperada desde memoria operativa"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Link
                href={`/client/professionals?jobId=${encodeURIComponent(String(workspace?.jobId ?? ""))}`}
                style={{
                  fontSize: 12,
                  color: "#818cf8",
                  textDecoration: "none",
                  border: "1px solid rgba(129,140,248,.25)",
                  borderRadius: 999,
                  padding: "7px 10px",
                }}
              >
                Abrir matching
              </Link>
              {preferredProfessional.publicSlug && (
                <Link
                  href={`/pro/${preferredProfessional.publicSlug}`}
                  target="_blank"
                  style={{
                    fontSize: 12,
                    color: "#34d399",
                    textDecoration: "none",
                    border: "1px solid rgba(52,211,153,.25)",
                    borderRadius: 999,
                    padding: "7px 10px",
                  }}
                >
                  Ver perfil publico
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {financeSummary && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 10 }}>FINANZAS DEL PROYECTO</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            {[
              { label: "Facturado", value: `$${financeSummary.totalInvoiced.toLocaleString()}` },
              { label: "Cobrado", value: `$${financeSummary.totalPaid.toLocaleString()}`, color: "#10b981" },
              { label: "Por cobrar", value: `$${financeSummary.totalPending.toLocaleString()}`, color: "#fbbf24" },
              { label: "Gastos", value: `$${financeSummary.totalExpenses.toLocaleString()}`, color: "#f87171" },
              ...(financeSummary.margin !== null ? [{ label: "Margen", value: `${financeSummary.margin.toFixed(1)}%`, color: financeSummary.margin > 20 ? "#10b981" : "#fbbf24" }] : []),
            ].map(item => (
              <div key={item.label} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,255,255,.02)" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: item.color ?? "var(--ink)" }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, textAlign: "right" }}>
            <Link href="/client/finance" style={{ fontSize: 11, color: "#818cf8", textDecoration: "none" }}>
              Ver Finance Hub →
            </Link>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "thin" }}>
        {operationalLinks.map(({ href, label, note, icon: Icon, color }) => (
          <Link
            key={label}
            href={href}
            style={{
              minWidth: 180,
              flexShrink: 0,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--ink)",
              textDecoration: "none",
              display: "grid",
              gap: 6
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800 }}>
                <Icon size={15} color={color} />
                {label}
              </div>
              <ArrowUpRight size={14} color="var(--muted)" />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{note}</div>
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 10, border: "none",
              background: tab === id ? "rgba(99,102,241,0.15)" : "transparent",
              color: tab === id ? "#818cf8" : "var(--muted)",
              fontWeight: tab === id ? 700 : 400, fontSize: 13, cursor: "pointer"
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", borderRadius: 12, color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {actionFeedback && (
        <div style={{
          padding: "12px 16px", borderRadius: 12, fontSize: 13,
          background: actionFeedback.kind === "pending" ? "rgba(245,158,11,.08)" : actionFeedback.kind === "error" ? "rgba(239,68,68,.08)" : "rgba(16,185,129,.08)",
          border: `1px solid ${actionFeedback.kind === "pending" ? "rgba(245,158,11,.22)" : actionFeedback.kind === "error" ? "rgba(239,68,68,.18)" : "rgba(16,185,129,.18)"}`,
          color: actionFeedback.kind === "pending" ? "#fbbf24" : actionFeedback.kind === "error" ? "#ef4444" : "#34d399",
        }}>
          {actionFeedback.kind === "pending" && <span style={{ fontWeight: 700, marginRight: 6 }}>⏳ Pendiente de aprobación:</span>}
          {actionFeedback.kind === "executed" && <span style={{ fontWeight: 700, marginRight: 6 }}>✓ Ejecutado:</span>}
          {actionFeedback.message}
        </div>
      )}

      {tab === "chat" && (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "14px 16px", borderBottom: "1px solid var(--border)", background: "rgba(99,102,241,0.04)", alignItems: "center" }}>
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(99,102,241,0.18)",
                  background: "rgba(99,102,241,0.10)",
                  color: "#818cf8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {prompt}
              </button>
            ))}
            <TemplatePicker onPick={(prompt) => { setTab("chat"); setInput(prompt); }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {currentPlan && !isCurrentPlanInMessages && (
              <WorkPlanCard
                plan={currentPlan}
                onPlanUpdate={(updated) => {
                  setCurrentPlan(updated);
                  setMessages((prev) => prev.map((entry) =>
                    entry.proposedPlan?.id === updated.id || entry.activePlan?.id === updated.id
                      ? { ...entry, proposedPlan: updated, activePlan: updated }
                      : entry,
                  ));
                }}
                onAskAdjustment={(plan) => {
                  setInput(`Ajusta este plan: "${plan.title}". Mantén el objetivo, pero corrige pasos, riesgos y evidencia requerida.`);
                }}
                onRefreshPlan={runRefresh}
                evidenceCount={signals.evidenceCount}
              />
            )}
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, marginTop: 40 }}>
                Haz una pregunta sobre el proyecto o pide ayuda con estado, riesgos, milestones, pagos o disputas.
              </div>
            )}
            {messages.map((msg, msgIndex) => (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 4 }}>
                <div style={{
                  maxWidth: "78%", padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: msg.role === "user" ? "rgba(99,102,241,0.2)" : "var(--panel, var(--bg))",
                  border: "1px solid var(--border)",
                  fontSize: 13, lineHeight: 1.6, color: "var(--ink)"
                }}>
                  {msg.content}
                </div>
                {msg.role === "assistant" && msg.proposedActions && msg.proposedActions.length > 0 && (
                  <div style={{ maxWidth: "78%", display: "grid", gap: 6, marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                      Acciones propuestas por el copiloto
                    </div>
                    {msg.proposedActions.map((action, actionIndex) => {
                      const actionKey = action.id ?? `${msgIndex}-${actionIndex}`;
                      const isBusy = actionBusyId === actionKey;
                      const riskColors: Record<string, string> = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };
                      const riskColor = riskColors[action.riskLevel] ?? "var(--muted)";
                      return (
                        <div key={actionKey} style={{
                          padding: "10px 12px", borderRadius: 10,
                          background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
                          display: "grid", gap: 6,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: 12, color: "var(--ink)" }}>{action.summary}</strong>
                            <span style={{ fontSize: 10, color: riskColor, fontWeight: 700, textTransform: "uppercase" }}>
                              {action.riskLevel}
                            </span>
                          </div>
                          {action.rationale ? (
                            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{action.rationale}</p>
                          ) : null}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <span style={{ fontSize: 10, color: "var(--faint)" }}>
                              {action.approvalMode === "required"
                                ? "Requiere aprobación humana"
                                : action.approvalMode === "recommended"
                                ? "Se ejecuta con registro de auditoría"
                                : "Ejecución directa"}
                            </span>
                            <button
                              onClick={() => void runAction(action as Record<string, unknown>, actionIndex)}
                              disabled={busy || isBusy}
                              style={{
                                padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.35)",
                                background: "rgba(99,102,241,0.12)", color: "#818cf8",
                                fontSize: 11, fontWeight: 700, cursor: isBusy ? "not-allowed" : "pointer",
                                opacity: isBusy ? 0.6 : 1,
                              }}
                            >
                              {isBusy ? "Enviando…" : action.approvalMode === "required" ? "Enviar a aprobación" : "Ejecutar"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {msg.role === "assistant" && msg.blockedActions && msg.blockedActions.length > 0 && (
                  <div style={{ maxWidth: "78%", display: "grid", gap: 6, marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                      Acciones bloqueadas por policy
                    </div>
                    {msg.blockedActions.map((action) => (
                      <div
                        key={`${action.actionType}-${action.summary}`}
                        style={{
                          padding: "10px 12px", borderRadius: 10,
                          background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)",
                          display: "grid", gap: 4,
                        }}
                      >
                        <strong style={{ fontSize: 12, color: "#ef4444" }}>{action.summary}</strong>
                        <div style={{ fontSize: 11, color: "var(--ink)", lineHeight: 1.5 }}>{action.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
                {msg.role === "assistant" && msg.proposedPlan && (
                  <WorkPlanCard
                    plan={msg.proposedPlan}
                    onPlanUpdate={(updated) => {
                      setCurrentPlan(updated);
                      setMessages((prev) => prev.map((m) =>
                        m.id === msg.id ? { ...m, proposedPlan: updated, activePlan: updated } : m,
                      ));
                    }}
                    onAskAdjustment={(plan) => {
                      setInput(`Ajusta este plan: "${plan.title}". Mantén el objetivo, pero corrige pasos, riesgos y evidencia requerida.`);
                    }}
                    onRefreshPlan={runRefresh}
                    evidenceCount={signals.evidenceCount}
                  />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>{formatTime(msg.timestamp)}</span>
                  {msg.role === "assistant" && msg.mode && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em",
                      padding: "2px 6px", borderRadius: 4,
                      background: msg.mode === "llm" ? "rgba(99,102,241,.12)" : msg.mode === "local" ? "rgba(16,185,129,.12)" : "rgba(156,163,175,.1)",
                      color: msg.mode === "llm" ? "#818cf8" : msg.mode === "local" ? "#10b981" : "var(--faint)",
                    }}>
                      {msg.mode === "fallback" ? "template" : (msg.provider ?? msg.mode)}
                      {msg.model ? ` · ${msg.model.split("-").slice(0, 2).join("-")}` : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {busy && tab === "chat" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 12 }}>
                <Bot size={14} color="#818cf8" />
                Escribiendo...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
              placeholder="Pregunta sobre el proyecto... (Enter para enviar)"
              rows={2}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)",
                background: "var(--panel, var(--bg))", color: "var(--ink)", fontSize: 13, resize: "none", outline: "none"
              }}
            />
            <button
              onClick={() => void sendChat()}
              disabled={busy || !input.trim()}
              style={{
                padding: "10px 16px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff",
                fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                opacity: busy || !input.trim() ? 0.5 : 1
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {tab === "search" && (
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
              placeholder="Buscar en documentos, evidencias, disputas, pagos..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 13, outline: "none" }}
            />
            <button
              onClick={() => void runSearch()}
              disabled={busy || !searchQuery.trim()}
              style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: busy || !searchQuery.trim() ? 0.5 : 1 }}
            >
              <Search size={15} />
            </button>
          </div>
          {searchResults.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 14, fontSize: 13 }}>
              {busy ? "Buscando..." : "Los resultados aparecerán aquí."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {searchResults.map((r, i) => (
                <div key={String(r.id ?? i)} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{String(r.sourceType ?? "")} · {String(r.sourceId ?? "")}</div>
                    <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700 }}>
                      score {typeof r.score === "number" ? r.score.toFixed(2) : String(r.score ?? "—")}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>{String(r.excerpt ?? "")}</div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    {resolveSearchResultAction(r, projectId).kind === "link" ? (
                      <Link
                        href={(resolveSearchResultAction(r, projectId) as Extract<ActionAssist, { kind: "link" }>).href}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 10, border: "1px solid var(--border)", color: "var(--ink)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                      >
                        {(resolveSearchResultAction(r, projectId) as Extract<ActionAssist, { kind: "link" }>).label}
                        <ArrowUpRight size={13} />
                      </Link>
                    ) : (
                      <button
                        onClick={() => openPrompt((resolveSearchResultAction(r, projectId) as Extract<ActionAssist, { kind: "chat" }>).prompt)}
                        style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.22)", background: "rgba(99,102,241,0.10)", color: "#818cf8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        {(resolveSearchResultAction(r, projectId) as Extract<ActionAssist, { kind: "chat" }>).label}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "refresh" && (
        <div style={{ display: "grid", gap: "16px" }}>
          <button
            onClick={() => void runRefresh()}
            disabled={busy}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", fontWeight: 700, cursor: "pointer", width: "fit-content", opacity: busy ? 0.6 : 1 }}
          >
            <RefreshCw size={15} style={{ animation: busy ? "spin 1s linear infinite" : "none" }} />
            {busy ? "Actualizando..." : "Actualizar estado del proyecto"}
          </button>

          {workspace && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Zap size={16} color="#818cf8" />
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Estado del proyecto</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                {[
                  { label: "Estado", value: String(workspace.status ?? "—") },
                  { label: "Presupuesto", value: `$${Number(workspace.budgetTotal ?? 0).toLocaleString()}` },
                  { label: "Milestones", value: `${workspace.milestonesApproved ?? 0}/${workspace.milestonesTotal ?? 0}` },
                  { label: "Escrow", value: String(workspace.escrowStatus ?? "—") },
                  { label: "Fondeado", value: `$${Number(workspace.escrowFunded ?? 0).toLocaleString()}` },
                  { label: "Liberado", value: `$${Number(workspace.escrowReleased ?? 0).toLocaleString()}` },
                  { label: "Pendientes", value: String(signals.milestonesPending) },
                  { label: "Disputas", value: String(signals.openDisputeCount) },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "12px 14px", borderRadius: 12, background: "var(--bg, var(--panel))", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 5 }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 12, marginTop: 14 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ padding: "14px", borderRadius: 12, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)" }}>
                    <div style={{ fontSize: 11, color: "#fca5a5", marginBottom: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                      Bloqueos visibles
                    </div>
                    <div style={{ display: "grid", gap: 6, fontSize: 13, lineHeight: 1.55 }}>
                      {signals.blockers.length > 0 ? signals.blockers.map((item) => (
                        <div key={item}>- {item}</div>
                      )) : <div>No hay bloqueos fuertes detectados.</div>}
                    </div>
                  </div>
                  <div style={{ padding: "14px", borderRadius: 12, background: "rgba(99,102,241,.06)", border: "1px solid rgba(99,102,241,.18)" }}>
                    <div style={{ fontSize: 11, color: "#a5b4fc", marginBottom: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                      Prioridades sugeridas
                    </div>
                    <div style={{ display: "grid", gap: 6, fontSize: 13, lineHeight: 1.55 }}>
                      {signals.priorities.map((item) => (
                        <div key={item}>- {item}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ padding: "14px", borderRadius: 12, background: "var(--bg, var(--panel))", border: "1px solid var(--border)", display: "grid", gap: 8 }}>
                  {[
                    { label: "Saldo por liberar", value: `$${signals.escrowGap.toLocaleString()}` },
                    { label: "Evidencia indexada", value: String(signals.evidenceCount) },
                    { label: "Acciones sugeridas", value: String((snapshot.actions ?? []).length) },
                    { label: "Runs recientes", value: String((snapshot.runs ?? []).length) },
                  ].map((item) => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                      <span style={{ color: "var(--muted)" }}>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 14, padding: "14px", borderRadius: 12, background: "rgba(16,185,129,.05)", border: "1px solid rgba(16,185,129,.16)" }}>
                <div style={{ fontSize: 11, color: "#86efac", marginBottom: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Acciones sugeridas por el copiloto
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {(snapshot.actions ?? []).length > 0 ? (snapshot.actions ?? []).map((action, index) => (
                    <div key={String(action.id ?? index)} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg, var(--panel))", border: "1px solid var(--border)", display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <strong style={{ fontSize: 13 }}>{String(action.summary ?? action.label ?? "Accion sugerida")}</strong>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{String(action.riskLevel ?? "low")}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {String(action.type ?? "ACTION")} · {action.approvalMode === "required" ? "requiere aprobacion" : action.approvalMode === "recommended" ? "aprobacion recomendada" : "sin aprobacion previa"}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>
                          {action.approvalMode === "required" ? "Se enviara a cola operativa para aprobacion humana." : "Se ejecuta como instruccion operativa asistida."}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {resolveActionAssist(action, projectId).kind === "link" ? (
                            <Link
                              href={(resolveActionAssist(action, projectId) as Extract<ActionAssist, { kind: "link" }>).href}
                              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                            >
                              {(resolveActionAssist(action, projectId) as Extract<ActionAssist, { kind: "link" }>).label}
                            </Link>
                          ) : (
                            <button
                              onClick={() => openPrompt((resolveActionAssist(action, projectId) as Extract<ActionAssist, { kind: "chat" }>).prompt)}
                              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                            >
                              {(resolveActionAssist(action, projectId) as Extract<ActionAssist, { kind: "chat" }>).label}
                            </button>
                          )}
                          <button
                            onClick={() => void runAction(action, index)}
                            disabled={busy || actionBusyId === String(action.id ?? action.type ?? index)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid rgba(99,102,241,0.22)",
                              background: "rgba(99,102,241,0.10)",
                              color: "#818cf8",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              opacity: busy || actionBusyId === String(action.id ?? action.type ?? index) ? 0.6 : 1,
                            }}
                          >
                            {actionBusyId === String(action.id ?? action.type ?? index) ? "Enviando..." : "Ejecutar acción"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      No hay acciones sugeridas en este momento.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <Settings size={18} color="#818cf8" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Personalización del asistente</h2>
          </div>

          {!assistantProfile ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Cargando preferencias…</div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>

              {/* Tone */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 8 }}>TONO DEL ASISTENTE</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { val: "friendly",  label: "Amistoso" },
                    { val: "formal",    label: "Formal" },
                    { val: "technical", label: "Técnico" },
                    { val: "executive", label: "Ejecutivo" },
                  ].map(({ val, label }) => (
                    <button key={val}
                      onClick={() => void saveAssistantProfile({ assistantTone: val as AssistantTone })}
                      style={{
                        padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                        fontWeight: 700, fontSize: 12,
                        background: assistantProfile.assistantTone === val ? "#6366f1" : "var(--surface-hover, rgba(255,255,255,.06))",
                        color: assistantProfile.assistantTone === val ? "#fff" : "var(--muted)",
                      }}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 8 }}>IDIOMA</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ val: "es", label: "🇪🇸 Español" }, { val: "en", label: "🇺🇸 English" }].map(({ val, label }) => (
                    <button key={val}
                      onClick={() => void saveAssistantProfile({ assistantLanguage: val as AssistantLanguage })}
                      style={{
                        padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                        fontWeight: 700, fontSize: 12,
                        background: assistantProfile.assistantLanguage === val ? "#6366f1" : "var(--surface-hover, rgba(255,255,255,.06))",
                        color: assistantProfile.assistantLanguage === val ? "#fff" : "var(--muted)",
                      }}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Verbosity */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 8 }}>EXTENSIÓN DE RESPUESTAS</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { val: "short",    label: "Corto" },
                    { val: "balanced", label: "Equilibrado" },
                    { val: "detailed", label: "Detallado" },
                  ].map(({ val, label }) => (
                    <button key={val}
                      onClick={() => void saveAssistantProfile({ assistantVerbosity: val as AssistantVerbosity })}
                      style={{
                        padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                        fontWeight: 700, fontSize: 12,
                        background: assistantProfile.assistantVerbosity === val ? "#6366f1" : "var(--surface-hover, rgba(255,255,255,.06))",
                        color: assistantProfile.assistantVerbosity === val ? "#fff" : "var(--muted)",
                      }}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Expert Mode */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Modo experto</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Incluye IDs, estados raw y detalles técnicos</div>
                </div>
                <button
                  onClick={() => void saveAssistantProfile({ expertMode: !assistantProfile.expertMode })}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                    background: assistantProfile.expertMode ? "#6366f1" : "rgba(148,163,184,.25)",
                    position: "relative", transition: "background .2s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 2, left: assistantProfile.expertMode ? 22 : 2,
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    transition: "left .2s",
                  }} />
                </button>
              </div>

              {profileSaving && (
                <div style={{ fontSize: 12, color: "#10b981" }}>Guardando…</div>
              )}

              <div style={{ fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                Los cambios se aplican al próximo mensaje del asistente.
                <a href="/worker/settings" style={{ color: "#818cf8", marginLeft: 6 }}>Configuración completa →</a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

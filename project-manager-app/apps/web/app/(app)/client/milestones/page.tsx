"use client";

/**
 * Client — Milestones
 * Vista de todos los hitos de pago por proyecto activo
 */

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Clock, DollarSign, ChevronDown, ChevronRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import { fetchJobMilestones, fetchJobs, mutateMilestone } from "../../../semse-api";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type MilestoneRecord = {
  id: string;
  title: string;
  amount?: number;
  status?: string;
  sequence?: number;
  jobId?: string;
};

const STATUS_CONFIG: Record<string, { variant: "success" | "warning" | "info" | "neutral"; label: string }> = {
  APPROVED:        { variant: "success", label: "Aprobado" },
  PAID:            { variant: "success", label: "Pagado" },
  SUBMITTED:       { variant: "warning", label: "Enviado" },
  AWAITING_REVIEW: { variant: "warning", label: "En revisión" },
  REJECTED:        { variant: "info", label: "Rechazado" },
  DRAFT:           { variant: "neutral", label: "Pendiente" },
};

export default function ClientMilestonesPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [groups, setGroups] = useState<Array<{
    jobId: string;
    jobTitle: string;
    totalBudget: number;
    milestones: MilestoneRecord[];
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonByMilestone, setReasonByMilestone] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const loadMilestones = async () => {
    setLoading(true);
    setError(null);
    try {
      const jobs = await fetchJobs();
      const activeJobs = jobs.filter((job) => ["in_progress", "review", "accepted"].includes(job.status));
      const milestoneRows = await Promise.all(
        activeJobs.map(async (job) => ({
          job,
          milestones: (await fetchJobMilestones(job.id)).map((item) => {
            const record = item as Record<string, unknown>;
            return {
              id: String(record.id),
              title: String(record.title ?? "Milestone"),
              amount: typeof record.amount === "number" ? record.amount : Number(record.amount ?? 0),
              status: typeof record.status === "string" ? record.status : "DRAFT",
              sequence: typeof record.sequence === "number" ? record.sequence : Number(record.sequence ?? 0),
              jobId: typeof record.jobId === "string" ? record.jobId : job.id
            } satisfies MilestoneRecord;
          })
        }))
      );

      const nextGroups = milestoneRows
        .filter((entry) => entry.milestones.length > 0)
        .map((entry) => ({
          jobId: entry.job.id,
          jobTitle: entry.job.title,
          totalBudget: entry.job.budgetMax ?? entry.job.budgetMin ?? 0,
          milestones: entry.milestones.sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0))
        }));

      setGroups(nextGroups);
      setExpanded(Object.fromEntries(nextGroups.map((group) => [group.jobId, true])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los milestones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMilestones();
  }, []);

  const summary = useMemo(() => {
    const allMilestones = groups.flatMap((group) => group.milestones);
    const completed = allMilestones.filter((item) => item.status === "APPROVED" || item.status === "PAID").length;
    const inProgress = allMilestones.filter((item) => item.status === "SUBMITTED" || item.status === "AWAITING_REVIEW").length;
    const escrow = allMilestones.reduce((sum, item) => sum + (item.amount ?? 0), 0);
    return { completed, inProgress, escrow };
  }, [groups]);

  async function handleAction(milestoneId: string, action: "approve" | "reject") {
    if (pendingAction) return;
    if (action === "reject" && !(reasonByMilestone[milestoneId] ?? "").trim()) {
      setError("Escribe una razón para rechazar el milestone.");
      return;
    }

    setPendingAction(`${action}:${milestoneId}`);
    setError(null);
    try {
      await mutateMilestone(
        milestoneId,
        action,
        action === "reject" ? { reason: reasonByMilestone[milestoneId] } : undefined
      );
      await loadMilestones();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el milestone.");
    } finally {
      setPendingAction(null);
    }
  }

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden",
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <ClientPageHeader
        title="Milestones"
        subtitle="Hitos de pago por proyecto: revisa entregas, aprueba avance y destraba liberaciones."
        breadcrumbs={[{ label: "Milestones" }]}
        minHeight={82}
        actions={<NotificationBanner audience="client" />}
      />

      {/* Summary */}
      <HtmlInCanvasPanel as="section" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "24px" }} canvasClassName="rounded-2xl" minHeight={120}>
        {[
          { label: "Hitos completados", value: String(summary.completed), color: "#10b981", icon: CheckSquare },
          { label: "En progreso", value: String(summary.inProgress), color: "var(--brand)", icon: Clock },
          { label: "Fondos en escrow", value: `$${summary.escrow.toLocaleString()}`, color: "var(--accent)", icon: DollarSign },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <Icon size={15} color={s.color} />
                <p style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>{s.label.toUpperCase()}</p>
              </div>
              <p style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>{s.value}</p>
            </div>
          );
        })}
      </HtmlInCanvasPanel>

      {/* Milestone Groups */}
      {loading ? (
        <div style={{ display: "grid", gap: "10px" }}>
          {[1, 2, 3].map((item) => (
            <div key={item} style={{ height: "88px", borderRadius: "12px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: "16px 18px", borderRadius: "12px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", color: "#ef4444", fontSize: "13px" }}>
          {error}
        </div>
      ) : (
      <HtmlInCanvasPanel as="section" style={{ display: "flex", flexDirection: "column", gap: "12px" }} canvasClassName="rounded-2xl" minHeight={380}>
        {groups.map(group => {
          const done   = group.milestones.filter(m => m.status === "approved").length;
          const total  = group.milestones.length;
          const pct    = Math.round((done / total) * 100);
          const isOpen = expanded[group.jobId] ?? true;

          return (
            <div key={group.jobId} style={card}>
              {/* Group Header */}
              <button
                onClick={() => toggle(group.jobId)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 18px", border: "none", background: "transparent", cursor: "pointer",
                  borderBottom: isOpen ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {isOpen ? <ChevronDown size={15} color="var(--muted)" /> : <ChevronRight size={15} color="var(--muted)" />}
                  <div style={{ textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>{group.jobTitle}</p>
                      <Link
                        href={`/client/jobs/${group.jobId}`}
                        onClick={e => e.stopPropagation()}
                        style={{ display: "inline-flex", alignItems: "center", color: "var(--brand)", opacity: 0.7, textDecoration: "none" }}
                        title="Ver detalle del trabajo"
                      >
                        <ArrowUpRight size={13} />
                      </Link>
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                      {done}/{total} hitos · ${group.totalBudget.toLocaleString()} total
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "80px", height: "4px", borderRadius: "2px", background: "var(--border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "var(--brand)", borderRadius: "2px" }} />
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--brand)", minWidth: "32px" }}>{pct}%</span>
                </div>
              </button>

              {/* Milestones */}
              {isOpen && (
                <div>
                  {group.milestones.map((m, i) => {
                    const s = STATUS_CONFIG[m.status ?? "DRAFT"] ?? STATUS_CONFIG.DRAFT;
                    const canApprove = m.status === "SUBMITTED" || m.status === "AWAITING_REVIEW";
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "flex", alignItems: "center", gap: "14px",
                          padding: "14px 18px",
                          borderBottom: i < group.milestones.length - 1 ? "1px solid var(--border)" : "none",
                          background: m.status === "review" ? "var(--accent)06" : "transparent",
                        }}
                      >
                        {/* Step bubble */}
                        <div style={{
                          width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "12px", fontWeight: 700,
                          background: m.status === "approved" ? "#10b981" : "var(--border)",
                          color: m.status === "approved" ? "#fff" : "var(--muted)",
                        }}>
                          {i + 1}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "2px" }}>{m.title}</p>
                          <p style={{ fontSize: "11px", color: "var(--muted)" }}>Secuencia {m.sequence ?? i + 1}</p>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                          <StatusBadge variant={s.variant} text={s.label} size="sm" />
                          <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)", minWidth: "64px", textAlign: "right" }}>
                            ${(m.amount ?? 0).toLocaleString()}
                          </p>
                          {canApprove && (
                            <button
                              onClick={() => void handleAction(m.id, "approve")}
                              disabled={pendingAction === `approve:${m.id}`}
                              style={{
                              padding: "5px 12px", borderRadius: "6px", border: "none",
                              background: "#10b981", color: "#fff",
                              fontSize: "11px", fontWeight: 700, cursor: "pointer",
                            }}
                            >
                              Aprobar
                            </button>
                          )}
                          {canApprove && (
                            <button
                              onClick={() => void handleAction(m.id, "reject")}
                              disabled={pendingAction === `reject:${m.id}`}
                              style={{
                                padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--border)",
                                background: "var(--surface)", color: "var(--ink)",
                                fontSize: "11px", fontWeight: 700, cursor: "pointer",
                              }}
                            >
                              Rechazar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {group.milestones.some((milestone) => milestone.status === "SUBMITTED" || milestone.status === "AWAITING_REVIEW") ? (
                    <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "grid", gap: "8px" }}>
                      {group.milestones
                        .filter((milestone) => milestone.status === "SUBMITTED" || milestone.status === "AWAITING_REVIEW")
                        .map((milestone) => (
                          <input
                            key={`${milestone.id}-reason`}
                            value={reasonByMilestone[milestone.id] ?? ""}
                            onChange={(event) => setReasonByMilestone((current) => ({ ...current, [milestone.id]: event.target.value }))}
                            placeholder={`Razón para rechazar ${milestone.title}`}
                            style={{
                              width: "100%",
                              padding: "9px 12px",
                              borderRadius: "8px",
                              border: "1px solid var(--border)",
                              background: "var(--bg)",
                              color: "var(--ink)",
                              fontSize: "12px",
                              boxSizing: "border-box",
                              outline: "none",
                            }}
                          />
                        ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </HtmlInCanvasPanel>
      )}
    </div>
  );
}

"use client";

/**
 * Client — Milestones
 * Vista de todos los hitos de pago por proyecto activo
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { CheckSquare, Clock, DollarSign, ChevronDown, ChevronRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { HtmlInCanvasPanel } from "@semse/ui";
import { fetchJobMilestones, fetchJobs, mutateMilestone } from "../../../semse-api";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { MilestoneTrackerCard } from "@/components/milestones/MilestoneTrackerCard";
import { MilestoneGovernancePanel } from "@/components/milestones/MilestoneGovernancePanel";
import { MilestoneEvidenceUploader } from "@/components/milestones/MilestoneEvidenceUploader";
import { useBuildOpsSSE } from "@/hooks/useBuildOpsSSE";

type MilestoneRecord = {
  id: string;
  title: string;
  amount?: number;
  status?: string;
  sequence?: number;
  jobId?: string;
};

export default function ClientMilestonesPage() {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [groups, setGroups] = useState<Array<{
    jobId: string;
    jobTitle: string;
    totalBudget: number;
    milestones: MilestoneRecord[];
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch evidence items and payment readiness for a milestone
  const fetchMilestoneDetail = useCallback(async (milestoneId: string) => {
    try {
      const [evRes, prRes] = await Promise.all([
        fetch(`/api/semse/milestones/${milestoneId}/evidence-items`),
        fetch(`/api/semse/milestones/${milestoneId}/payment-readiness`),
      ]);
      const evData   = evRes.ok   ? await evRes.json()   : null;
      const prData   = prRes.ok   ? await prRes.json()   : null;
      return {
        evidenceItems:   evData?.data   ?? [],
        paymentReadiness: prData?.data?.status,
      };
    } catch { return { evidenceItems: [], paymentReadiness: undefined }; }
  }, []);

  const [milestoneDetails, setMilestoneDetails] = useState<Record<string, {
    evidenceItems: any[];
    paymentReadiness?: string;
    loading: boolean;
  }>>({});

  // Governance refresh key: increment to force MilestoneGovernancePanel to re-fetch
  const [governanceRefreshKeys, setGovernanceRefreshKeys] = useState<Record<string, number>>({});
  const refreshGovernance = (milestoneId: string) => {
    setGovernanceRefreshKeys((k) => ({ ...k, [milestoneId]: (k[milestoneId] ?? 0) + 1 }));
    // Also invalidate milestone detail so evidence counts update
    setMilestoneDetails((prev) => { const next = { ...prev }; delete next[milestoneId]; return next; });
  };

  // SSE: auto-refresh governance when evidence or change orders change on server
  useBuildOpsSSE({
    onEvent: (evt) => {
      if (evt.type === "evidence-item:updated" || evt.type === "evidence-item:reviewed") {
        refreshGovernance(evt.milestoneId);
      }
      if ((evt.type === "change-order:updated" || evt.type === "change-order:applied") && evt.milestoneId) {
        refreshGovernance(evt.milestoneId);
      }
    },
  });

  const loadMilestoneDetail = useCallback(async (milestoneId: string) => {
    let shouldLoad = false;
    setMilestoneDetails(prev => {
      if (prev[milestoneId]) return prev;
      shouldLoad = true;
      return { ...prev, [milestoneId]: { evidenceItems: [], loading: true } };
    });
    if (!shouldLoad) return;
    const detail = await fetchMilestoneDetail(milestoneId);
    setMilestoneDetails(prev => ({ ...prev, [milestoneId]: { ...detail, loading: false } }));
  }, [fetchMilestoneDetail]);

  const openMilestoneIds = useMemo(() => groups.flatMap(group =>
    (expanded[group.jobId] ?? true) ? group.milestones.map(milestone => milestone.id) : []
  ), [groups, expanded]);

  useEffect(() => {
    openMilestoneIds.forEach((milestoneId) => {
      if (!milestoneDetails[milestoneId]) void loadMilestoneDetail(milestoneId);
    });
  }, [openMilestoneIds, milestoneDetails, loadMilestoneDetail]);

  async function handleTrackerAction(milestoneId: string, action: "submit" | "approve" | "reject" | "request-changes", payload?: { comment?: string }) {
    try {
      await mutateMilestone(milestoneId, action as any, payload?.comment ? { reason: payload.comment } : undefined);
      await loadMilestones();
      // Reload detail
      setMilestoneDetails(prev => { const next = { ...prev }; delete next[milestoneId]; return next; });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el milestone.");
    }
  }

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden",
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <ClientPageHeader
        title={t("page.clientMilestones")}
        subtitle="Hitos de pago por proyecto: revisa entregas, aprueba avance y destraba liberaciones."
        breadcrumbs={[{ label: t("page.clientMilestones") }]}
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
          const done   = group.milestones.filter(m => m.status === "APPROVED" || m.status === "PAID").length;
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

              {/* Milestones — use MilestoneTrackerCard for evidence + approval flow */}
              {isOpen && (
                <div style={{ padding: "8px 12px", display: "grid", gap: "8px" }}>
                  {group.milestones.map((m, i) => {
                    const detail = milestoneDetails[m.id];
                    const showGovernance = ["SUBMITTED", "AWAITING_REVIEW", "APPROVED"].includes(m.status ?? "");
                    const showUploader   = ["SUBMITTED", "AWAITING_REVIEW", "DRAFT"].includes(m.status ?? "");
                    const governanceKey  = governanceRefreshKeys[m.id] ?? 0;

                    return (
                      <div key={m.id} style={{ display: "grid", gap: "8px" }}>
                        <MilestoneTrackerCard
                          milestone={{
                            id:              m.id,
                            title:           m.title,
                            amount:          m.amount ?? 0,
                            sequence:        m.sequence ?? (i + 1),
                            status:          (m.status ?? "DRAFT") as any,
                            paymentReadiness: detail?.paymentReadiness as any,
                            evidenceItems:   detail?.evidenceItems ?? [],
                          }}
                          role="client"
                          onAction={handleTrackerAction}
                        />
                        {/* Evidence uploader — visible when milestone has pending/missing evidence */}
                        {showUploader && (
                          <MilestoneEvidenceUploader
                            milestoneId={m.id}
                            onUploaded={() => refreshGovernance(m.id)}
                          />
                        )}
                        {/* Governance panel — re-mounts when governanceKey changes */}
                        {showGovernance && (
                          <MilestoneGovernancePanel
                            key={`gov-${m.id}-${governanceKey}`}
                            milestoneId={m.id}
                          />
                        )}
                      </div>
                    );
                  })}
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

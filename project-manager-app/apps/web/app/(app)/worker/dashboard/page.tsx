"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Camera,
  CheckSquare,
  Clock,
  DollarSign,
  Package,
  Search,
  Star,
  Wallet,
  Wrench,
} from "lucide-react";
import { EmptyState, ErrorState, HtmlInCanvasPanel, JobCard, StatCard } from "@semse/ui";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { WorkerEvidenceSummary } from "../../../../components/semse/WorkerEvidenceSummary";
import type { Job, JobRecordView } from "@semse/schemas";
import { useLanguage, type LanguagePreference } from "../../../../lib/language-context";
import { fetchRatings, fetchMyBids, normalizeErrorMessage, type RatingListItem, type MyBidView } from "../../../semse-api";

function formatMoney(value: number, language: LanguagePreference) {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "es-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function toUiJob(record: JobRecordView): Job {
  return {
    id: record.id,
    title: record.title,
    description: record.scope,
    scope: record.scope,
    budget: {
      min: record.budgetMin ?? record.budgetMax ?? 0,
      max: record.budgetMax,
      type: record.budgetMax ? "range" : "fixed",
    },
    location: {
      type: "remote",
    },
    status: record.status === "published" || record.status === "awarded" ? "posted" : record.status,
    clientId: record.tenantId,
    tenantId: record.tenantId,
    createdAt: new Date(),
    attachments: [],
    proposals: [],
  };
}

function bidToUiJob(bid: MyBidView): Job {
  return {
    id: bid.jobId,
    title: bid.jobTitle,
    description: bid.jobCategory ?? "",
    scope: bid.jobCategory ?? "",
    budget: {
      min: bid.amount,
      max: undefined,
      type: "fixed" as const,
    },
    location: { type: "remote" as const },
    status: (bid.jobStatus === "published" || bid.jobStatus === "awarded" ? "posted" : bid.jobStatus) as Job["status"],
    clientId: "",
    tenantId: "",
    createdAt: new Date(),
    attachments: [],
    proposals: [],
  };
}

const TRUST_TIER: Record<string, { label: string; color: string }> = {
  emerging:    { label: "Emergente",    color: "#64748b" },
  growing:     { label: "En crecimiento", color: "var(--brand)" },
  established: { label: "Establecido", color: "var(--violet)" },
  trusted:     { label: "De confianza", color: "var(--ok)" },
};

function reputationTier(totalRatings: number, avg: number): string {
  if (totalRatings === 0) return "emerging";
  if (totalRatings < 5 || avg < 3.5) return "emerging";
  if (totalRatings < 10 || avg < 4.0) return "growing";
  if (totalRatings < 25 || avg < 4.5) return "established";
  return "trusted";
}

export default function WorkerDashboardPage() {
  const { t, language } = useLanguage();
  const [jobs, setJobs] = useState<JobRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [receivedRatings, setReceivedRatings] = useState<RatingListItem[]>([]);
  const [myBids, setMyBids] = useState<MyBidView[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/semse/jobs")
        .then((r) => r.json())
        .then((payload: { data?: JobRecordView[]; error?: unknown }) => {
          if (payload.error) {
            setApiError(normalizeErrorMessage(payload.error) ?? t("clientDash.jobsLoadError"));
            return;
          }
          setJobs(payload.data ?? []);
        })
        .catch(() => setApiError(t("clientDash.connectionError"))),
      fetchRatings()
        .then(({ actorUserId, items }) => {
          setReceivedRatings(items.filter((r) => r.toUser.id === actorUserId));
        })
        .catch(() => undefined),
      fetchMyBids().then(setMyBids).catch(() => undefined),
    ]).finally(() => setLoading(false));
  }, [t]);

  const metrics = useMemo(() => {
    const acceptedBids = myBids.filter((b) => b.status === "accepted");
    const active = acceptedBids.filter((b) => ["in_progress", "reserved", "accepted", "review"].includes(b.jobStatus));
    const completed = acceptedBids.filter((b) => b.jobStatus === "completed");
    const review = acceptedBids.filter((b) => b.jobStatus === "review");
    const disputes = acceptedBids.filter((b) => b.jobStatus === "dispute");
    const opportunities = jobs.filter((job) => ["posted", "published"].includes(job.status));
    const activeBudget = active.reduce((total, b) => total + (b.amount ?? 0), 0);
    const completionRate = acceptedBids.length > 0 ? Math.round((completed.length / acceptedBids.length) * 100) : 0;
    const reviewRate = active.length > 0 ? Math.round((review.length / active.length) * 100) : 0;

    return {
      active,
      completed,
      review,
      disputes,
      opportunities,
      activeBudget,
      completionRate,
      reviewRate,
    };
  }, [myBids, jobs]);

  return (
    <div style={{ maxWidth: "1120px", margin: "0 auto", display: "grid", gap: "28px" }}>
      <HtmlInCanvasPanel
        as="section"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
        canvasClassName="rounded-2xl"
        minHeight={96}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{t("workerDash.title")} </h1>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>{t("workerDash.subtitle")} </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <NotificationBanner audience="worker" />
          <Link
            href="/worker/jobs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              textDecoration: "none",
              background: "var(--surface)",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <Briefcase size={15} />{t("workerDash.myJobs")} </Link>
          <Link
            href="/worker/evidence"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 16px",
              borderRadius: "10px",
              color: "#fff",
              textDecoration: "none",
              background: "linear-gradient(135deg, var(--brand), var(--brand-dark))",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <Camera size={15} />{t("workerDash.uploadEvidence")} </Link>
          <Link
            href="/worker/travel"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(124,58,237,.22)",
              color: "#c4b5fd",
              textDecoration: "none",
              background: "rgba(124,58,237,.1)",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <Wallet size={15} />{t("workerDash.travelLodging")} </Link>
          <Link
            href="/worker/disputes?status=open"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(239,68,68,.22)",
              color: "var(--error)",
              textDecoration: "none",
              background: "rgba(239,68,68,.08)",
              fontSize: "13px",
              fontWeight: 700,
            }}
          >
            <AlertTriangle size={15} />{t("workerDash.disputes")} </Link>
        </div>
      </HtmlInCanvasPanel>

      {/* Evidence pending summary */}
      <WorkerEvidenceSummary />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
        <Link href="/worker/jobs?tab=Activos" className="card-lift" style={{ textDecoration: "none", display: "block", borderRadius: "16px" }}>
          <StatCard label={t("workerDash.activeJobs")} value={loading ? "—" : metrics.active.length} icon={Briefcase} color="blue" loading={loading} />
        </Link>
        <Link href="/worker/jobs?tab=Completados" className="card-lift" style={{ textDecoration: "none", display: "block", borderRadius: "16px" }}>
          <StatCard label={t("workerDash.completed")} value={loading ? "—" : metrics.completed.length} icon={CheckSquare} color="green" loading={loading} />
        </Link>
        <Link href="/worker/jobs?tab=Activos" className="card-lift" style={{ textDecoration: "none", display: "block", borderRadius: "16px" }}>
          <StatCard label={t("workerDash.inReview")} value={loading ? "—" : metrics.review.length} icon={Star} color="amber" loading={loading} />
        </Link>
        <Link href="/worker/disputes?status=open" className="card-lift" style={{ textDecoration: "none", display: "block", borderRadius: "16px" }}>
          <StatCard label={t("workerDash.openDisputes")} value={loading ? "—" : metrics.disputes.length} icon={AlertTriangle} color="red" loading={loading} />
        </Link>
        <Link href="/worker/payments" className="card-lift" style={{ textDecoration: "none", display: "block", borderRadius: "16px" }}>
          <StatCard label={t("workerDash.activeBudget")} value={loading ? "—" : metrics.activeBudget > 0 ? formatMoney(metrics.activeBudget, language) : "—"} icon={DollarSign} color="orange" loading={loading} />
        </Link>
        <Link href="/worker/travel" className="card-lift" style={{ textDecoration: "none", display: "block", borderRadius: "16px" }}>
          <StatCard label={t("workerDash.travelExpenses")} value={loading ? "—" : t("workerDash.open")} icon={Wallet} color="violet" loading={loading} />
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        <HtmlInCanvasPanel
          as="section"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "18px",
          }}
          canvasClassName="rounded-2xl"
          minHeight={260}
        >
          <div style={{ marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>{t("workerDash.summary")} </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{t("workerDash.summaryDescription")} </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
            {[
              {
                label: t("workerDash.openOpportunities"),
                value: metrics.opportunities.length,
                tone: "rgba(59,130,246,.12)",
                color: "#60a5fa",
              },
              {
                label: t("workerDash.acceptedReserved"),
                // Was reading job.status (a bid, always "accepted" here since
                // `active` is already pre-filtered to accepted bids) instead
                // of job.jobStatus (the real job lifecycle status) — the KPI
                // was structurally identical to "Trabajos activos" (2.29 in
                // docs/AUDIT_REMEDIATION_PLAN.md).
                value: metrics.active.filter((job) => ["accepted", "reserved"].includes(job.jobStatus)).length,
                tone: "rgba(16,185,129,.12)",
                color: "#34d399",
              },
              {
                label: t("workerDash.completionRate"),
                value: `${metrics.completionRate}%`,
                tone: "rgba(249,115,22,.12)",
                color: "#fb923c",
              },
              {
                label: t("workerDash.reviewLoad"),
                value: `${metrics.reviewRate}%`,
                tone: "rgba(245,158,11,.12)",
                color: "#fbbf24",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: "12px",
                  padding: "14px",
                  background: item.tone,
                  border: "1px solid color-mix(in srgb, white 10%, transparent)",
                }}
              >
                <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                  {item.label}
                </p>
                <p style={{ fontSize: "24px", fontWeight: 800, color: item.color, marginTop: "8px" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </HtmlInCanvasPanel>

        <HtmlInCanvasPanel
          as="section"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "18px",
          }}
          canvasClassName="rounded-2xl"
          minHeight={260}
        >
          <div style={{ marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>{t("workerDash.quickActions")} </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{t("workerDash.quickActionsDesc")} </p>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {[
              { href: "/worker/tracker", label: t("workerDash.trackHours"), description: t("workerDash.trackHoursDesc"), icon: Clock, color: "var(--info)" },
              { href: "/worker/evidence", label: t("workerDash.uploadEvidence"), description: t("workerDash.uploadEvidenceDesc"), icon: Camera, color: "var(--ok)" },
              { href: "/worker/materials", label: t("workerDash.materials"), description: t("workerDash.materialsDesc"), icon: Package, color: "var(--warn)" },
              { href: "/worker/incidents", label: t("workerDash.incidents"), description: t("workerDash.incidentsDesc"), icon: AlertTriangle, color: "var(--error)" },
              { href: "/worker/payments", label: t("workerDash.myPayments"), description: t("workerDash.myPaymentsDesc"), icon: Wallet, color: "var(--accent)" },
              { href: "/worker/field-ops", label: t("nav.fieldOps"), description: t("dash.fieldOpsDesc"), icon: Wrench, color: "#a78bfa" },
              { href: "/worker/review", label: t("workerDash.rateClients"), description: t("workerDash.rateClientsDesc"), icon: Star, color: "#fbbf24" },
              { href: "/worker/opportunities", label: t("workerDash.viewOpportunities"), description: t("workerDash.viewOpportunitiesDesc"), icon: Briefcase, color: "#6366f1" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "#0d1220",
                    textDecoration: "none",
                    color: "var(--ink)",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `${action.color}18`,
                      color: action.color,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{action.label}</p>
                    <p style={{ fontSize: "12px", color: "var(--muted)" }}>{action.description}</p>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        </HtmlInCanvasPanel>
      </div>

      {/* Reputation widget */}
      {!loading && (() => {
        const avgScore = receivedRatings.length > 0
          ? receivedRatings.reduce((s, r) => s + r.score, 0) / receivedRatings.length
          : 0;
        const tier = reputationTier(receivedRatings.length, avgScore);
        const tierMeta = TRUST_TIER[tier] ?? TRUST_TIER.emerging!;
        return (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>{t("workerDash.reputation")} </h2>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{t("workerDash.reputationDesc")} </p>
              </div>
              <Link href="/worker/review" style={{ fontSize: "12px", color: "var(--brand)", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>{t("workerDash.reviews")} <ArrowRight size={13} />
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
              <div style={{ background: "var(--raised)", borderRadius: "12px", padding: "14px 12px", textAlign: "center" }}>
                <div style={{ display: "flex", gap: "2px", justifyContent: "center", marginBottom: "6px" }}>
                  {[1,2,3,4,5].map((n) => (
                    <Star key={n} size={14} fill={n <= Math.round(avgScore) ? "#fbbf24" : "none"} color={n <= Math.round(avgScore) ? "#fbbf24" : "var(--border)"} />
                  ))}
                </div>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", margin: "0 0 2px" }}>
                  {receivedRatings.length === 0 ? "—" : avgScore.toFixed(1)}
                </p>
                <p style={{ fontSize: "11px", color: "var(--muted)" }}>{t("workerDash.average")} </p>
              </div>
              <div style={{ background: "var(--raised)", borderRadius: "12px", padding: "14px 12px", textAlign: "center" }}>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", margin: "0 0 2px" }}>{receivedRatings.length}</p>
                <p style={{ fontSize: "11px", color: "var(--muted)" }}>{t("workerDash.receivedReviews")} </p>
              </div>
              <div style={{ background: "var(--raised)", borderRadius: "12px", padding: "14px 12px", textAlign: "center" }}>
                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: "11px", fontWeight: 700, background: `${tierMeta.color}22`, color: tierMeta.color, border: `1px solid ${tierMeta.color}44`, marginBottom: "6px" }}>
                  {t(`workerDash.tier.${tier}`)}
                </span>
                <p style={{ fontSize: "11px", color: "var(--muted)" }}>{t("workerDash.trustLevel")} </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mis propuestas */}
      {!loading && myBids.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>{t("workerDash.myBids")} </h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{t("workerDash.myBidsDesc")} </p>
            </div>
            <Link href="/worker/bids" style={{ fontSize: "12px", color: "var(--brand)", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>{t("workerDash.viewAll")} <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myBids.slice(0, 5).map(bid => {
              const BID_STATUS: Record<string, { label: string; color: string; bg: string }> = {
                submitted: { label: "Enviada",   color: "var(--brand)", bg: "rgba(59,130,246,.1)" },
                accepted:  { label: "Aceptada",  color: "var(--ok)", bg: "rgba(16,185,129,.1)" },
                rejected:  { label: "Rechazada", color: "var(--error)", bg: "rgba(239,68,68,.1)"  },
              };
              const s = BID_STATUS[bid.status] ?? BID_STATUS["submitted"]!;
              const amt = new Intl.NumberFormat(language === "en" ? "en-US" : "es-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(bid.amount);
              return (
                <div key={bid.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--raised)", borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bid.jobTitle}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>{amt} · {bid.etaDays} {t("workerDash.days")}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{t(`workerDash.bid.${BID_STATUS[bid.status] ? bid.status : "submitted"}`)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>{t("workerDash.activeWork")} </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{t("workerDash.activeWorkDesc")} </p>
          </div>
          <Link
            href="/worker/jobs"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--brand)", textDecoration: "none", fontWeight: 700 }}
          >{t("workerDash.viewAllJobs")} <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {[1, 2, 3].map((item) => (
              <div key={item} style={{ height: "190px", borderRadius: "16px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : apiError ? (
          <ErrorState message={apiError} />
        ) : metrics.active.length === 0 ? (
          <EmptyState
            title={t("workerDash.noActiveJobs")}
            description={t("workerDash.noActiveJobsDesc")}
            icon={Briefcase}
            action={
              <Link
                href="/worker/opportunities"
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", borderRadius: "9px", background: "var(--brand)", textDecoration: "none", color: "#fff", fontSize: "13px", fontWeight: 700 }}
              >{t("workerDash.viewOpportunitiesArrow")} </Link>
            }
          />
        ) : (
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {metrics.active.slice(0, 4).map((bid) => (
              <Link key={bid.id} href={`/worker/jobs/${bid.jobId}`} style={{ textDecoration: "none" }}>
                <JobCard
                  job={bidToUiJob(bid)}
                  compact
                  footer={
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>{t("workerDash.openDetail")} </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--brand)", fontSize: "12px", fontWeight: 700 }}>{t("workerDash.viewJob")} <ArrowRight size={12} />
                      </span>
                    </div>
                  }
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>{t("workerDash.openOpportunities")} </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>{t("workerDash.opportunitiesDesc")} </p>
          </div>
          <Link
            href="/worker/jobs"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--brand)", textDecoration: "none", fontWeight: 700 }}
          >{t("workerDash.explore")} <Search size={13} />
          </Link>
        </div>

        {loading ? null : metrics.opportunities.length === 0 ? (
          <EmptyState
            title={t("workerDash.noOpportunities")}
            description={t("workerDash.noOpportunitiesDesc")}
            image="/brand/empty-states/worker-opportunities.png"
          />
        ) : (
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {metrics.opportunities.slice(0, 3).map((job) => (
              <Link key={job.id} href={`/worker/jobs/${job.id}`} style={{ textDecoration: "none" }}>
                <JobCard job={toUiJob(job)} compact />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

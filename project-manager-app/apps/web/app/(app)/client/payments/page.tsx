"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DollarSign, Lock, CheckCircle, Clock, Plus, ChevronRight, RefreshCw, Inbox, AlertTriangle, Scale } from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import Link from "next/link";
import { fetchJobPaymentReadiness, fetchJobPayments, fetchJobs, fetchJobMilestones, mutateMilestone, releaseMilestoneEscrow, fetchDisputes, fetchPaymentProviderReadiness, type PaymentProviderReadiness } from "../../../semse-api";
import { EscrowFundModal } from "../../../components/payments/EscrowFundModal";
import type { JobRecordView } from "@semse/schemas";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { CLIENT_ROUTES } from "../../../lib/client-routes";

type PaymentRow = {
  id: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  jobId: string;
};

type MilestoneRow = {
  id: string;
  title: string;
  amount: number;
  status: string;
  jobId: string;
  jobTitle: string;
};

type PaymentReadiness = {
  jobId: string;
  ready: boolean;
  checks: {
    acceptedReservation: boolean;
    activeContract: boolean;
    signedClient: boolean;
    signedProfessional: boolean;
    projectLinked: boolean;
  };
  reasons: string[];
  reservationId?: string | null;
  contractId?: string | null;
};

const TYPE_CONFIG: Record<string, { variant: "success" | "warning" | "info" | "neutral"; label: string; color: string }> = {
  DEPOSIT:  { variant: "info",    label: "Escrow",     color: "var(--brand)" },
  RELEASE:  { variant: "success", label: "Liberado",   color: "#10b981" },
  HOLDBACK: { variant: "warning", label: "Retención",  color: "#f59e0b" },
  FEE:      { variant: "neutral", label: "Fee",        color: "#8b5cf6" },
  REFUND:   { variant: "warning", label: "Reembolso",  color: "#f59e0b" },
};

function displayText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export default function ClientPaymentsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTabParam = searchParams?.get("tab");
  const initialTab: "todos" | "escrow" | "pagados" =
    initialTabParam === "escrow" || initialTabParam === "pagados" ? initialTabParam : "todos";
  const initialJobId = searchParams?.get("jobId") ?? "";

  const [tab, setTab]                   = useState<"todos" | "escrow" | "pagados">(initialTab);
  const [transactions, setTransactions] = useState<PaymentRow[]>([]);
  const [milestones, setMilestones]     = useState<MilestoneRow[]>([]);
  const [jobs, setAllJobs]              = useState<JobRecordView[]>([]);
  const [readinessByJob, setReadinessByJob] = useState<Record<string, PaymentReadiness | null>>({});
  const [jobsLoading, setJobsLoading]   = useState(true);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [fundModal, setFundModal]       = useState<{ jobId: string; jobTitle: string; amount?: number } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId);
  const [releasing, setReleasing]       = useState<string | null>(null);
  const [disputedJobIds, setDisputedJobIds] = useState<Set<string>>(new Set());
  const [paymentReadiness, setPaymentReadiness] = useState<PaymentProviderReadiness | null>(null);

  useEffect(() => {
    const nextTabParam = searchParams?.get("tab");
    const nextTab: "todos" | "escrow" | "pagados" =
      nextTabParam === "escrow" || nextTabParam === "pagados" ? nextTabParam : "todos";
    const nextJobId = searchParams?.get("jobId") ?? "";
    if (nextTab !== tab) setTab(nextTab);
    if (nextJobId !== selectedJobId) setSelectedJobId(nextJobId);
  }, [searchParams, tab, selectedJobId]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (tab === "todos") params.delete("tab");
    else params.set("tab", tab);
    if (selectedJobId) params.set("jobId", selectedJobId);
    else params.delete("jobId");
    const next = params.toString();
    const current = searchParams?.toString() ?? "";
    if (next !== current) {
      router.replace(next ? `${pathname ?? ""}?${next}` : (pathname ?? ""), { scroll: false });
    }
  }, [pathname, router, searchParams, selectedJobId, tab]);

  const load = useCallback(async () => {
    setJobsLoading(true);
    setLoading(true);
    setError(null);
    try {
      const [jobs, disputes] = await Promise.all([fetchJobs(), fetchDisputes().catch(() => [])]);
      setAllJobs(jobs);
      setDisputedJobIds(new Set(
        disputes.map(d => String((d as Record<string, unknown>).jobId ?? "")).filter(Boolean)
      ));
      if (selectedJobId && !jobs.some((job) => job.id === selectedJobId)) {
        setSelectedJobId("");
      }
      setJobsLoading(false);
      // Default to the most recent jobs to keep the payments surface fast and
      // avoid rate-limiting bursts on accounts with deep history. Once the user
      // scopes to a job we load that exact job in full.
      const jobsToLoad = selectedJobId
        ? jobs.filter((job) => job.id === selectedJobId)
        : jobs.slice(0, 3);
      const transactions: PaymentRow[] = [];
      const milestoneRows: MilestoneRow[] = [];
      const readinessRows: Record<string, PaymentReadiness | null> = {};

      // Load job payment data sequentially to avoid rate-limit bursts when the
      // account accumulates many historical jobs.
      for (const job of jobsToLoad) {
        const jobTitle = displayText((job as Record<string, unknown>).title, "Trabajo");
        try {
          const payments = await fetchJobPayments(job.id);
          for (const payment of payments) {
            const row = payment as Record<string, unknown>;
            const type = typeof row.type === "string" ? row.type : "DEPOSIT";
            transactions.push({
              id: String(row.id),
              description: `${type === "DEPOSIT" ? "Escrow depositado" : type === "RELEASE" ? "Liberación" : type === "REFUND" ? "Reembolso" : type} – ${jobTitle}`,
              amount: typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0),
              type,
              status: typeof row.status === "string" ? row.status : "PENDING",
              date: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
              jobId: job.id,
            });
          }
        } catch {
          // Some historical jobs may not have payment records yet.
        }

        try {
          const milestones = await fetchJobMilestones(job.id);
          for (const milestone of milestones) {
            const row = milestone as Record<string, unknown>;
            milestoneRows.push({
              id: String(row.id),
              title: String(row.title ?? "Milestone"),
              amount: typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0),
              status: String(row.status ?? "PENDING"),
              jobId: job.id,
              jobTitle: job.title,
            });
          }
        } catch {
          // Missing milestone history should not break the payments page.
        }

        try {
          readinessRows[job.id] = (await fetchJobPaymentReadiness(job.id)) as PaymentReadiness;
        } catch {
          readinessRows[job.id] = null;
        }
      }

      setTransactions(
        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
      setMilestones(milestoneRows);
      setReadinessByJob((current) => ({ ...current, ...readinessRows }));
    } catch (caught) {
      setJobsLoading(false);
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los pagos.");
    } finally {
      setLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void fetchPaymentProviderReadiness().then(setPaymentReadiness).catch(() => undefined);
  }, []);

  async function handleRelease(milestoneId: string) {
    setReleasing(milestoneId);
    try {
      const milestone = milestones.find((item) => item.id === milestoneId);
      const status = milestone?.status?.toUpperCase();
      if (status && status !== "APPROVED" && status !== "PAID") {
        await mutateMilestone(milestoneId, "approve");
      }
      await releaseMilestoneEscrow(milestoneId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo aprobar y liberar el milestone.");
    }
    setReleasing(null);
  }

  const scopedTransactions = useMemo(
    () => selectedJobId ? transactions.filter(t => t.jobId === selectedJobId) : transactions,
    [selectedJobId, transactions]
  );
  const scopedMilestones = useMemo(
    () => selectedJobId ? milestones.filter(m => m.jobId === selectedJobId) : milestones,
    [selectedJobId, milestones]
  );

  const totalEscrow    = scopedTransactions.filter(t => t.type === "DEPOSIT" && t.status === "PENDING").reduce((a, t) => a + t.amount, 0);
  const totalSpent     = scopedTransactions.filter(t => t.type === "RELEASE" && t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const activeProjects = useMemo(() => new Set(scopedTransactions.map(t => t.jobId)).size, [scopedTransactions]);

  const pendingMilestones = scopedMilestones.filter((m) => {
    const status = m.status.toUpperCase();
    return status === "SUBMITTED" || status === "AWAITING_REVIEW" || status === "APPROVED";
  });

  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) ?? null : null;
  const selectedReadiness = selectedJobId ? readinessByJob[selectedJobId] ?? null : null;
  // null = readiness endpoint no disponible → no bloqueamos (la API rechazará si no cumple condiciones)
  const canFundSelectedJob = selectedReadiness === null ? true : Boolean(selectedReadiness.ready);

  const allFiltered    = scopedTransactions;
  const escrowFiltered = scopedTransactions.filter(t => t.type === "DEPOSIT");
  const paidFiltered   = scopedTransactions.filter(t => t.type === "RELEASE" || t.type === "REFUND");

  const filtered = tab === "escrow" ? escrowFiltered : tab === "pagados" ? paidFiltered : allFiltered;

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };

  function openFundModal() {
    const job = selectedJobId ? jobs.find(j => j.id === selectedJobId) : jobs[0];
    if (job) setFundModal({ jobId: job.id, jobTitle: job.title, amount: job.budgetMin ?? undefined });
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <ClientPageHeader
        title={t("page.clientPayments")}
        subtitle="Escrow activo, readiness y transacciones por proyecto"
        breadcrumbs={[{ label: t("page.clientPayments") }]}
        minHeight={92}
        actions={
          <>
            <NotificationBanner audience="client" />
            {(jobsLoading || jobs.length > 0) && (
              <div style={{ display: "flex", gap: "0", borderRadius: "8px", overflow: "hidden" }}>
                <select
                  data-testid="client-payments-job-filter"
                  value={selectedJobId}
                  disabled={jobsLoading}
                  onChange={e => setSelectedJobId(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px 0 0 8px", border: "1px solid var(--brand)", borderRight: "none", background: "var(--surface)", color: jobsLoading ? "var(--muted)" : "var(--ink)", fontSize: "13px", cursor: jobsLoading ? "wait" : "pointer", maxWidth: "190px" }}
                >
                  {jobsLoading ? (
                    <option value="">Cargando proyectos...</option>
                  ) : (
                    <option value="">Todos los proyectos</option>
                  )}
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
                <button
                  data-testid="client-payments-fund-button"
                  onClick={openFundModal}
                  disabled={jobsLoading || jobs.length === 0 || (Boolean(selectedJobId) && !canFundSelectedJob)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "0 8px 8px 0", border: "none", background: jobsLoading || jobs.length === 0 || (Boolean(selectedJobId) && !canFundSelectedJob) ? "var(--muted)" : "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: jobsLoading || jobs.length === 0 || (Boolean(selectedJobId) && !canFundSelectedJob) ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                >
                  <DollarSign size={13} /> Fondear escrow
                </button>
              </div>
            )}
            <button
              data-testid="client-payments-refresh-button"
              onClick={() => void load()}
              disabled={loading}
              style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}
              title="Recargar"
            >
              <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
            <Link
              href={CLIENT_ROUTES.newJob}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}
            >
              <Plus size={13} /> Publicar trabajo
            </Link>
          </>
        }
      />

      {fundModal && (
        <EscrowFundModal
          jobId={fundModal.jobId}
          jobTitle={fundModal.jobTitle}
          suggestedAmount={fundModal.amount}
          onClose={() => setFundModal(null)}
          onSuccess={() => { setFundModal(null); void load(); }}
        />
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <StatCard label="En escrow"        value={`$${totalEscrow.toLocaleString()}`}  icon={Lock}        color="blue"   loading={loading} />
        <StatCard label="Total liberado"   value={`$${totalSpent.toLocaleString()}`}   icon={CheckCircle} color="green"  loading={loading} />
        <StatCard label="Proyectos activos" value={activeProjects}                     icon={Clock}       color="amber"  loading={loading} />
      </div>

      {paymentReadiness && (
        <HtmlInCanvasPanel as="section" style={{ ...card, padding: "14px 16px", marginBottom: "20px" }} canvasClassName="rounded-2xl" minHeight={72}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>Formas de fondear escrow</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                Provider por defecto: {paymentReadiness.configuredDefaultProvider} · modo {paymentReadiness.mode}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {paymentReadiness.rails.filter((rail) => rail.clientFunding).map((rail) => (
                <span key={rail.key} style={{ padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, color: rail.ready ? "#10b981" : "#f59e0b", background: rail.ready ? "rgba(16,185,129,.10)" : "rgba(245,158,11,.10)", border: `1px solid ${rail.ready ? "rgba(16,185,129,.25)" : "rgba(245,158,11,.25)"}` }}>
                  {rail.label}{rail.automatic ? "" : " · manual"}
                </span>
              ))}
            </div>
          </div>
        </HtmlInCanvasPanel>
      )}

      {selectedJobId && selectedJob && (
        <HtmlInCanvasPanel
          as="section"
          style={{
            ...card,
            padding: "16px 18px",
            marginBottom: "20px",
            borderColor: canFundSelectedJob ? "rgba(16,185,129,.25)" : "rgba(245,158,11,.3)",
            background: canFundSelectedJob ? "rgba(16,185,129,.05)" : "rgba(245,158,11,.06)"
          }}
          canvasClassName="rounded-2xl"
          minHeight={86}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            {canFundSelectedJob ? <CheckCircle size={18} color="#10b981" /> : <AlertTriangle size={18} color="#f59e0b" />}
            <div style={{ flex: 1 }}>
              <p data-testid="client-payments-readiness-title" style={{ fontSize: "13px", fontWeight: 800, color: canFundSelectedJob ? "#10b981" : "#f59e0b", marginBottom: "6px" }}>
                {canFundSelectedJob ? "Proyecto listo para fondear escrow" : "Precondiciones de pago pendientes"}
              </p>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "10px" }}>
                {selectedJob.title}
              </p>
              <div style={{ display: "grid", gap: "6px" }}>
                <p data-testid="client-payments-check-reservation" style={{ fontSize: "12px", color: selectedReadiness === null || selectedReadiness?.checks.acceptedReservation ? "#10b981" : "var(--muted)" }}>
                  {selectedReadiness === null || selectedReadiness?.checks.acceptedReservation ? "✓ Reserva aceptada" : "• Falta una reserva aceptada"}
                </p>

                <p data-testid="client-payments-check-contract" style={{ fontSize: "12px", color: selectedReadiness === null || selectedReadiness?.checks.activeContract ? "#10b981" : "var(--muted)" }}>
                  {selectedReadiness === null || selectedReadiness?.checks.activeContract ? "✓ Contrato activo" : "• Falta contrato activo"}
                </p>
                <p data-testid="client-payments-check-client-sign" style={{ fontSize: "12px", color: selectedReadiness === null || selectedReadiness?.checks.signedClient ? "#10b981" : "var(--muted)" }}>
                  {selectedReadiness === null || selectedReadiness?.checks.signedClient ? "✓ Firma del cliente registrada" : "• Falta firma del cliente"}
                </p>
                <p data-testid="client-payments-check-pro-sign" style={{ fontSize: "12px", color: selectedReadiness === null || selectedReadiness?.checks.signedProfessional ? "#10b981" : "var(--muted)" }}>
                  {selectedReadiness === null || selectedReadiness?.checks.signedProfessional ? "✓ Firma del profesional registrada" : "• Falta firma del profesional"}
                </p>
                {selectedReadiness === null && (
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                    • No pudimos validar readiness en este momento. La API confirmará las precondiciones al fondear.
                  </p>
                )}
                {!canFundSelectedJob && selectedReadiness && selectedReadiness.reasons.length > 0 && (
                  <div data-testid="client-payments-readiness-reasons" style={{ marginTop: "4px", display: "grid", gap: "4px" }}>
                    {selectedReadiness.reasons.map((reason) => (
                      <p key={reason} style={{ fontSize: "12px", color: "var(--muted)" }}>• {reason}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </HtmlInCanvasPanel>
      )}

      {/* Milestones pending release */}
      {pendingMilestones.length > 0 && (
        <HtmlInCanvasPanel as="section" style={{ ...card, padding: "16px 18px", marginBottom: "20px", borderColor: "rgba(16,185,129,.3)", background: "rgba(16,185,129,.05)" }} canvasClassName="rounded-2xl" minHeight={80}>
          <p data-testid="client-payments-milestones-title" style={{ fontSize: "12px", fontWeight: 700, color: "#10b981", marginBottom: "10px" }}>
            MILESTONES LISTOS PARA APROBAR ({pendingMilestones.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pendingMilestones.map(ms => (
              <div key={ms.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{ms.title}</p>
                  <p style={{ fontSize: "11px", color: "var(--muted)" }}>{ms.jobTitle}</p>
                </div>
                <p style={{ fontSize: "14px", fontWeight: 800, color: "#10b981", marginRight: "8px" }}>${ms.amount.toLocaleString()}</p>
                <button
                  data-testid={`client-payments-release-${ms.id}`}
                  onClick={() => void handleRelease(ms.id)}
                  disabled={releasing === ms.id}
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px", border: "none", background: releasing === ms.id ? "var(--muted)" : "#10b981", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: releasing === ms.id ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                >
                  {releasing === ms.id ? "Liberando..." : <><CheckCircle size={13} /> Aprobar y liberar</>}
                </button>
              </div>
            ))}
          </div>
        </HtmlInCanvasPanel>
      )}

      {/* Escrow notice */}
      {totalEscrow > 0 && (
        <HtmlInCanvasPanel as="section" style={{ ...card, padding: "14px 18px", marginBottom: "20px", background: "var(--brand)08", borderColor: "var(--brand)30", display: "flex", alignItems: "center", gap: "12px" }} canvasClassName="rounded-2xl" minHeight={66}>
          <Lock size={18} color="var(--brand)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.5 }}>
            <strong>${totalEscrow.toLocaleString()} retenidos en escrow</strong> — los fondos se liberan cuando apruebas cada milestone.
            Tu dinero está protegido hasta que valides el trabajo.
          </p>
        </HtmlInCanvasPanel>
      )}

      {/* Tabs with counts */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", marginBottom: "14px", width: "fit-content" }} canvasClassName="rounded-2xl" minHeight={48}>
        {([
          { key: "todos",   label: "Todos",   count: allFiltered.length },
          { key: "escrow",  label: "Escrow",  count: escrowFiltered.length },
          { key: "pagados", label: "Pagados", count: paidFiltered.length },
        ] as const).map(t => (
          <button
            data-testid={`client-payments-tab-${t.key}`}
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ padding: "6px 14px", borderRadius: "7px", border: "none", background: tab === t.key ? "var(--brand)" : "transparent", color: tab === t.key ? "#fff" : "var(--muted)", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ fontSize: "10px", fontWeight: 800, padding: "1px 6px", borderRadius: "10px", background: tab === t.key ? "rgba(255,255,255,.25)" : "var(--raised)" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </HtmlInCanvasPanel>

      {/* Transaction list */}
      <HtmlInCanvasPanel as="section" style={{ ...card, overflow: "hidden" }} canvasClassName="rounded-2xl" minHeight={360}>
        {loading ? (
          <div style={{ display: "grid", gap: "8px", padding: "16px" }}>
            {[1, 2, 3, 4].map(i => <div key={i} style={{ height: "60px", borderRadius: "10px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
          </div>
        ) : error ? (
          <div style={{ padding: "18px", color: "#ef4444", fontSize: "13px", background: "rgba(239,68,68,.08)" }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div data-testid="client-payments-empty" style={{ padding: "48px 24px", textAlign: "center" }}>
            <Inbox size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)" }}>Sin transacciones</p>
            <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "4px" }}>Fondea escrow para iniciar un proyecto.</p>
          </div>
        ) : filtered.map((t, i) => {
          const cfg = TYPE_CONFIG[t.type] ?? TYPE_CONFIG.DEPOSIT;
          const isRefund = t.amount < 0;
          const isDisputed = t.type === "DEPOSIT" && disputedJobIds.has(t.jobId);
          return (
            <div
              data-testid={`client-payments-row-${t.id}`}
              key={t.id}
              style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", background: isDisputed ? "rgba(239,68,68,.03)" : "transparent" }}
            >
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0, background: isDisputed ? "rgba(239,68,68,.12)" : `${cfg.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isDisputed ? <Scale size={16} color="#ef4444" /> : <DollarSign size={16} color={cfg.color} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</p>
                <p style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {new Date(t.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                {isDisputed ? (
                  <Link href="/client/disputes?status=open" style={{ fontSize: "11px", fontWeight: 800, color: "#ef4444", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px", padding: "4px 9px", borderRadius: "7px", border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.06)" }}>
                    <Scale size={10} /> En disputa
                  </Link>
                ) : (
                  <StatusBadge variant={cfg.variant} text={cfg.label} size="sm" />
                )}
                <p style={{ fontSize: "15px", fontWeight: 800, minWidth: "76px", textAlign: "right", color: isRefund ? "#10b981" : isDisputed ? "#ef4444" : t.type === "RELEASE" ? "var(--ink)" : "var(--brand)" }}>
                  {isRefund ? "+" : t.type === "DEPOSIT" ? "" : "-"}${Math.abs(t.amount).toLocaleString()}
                </p>
                {t.type === "DEPOSIT" && !isDisputed && (
                  <Link href={`/client/jobs/${t.jobId}`} style={{ color: "var(--muted)", display: "flex" }}>
                    <ChevronRight size={16} />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </HtmlInCanvasPanel>
    </div>
  );
}

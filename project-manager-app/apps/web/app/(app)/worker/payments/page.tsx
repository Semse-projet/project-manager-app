"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, Clock, CheckCircle, AlertTriangle, TrendingUp, Settings2, RefreshCw, Inbox, Scale } from "lucide-react";
import { HtmlInCanvasPanel, StatCard, StatusBadge } from "@semse/ui";
import { PayoutMethodForm, type PayoutMethod } from "../../../components/payments/PayoutMethodForm";
import { fetchJobs, fetchJobPayments, fetchDisputes } from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type PayRow = {
  id: string;
  description: string;
  amount: number;
  date: string;
  status: "released" | "in_escrow" | "pending";
  jobId: string;
};

const STATUS_CONFIG: Record<string, { variant: "success" | "warning" | "info"; label: string; icon: typeof CheckCircle }> = {
  released:  { variant: "success", label: "Liberado",  icon: CheckCircle   },
  in_escrow: { variant: "info",    label: "En escrow", icon: Clock         },
  pending:   { variant: "warning", label: "Pendiente", icon: AlertTriangle },
};

export default function WorkerPaymentsPage() {
  const [tab, setTab]             = useState<"todos" | "liberados" | "escrow">("todos");
  const [showPayout, setShowPayout] = useState(false);
  const [payments, setPayments]   = useState<PayRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [payoutSaved, setPayoutSaved] = useState(false);
  const [filterJobId, setFilterJobId] = useState<string>("");
  const [jobTitles, setJobTitles] = useState<{ id: string; title: string }[]>([]);
  const [currentMethod, setCurrentMethod] = useState<PayoutMethod | undefined>(undefined);
  const [disputedJobIds, setDisputedJobIds] = useState<Set<string>>(new Set());

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const [jobs, disputes] = await Promise.all([fetchJobs(), fetchDisputes().catch(() => [])]);
      const dJobIds = new Set<string>(
        disputes.map(d => String((d as Record<string, unknown>).jobId ?? "")).filter(Boolean)
      );
      setDisputedJobIds(dJobIds);
      setJobTitles(jobs.map(j => ({ id: j.id, title: j.title })));
      const rows: PayRow[] = [];
      for (const job of jobs) {
        const txns = await fetchJobPayments(job.id);
        for (const t of txns) {
          const row = t as Record<string, unknown>;
          const txType = String(row.type ?? "DEPOSIT");
          const status: PayRow["status"] =
            txType === "RELEASE" ? "released" :
            txType === "DEPOSIT" ? "in_escrow" : "pending";
          rows.push({
            id: String(row.id ?? Math.random()),
            description: `${job.title} – ${txType === "RELEASE" ? "Liberación" : txType === "DEPOSIT" ? "Escrow depositado" : txType}`,
            amount: typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0),
            date: typeof row.createdAt === "string" ? row.createdAt.slice(0, 10) : "—",
            status,
            jobId: job.id,
          });
        }
      }
      setPayments(rows);
    } catch {
      setPayments([]);
    }
    setLoading(false);
  }, []);

  const loadPayoutMethod = useCallback(async () => {
    try {
      const response = await fetch("/api/semse/workers/payout-method", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { data?: Record<string, unknown> | null };
      const row = payload.data;
      if (!row) return;
      const type = typeof row.type === "string" ? row.type : null;
      const label = typeof row.label === "string" ? row.label : null;
      if (!type || !label) return;
      setCurrentMethod({
        type: type as PayoutMethod["type"],
        label,
        bankName: typeof row.bankName === "string" ? row.bankName : undefined,
        last4: typeof row.last4 === "string" ? row.last4 : undefined,
        email: typeof row.email === "string" ? row.email : undefined,
        verified: Boolean(row.verified),
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadPayments();
    void loadPayoutMethod();
  }, [loadPayments, loadPayoutMethod]);

  const released  = payments.filter(p => p.status === "released");
  const inEscrow  = payments.filter(p => p.status === "in_escrow");
  const totalReleased = released.reduce((a, p) => a + p.amount, 0);
  const totalEscrow   = inEscrow.reduce((a, p) => a + p.amount, 0);
  const totalPending  = payments.filter(p => p.status === "pending").reduce((a, p) => a + p.amount, 0);

  const filtered = payments.filter(p => {
    if (filterJobId && p.jobId && p.jobId !== filterJobId) return false;
    if (tab === "liberados") return p.status === "released";
    if (tab === "escrow")    return p.status !== "released";
    return true;
  });

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <HtmlInCanvasPanel as="section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }} canvasClassName="rounded-2xl" minHeight={82}>
        <div>
          <Link href="/worker/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>Pagos</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Historial de pagos y fondos en escrow</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <NotificationBanner audience="worker" />
          <button
            data-testid="worker-payments-refresh-button"
            onClick={() => void loadPayments()}
            disabled={loading}
            style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}
            title="Recargar"
          >
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button
            data-testid="worker-payments-payout-toggle"
            onClick={() => setShowPayout(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          >
            <Settings2 size={14} />
            {payoutSaved ? "✓ Método guardado" : "Método de cobro"}
          </button>
        </div>
      </HtmlInCanvasPanel>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        <StatCard label="Total liberado"  value={`$${totalReleased.toLocaleString()}`} icon={CheckCircle}  color="green"  loading={loading} />
        <StatCard label="En escrow"       value={`$${totalEscrow.toLocaleString()}`}   icon={Clock}        color="blue"   loading={loading} />
        <StatCard label="Pendiente cobro" value={`$${totalPending.toLocaleString()}`}  icon={AlertTriangle} color="amber" loading={loading} />
        <StatCard label="Pagos recibidos" value={released.length}                      icon={TrendingUp}   color="violet" loading={loading} />
      </div>

      {/* Payout method panel */}
      {showPayout && (
        <HtmlInCanvasPanel as="section" style={{ ...card, padding: "22px", marginBottom: "20px" }} canvasClassName="rounded-2xl" minHeight={320}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>Configurar método de cobro</h2>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "20px" }}>Aquí se depositarán los pagos cuando el cliente apruebe un milestone</p>
          <PayoutMethodForm
            currentMethod={currentMethod}
            onSave={(method) => {
              setCurrentMethod(method);
              setPayoutSaved(true);
              setShowPayout(false);
              setTimeout(() => setPayoutSaved(false), 3000);
            }}
          />
        </HtmlInCanvasPanel>
      )}

      {/* Escrow notice */}
      {totalEscrow > 0 && (
        <HtmlInCanvasPanel as="section" style={{ ...card, padding: "14px 18px", marginBottom: "20px", background: "rgba(16,185,129,.07)", borderColor: "rgba(16,185,129,.25)", display: "flex", alignItems: "center", gap: "12px" }} canvasClassName="rounded-2xl" minHeight={66}>
          <ArrowDownLeft size={18} color="#10b981" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: 1.5 }}>
            <strong style={{ color: "#10b981" }}>${totalEscrow.toLocaleString()} en escrow</strong> — se liberan cuando el cliente aprueba cada milestone.
            Configura tu método de cobro para recibir los fondos automáticamente.
          </p>
        </HtmlInCanvasPanel>
      )}

      {/* Filters + Tabs row */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", width: "fit-content" }}>
          {(["todos", "liberados", "escrow"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 14px", borderRadius: "7px", border: "none",
              background: tab === t ? "var(--brand)" : "transparent",
              color: tab === t ? "#fff" : "var(--muted)",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}>
              {t === "todos" ? "Todos" : t === "liberados" ? "Liberados" : "En escrow"}
            </button>
          ))}
        </div>
        {jobTitles.length > 1 && (
          <select
            data-testid="worker-payments-job-filter"
            value={filterJobId}
            onChange={e => setFilterJobId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", cursor: "pointer" }}
          >
            <option value="">Todos los proyectos</option>
            {jobTitles.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        )}
      </div>

      {/* Payment list */}
      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={320}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1,2,3].map(i => <div key={i} style={{ height: "68px", borderRadius: "10px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div data-testid="worker-payments-empty" style={{ padding: "48px 24px", textAlign: "center" }}>
            <Inbox size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)" }}>Sin movimientos</p>
            <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "4px" }}>Los pagos aparecerán aquí cuando el cliente fondee el escrow.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtered.map(p => {
              const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
              const Icon = sc.icon;
              const isDisputed = p.status === "in_escrow" && disputedJobIds.has(p.jobId);
              return (
                <div data-testid={`worker-payments-row-${p.id}`} key={p.id} style={{ ...card, display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderColor: isDisputed ? "rgba(239,68,68,.28)" : "var(--border)", background: isDisputed ? "rgba(239,68,68,.03)" : "var(--surface)" }}>
                  <div style={{ width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isDisputed ? "rgba(239,68,68,.12)" : p.status === "released" ? "rgba(16,185,129,.12)" : p.status === "in_escrow" ? "rgba(59,130,246,.12)" : "rgba(251,191,36,.12)" }}>
                    {isDisputed ? <Scale size={16} color="#ef4444" /> : <Icon size={16} color={p.status === "released" ? "#10b981" : p.status === "in_escrow" ? "#3b82f6" : "#fbbf24"} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</p>
                    <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={10} /> {p.date}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
                    <p style={{ fontSize: "15px", fontWeight: 800, color: p.status === "released" ? "#10b981" : isDisputed ? "#ef4444" : "var(--ink)", margin: 0 }}>
                      ${p.amount.toLocaleString()}
                    </p>
                    {isDisputed ? (
                      <Link href="/worker/disputes?status=open" style={{ fontSize: "11px", fontWeight: 800, color: "#ef4444", textDecoration: "none", display: "flex", alignItems: "center", gap: "3px", padding: "3px 8px", borderRadius: "6px", border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.06)" }}>
                        <Scale size={10} /> En disputa
                      </Link>
                    ) : (
                      <StatusBadge variant={sc.variant} text={sc.label} size="sm" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HtmlInCanvasPanel>
    </div>
  );
}

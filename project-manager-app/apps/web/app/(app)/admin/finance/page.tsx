"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import {
  AlertTriangle, CheckCircle, Clock, DollarSign,
  FileText, Receipt, RefreshCw, TrendingDown,
} from "lucide-react";
import {
  approveExpense,
  fetchExpenses,
  fetchInvoices,
  fetchJobEscrow,
  fetchJobPayments,
  fetchJobs,
  markInvoicePaid,
  refundEscrow,
  rejectExpense,
  sendInvoice,
  type Invoice,
  type ProjectExpense,
} from "../../../semse-api";

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", sent: "#818cf8", viewed: "#a78bfa", approved: "#34d399",
  paid: "#10b981", overdue: "#f87171", cancelled: "#64748b",
  pending: "#fbbf24", rejected: "#f87171", reimbursed: "#34d399", archived: "#64748b",
  deposit: "#3b82f6", release: "#10b981", refund: "#fbbf24", active: "#3b82f6", funded: "#3b82f6", partial: "#a78bfa",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function Badge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#64748b";
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: `${color}22`, color, border: `1px solid ${color}44`,
    }}>
      {status.toUpperCase()}
    </span>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color = "#818cf8", alert = false }: {
  label: string; value: string; sub?: string; icon: typeof DollarSign; color?: string; alert?: boolean;
}) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16, padding: 18,
      border: `1px solid ${alert ? "rgba(248,113,113,.3)" : "var(--border)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}22`, display: "grid", placeItems: "center" }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: alert ? "#fca5a5" : "var(--ink)" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function smBtn(bg: string, color: string): React.CSSProperties {
  return { padding: "5px 12px", borderRadius: 8, border: "none", background: bg, color, fontWeight: 700, fontSize: 12, cursor: "pointer" };
}

type EscrowTxnRow = {
  id: string;
  jobId: string;
  jobTitle: string;
  type: string;
  status: string;
  amount: number;
  date: string;
};

type JobEscrowInfo = {
  jobId: string;
  jobTitle: string;
  escrowId: string;
  status: string;
  amount: number;
};

export default function AdminFinancePage() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"invoices" | "expenses" | "escrow">("invoices");
  const [statusFilter, setStatusFilter] = useState("all");
  const [escrowTxns, setEscrowTxns] = useState<EscrowTxnRow[]>([]);
  const [escrows, setEscrows] = useState<JobEscrowInfo[]>([]);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [escrowLoaded, setEscrowLoaded] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [inv, exp] = await Promise.all([fetchInvoices({ limit: 200 }), fetchExpenses({ limit: 500 })]);
      setInvoices(inv); setExpenses(exp);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }

  async function loadEscrow() {
    setEscrowLoading(true); setError(null);
    try {
      const jobs = await fetchJobs();
      const txns: EscrowTxnRow[] = [];
      const escrowRows: JobEscrowInfo[] = [];
      // Carga secuencial para no disparar rate-limits con historiales largos
      for (const job of jobs) {
        try {
          const payments = await fetchJobPayments(job.id);
          for (const payment of payments) {
            const row = payment as Record<string, unknown>;
            txns.push({
              id: String(row.id ?? `${job.id}-${txns.length}`),
              jobId: job.id,
              jobTitle: job.title,
              type: String(row.type ?? "DEPOSIT"),
              status: String(row.status ?? "PENDING"),
              amount: typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0),
              date: typeof row.createdAt === "string" ? row.createdAt : "",
            });
          }
        } catch { /* job sin pagos */ }
        try {
          const escrowResult = await fetchJobEscrow(job.id) as Record<string, unknown>;
          const escrow = (escrowResult.escrow ?? escrowResult) as Record<string, unknown> | null;
          if (escrow && typeof escrow.id === "string") {
            escrowRows.push({
              jobId: job.id,
              jobTitle: job.title,
              escrowId: escrow.id,
              status: String(escrow.status ?? "PENDING"),
              amount: typeof escrow.amount === "number" ? escrow.amount : Number(escrow.amount ?? 0),
            });
          }
        } catch { /* job sin escrow */ }
      }
      txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEscrowTxns(txns);
      setEscrows(escrowRows);
      setEscrowLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setEscrowLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (tab === "escrow" && !escrowLoaded && !escrowLoading) void loadEscrow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const totalInvoiced = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total ?? 0), 0);
  const overdueInvoices = invoices.filter(i => i.status === "overdue");
  const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const pendingExpenses = expenses.filter(e => e.status === "pending");
  const totalExpenses = expenses.filter(e => !["rejected", "archived"].includes(e.status)).reduce((s, e) => s + (e.amount ?? 0), 0);
  const duplicates = expenses.filter(e => e.isDuplicate);

  const invoiceStatuses = ["draft", "sent", "viewed", "approved", "paid", "overdue", "cancelled"];
  const expenseStatuses = ["pending", "approved", "rejected", "reimbursed", "archived"];
  const filteredInvoices = statusFilter === "all" ? invoices : invoices.filter(i => i.status === statusFilter);
  const filteredExpenses = statusFilter === "all" ? expenses : expenses.filter(e => e.status === statusFilter);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px", display: "grid", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Finance Admin</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Vista financiera cross-org</p>
        </div>
        <button onClick={() => void load()} disabled={loading} style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px",
          borderRadius: 12, border: "none", background: "rgba(99,102,241,.15)", color: "#818cf8", fontWeight: 700, cursor: "pointer",
        }}>
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 12, padding: 12, color: "#fca5a5", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 14 }}>
        <KpiCard label="Total facturado" value={fmt(totalInvoiced)} sub={`${invoices.length} facturas`} icon={FileText} />
        <KpiCard label="Cobrado" value={fmt(totalPaid)} sub={`${invoices.filter(i => i.status === "paid").length} pagadas`} icon={CheckCircle} color="#10b981" />
        <KpiCard label="Vencidas" value={fmt(overdueAmount)} sub={`${overdueInvoices.length} facturas`} icon={AlertTriangle} color="#f87171" alert={overdueInvoices.length > 0} />
        <KpiCard label="Total gastos" value={fmt(totalExpenses)} sub={`${expenses.length} registros`} icon={Receipt} color="#fb923c" />
        <KpiCard label="Gastos pendientes" value={String(pendingExpenses.length)} sub="Por revisar" icon={Clock} color="#fbbf24" alert={pendingExpenses.length > 0} />
        {duplicates.length > 0 && <KpiCard label="Duplicados" value={String(duplicates.length)} sub="Revisión requerida" icon={TrendingDown} color="#f87171" alert />}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["invoices", "expenses", "escrow"] as const).map(t => (
            <button key={t} data-testid={`admin-finance-tab-${t}`} onClick={() => { setTab(t); setStatusFilter("all"); }} style={{
              padding: "10px 18px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
              background: "transparent", color: tab === t ? "var(--ink)" : "var(--muted)",
              borderBottom: tab === t ? "2px solid #818cf8" : "2px solid transparent",
            }}>
              {t === "invoices" ? `Facturas (${invoices.length})` : t === "expenses" ? `Gastos (${expenses.length})` : `Pagos & Escrow${escrowLoaded ? ` (${escrowTxns.length})` : ""}`}
            </button>
          ))}
        </div>
        {tab !== "escrow" && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--muted)" }}>
            <option value="all">Todos</option>
            {(tab === "invoices" ? invoiceStatuses : expenseStatuses).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {tab === "invoices" && (
        <div style={{ display: "grid", gap: 8 }}>
          {filteredInvoices.length === 0 && !loading && <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>Sin facturas.</div>}
          {filteredInvoices.map(inv => <InvoiceRow key={inv.id} invoice={inv} onRefresh={load} />)}
        </div>
      )}

      {tab === "expenses" && (
        <div style={{ display: "grid", gap: 8 }}>
          {filteredExpenses.length === 0 && !loading && <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>Sin gastos.</div>}
          {filteredExpenses.map(exp => <ExpenseRow key={exp.id} expense={exp} onRefresh={load} />)}
        </div>
      )}

      {tab === "escrow" && (
        <EscrowPanel
          txns={escrowTxns}
          escrows={escrows}
          loading={escrowLoading}
          onRefresh={loadEscrow}
        />
      )}
    </div>
  );
}

function EscrowPanel({ txns, escrows, loading, onRefresh }: {
  txns: EscrowTxnRow[]; escrows: JobEscrowInfo[]; loading: boolean; onRefresh: () => void;
}) {
  const [refundTarget, setRefundTarget] = useState<JobEscrowInfo | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundOk, setRefundOk] = useState<string | null>(null);
  const [releaseBusy, setReleaseBusy] = useState<string | null>(null);
  const [releaseOk, setReleaseOk] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const totalEscrow = txns.filter(t => t.type === "DEPOSIT" && t.status === "PENDING").reduce((s, t) => s + t.amount, 0);
  const totalReleased = txns.filter(t => t.type === "RELEASE").reduce((s, t) => s + t.amount, 0);
  const totalRefunded = txns.filter(t => t.type === "REFUND").reduce((s, t) => s + Math.abs(t.amount), 0);
  const refundableEscrows = escrows.filter(e => ["PENDING", "ACTIVE", "FUNDED", "PARTIAL"].includes(e.status.toUpperCase()));

  async function submitRefund() {
    if (!refundTarget) return;
    const amount = Number(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setRefundError("Monto inválido"); return; }
    if (refundReason.trim().length < 3) { setRefundError("La razón debe tener al menos 3 caracteres"); return; }
    setRefundBusy(true); setRefundError(null);
    try {
      await refundEscrow({ escrowId: refundTarget.escrowId, amount, reason: refundReason.trim() });
      setRefundOk(`Reembolso de ${fmt(amount)} emitido para "${refundTarget.jobTitle}"`);
      setRefundTarget(null); setRefundAmount(""); setRefundReason("");
      onRefresh();
    } catch (e) { setRefundError(e instanceof Error ? e.message : "Error al reembolsar"); }
    finally { setRefundBusy(false); }
  }

  async function submitRelease(e: JobEscrowInfo) {
    setReleaseBusy(e.escrowId); setReleaseOk(null); setReleaseError(null);
    try {
      const res = await fetch("/api/semse/payment-governance/release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ escrowId: e.escrowId, amount: e.amount, reason: "Manual release from admin finance panel" }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: { message?: string } }).error?.message ?? "Error");
      setReleaseOk(`Liberación de ${fmt(e.amount)} emitida para "${e.jobTitle}"`);
      onRefresh();
    } catch (err) { setReleaseError(err instanceof Error ? err.message : "Error al liberar"); }
    finally { setReleaseBusy(null); }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 14 }}>
        <KpiCard label="En escrow" value={fmt(totalEscrow)} sub={`${escrows.length} escrows`} icon={DollarSign} color="#3b82f6" />
        <KpiCard label="Liberado" value={fmt(totalReleased)} sub="A profesionales" icon={CheckCircle} color="#10b981" />
        <KpiCard label="Reembolsado" value={fmt(totalRefunded)} sub="A clientes" icon={TrendingDown} color="#fbbf24" />
      </div>

      {(refundOk ?? releaseOk) && (
        <div data-testid="admin-escrow-refund-ok" style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.25)", borderRadius: 12, padding: 12, color: "#10b981", fontSize: 13 }}>
          {refundOk ?? releaseOk}
        </div>
      )}
      {releaseError && (
        <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 12, padding: 12, color: "#fca5a5", fontSize: 13 }}>{releaseError}</div>
      )}

      {refundableEscrows.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 18, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 10 }}>Escrows activos ({refundableEscrows.length})</div>
          <div style={{ display: "grid", gap: 8 }}>
            {refundableEscrows.map(e => (
              <div key={e.escrowId} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{e.jobTitle}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{e.escrowId.slice(-10)}</div>
                </div>
                <Badge status={e.status.toLowerCase()} />
                <div style={{ fontWeight: 800, fontSize: 14 }}>{fmt(e.amount)}</div>
                <button
                  disabled={releaseBusy === e.escrowId}
                  onClick={() => { void submitRelease(e); }}
                  style={smBtn("rgba(16,185,129,.15)", "#10b981")}
                >
                  {releaseBusy === e.escrowId ? "Liberando…" : "Liberar"}
                </button>
                <button
                  data-testid={`admin-escrow-refund-${e.escrowId}`}
                  onClick={() => { setRefundTarget(e); setRefundAmount(String(e.amount || "")); setRefundReason(""); setRefundError(null); setRefundOk(null); setReleaseOk(null); }}
                  style={smBtn("rgba(251,191,36,.15)", "#fbbf24")}
                >
                  Reembolsar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {refundTarget && (
        <div data-testid="admin-escrow-refund-form" style={{ background: "var(--surface)", borderRadius: 14, padding: 18, border: "1px solid rgba(251,191,36,.35)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>Reembolsar escrow — {refundTarget.jobTitle}</div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>Los fondos vuelven al cliente. Esta acción queda registrada como transacción REFUND.</p>
          {refundError && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{refundError}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="number" min="1" placeholder="Monto"
              value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
              style={{ width: 130, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--raised)", color: "var(--ink)", fontSize: 13 }}
            />
            <input
              type="text" placeholder="Razón del reembolso"
              value={refundReason} onChange={e => setRefundReason(e.target.value)}
              style={{ flex: 1, minWidth: 220, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--raised)", color: "var(--ink)", fontSize: 13 }}
            />
            <button disabled={refundBusy} onClick={() => void submitRefund()} style={smBtn("#fbbf24", "#1f1f1f")}>
              {refundBusy ? "Procesando…" : "Confirmar reembolso"}
            </button>
            <button disabled={refundBusy} onClick={() => setRefundTarget(null)} style={smBtn("transparent", "var(--muted)")}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>Cargando pagos…</div>}
        {!loading && txns.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>Sin transacciones de escrow.</div>}
        {!loading && txns.map(t => (
          <div key={t.id} style={{
            background: "var(--surface)", borderRadius: 14, padding: "12px 18px", border: "1px solid var(--border)",
            display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 14, alignItems: "center",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{t.jobTitle}</span>
                <Badge status={t.type.toLowerCase()} />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.jobId.slice(-8)} · {t.status}</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.type === "RELEASE" ? "#10b981" : t.type === "REFUND" ? "#fbbf24" : "var(--ink)" }}>{fmt(Math.abs(t.amount))}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.date ? new Date(t.date).toLocaleDateString("es-MX") : "—"}</div>
            <div />
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceRow({ invoice, onRefresh }: { invoice: Invoice; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 14, padding: "12px 18px",
      border: `1px solid ${invoice.status === "overdue" ? "rgba(248,113,113,.3)" : "var(--border)"}`,
      display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 14, alignItems: "center",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{invoice.number}</span>
          <Badge status={invoice.status} />
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {invoice.title}
          {invoice.dueDate ? ` · vence ${new Date(invoice.dueDate).toLocaleDateString("es-MX")}` : ""}
          {invoice.projectId ? ` · ${invoice.projectId.slice(-8)}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: invoice.status === "overdue" ? "#fca5a5" : "var(--ink)" }}>{fmt(invoice.total)}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{invoice.currency}</div>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(invoice.createdAt).toLocaleDateString("es-MX")}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {invoice.status === "draft" && (
          <button disabled={busy} onClick={async () => { setBusy(true); await sendInvoice(invoice.id).catch(() => null); onRefresh(); setBusy(false); }} style={smBtn("#4f46e5", "white")}>Enviar</button>
        )}
        {["sent", "viewed", "approved", "overdue"].includes(invoice.status) && (
          <button disabled={busy} onClick={async () => { setBusy(true); await markInvoicePaid(invoice.id).catch(() => null); onRefresh(); setBusy(false); }} style={smBtn("#10b981", "white")}>Cobrada</button>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ expense, onRefresh }: { expense: ProjectExpense; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 14, padding: "12px 18px",
      border: `1px solid ${expense.isDuplicate ? "rgba(248,113,113,.3)" : "var(--border)"}`,
      display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 14, alignItems: "center",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{expense.description}</span>
          <Badge status={expense.status} />
          {expense.isDuplicate && <span style={{ fontSize: 10, background: "rgba(248,113,113,.15)", color: "#fca5a5", padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>DUP</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {expense.category}{expense.vendor ? ` · ${expense.vendor}` : ""}
          {expense.projectId ? ` · ${expense.projectId.slice(-8)}` : ""}
          {" · "}{new Date(expense.expenseDate).toLocaleDateString("es-MX")}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: expense.isDuplicate ? "#fca5a5" : "var(--ink)" }}>{fmt(expense.amount)}</div>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{expense.submittedBy.slice(-8)}</div>
      {expense.status === "pending" ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button disabled={busy} onClick={async () => { setBusy(true); await approveExpense(expense.id).catch(() => null); onRefresh(); setBusy(false); }} style={smBtn("#10b981", "white")}>✓</button>
          <button disabled={busy} onClick={async () => { setBusy(true); await rejectExpense(expense.id).catch(() => null); onRefresh(); setBusy(false); }} style={smBtn("#ef4444", "white")}>✗</button>
        </div>
      ) : <div />}
    </div>
  );
}

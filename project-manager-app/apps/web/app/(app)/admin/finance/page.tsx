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
  markInvoicePaid,
  rejectExpense,
  sendInvoice,
  type Invoice,
  type ProjectExpense,
} from "../../../semse-api";

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", sent: "#818cf8", viewed: "#a78bfa", approved: "#34d399",
  paid: "#10b981", overdue: "#f87171", cancelled: "#64748b",
  pending: "#fbbf24", rejected: "#f87171", reimbursed: "#34d399", archived: "#64748b",
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

export default function AdminFinancePage() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"invoices" | "expenses">("invoices");
  const [statusFilter, setStatusFilter] = useState("all");

  async function load() {
    setLoading(true); setError(null);
    try {
      const [inv, exp] = await Promise.all([fetchInvoices({ limit: 200 }), fetchExpenses({ limit: 500 })]);
      setInvoices(inv); setExpenses(exp);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

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
          {(["invoices", "expenses"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setStatusFilter("all"); }} style={{
              padding: "10px 18px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
              background: "transparent", color: tab === t ? "var(--ink)" : "var(--muted)",
              borderBottom: tab === t ? "2px solid #818cf8" : "2px solid transparent",
            }}>
              {t === "invoices" ? `Facturas (${invoices.length})` : `Gastos (${expenses.length})`}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--muted)" }}>
          <option value="all">Todos</option>
          {(tab === "invoices" ? invoiceStatuses : expenseStatuses).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
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

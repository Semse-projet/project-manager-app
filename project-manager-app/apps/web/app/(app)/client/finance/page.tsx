"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle, Clock, DollarSign, FileText, Plus, Receipt, RefreshCw, Scan, TrendingUp, X } from "lucide-react";
import { DownloadPdfButton } from "../../../../components/finance/download-pdf-button";
import {
  approveExpense,
  createExpense,
  createInvoice,
  fetchExpenses,
  fetchInvoices,
  markInvoicePaid,
  rejectExpense,
  scanReceipt,
  sendInvoice,
  type ExpenseCategory,
  type ExtractedReceipt,
  type Invoice,
  type InvoiceLineItem,
  type ProjectExpense,
} from "../../../semse-api";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "materials", "labor", "tools", "transport", "permits",
  "subcontractors", "maintenance", "equipment", "unexpected", "other",
];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  materials: "Materiales", labor: "Mano de obra", tools: "Herramientas",
  transport: "Transporte", permits: "Permisos", subcontractors: "Subcontratistas",
  maintenance: "Mantenimiento", equipment: "Equipos", unexpected: "Imprevistos", other: "Otro",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", sent: "#818cf8", viewed: "#a78bfa", approved: "#34d399",
  paid: "#10b981", overdue: "#f87171", cancelled: "#64748b",
  pending: "#fbbf24", rejected: "#f87171", reimbursed: "#34d399", archived: "#64748b",
};

function Badge({ status }: { status: string }) {
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: `${STATUS_COLORS[status] ?? "#64748b"}22`,
      color: STATUS_COLORS[status] ?? "#94a3b8", border: `1px solid ${STATUS_COLORS[status] ?? "#64748b"}44`,
    }}>
      {status.toUpperCase()}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, color = "#818cf8" }: {
  label: string; value: string; sub?: string; icon: typeof DollarSign; color?: string;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}22`, display: "grid", placeItems: "center" }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 0 }).format(n);
}

export default function FinancePage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"invoices" | "expenses">("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showScanForm, setShowScanForm] = useState(false);
  const [overdueToasts, setOverdueToasts] = useState<Array<{ id: string; number: string; total: number }>>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [inv, exp] = await Promise.all([fetchInvoices({ limit: 50 }), fetchExpenses({ limit: 100 })]);
      setInvoices(inv);
      setExpenses(exp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos financieros");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    const es = new EventSource("/api/semse/finance/stream");
    es.addEventListener("invoice-overdue", (e) => {
      try {
        const data = JSON.parse(e.data) as { invoiceId: string; number: string; total: number };
        setOverdueToasts(prev => [...prev.slice(-2), { id: data.invoiceId, number: data.number, total: data.total }]);
        void load();
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, []);

  const totalInvoiced = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total ?? 0), 0);
  const totalExpenses = expenses.filter(e => e.status !== "rejected" && e.status !== "archived").reduce((s, e) => s + (e.amount ?? 0), 0);
  const pendingInvoices = invoices.filter(i => ["sent", "viewed", "approved"].includes(i.status)).length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px", display: "grid", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Finance Hub</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Facturas, gastos y control financiero</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void load()} disabled={loading} style={btnStyle("#334155", "#94a3b8")}>
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button onClick={() => setShowExpenseForm(true)} style={btnStyle("#1e293b", "#94a3b8")}>
            <Receipt size={14} /> Registrar gasto
          </button>
          <button onClick={() => setShowScanForm(true)} style={btnStyle("#0f172a", "#94a3b8")}>
            <Scan size={14} /> Escanear recibo
          </button>
          <button onClick={() => setShowInvoiceForm(true)} style={btnStyle("#4f46e5", "white")}>
            <Plus size={14} /> Nueva factura
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 12, padding: 12, color: "#fca5a5", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <StatCard label="Total facturado" value={fmt(totalInvoiced)} sub={`${invoices.length} facturas`} icon={FileText} />
        <StatCard label="Cobrado" value={fmt(totalPaid)} sub={`${invoices.filter(i => i.status === "paid").length} pagadas`} icon={CheckCircle} color="#10b981" />
        <StatCard label="Por cobrar" value={fmt(totalInvoiced - totalPaid)} sub={`${pendingInvoices} pendientes`} icon={Clock} color="#fbbf24" />
        <StatCard label="Total gastos" value={fmt(totalExpenses)} sub={`${expenses.length} registros`} icon={TrendingUp} color="#f87171" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        {(["invoices", "expenses"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 18px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
            background: "transparent", color: tab === t ? "var(--ink)" : "var(--muted)",
            borderBottom: tab === t ? "2px solid #818cf8" : "2px solid transparent",
          }}>
            {t === "invoices" ? `Facturas (${invoices.length})` : `Gastos (${expenses.length})`}
          </button>
        ))}
      </div>

      {/* Invoices list */}
      {tab === "invoices" && (
        <div style={{ display: "grid", gap: 10 }}>
          {invoices.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>
              No hay facturas. Crea tu primera factura.
            </div>
          )}
          {invoices.map(inv => (
            <InvoiceRow key={inv.id} invoice={inv} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Expenses list */}
      {tab === "expenses" && (
        <div style={{ display: "grid", gap: 10 }}>
          {expenses.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13 }}>
              No hay gastos registrados.
            </div>
          )}
          {expenses.map(exp => (
            <ExpenseRow key={exp.id} expense={exp} onRefresh={load} />
          ))}
        </div>
      )}

      {/* Overdue toasts */}
      {overdueToasts.length > 0 && (
        <div style={{ position: "fixed", bottom: 24, right: 24, display: "grid", gap: 8, zIndex: 200 }}>
          {overdueToasts.map(toast => (
            <div key={toast.id} style={{
              background: "rgba(239,68,68,.95)", borderRadius: 12, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10, color: "white", fontSize: 13, fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,.3)",
            }}>
              <AlertTriangle size={16} />
              Factura {toast.number} vencida — ${toast.total.toLocaleString()}
              <button onClick={() => setOverdueToasts(p => p.filter(t => t.id !== toast.id))}
                style={{ background: "none", border: "none", color: "white", cursor: "pointer", marginLeft: 4 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showInvoiceForm && (
        <InvoiceFormModal
          onClose={() => setShowInvoiceForm(false)}
          onCreated={() => { setShowInvoiceForm(false); void load(); }}
        />
      )}
      {showExpenseForm && (
        <ExpenseFormModal
          onClose={() => setShowExpenseForm(false)}
          onCreated={() => { setShowExpenseForm(false); void load(); }}
        />
      )}
      {showScanForm && (
        <ScanReceiptModal
          onClose={() => setShowScanForm(false)}
          onCreated={() => { setShowScanForm(false); void load(); }}
        />
      )}
    </div>
  );
}

function InvoiceRow({ invoice, onRefresh }: { invoice: Invoice; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    setBusy(true);
    await sendInvoice(invoice.id).catch(() => null);
    onRefresh();
    setBusy(false);
  }

  async function handlePay() {
    setBusy(true);
    await markInvoicePaid(invoice.id).catch(() => null);
    onRefresh();
    setBusy(false);
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Link href={`/client/finance/invoices/${invoice.id}`} style={{ fontWeight: 700, fontSize: 13, color: "#818cf8", textDecoration: "none" }}>
            {invoice.number}
          </Link>
          <Badge status={invoice.status} />
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{invoice.title}</div>
        {invoice.dueDate && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            Vence: {new Date(invoice.dueDate).toLocaleDateString("es-MX")}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>{fmt(invoice.total, invoice.currency)}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{invoice.currency}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <DownloadPdfButton
          invoiceId={invoice.id}
          docType={invoice.status === "draft" ? "estimate" : "invoice"}
        />
        {invoice.status === "draft" && (
          <button onClick={() => void handleSend()} disabled={busy} style={btnStyle("#4f46e5", "white", true)}>
            Enviar
          </button>
        )}
        {["sent", "viewed", "approved"].includes(invoice.status) && (
          <button onClick={() => void handlePay()} disabled={busy} style={btnStyle("#10b981", "white", true)}>
            Marcar pagada
          </button>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ expense, onRefresh }: { expense: ProjectExpense; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handle(action: "approve" | "reject") {
    setBusy(true);
    if (action === "approve") await approveExpense(expense.id).catch(() => null);
    else await rejectExpense(expense.id).catch(() => null);
    onRefresh();
    setBusy(false);
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      {expense.isDuplicate && (
        <AlertCircle size={16} color="#f87171" aria-label="Posible duplicado" />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{expense.description}</span>
          <Badge status={expense.status} />
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {CATEGORY_LABELS[expense.category]} {expense.vendor ? `· ${expense.vendor}` : ""}
          {" · "}{new Date(expense.expenseDate).toLocaleDateString("es-MX")}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: expense.isDuplicate ? "#f87171" : "var(--ink)" }}>
          {fmt(expense.amount, expense.currency)}
        </div>
      </div>
      {expense.status === "pending" && (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => void handle("approve")} disabled={busy} style={btnStyle("#10b981", "white", true)}>
            <CheckCircle size={12} />
          </button>
          <button onClick={() => void handle("reject")} disabled={busy} style={btnStyle("#ef4444", "white", true)}>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function InvoiceFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { description: "", qty: 1, unitPrice: 0, taxRate: 16, total: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function updateItem(i: number, field: keyof InvoiceLineItem, val: string) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: field === "description" ? val : parseFloat(val) || 0 };
      updated.total = updated.qty * updated.unitPrice * (1 + updated.taxRate / 100);
      return updated;
    }));
  }

  const total = items.reduce((s, it) => s + it.qty * it.unitPrice * (1 + it.taxRate / 100), 0);

  async function handleSubmit() {
    if (!title.trim()) { setErr("El título es requerido"); return; }
    setBusy(true);
    setErr(null);
    try {
      await createInvoice({ title, lineItems: items, notes: notes || undefined, dueDate: dueDate || undefined });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al crear factura");
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 100 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: "min(560px, 95vw)", maxHeight: "90vh", overflow: "auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Nueva factura</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}><X size={20} /></button>
        </div>

        {err && <div style={{ color: "#fca5a5", fontSize: 13 }}>{err}</div>}

        <input placeholder="Título de la factura *" value={title} onChange={e => setTitle(e.target.value)}
          style={inputStyle} />
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />

        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Conceptos</div>
        {items.map((item, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 100px 70px", gap: 8 }}>
            <input placeholder="Descripción" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Qty" value={item.qty} onChange={e => updateItem(i, "qty", e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Precio unitario" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", e.target.value)} style={inputStyle} />
            <input type="number" placeholder="IVA %" value={item.taxRate} onChange={e => updateItem(i, "taxRate", e.target.value)} style={inputStyle} />
          </div>
        ))}
        <button onClick={() => setItems(p => [...p, { description: "", qty: 1, unitPrice: 0, taxRate: 16, total: 0 }])}
          style={btnStyle("#1e293b", "#818cf8")}>
          <Plus size={14} /> Agregar concepto
        </button>

        <div style={{ textAlign: "right", fontWeight: 800, fontSize: 18 }}>Total: {fmt(total)}</div>

        <textarea placeholder="Notas" value={notes} onChange={e => setNotes(e.target.value)}
          rows={2} style={{ ...inputStyle, resize: "vertical" }} />

        <button onClick={() => void handleSubmit()} disabled={busy} style={btnStyle("#4f46e5", "white")}>
          {busy ? "Creando..." : "Crear factura"}
        </button>
      </div>
    </div>
  );
}

function ExpenseFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("materials");
  const [vendor, setVendor] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (!description.trim() || !amount) { setErr("Descripción y monto son requeridos"); return; }
    setBusy(true);
    setErr(null);
    try {
      await createExpense({
        description, amount: parseFloat(amount), category,
        vendor: vendor || undefined, receiptUrl: receiptUrl || undefined,
        notes: notes || undefined,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al registrar gasto");
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 100 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: "min(460px, 95vw)", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Registrar gasto</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}><X size={20} /></button>
        </div>

        {err && <div style={{ color: "#fca5a5", fontSize: 13 }}>{err}</div>}

        <input placeholder="Descripción *" value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input type="number" placeholder="Monto *" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} />
          <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} style={inputStyle}>
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>

        <input placeholder="Proveedor" value={vendor} onChange={e => setVendor(e.target.value)} style={inputStyle} />
        <input placeholder="URL del recibo (foto/PDF)" value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)} style={inputStyle} />
        <textarea placeholder="Notas" value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />

        <button onClick={() => void handleSubmit()} disabled={busy} style={btnStyle("#4f46e5", "white")}>
          {busy ? "Guardando..." : "Registrar gasto"}
        </button>
      </div>
    </div>
  );
}

function btnStyle(bg: string, color: string, small = false): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: small ? "6px 12px" : "10px 16px",
    borderRadius: 10, border: "none", background: bg, color, fontWeight: 700,
    fontSize: small ? 12 : 13, cursor: "pointer",
  };
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface-2, #1e293b)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--ink)",
  width: "100%", boxSizing: "border-box",
};

function ScanReceiptModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [receiptText, setReceiptText] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedReceipt | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleScan() {
    if (!receiptText.trim() && !receiptUrl.trim()) { setErr("Pega el texto del recibo o una URL"); return; }
    setScanning(true); setErr(null); setExtracted(null);
    try {
      const result = await scanReceipt({ receiptText: receiptText || undefined, receiptUrl: receiptUrl || undefined });
      setExtracted(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al escanear");
    } finally {
      setScanning(false);
    }
  }

  async function handleCreate() {
    if (!extracted?.description) return;
    setCreating(true);
    try {
      await createExpense({
        description: extracted.description,
        amount: extracted.amount ?? 0,
        category: (extracted.category as ExpenseCategory) ?? "other",
        vendor: extracted.vendor ?? undefined,
        expenseDate: extracted.date ?? undefined,
        receiptUrl: receiptUrl || undefined,
        receiptText: receiptText || undefined,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar gasto");
      setCreating(false);
    }
  }

  const confidenceColor = { high: "#10b981", medium: "#fbbf24", low: "#f87171" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 100 }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: "min(580px, 95vw)", maxHeight: "90vh", overflow: "auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Escanear recibo con IA</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}><X size={20} /></button>
        </div>

        {err && <div style={{ color: "#fca5a5", fontSize: 13 }}>{err}</div>}

        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Pega el texto del recibo o la URL de la imagen. Prometeo extrae los datos automáticamente.
        </div>

        <textarea
          placeholder="Pega el texto del recibo aquí... ej: Home Depot - Folio #1234 - $318.42 - Materiales eléctricos - 28/04/2026"
          value={receiptText}
          onChange={e => setReceiptText(e.target.value)}
          rows={5}
          style={{ ...inputStyle, resize: "vertical" }}
        />

        <input
          placeholder="URL del recibo (imagen o PDF)"
          value={receiptUrl}
          onChange={e => setReceiptUrl(e.target.value)}
          style={inputStyle}
        />

        <button onClick={() => void handleScan()} disabled={scanning} style={btnStyle("#4f46e5", "white")}>
          <Scan size={14} /> {scanning ? "Analizando con IA..." : "Extraer datos"}
        </button>

        {extracted && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Datos extraídos</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: confidenceColor[extracted.confidence] }}>
                Confianza: {extracted.confidence.toUpperCase()}
              </span>
            </div>
            {[
              ["Proveedor", extracted.vendor ?? "—"],
              ["Monto", extracted.amount != null ? `$${extracted.amount.toLocaleString()} ${extracted.currency}` : "—"],
              ["Fecha", extracted.date ?? "—"],
              ["Categoría", CATEGORY_LABELS[extracted.category as ExpenseCategory] ?? extracted.category],
              ["Descripción", extracted.description],
              ["IVA", extracted.taxAmount != null ? `$${extracted.taxAmount}` : "—"],
              ["Método pago", extracted.paymentMethod ?? "—"],
              ["No. recibo", extracted.receiptNumber ?? "—"],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                <span style={{ color: "var(--muted)", minWidth: 100 }}>{label}:</span>
                <span style={{ color: "var(--ink)", fontWeight: 600 }}>{val}</span>
              </div>
            ))}
            {extracted.lineItems.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>ARTÍCULOS</div>
                {extracted.lineItems.map((li, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", padding: "2px 0" }}>
                    <span>{li.description}</span><span>${li.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => void handleCreate()} disabled={creating} style={btnStyle("#10b981", "white")}>
              {creating ? "Guardando..." : "Guardar como gasto"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

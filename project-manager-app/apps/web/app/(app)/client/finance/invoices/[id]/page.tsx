"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Send } from "lucide-react";
import {
  fetchInvoices,
  sendInvoice,
  markInvoicePaid,
  type Invoice,
} from "../../../../../semse-api";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador", sent: "Enviada", viewed: "Vista", approved: "Aprobada",
  paid: "Pagada", overdue: "Vencida", cancelled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8", sent: "#818cf8", viewed: "#a78bfa", approved: "#34d399",
  paid: "#10b981", overdue: "#f87171", cancelled: "#64748b",
};

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = typeof params?.id === "string" ? params.id : "";
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!invoiceId) return;
    fetchInvoices({ limit: 200 })
      .then(list => {
        const found = list.find(i => i.id === invoiceId) ?? null;
        setInvoice(found);
      })
      .catch(() => setInvoice(null))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  function handlePrint() {
    window.print();
  }

  async function handleSend() {
    if (!invoice) return;
    setBusy(true);
    const updated = await sendInvoice(invoice.id).catch(() => null);
    if (updated) setInvoice(updated);
    setBusy(false);
  }

  async function handlePay() {
    if (!invoice) return;
    setBusy(true);
    const updated = await markInvoicePaid(invoice.id).catch(() => null);
    if (updated) setInvoice(updated);
    setBusy(false);
  }

  if (loading) return <div style={{ padding: 40, color: "var(--muted)", fontSize: 13 }}>Cargando...</div>;
  if (!invoice) return (
    <div style={{ padding: 40, color: "var(--muted)", fontSize: 13 }}>
      Factura no encontrada.{" "}
      <button onClick={() => router.push("/client/finance")} style={{ color: "#818cf8", background: "none", border: "none", cursor: "pointer" }}>
        Volver
      </button>
    </div>
  );

  const subtotal = invoice.lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px" }}>
      {/* Controls — hidden on print */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <button onClick={() => router.push("/client/finance")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          <ArrowLeft size={16} /> Volver
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {invoice.status === "draft" && (
            <button onClick={() => void handleSend()} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: "#4f46e5", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              <Send size={14} /> Enviar
            </button>
          )}
          {["sent", "viewed", "approved", "overdue"].includes(invoice.status) && (
            <button onClick={() => void handlePay()} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: "#10b981", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Marcar pagada
            </button>
          )}
          <button onClick={handlePrint}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Download size={14} /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Invoice document */}
      <div ref={printRef} style={{
        background: "white", color: "#0f172a", borderRadius: 16,
        padding: "48px 52px", boxShadow: "0 4px 24px rgba(0,0,0,.12)",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#1e293b", letterSpacing: -1 }}>SEMSE</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Platform de Gestión de Proyectos</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1e293b" }}>FACTURA</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#6366f1", marginTop: 4 }}>{invoice.number}</div>
            <div style={{
              display: "inline-block", marginTop: 8, padding: "4px 12px", borderRadius: 99,
              background: `${STATUS_COLORS[invoice.status] ?? "#64748b"}22`,
              color: STATUS_COLORS[invoice.status] ?? "#64748b",
              border: `1px solid ${STATUS_COLORS[invoice.status] ?? "#64748b"}44`,
              fontSize: 11, fontWeight: 700,
            }}>
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>FECHA DE EMISIÓN</div>
            <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 600 }}>
              {new Date(invoice.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>
          {invoice.dueDate && (
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>FECHA DE VENCIMIENTO</div>
              <div style={{ fontSize: 14, color: invoice.status === "overdue" ? "#ef4444" : "#1e293b", fontWeight: 600 }}>
                {new Date(invoice.dueDate).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>DESCRIPCIÓN</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{invoice.title}</div>
        </div>

        {/* Line items */}
        <div style={{ marginBottom: 28 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "10px 0", fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>CONCEPTO</th>
                <th style={{ textAlign: "center", padding: "10px 8px", fontSize: 11, color: "#94a3b8", fontWeight: 700, width: 60 }}>QTY</th>
                <th style={{ textAlign: "right", padding: "10px 0", fontSize: 11, color: "#94a3b8", fontWeight: 700, width: 110 }}>PRECIO UNIT.</th>
                <th style={{ textAlign: "right", padding: "10px 0", fontSize: 11, color: "#94a3b8", fontWeight: 700, width: 70 }}>IVA</th>
                <th style={{ textAlign: "right", padding: "10px 0", fontSize: 11, color: "#94a3b8", fontWeight: 700, width: 120 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 0", fontSize: 13, color: "#1e293b" }}>{li.description}</td>
                  <td style={{ padding: "12px 8px", fontSize: 13, color: "#475569", textAlign: "center" }}>{li.qty}</td>
                  <td style={{ padding: "12px 0", fontSize: 13, color: "#475569", textAlign: "right" }}>{fmt(li.unitPrice, invoice.currency)}</td>
                  <td style={{ padding: "12px 0", fontSize: 13, color: "#475569", textAlign: "right" }}>{li.taxRate}%</td>
                  <td style={{ padding: "12px 0", fontSize: 13, color: "#1e293b", fontWeight: 600, textAlign: "right" }}>
                    {fmt(li.qty * li.unitPrice * (1 + li.taxRate / 100), invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 260 }}>
            {[
              { label: "Subtotal", value: fmt(subtotal, invoice.currency) },
              { label: "IVA", value: fmt(invoice.taxAmount, invoice.currency) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#475569" }}>
                <span>{label}</span><span>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
              <span>TOTAL</span><span>{fmt(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ marginTop: 32, padding: "16px 20px", background: "#f8fafc", borderRadius: 10, borderLeft: "3px solid #6366f1" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>NOTAS</div>
            <div style={{ fontSize: 13, color: "#475569" }}>{invoice.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
          <span>SEMSE OS · semse.io</span>
          <span>Generado el {new Date().toLocaleDateString("es-MX")}</span>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

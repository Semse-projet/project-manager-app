"use client";

import { useState } from "react";
import { Bot, DollarSign, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  suggestEstimateForLead,
  createEstimateFromLead,
  getInvoicePdfUrl,
  type ContractorLead,
  type SuggestedLineItem,
  type Invoice,
} from "../../app/semse-api";

interface Props {
  lead: ContractorLead;
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
}

const CATEGORY_COLORS = {
  materials: "#60a5fa",
  labor: "#34d399",
  other: "#f59e0b",
};

export function EstimateModal({ lead, onClose, onCreated }: Props) {
  const [items, setItems] = useState<SuggestedLineItem[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState(
    `Cliente: ${lead.name}${lead.phone ? ` · Tel: ${lead.phone}` : ""}${lead.address ? `\nDirección: ${lead.address}` : ""}`,
  );
  const [terms, setTerms] = useState(
    "50% de depósito requerido para iniciar el trabajo. Saldo al terminar y antes de la entrega final. Precios válidos por 14 días.",
  );
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);

  const subtotal = items.reduce((s, i) => s + i.total, 0);

  async function handleSuggest() {
    setSuggesting(true);
    try {
      const suggested = await suggestEstimateForLead(lead.id);
      setItems(suggested);
    } finally {
      setSuggesting(false);
    }
  }

  function updateItem(idx: number, field: keyof SuggestedLineItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: field === "description" || field === "category" ? value : Number(value) };
      if (field === "qty" || field === "unitPrice") {
        updated.total = updated.qty * updated.unitPrice;
      }
      return updated;
    }));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, taxRate: 0, total: 0, category: "materials" }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (items.length === 0) return;
    setCreating(true);
    try {
      const invoice = await createEstimateFromLead(lead.id, { lineItems: items, dueDate: dueDate || undefined, notes, terms });
      setCreatedInvoice(invoice);
      onCreated(invoice);
    } finally {
      setCreating(false);
    }
  }

  const inputCss: React.CSSProperties = {
    width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)",
    background: "var(--bg)", color: "var(--ink)", fontSize: 12, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 680, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--ink)" }}>Crear estimado</h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {lead.name}{lead.jobType ? ` · ${lead.jobType}` : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ padding: 4, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        {/* Success state */}
        {createdInvoice ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>
              Estimado #{createdInvoice.number} creado
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
              El lead fue actualizado a &quot;Estimado enviado&quot;
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <a
                href={getInvoicePdfUrl(createdInvoice.id, "estimate")}
                target="_blank"
                rel="noreferrer"
                style={{ padding: "8px 18px", borderRadius: 8, background: "#3b82f6", color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
              >
                Descargar PDF
              </a>
              <button
                onClick={onClose}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* AI suggest button */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(99,102,241,.08)", borderRadius: 10, border: "1px solid rgba(99,102,241,.2)" }}>
              <Bot size={16} color="#818cf8" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>Generar con Prometeo IA</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Basado en: {lead.jobType ?? lead.description ?? "descripción del trabajo"}
                </div>
              </div>
              <button
                onClick={() => void handleSuggest()}
                disabled={suggesting}
                style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#4f46e5", color: "white", fontWeight: 700, fontSize: 12, cursor: suggesting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: suggesting ? 0.7 : 1 }}
              >
                {suggesting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Bot size={12} />}
                {suggesting ? "Generando..." : items.length > 0 ? "Regenerar" : "Generar items"}
              </button>
            </div>

            {/* Line items */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Items del estimado</span>
                <button onClick={addItem} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}>
                  <Plus size={11} /> Agregar item
                </button>
              </div>

              {items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted)", fontSize: 12, border: "1px dashed var(--border)", borderRadius: 8 }}>
                  Usa &quot;Generar items&quot; o agrega manualmente
                </div>
              ) : (
                <div style={{ display: "grid", gap: 4 }}>
                  {/* Header */}
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 60px 80px 80px 24px", gap: 6, padding: "4px 6px" }}>
                    {["Descripción", "Cant.", "Precio u.", "Total", ""].map((h) => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{h}</div>
                    ))}
                  </div>

                  {items.map((item, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 60px 80px 80px 24px", gap: 6, alignItems: "center", background: "rgba(255,255,255,.02)", borderRadius: 6, padding: "4px 6px", border: `1px solid ${CATEGORY_COLORS[item.category]}22` }}>
                      <div>
                        <input
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          style={{ ...inputCss, marginBottom: 2 }}
                          placeholder="Descripción del item"
                        />
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(idx, "category", e.target.value)}
                          style={{ ...inputCss, fontSize: 10 }}
                        >
                          <option value="materials">Materiales</option>
                          <option value="labor">Mano de obra</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                      <input
                        value={item.qty}
                        type="number"
                        min={0}
                        step={0.5}
                        onChange={(e) => updateItem(idx, "qty", e.target.value)}
                        style={inputCss}
                      />
                      <input
                        value={item.unitPrice}
                        type="number"
                        min={0}
                        step={0.5}
                        onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                        style={inputCss}
                      />
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", textAlign: "right" }}>
                        ${item.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <button onClick={() => removeItem(idx)} style={{ padding: 2, border: "none", background: "transparent", color: "#f87171", cursor: "pointer" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, gap: 24, fontSize: 13 }}>
                  <div style={{ color: "var(--muted)" }}>Subtotal</div>
                  <div style={{ fontWeight: 900, color: "var(--ink)", minWidth: 80, textAlign: "right" }}>
                    <DollarSign size={11} style={{ display: "inline", marginRight: 2 }} />
                    {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>

            {/* Date, notes, terms */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase" }}>Fecha de vencimiento</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputCss} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase" }}>Notas al cliente</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputCss, resize: "vertical" }} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase" }}>Términos y condiciones</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} style={{ ...inputCss, resize: "vertical" }} />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={creating || items.length === 0}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: items.length === 0 ? "var(--border)" : "#3b82f6", color: items.length === 0 ? "var(--muted)" : "white", fontWeight: 700, fontSize: 13, cursor: creating || items.length === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                {creating ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : null}
                {creating ? "Creando..." : `Crear estimado${subtotal > 0 ? ` · $${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X, CreditCard, Building2, Wallet, Globe, Lock, CheckCircle, AlertTriangle } from "lucide-react";

type Provider = "mock" | "stripe" | "paypal" | "adyen" | "bank-transfer";
type MethodType = "card" | "bank_transfer" | "ach" | "sepa" | "wallet";

interface EscrowFundModalProps {
  jobId: string;
  jobTitle: string;
  suggestedAmount?: number;
  onClose: () => void;
  onSuccess: (txn: { amount: number; provider: Provider; method: MethodType }) => void;
}

const PROVIDERS: { id: Provider; label: string; description: string; icon: typeof CreditCard; color: string }[] = [
  { id: "stripe",        label: "Stripe",         description: "Tarjeta de crédito/débito segura",     icon: CreditCard,  color: "#635bff" },
  { id: "paypal",        label: "PayPal",          description: "Cuenta PayPal o tarjeta vinculada",    icon: Globe,       color: "#003087" },
  { id: "bank-transfer", label: "Transferencia",   description: "ACH / SEPA / transferencia bancaria",  icon: Building2,   color: "#10b981" },
  { id: "adyen",         label: "Adyen",           description: "Pagos globales multi-canal",           icon: Wallet,      color: "#0abf53" },
  { id: "mock",          label: "Sandbox",         description: "Simulación para pruebas y desarrollo", icon: CheckCircle, color: "#8b5cf6" },
];

const METHODS_FOR_PROVIDER: Record<Provider, { id: MethodType; label: string }[]> = {
  stripe:          [{ id: "card", label: "Tarjeta" }, { id: "bank_transfer", label: "Banco" }, { id: "wallet", label: "Wallet" }],
  paypal:          [{ id: "wallet", label: "PayPal Balance" }, { id: "card", label: "Tarjeta" }],
  "bank-transfer": [{ id: "ach", label: "ACH (USA)" }, { id: "sepa", label: "SEPA (Europa)" }, { id: "bank_transfer", label: "Transferencia" }],
  adyen:           [{ id: "card", label: "Tarjeta" }, { id: "bank_transfer", label: "Banco" }, { id: "ach", label: "ACH" }, { id: "sepa", label: "SEPA" }],
  mock:            [{ id: "card", label: "Tarjeta simulada" }],
};

const CURRENCIES = ["USD", "EUR", "CAD", "MXN"];

export function EscrowFundModal({ jobId, jobTitle, suggestedAmount, onClose, onSuccess }: EscrowFundModalProps) {
  const [step, setStep] = useState<"form" | "confirm" | "success" | "error">("form");
  const [amount, setAmount] = useState(suggestedAmount ? String(suggestedAmount) : "");
  const [currency, setCurrency] = useState("USD");
  const [provider, setProvider] = useState<Provider>("mock");
  const [method, setMethod] = useState<MethodType>("card");
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const methods = METHODS_FOR_PROVIDER[provider];
  const selectedProvider = PROVIDERS.find(p => p.id === provider)!;

  function handleProviderChange(p: Provider) {
    setProvider(p);
    setMethod(METHODS_FOR_PROVIDER[p][0].id);
  }

  async function handleSubmit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErrMsg("Monto inválido"); return; }
    setStep("confirm");
  }

  async function handleConfirm() {
    setLoading(true);
    setErrMsg("");
    try {
      const res = await fetch(`/api/semse/jobs/${jobId}/escrow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(amount), currency, provider, methodType: method }),
      });
      const data = await res.json() as { data?: unknown; error?: { message: string } };
      if (!res.ok || data.error) {
        setErrMsg(data.error?.message ?? "Error al procesar el pago");
        setStep("error");
        return;
      }
      setStep("success");
      setTimeout(() => onSuccess({ amount: parseFloat(amount), provider, method }), 1200);
    } catch {
      setErrMsg("No se pudo conectar con el servidor de pagos");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 200,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
  };

  const modal: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "20px",
    width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto",
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 13px", borderRadius: "9px",
    border: "1px solid var(--border)", background: "var(--bg)",
    color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box",
  };

  if (step === "success") return (
    <div style={overlay}>
      <div style={{ ...modal, padding: "48px 32px", textAlign: "center" }}>
        <CheckCircle size={48} color="#10b981" style={{ margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", marginBottom: "8px" }}>¡Escrow fondeado!</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)" }}>${parseFloat(amount).toLocaleString()} {currency} procesados via {selectedProvider.label}.</p>
        <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "6px" }}>El profesional puede comenzar el trabajo.</p>
      </div>
    </div>
  );

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 0" }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 800, color: "var(--ink)" }}>Fondear escrow</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>{jobTitle}</p>
          </div>
          <button onClick={onClose} style={{ padding: "6px", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", borderRadius: "8px", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {step === "error" && (
            <div style={{ padding: "12px 14px", borderRadius: "10px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={14} color="#ef4444" />
              <p style={{ fontSize: "13px", color: "#ef4444" }}>{errMsg}</p>
            </div>
          )}

          {step !== "confirm" ? (
            <div style={{ display: "grid", gap: "18px" }}>
              {/* Amount */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>MONTO</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: "14px", fontWeight: 700 }}>$</span>
                    <input
                      data-testid="escrow-fund-amount"
                      type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="0.00" min="1" step="0.01"
                      style={{ ...inp, paddingLeft: "28px" }}
                    />
                  </div>
                  <select data-testid="escrow-fund-currency" value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inp, width: "80px", cursor: "pointer" }}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {suggestedAmount && (
                  <button onClick={() => setAmount(String(suggestedAmount))} style={{ marginTop: "6px", background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "var(--brand)", padding: 0, fontWeight: 600 }}>
                    Usar presupuesto sugerido: ${suggestedAmount.toLocaleString()}
                  </button>
                )}
              </div>

              {/* Provider */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "8px" }}>PROVEEDOR DE PAGO</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {PROVIDERS.map(p => {
                    const Icon = p.icon;
                    const selected = provider === p.id;
                    return (
                      <button
                        key={p.id}
                        data-testid={`escrow-provider-${p.id}`}
                        onClick={() => handleProviderChange(p.id)}
                        style={{
                          padding: "12px", borderRadius: "10px", border: `1px solid ${selected ? p.color : "var(--border)"}`,
                          background: selected ? `${p.color}14` : "var(--bg)",
                          cursor: "pointer", textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                          <Icon size={14} color={selected ? p.color : "var(--muted)"} />
                          <span style={{ fontSize: "12px", fontWeight: 700, color: selected ? p.color : "var(--ink)" }}>{p.label}</span>
                        </div>
                        <p style={{ fontSize: "10px", color: "var(--faint)", lineHeight: 1.3 }}>{p.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Method */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>MÉTODO DE PAGO</label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {methods.map(m => (
                    <button
                      data-testid={`escrow-method-${m.id}`}
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      style={{
                        padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${method === m.id ? "var(--brand)" : "var(--border)"}`,
                        background: method === m.id ? "var(--brand)14" : "var(--bg)",
                        color: method === m.id ? "var(--brand)" : "var(--muted)",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security note */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "9px", background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.15)" }}>
                <Lock size={12} color="#10b981" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>
                  Los fondos quedan retenidos en escrow hasta que apruebes el trabajo. No se liberan sin tu autorización.
                </p>
              </div>

              {errMsg && step === "form" && (
                <p style={{ fontSize: "12px", color: "#ef4444" }}>{errMsg}</p>
              )}

              <button data-testid="escrow-fund-continue" onClick={handleSubmit} style={{ padding: "12px", borderRadius: "10px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
                Continuar → Confirmar pago
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ padding: "20px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px", fontWeight: 700 }}>RESUMEN DEL PAGO</p>
                {[
                  ["Proyecto", jobTitle],
                  ["Monto", `$${parseFloat(amount).toLocaleString()} ${currency}`],
                  ["Proveedor", selectedProvider.label],
                  ["Método", methods.find(m => m.id === method)?.label ?? method],
                  ["Destino", "Escrow — protegido hasta aprobación"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>{k}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button data-testid="escrow-fund-back" onClick={() => setStep("form")} style={{ padding: "11px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  ← Volver
                </button>
                <button data-testid="escrow-fund-confirm" onClick={handleConfirm} disabled={loading} style={{ padding: "11px", borderRadius: "10px", border: "none", background: loading ? "var(--muted)" : "#10b981", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Procesando..." : "✓ Confirmar pago"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Building2, CreditCard, Wallet, Check, ChevronDown, AlertTriangle, Loader2 } from "lucide-react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { normalizeErrorMessage } from "../../semse-api";
import { getStripe, isStripeConfigured } from "../../../lib/stripe-client";

type PayoutType = "bank_account" | "debit_card" | "paypal" | "zelle" | "cashapp";

export interface PayoutMethod {
  type: PayoutType;
  label: string;
  last4?: string;
  bankName?: string;
  email?: string;
  verified: boolean;
}

interface PayoutMethodFormProps {
  currentMethod?: PayoutMethod;
  onSave: (method: PayoutMethod) => void;
}

const PAYOUT_TYPES: { id: PayoutType; label: string; description: string; icon: typeof Building2 }[] = [
  { id: "bank_account", label: "Cuenta bancaria",   description: "ACH o transferencia directa",   icon: Building2  },
  { id: "debit_card",   label: "Tarjeta de débito",  description: "Depósito instantáneo",          icon: CreditCard },
  { id: "paypal",       label: "PayPal",             description: "Recibe en tu cuenta PayPal",    icon: Wallet     },
  { id: "zelle",        label: "Zelle",              description: "Transferencia USA en minutos",  icon: Wallet     },
  { id: "cashapp",      label: "Cash App",           description: "Recibe en tu $cashtag",         icon: Wallet     },
];

const US_BANKS = ["Bank of America", "Chase", "Wells Fargo", "Citibank", "TD Bank", "PNC Bank", "US Bank", "Otro"];

function validate(type: PayoutType, bankName: string, routing: string, email: string): string | null {
  if (type === "bank_account") {
    if (!bankName) return "Selecciona un banco";
    if (routing.length !== 9) return "El routing number debe tener 9 dígitos";
  }
  if (type === "paypal" && !email.includes("@")) return "Email PayPal inválido";
  if (type === "zelle" && email.length < 5) return "Teléfono o email Zelle requerido";
  if (type === "cashapp" && !email.startsWith("$")) return "El $cashtag debe comenzar con $";
  return null;
}

const cardElementStyle = {
  style: {
    base: {
      fontSize: "13px",
      color: "var(--ink, #0f172a)",
      "::placeholder": { color: "var(--muted, #94a3b8)" },
    },
    invalid: { color: "var(--error)" },
  },
};

function PayoutMethodFormInner({ currentMethod, onSave }: PayoutMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [type, setType]           = useState<PayoutType>(currentMethod?.type ?? "bank_account");
  const [bankName, setBankName]   = useState(currentMethod?.bankName ?? "");
  const [routing, setRouting]     = useState("");
  // The account number never leaves the browser except inside the direct
  // stripe.createToken() call below (browser → Stripe's own servers) — it is
  // never sent to our own BFF/backend. See AUDIT_REMEDIATION_PLAN.md 2.44.
  const [account, setAccount]     = useState("");
  const [email, setEmail]         = useState(currentMethod?.email ?? "");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: "9px",
    border: "1px solid var(--border)", background: "var(--bg)",
    color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box",
  };

  async function tokenizeBankAccount(): Promise<{ token: string; last4?: string } | null> {
    if (!stripe) {
      setError("Stripe no está listo todavía. Intenta de nuevo en un momento.");
      return null;
    }
    const result = await stripe.createToken("bank_account", {
      country: "US",
      currency: "usd",
      routing_number: routing,
      account_number: account,
      account_holder_type: "individual",
    });
    if (result.error) {
      setError(result.error.message ?? "No se pudo verificar la cuenta bancaria.");
      return null;
    }
    return { token: result.token.id, last4: result.token.bank_account?.last4 };
  }

  async function tokenizeCard(): Promise<{ token: string; last4?: string } | null> {
    if (!stripe || !elements) {
      setError("Stripe no está listo todavía. Intenta de nuevo en un momento.");
      return null;
    }
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError("Completa los datos de la tarjeta.");
      return null;
    }
    const result = await stripe.createToken(cardElement);
    if (result.error) {
      setError(result.error.message ?? "No se pudo verificar la tarjeta.");
      return null;
    }
    return { token: result.token.id, last4: result.token.card?.last4 };
  }

  async function handleSave() {
    const validationError = validate(type, bankName, routing, email);
    if (validationError) { setError(validationError); return; }
    if (type === "debit_card" && !cardComplete) { setError("Completa los datos de la tarjeta."); return; }
    setError(null);
    setSaving(true);

    try {
      // Card and bank account numbers are tokenized directly against Stripe's
      // servers from the browser (stripe.createToken) — our own backend only
      // ever receives the resulting token id + the last4 Stripe's response
      // includes, never the raw PAN/routing/account number. Digital wallets
      // (PayPal/Zelle/Cash App) only ever collected a handle/email, not
      // financial account numbers, so they're unaffected.
      let token: string | undefined;
      let last4: string | undefined;
      if (type === "bank_account") {
        const result = await tokenizeBankAccount();
        if (!result) { setSaving(false); return; }
        token = result.token;
        last4 = result.last4;
      } else if (type === "debit_card") {
        const result = await tokenizeCard();
        if (!result) { setSaving(false); return; }
        token = result.token;
        last4 = result.last4;
      }

      const method: PayoutMethod = {
        type,
        label: PAYOUT_TYPES.find(t => t.id === type)!.label,
        bankName: type === "bank_account" ? bankName : undefined,
        last4,
        email: ["paypal", "zelle", "cashapp"].includes(type) ? email : undefined,
        verified: false,
      };

      const response = await fetch("/api/semse/workers/payout-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          bankName: method.bankName,
          stripeToken: token,
          last4: method.last4,
          email: method.email,
        }),
      });
      if (!response.ok) {
        throw new Error("No se pudo guardar el método de cobro");
      }
      const payload = await response.json() as { error?: unknown };
      const errorMessage = normalizeErrorMessage(payload.error);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSave(method);
    } catch (caught) {
      setSaving(false);
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el método de cobro");
    }
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      {/* Type selector */}
      <div>
        <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "8px" }}>TIPO DE MÉTODO DE COBRO</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {PAYOUT_TYPES.map(t => {
            const Icon = t.icon;
            const sel = type === t.id;
            return (
              <button
                key={t.id}
                data-testid={`payout-type-${t.id}`}
                onClick={() => { setType(t.id); setError(null); }}
                style={{
                  padding: "12px", borderRadius: "10px",
                  border: `1px solid ${sel ? "var(--brand)" : "var(--border)"}`,
                  background: sel ? "var(--brand)10" : "var(--bg)",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "3px" }}>
                  <Icon size={13} color={sel ? "var(--brand)" : "var(--muted)"} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: sel ? "var(--brand)" : "var(--ink)" }}>{t.label}</span>
                </div>
                <p style={{ fontSize: "10px", color: "var(--faint)" }}>{t.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bank account fields */}
      {type === "bank_account" && (
        <>
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>BANCO</label>
            <div style={{ position: "relative" }}>
              <select data-testid="payout-bank-name" value={bankName} onChange={e => setBankName(e.target.value)} style={{ ...inp, paddingRight: "32px", appearance: "none", cursor: "pointer" }}>
                <option value="">Seleccionar banco...</option>
                {US_BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>ROUTING NUMBER</label>
              <input
                data-testid="payout-routing"
                value={routing}
                onChange={e => setRouting(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="9 dígitos"
                style={{ ...inp, borderColor: routing.length > 0 && routing.length !== 9 ? "var(--error)" : "var(--border)" }}
                maxLength={9}
              />
              {routing.length > 0 && routing.length !== 9 && (
                <p style={{ fontSize: "10px", color: "var(--error)", marginTop: "3px" }}>{routing.length}/9 dígitos</p>
              )}
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>NÚMERO DE CUENTA</label>
              <input
                data-testid="payout-account"
                value={account}
                onChange={e => setAccount(e.target.value.replace(/\D/g, "").slice(0, 17))}
                placeholder="Hasta 17 dígitos"
                style={inp}
              />
            </div>
          </div>
          <p style={{ fontSize: "11px", color: "var(--muted)" }}>
            Tu número de cuenta se verifica directo con Stripe desde tu navegador — nunca pasa por nuestros servidores, solo guardamos los últimos 4 dígitos.
          </p>
        </>
      )}

      {/* Debit card — Stripe's own hosted CardElement, never our own <input> */}
      {type === "debit_card" && (
        <div>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>DATOS DE LA TARJETA</label>
          <div style={{ ...inp, padding: "12px" }}>
            <CardElement options={cardElementStyle} onChange={(e) => setCardComplete(e.complete)} />
          </div>
          <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "5px" }}>
            El número de tarjeta lo procesa Stripe directamente en tu navegador — nunca llega a nuestros servidores. Solo guardamos los últimos 4 dígitos.
          </p>
        </div>
      )}

      {/* Digital wallets */}
      {(type === "paypal" || type === "zelle" || type === "cashapp") && (
        <div>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
            {type === "paypal" ? "EMAIL PAYPAL" : type === "cashapp" ? "$CASHTAG" : "TELÉFONO O EMAIL ZELLE"}
          </label>
          <input
            data-testid="payout-digital-handle"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={type === "paypal" ? "tu@email.com" : type === "cashapp" ? "$TuCashTag" : "+1 305 555 0000"}
            style={inp}
          />
        </div>
      )}

      {/* Validation error */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "9px", background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.2)" }}>
          <AlertTriangle size={13} color="var(--error)" />
          <p style={{ fontSize: "12px", color: "var(--error)" }}>{error}</p>
        </div>
      )}

      {/* Info note */}
      <div style={{ padding: "10px 12px", borderRadius: "9px", background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.15)", fontSize: "11px", color: "var(--muted)", lineHeight: 1.6 }}>
        Los pagos se liberan desde escrow cuando el cliente aprueba un milestone. Procesamiento: 1-3 días hábiles para banco, instantáneo para tarjeta de débito.
      </div>

      <button
        data-testid="payout-save-button"
        onClick={() => void handleSave()}
        disabled={saving}
        style={{
          padding: "12px", borderRadius: "10px", border: "none",
          background: saved ? "var(--ok)" : saving ? "var(--muted)" : "var(--brand)",
          color: "#fff", fontSize: "14px", fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
          transition: "background 0.2s",
        }}
      >
        {saving  ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</> :
         saved   ? <><Check size={16} /> Guardado</> :
         "Guardar método de cobro"}
      </button>
    </div>
  );
}

export function PayoutMethodForm(props: PayoutMethodFormProps) {
  const stripePromise = useMemo(() => getStripe(), []);

  if (!isStripeConfigured()) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 14px", borderRadius: "9px", background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.2)" }}>
        <AlertTriangle size={14} color="var(--error)" />
        <p style={{ fontSize: "12px", color: "var(--error)" }}>
          El método de cobro no está disponible todavía — falta configurar la clave pública de Stripe en este entorno.
        </p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <PayoutMethodFormInner {...props} />
    </Elements>
  );
}

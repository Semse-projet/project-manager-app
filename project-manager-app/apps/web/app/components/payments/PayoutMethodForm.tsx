"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { normalizeErrorMessage } from "../../semse-api";

export type PayoutType = "bank_account" | "debit_card" | "paypal" | "zelle" | "cashapp";
type SafeManualPayoutType = "paypal" | "zelle" | "cashapp";

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

const PAYOUT_TYPES: Array<{
  id: SafeManualPayoutType;
  label: string;
  description: string;
}> = [
  { id: "paypal", label: "PayPal", description: "Identificador para instrucción manual" },
  { id: "zelle", label: "Zelle", description: "Teléfono o email para instrucción manual" },
  { id: "cashapp", label: "Cash App", description: "$cashtag para instrucción manual" },
];

function isSafeManualType(type: PayoutType | undefined): type is SafeManualPayoutType {
  return type === "paypal" || type === "zelle" || type === "cashapp";
}

function validate(type: SafeManualPayoutType, handle: string): string | null {
  if (type === "paypal" && !handle.includes("@")) return "Email PayPal inválido";
  if (type === "zelle" && handle.length < 5) return "Teléfono o email Zelle requerido";
  if (type === "cashapp" && !handle.startsWith("$")) return "El $cashtag debe comenzar con $";
  return null;
}

export function PayoutMethodForm({ currentMethod, onSave }: PayoutMethodFormProps) {
  const [type, setType] = useState<SafeManualPayoutType>(
    isSafeManualType(currentMethod?.type) ? currentMethod.type : "paypal",
  );
  const [handle, setHandle] = useState(
    isSafeManualType(currentMethod?.type) ? currentMethod.email ?? "" : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const legacyFinancialMethod = currentMethod
    && (currentMethod.type === "bank_account" || currentMethod.type === "debit_card")
    ? currentMethod
    : null;

  async function handleSave() {
    const normalizedHandle = handle.trim();
    const validationError = validate(type, normalizedHandle);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);
    const method: PayoutMethod = {
      type,
      label: PAYOUT_TYPES.find((candidate) => candidate.id === type)?.label ?? type,
      email: normalizedHandle,
      verified: false,
    };

    try {
      const response = await fetch("/api/semse/workers/payout-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, email: normalizedHandle }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: unknown };
      const errorMessage = normalizeErrorMessage(payload.error);
      if (!response.ok || errorMessage) {
        throw new Error(errorMessage || "No se pudo guardar el identificador de cobro");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSave(method);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el identificador de cobro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        role="note"
        data-testid="payout-sensitive-fields-disabled"
        style={{ display: "grid", gap: 7, padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.22)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#818cf8", fontSize: 12, fontWeight: 800 }}>
          <ShieldCheck size={15} /> Captura financiera directa deshabilitada
        </div>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
          SEMSE no solicita aquí números completos de tarjeta, cuenta ni routing. Para cobros automáticos usa Stripe Connect en la sección siguiente.
        </p>
        <a href="#stripe-connect-account" style={{ justifySelf: "start", color: "#818cf8", fontSize: 11, fontWeight: 800 }}>
          Ir a Stripe Connect
        </a>
      </div>

      {legacyFinancialMethod ? (
        <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderRadius: 9, background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.22)" }}>
          <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 11, lineHeight: 1.55 }}>
            Tu método legacy “{legacyFinancialMethod.label}”
            {legacyFinancialMethod.last4 ? ` terminado en ${legacyFinancialMethod.last4}` : ""} queda solo como referencia histórica y no puede editarse aquí. Migra a Stripe Connect.
          </p>
        </div>
      ) : null}

      <div>
        <label style={{ display: "block", marginBottom: 8, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>
          IDENTIFICADOR PARA RIEL MANUAL
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {PAYOUT_TYPES.map((candidate) => {
            const selected = type === candidate.id;
            return (
              <button
                key={candidate.id}
                type="button"
                data-testid={`payout-type-${candidate.id}`}
                onClick={() => {
                  setType(candidate.id);
                  setHandle("");
                  setError(null);
                }}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${selected ? "var(--brand)" : "var(--border)"}`, background: selected ? "var(--brand)10" : "var(--bg)", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                  <Wallet size={13} color={selected ? "var(--brand)" : "var(--muted)"} />
                  <span style={{ color: selected ? "var(--brand)" : "var(--ink)", fontSize: 12, fontWeight: 700 }}>{candidate.label}</span>
                </div>
                <p style={{ margin: 0, color: "var(--faint)", fontSize: 10 }}>{candidate.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={{ display: "block", marginBottom: 6, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>
          {type === "paypal" ? "EMAIL PAYPAL" : type === "cashapp" ? "$CASHTAG" : "TELÉFONO O EMAIL ZELLE"}
        </label>
        <input
          data-testid="payout-digital-handle"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder={type === "paypal" ? "tu@email.com" : type === "cashapp" ? "$TuCashTag" : "+1 305 555 0000"}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
        />
        <p style={{ margin: "5px 0 0", color: "var(--faint)", fontSize: 10 }}>
          Este identificador no habilita payout automático; solo queda como instrucción manual auditada.
        </p>
      </div>

      {error ? (
        <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 9, background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.2)" }}>
          <AlertTriangle size={13} color="#ef4444" />
          <p style={{ margin: 0, color: "#ef4444", fontSize: 12 }}>{error}</p>
        </div>
      ) : null}

      <button
        type="button"
        data-testid="payout-save-button"
        onClick={() => void handleSave()}
        disabled={saving}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 12, borderRadius: 10, border: "none", background: saved ? "#10b981" : saving ? "var(--muted)" : "var(--brand)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", transition: "background 0.2s" }}
      >
        {saving ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
          : saved ? <><Check size={16} /> Guardado</>
          : "Guardar identificador manual"}
      </button>
    </div>
  );
}

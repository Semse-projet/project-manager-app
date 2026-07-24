"use client";

import type { ReactNode } from "react";
import { Button } from "./button";

/**
 * Generic confirmation modal for actions that move money or otherwise
 * cannot be safely undone (release payments, resolve disputes, etc).
 * Introduced for docs/AUDIT_REMEDIATION_PLAN.md 1.1/1.3 — before this,
 * several client-facing money/dispute actions fired immediately on click
 * with no confirmation step and no visible amount/outcome summary.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Rows rendered as a "label: value" summary above the action buttons — e.g. amount, milestone, outcome. */
  details?: Array<{ label: string; value: string }>;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "destructive";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  details,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmVariant = "primary",
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "20px",
          width: "100%", maxWidth: "440px", padding: "24px",
        }}
      >
        <h2 id="confirm-dialog-title" style={{ fontSize: "16px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>
          {title}
        </h2>
        {description ? (
          <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "8px", lineHeight: 1.5 }}>
            {description}
          </div>
        ) : null}

        {details && details.length > 0 ? (
          <div style={{ marginTop: "16px", padding: "14px 16px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)" }}>
            {details.map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>{row.label}</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)" }}>{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "12px" }}>{error}</p>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "20px" }}>
          <Button variant="ghost" onClick={onCancel} disabled={loading} data-testid="confirm-dialog-cancel">
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={loading}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

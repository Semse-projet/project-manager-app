"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

/**
 * Small, token-only UI kit for the liens / forge / satellites surfaces.
 *
 * Every color resolves to a theme token from apps/web/app/globals.css
 * (`--ok`, `--warn`, `--error`, `--brand`, `--violet`, `--signal`, `--muted`),
 * and translucent fills use `color-mix()` over the same token, so the screens
 * stay correct in both the dark (default) and light themes — unlike the
 * `@semse/ui` StatusBadge, which hardcodes dark-theme Tailwind shades.
 */

export type Tone = "ok" | "warn" | "error" | "brand" | "violet" | "signal" | "muted";

export const toneColor = (tone: Tone) => `var(--${tone})`;
export const toneFill = (tone: Tone, pct = 12) => `color-mix(in srgb, var(--${tone}) ${pct}%, transparent)`;

export function Pill({ tone, children, icon: Icon }: { tone: Tone; children: ReactNode; icon?: LucideIcon }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        color: toneColor(tone),
        background: toneFill(tone, 12),
        border: `1px solid ${toneFill(tone, 30)}`
      }}
    >
      {Icon ? <Icon size={11} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Panel({
  title,
  icon: Icon,
  actions,
  children,
  padded = true,
  style
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        ...style
      }}
    >
      {title ? (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            flexWrap: "wrap"
          }}
        >
          {Icon ? <Icon size={15} style={{ color: "var(--muted)" }} aria-hidden /> : null}
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)", flex: 1, minWidth: 0 }}>{title}</h2>
          {actions}
        </header>
      ) : null}
      <div style={padded ? { padding: 16 } : undefined}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone = "muted", hint }: { label: string; value: ReactNode; tone?: Tone; hint?: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "14px 16px",
        minWidth: 0
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--muted)" }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone === "muted" ? "var(--ink)" : toneColor(tone), marginTop: 4, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint ? <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>{children}</div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  children,
  onClick,
  variant = "secondary",
  icon: Icon,
  busy = false,
  disabled = false,
  type = "button",
  title
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const palette: Record<ButtonVariant, CSSProperties> = {
    primary: { background: "var(--brand-fill)", color: "#fff", border: "1px solid var(--brand-fill)" },
    secondary: { background: "var(--raised)", color: "var(--ink)", border: "1px solid var(--border)" },
    danger: { background: toneFill("error", 12), color: "var(--error)", border: `1px solid ${toneFill("error", 35)}` },
    ghost: { background: "transparent", color: "var(--muted)", border: "1px solid transparent" }
  };
  const isDisabled = disabled || busy;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        whiteSpace: "nowrap",
        ...palette[variant]
      }}
    >
      {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : Icon ? <Icon size={14} aria-hidden /> : null}
      {children}
    </button>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--ink)",
  fontSize: 13,
  boxSizing: "border-box"
};

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 11, color: "var(--faint)" }}>{hint}</span> : null}
    </label>
  );
}

export function Banner({ tone, children, onDismiss }: { tone: Tone; children: ReactNode; onDismiss?: () => void }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 13,
        color: "var(--ink)",
        background: toneFill(tone, 10),
        border: `1px solid ${toneFill(tone, 35)}`
      }}
    >
      <span style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: toneColor(tone), flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar"
          style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function Empty({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--muted)" }}>
      {Icon ? <Icon size={28} style={{ color: "var(--faint)", marginBottom: 8 }} aria-hidden /> : null}
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
      {description ? <p style={{ margin: "6px auto 0", maxWidth: 460, fontSize: 13, lineHeight: 1.5 }}>{description}</p> : null}
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 32, color: "var(--muted)", fontSize: 13 }}>
      <Loader2 size={16} className="animate-spin" aria-hidden /> {label}
    </div>
  );
}

/** Modal confirmation for irreversible or billable actions. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "brand",
  busy,
  confirmDisabled = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "brand" | "error";
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "color-mix(in srgb, var(--bg) 70%, transparent)",
        backdropFilter: "blur(4px)"
      }}
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "var(--shadow-lg)"
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{title}</h3>
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant={tone === "error" ? "danger" : "primary"} onClick={onConfirm} busy={busy} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function formatDate(value?: string | null, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
  });
}

/** Whole days from now until `value` (negative when already past). */
export function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

export function shortId(id: string, size = 8): string {
  return id.length > size ? `${id.slice(0, size)}…` : id;
}

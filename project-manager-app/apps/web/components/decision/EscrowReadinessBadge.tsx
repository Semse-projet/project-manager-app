"use client";

import type { ReactNode } from "react";

export type EscrowReadinessStatus = "ready" | "blocked" | "needs_review" | "disputed" | "release_recommended";

export interface EscrowReadinessBadgeProps {
  status: EscrowReadinessStatus;
  label?: string;
  detail?: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
  suffix?: ReactNode;
}

const STATUS_COPY: Record<EscrowReadinessStatus, { label: string; tone: NonNullable<EscrowReadinessBadgeProps["tone"]> }> = {
  ready: { label: "Ready", tone: "positive" },
  blocked: { label: "Blocked", tone: "critical" },
  needs_review: { label: "Needs review", tone: "warning" },
  disputed: { label: "Disputed", tone: "critical" },
  release_recommended: { label: "Release recommended", tone: "positive" },
};

const TONE_STYLES: Record<NonNullable<EscrowReadinessBadgeProps["tone"]>, { bg: string; border: string; color: string }> = {
  neutral: { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.28)", color: "#cbd5e1" },
  positive: { bg: "rgba(16,185,129,0.14)", border: "rgba(16,185,129,0.32)", color: "#34d399" },
  warning: { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.32)", color: "#fbbf24" },
  critical: { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.32)", color: "#f87171" },
};

export function EscrowReadinessBadge({ status, label, detail, tone, suffix }: EscrowReadinessBadgeProps) {
  const copy = STATUS_COPY[status];
  const resolvedTone = tone ?? copy.tone;
  const styles = TONE_STYLES[resolvedTone];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "10px",
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.color,
        fontSize: "12px",
        fontWeight: 700,
        lineHeight: 1.2,
      }}
    >
      <span>{label ?? copy.label}</span>
      {detail ? <span style={{ color: "var(--muted)", fontWeight: 600 }}>{detail}</span> : null}
      {suffix}
    </div>
  );
}

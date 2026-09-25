"use client";

import { useLanguage } from "../../lib/language-context";

export type CapabilityRole = "CLIENT" | "PRO" | "WORKER";

const ROLE_CONFIG: Record<CapabilityRole, { color: string; bg: string; border: string }> = {
  CLIENT: { color: "#67e8f9", bg: "rgba(103,232,249,.10)", border: "rgba(103,232,249,.25)" },
  PRO:    { color: "#86efac", bg: "rgba(134,239,172,.10)", border: "rgba(134,239,172,.25)" },
  WORKER: { color: "#818cf8", bg: "rgba(129,140,248,.10)", border: "rgba(129,140,248,.25)" },
};

export function CapabilityBadge({
  role,
  size = "md",
}: {
  role: CapabilityRole;
  size?: "sm" | "md";
}) {
  const { t } = useLanguage();
  const cfg = ROLE_CONFIG[role];
  const fontSize = size === "sm" ? 10 : 11;
  const px = size === "sm" ? "6px 10px" : "5px 12px";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: px, borderRadius: 99,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize, fontWeight: 700, color: cfg.color,
    }}>
      {t(`capability.${role}`)}
    </span>
  );
}

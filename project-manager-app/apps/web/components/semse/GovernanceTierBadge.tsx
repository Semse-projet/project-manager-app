"use client";

import { Eye, Shield, Star, Users } from "lucide-react";

export type GovernanceTier = "observer" | "participant" | "contributor" | "steward";

const TIER_CONFIG: Record<GovernanceTier, { label: string; color: string; bg: string; border: string; Icon: typeof Eye }> = {
  observer:    { label: "Observer",    color: "#94a3b8", bg: "rgba(148,163,184,.10)", border: "rgba(148,163,184,.25)", Icon: Eye },
  participant: { label: "Participant", color: "#67e8f9", bg: "rgba(103,232,249,.10)", border: "rgba(103,232,249,.25)", Icon: Users },
  contributor: { label: "Contributor", color: "#818cf8", bg: "rgba(129,140,248,.10)", border: "rgba(129,140,248,.25)", Icon: Star },
  steward:     { label: "Steward",     color: "#86efac", bg: "rgba(134,239,172,.10)", border: "rgba(134,239,172,.25)", Icon: Shield },
};

export function GovernanceTierBadge({
  tier,
  credits,
  size = "md",
}: {
  tier: GovernanceTier;
  credits?: number;
  size?: "sm" | "md" | "lg";
}) {
  const cfg = TIER_CONFIG[tier];
  const Icon = cfg.Icon;
  const fontSize = size === "sm" ? 10 : size === "lg" ? 13 : 11;
  const iconSize = size === "sm" ? 9 : size === "lg" ? 14 : 11;
  const px = size === "sm" ? "6px 10px" : size === "lg" ? "7px 14px" : "5px 12px";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: px, borderRadius: 99,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize, fontWeight: 700, color: cfg.color,
    }}>
      <Icon size={iconSize} color={cfg.color} />
      {cfg.label}
      {credits !== undefined && (
        <span style={{ fontSize: fontSize - 1, color: cfg.color, opacity: 0.7, marginLeft: 2 }}>
          · {credits.toFixed(1)}cr
        </span>
      )}
    </span>
  );
}

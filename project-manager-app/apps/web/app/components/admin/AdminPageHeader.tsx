"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";

interface AdminPageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  backHref?: string;
  backLabel?: string;
  showBack?: boolean;
  actions?: ReactNode;
  panel?: boolean;
}

export function AdminPageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "var(--ink)",
  iconBg = "rgba(99,102,241,0.12)",
  backHref = "/admin/dashboard",
  backLabel = "Dashboard",
  showBack = true,
  actions,
  panel = false,
}: AdminPageHeaderProps) {
  const inner = (
    <>
      {showBack && backHref ? (
        <Link
          href={backHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: "var(--muted)",
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 14 }}>←</span> {backLabel}
        </Link>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {Icon ? (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: iconBg,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={20} color={iconColor} />
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--ink)" }}>{title}</h1>
          {subtitle ? (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
      </div>
    </>
  );

  return panel ? (
    <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={82} style={{ marginBottom: 24 }}>
      {inner}
    </HtmlInCanvasPanel>
  ) : (
    <div style={{ marginBottom: 24 }}>
      {inner}
    </div>
  );
}

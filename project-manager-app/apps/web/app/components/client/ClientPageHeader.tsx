"use client";

import type { CSSProperties, ReactNode } from "react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { ClientBreadcrumbs } from "./ClientBreadcrumbs";

type HeaderBreadcrumb = {
  label: string;
  href?: string;
};

export function ClientPageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  leading,
  panelStyle,
  minHeight = 88,
  marginBottom = 24,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs: HeaderBreadcrumb[];
  actions?: ReactNode;
  leading?: ReactNode;
  panelStyle?: CSSProperties;
  minHeight?: number;
  marginBottom?: number;
}) {
  return (
    <HtmlInCanvasPanel
      as="section"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom,
        ...panelStyle,
      }}
      canvasClassName="rounded-2xl"
      minHeight={minHeight}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1, minWidth: 0 }}>
        {leading ? <div style={{ flexShrink: 0 }}>{leading}</div> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <ClientBreadcrumbs items={breadcrumbs} />
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{title}</h1>
          {subtitle ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>{actions}</div> : null}
    </HtmlInCanvasPanel>
  );
}

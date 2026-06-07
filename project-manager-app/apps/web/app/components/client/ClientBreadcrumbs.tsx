"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CLIENT_ROUTES } from "../../lib/client-routes";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function ClientBreadcrumbs({
  items,
  includeDashboard = true,
}: {
  items: BreadcrumbItem[];
  includeDashboard?: boolean;
}) {
  const fullItems = includeDashboard
    ? [{ label: "Dashboard", href: CLIENT_ROUTES.dashboard }, ...items]
    : items;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", marginBottom: "8px" }}>
      {fullItems.map((item, index) => {
        const isLast = index === fullItems.length - 1;
        return (
          <div key={`${item.label}-${index}`} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                style={{
                  color: "var(--muted)",
                  fontSize: "12px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                style={{
                  color: isLast ? "var(--ink)" : "var(--muted)",
                  fontSize: "12px",
                  fontWeight: isLast ? 700 : 600,
                }}
              >
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight size={12} color="var(--faint)" />}
          </div>
        );
      })}
    </div>
  );
}

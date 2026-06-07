"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CLIENT_ROUTES } from "../../lib/client-routes";

export function ClientDashboardBackLink() {
  return (
    <Link
      href={CLIENT_ROUTES.dashboard}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        color: "var(--muted)",
        fontSize: "12px",
        fontWeight: 600,
        textDecoration: "none",
        marginBottom: "8px"
      }}
    >
      <ChevronLeft size={14} />
      Dashboard
    </Link>
  );
}

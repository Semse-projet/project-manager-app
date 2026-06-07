"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { StatCard } from "@semse/ui";

export function ClientSummaryCardLink(props: {
  href: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: "blue" | "amber" | "green" | "orange" | "violet";
  loading?: boolean;
  hint?: string;
}) {
  return (
    <Link
      href={props.href}
      style={{
        textDecoration: "none",
        display: "block",
        borderRadius: "16px",
        transition: "transform .12s, box-shadow .12s"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,.08)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      <div style={{ position: "relative" }}>
        <StatCard
          label={props.label}
          value={props.value}
          icon={props.icon}
          color={props.color}
          loading={props.loading}
        />
        {props.hint ? (
          <span
            style={{
              position: "absolute",
              right: "14px",
              bottom: "12px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--muted)"
            }}
          >
            {props.hint}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { subscribeToMissionControlEvents, type MissionIncident, type MissionIncidentSeverity } from "../../app/semse-api";

function severityColor(severity: MissionIncidentSeverity): string {
  if (severity === "critical") return "#ef4444";
  if (severity === "high") return "#fb7185";
  if (severity === "medium") return "#fbbf24";
  return "#38bdf8";
}

function displayText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export function MissionControlAlertBanner() {
  const [active, setActive] = useState<MissionIncident | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMissionControlEvents((incident) => {
      if (incident.severity === "critical" || incident.severity === "high") {
        setActive(incident);
      }
    });
    return unsubscribe;
  }, []);

  if (!active) return null;

  const color = severityColor(active.severity);

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: `${color}18`,
        border: `1px solid ${color}55`,
        borderRadius: 14,
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minWidth: 320,
        maxWidth: "90vw",
        boxShadow: "0 4px 24px rgba(0,0,0,.4)",
      }}
    >
      <ShieldAlert size={18} color={color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color }}>{displayText(active.title, "Incidente activo")}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayText(active.detail)}
        </div>
      </div>
      <Link
        href="/admin/ai-mission-control"
        style={{ fontSize: 11, color, fontWeight: 700, whiteSpace: "nowrap", textDecoration: "none", borderBottom: `1px solid ${color}55` }}
      >
        Ver
      </Link>
      <button
        onClick={() => setActive(null)}
        aria-label="Cerrar alerta"
        style={{ padding: 4, borderRadius: 6, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

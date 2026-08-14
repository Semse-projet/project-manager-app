"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMyCapabilities, type UserCapability } from "../../app/semse-api";

type AppRole = "client" | "worker" | "admin";

const ROLE_LABELS: Record<string, string> = {
  CLIENT: "Cliente",
  PRO: "Profesional",
  WORKER: "Trabajador",
  OPS_ADMIN: "Administración",
};

const ROLE_HREFS: Record<string, string> = {
  CLIENT: "/client/dashboard",
  PRO: "/worker/dashboard",
  WORKER: "/worker/dashboard",
  OPS_ADMIN: "/admin/dashboard",
};

function uniqueCapabilities(capabilities: UserCapability[]) {
  const seen = new Set<string>();
  return capabilities.filter((capability) => {
    if (seen.has(capability.role)) return false;
    seen.add(capability.role);
    return true;
  });
}

export function CapabilitySelector({ activeRole }: { activeRole: AppRole }) {
  const [capabilities, setCapabilities] = useState<UserCapability[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "degraded">("loading");

  useEffect(() => {
    let cancelled = false;
    fetchMyCapabilities()
      .then((next) => {
        if (cancelled) return;
        setCapabilities(uniqueCapabilities(next));
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("degraded");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => uniqueCapabilities(capabilities), [capabilities]);
  const activeCapability = activeRole === "client" ? "CLIENT" : activeRole === "worker" ? "WORKER" : "OPS_ADMIN";

  if (state === "loading" || (state === "ready" && options.length === 0)) return null;

  return (
    <label
      title={state === "degraded" ? "No se pudieron cargar tus capacidades" : "Capacidad activa por superficie"}
      style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "11px" }}
    >
      <span style={{ whiteSpace: "nowrap" }}>Capacidad</span>
      <select
        aria-label="Capacidad activa"
        value={activeCapability}
        onChange={(event) => {
          const href = ROLE_HREFS[event.target.value];
          if (href) window.location.assign(href);
        }}
        style={{
          maxWidth: "132px",
          border: "1px solid var(--border)",
          borderRadius: "7px",
          padding: "5px 7px",
          background: "var(--surface)",
          color: "var(--ink)",
          fontSize: "12px",
        }}
      >
        {options.map((capability) => (
          <option key={capability.role} value={capability.role}>
            {ROLE_LABELS[capability.role] ?? capability.role}
          </option>
        ))}
      </select>
    </label>
  );
}

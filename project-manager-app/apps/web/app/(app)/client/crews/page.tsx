"use client";

import Link from "next/link";
import { HardHat } from "lucide-react";
import { CrewsWorkspace } from "../../../../components/crews/CrewsWorkspace";

// Spec: docs/specs/core/crews-worksites.spec.md (APPROVED 2026-11-12).
// CLIENT and PRO (worker app role) both hold org:crews:manage; the API
// rejects anyone without it (403), and the screen explains that case.
export default function ClientCrewsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>
      <header>
        <Link href="/client/dashboard" style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          ← Dashboard
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "color-mix(in srgb, var(--warn) 14%, transparent)"
            }}
          >
            <HardHat size={20} style={{ color: "var(--warn)" }} aria-hidden />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Obras y cuadrillas</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Organiza tus equipos de campo: obras, cuadrillas, supervisores y miembros.
            </p>
          </div>
        </div>
      </header>
      <CrewsWorkspace />
    </div>
  );
}

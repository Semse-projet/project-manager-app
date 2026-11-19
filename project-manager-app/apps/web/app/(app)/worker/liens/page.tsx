"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { LienRightsWorkspace } from "../../../../components/liens/LienRightsWorkspace";
import { Loading } from "../../../../components/module-surface/ui";

// Spec: docs/specs/tools/fase-2/m2.1-lien-rights.spec.md (APPROVED).
// The project professional (PRO → worker app role) generates/sends notices
// and signs waivers here; the API enforces the pro-only rule per project.
export default function WorkerLiensPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>
      <header>
        <Link href="/worker/dashboard" style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
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
              background: "color-mix(in srgb, var(--violet) 14%, transparent)"
            }}
          >
            <Scale size={20} style={{ color: "var(--violet)" }} aria-hidden />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Derechos de gravamen</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Protege tu derecho a cobrar: plazos legales, avisos preliminares y waivers de tus proyectos.
            </p>
          </div>
        </div>
      </header>
      <Suspense fallback={<Loading />}>
        <LienRightsWorkspace mode="workspace" />
      </Suspense>
    </div>
  );
}

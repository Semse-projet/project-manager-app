"use client";

import { Suspense } from "react";
import { Scale } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { LienRightsWorkspace } from "../../../../components/liens/LienRightsWorkspace";
import { Loading } from "../../../../components/module-surface/ui";

// Spec: docs/specs/tools/fase-2/m2.1-lien-rights.spec.md (APPROVED).
export default function AdminLiensPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <AdminPageHeader
        title="Derechos de gravamen"
        subtitle="Supervisa plazos legales de liens por estado, avisos certificados y waivers que bloquean la liberación de escrow."
        icon={Scale}
        iconColor="var(--violet)"
        iconBg="color-mix(in srgb, var(--violet) 14%, transparent)"
        backHref="/admin/finance"
        backLabel="Finance"
      />
      <Suspense fallback={<Loading />}>
        <LienRightsWorkspace mode="admin" />
      </Suspense>
    </div>
  );
}

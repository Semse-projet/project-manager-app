"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircle } from "lucide-react";
import type { WorkspaceRole } from "../lib/workspace-model";
import { PanelState } from "./PanelState";

const WorkspacePrometeoCopilot = dynamic(
  () => import("../../components/prometeo/PrometeoCopilot").then((module) => module.PrometeoCopilot),
  {
    ssr: false,
    loading: () => <PanelState title="Abriendo Prometeo…" description="Cargando el widget existente." loading />,
  },
);

export function PrometeoAccess({ role, onMissionLoaded }: {
  role: WorkspaceRole | null;
  onMissionLoaded?: () => void;
}) {
  if (!role) {
    return <PanelState title="Prometeo no habilitado" description="No se ha podido resolver tu rol. No se consultó el asistente." />;
  }
  // La clave reinicia la activación al cambiar de rol. Un rol ausente desmonta
  // también el widget; recuperar el acceso requiere otro clic, sin consultas automáticas.
  return <PrometeoAccessCard key={role} onMissionLoaded={onMissionLoaded} />;
}

function PrometeoAccessCard({ onMissionLoaded }: { onMissionLoaded?: () => void }) {
  const [openSignal, setOpenSignal] = useState(0);

  return (
    <section aria-label="Acceso a Prometeo" className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Prometeo</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Abre el asistente existente cuando necesites ayuda con esta pantalla.</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Disponibilidad sin comprobar. Al abrir se consulta el contexto; las preguntas se envían solo cuando tú las solicitas.</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Referencia de trabajo · sin ejecución vinculada. Aceptar una sugerencia abre contexto, no ejecuta trabajo ni crea un proyecto operativo.</p>
          <button
            type="button"
            onClick={() => setOpenSignal((signal) => signal + 1)}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--brand-dim)] px-4 text-sm font-semibold text-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Abrir Prometeo
          </button>
        </div>
      </div>
      {openSignal > 0 && (
        <WorkspacePrometeoCopilot openSignal={openSignal} onWorkspaceMissionLoaded={onMissionLoaded} />
      )}
    </section>
  );
}

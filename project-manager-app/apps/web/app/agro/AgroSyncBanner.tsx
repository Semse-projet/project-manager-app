"use client";

// PR 15 de EXECUTION_CONTROL.md ("Offline Queue UI — sync status, retry").
// Montado en agro/layout.tsx: visible en cualquier subpagina de una finca, no
// solo en Tareas, porque las 8 acciones offline (tareas, animales, inventario,
// evidencia) se originan en paginas distintas.

import type { ReactNode } from "react";
import { useAgroSync } from "./AgroSyncProvider";

const ACTION_LABELS: Record<string, string> = {
  "farm_task.create": "una tarea nueva",
  "farm_task.complete": "completar una tarea",
  "farm_task.block": "bloquear una tarea",
  "animal.move": "mover un animal",
  "animal.weigh": "un pesaje",
  "animal_group.move": "mover un lote",
  "inventory_movement.create": "un movimiento de inventario",
  "evidence.note.create": "una nota de evidencia",
};

// Se monta en agro/layout.tsx, fuera de cualquier `.agro-shell` de pagina —
// el mismo max-width/padding aqui para que no se vea a ancho completo.
function BannerShell({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: 1040, margin: "0 auto", padding: "12px 20px 0" }}>{children}</div>;
}

export function AgroSyncBanner() {
  const { state, isOnline, autoSyncStopped, retryNow, permanentFailures } = useAgroSync();
  const pendingCount = state.pendingEvents.length;

  if (permanentFailures.length > 0) {
    const first = permanentFailures[0];
    const label = ACTION_LABELS[first.event.action] ?? "un cambio";
    return (
      <BannerShell>
        <div className="alert-banner alert-critical" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>
            SEMSE rechazó {label}{permanentFailures.length > 1 ? ` y ${permanentFailures.length - 1} cambio(s) más` : ""}: {first.error ?? "motivo desconocido"}.
            {pendingCount > 0 ? ` Sigue habiendo ${pendingCount} cambio(s) guardados en este dispositivo esperando sincronizar.` : ""}
          </span>
        </div>
      </BannerShell>
    );
  }

  if (pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <BannerShell>
        <div className="alert-banner alert-info">
          Sin conexión — {pendingCount} cambio{pendingCount === 1 ? "" : "s"} guardado{pendingCount === 1 ? "" : "s"} en este dispositivo. Se sincronizará{pendingCount === 1 ? "" : "n"} automáticamente al volver la señal.
        </div>
      </BannerShell>
    );
  }

  if (state.syncStatus === "syncing") {
    return (
      <BannerShell>
        <div className="alert-banner alert-info">
          Sincronizando {pendingCount} cambio{pendingCount === 1 ? "" : "s"}…
        </div>
      </BannerShell>
    );
  }

  if (state.syncStatus === "failed") {
    return (
      <BannerShell>
        <div className="alert-banner alert-warning" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>
            No pudimos sincronizar ahora{state.lastError ? `: ${state.lastError}` : ""}. Tus {pendingCount} cambio{pendingCount === 1 ? "" : "s"} sigue{pendingCount === 1 ? "" : "n"} guardado{pendingCount === 1 ? "" : "s"} aquí.
            {autoSyncStopped ? "" : " Seguiremos intentando automáticamente."}
          </span>
          <button onClick={retryNow} className="btn-ghost" style={{ fontSize: 11, padding: "4px 12px", flexShrink: 0 }}>
            Reintentar ahora
          </button>
        </div>
      </BannerShell>
    );
  }

  return (
    <BannerShell>
      <div className="alert-banner alert-warning">
        {pendingCount} cambio{pendingCount === 1 ? "" : "s"} pendiente{pendingCount === 1 ? "" : "s"} de sincronizar.
      </div>
    </BannerShell>
  );
}

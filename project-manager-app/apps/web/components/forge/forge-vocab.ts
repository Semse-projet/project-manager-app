import type { ForgeRunState, ForgeTaskStatus } from "../../app/lib/module-surfaces-api";
import type { Tone } from "../module-surface/ui";

/** Labels/tones for the Forge run lifecycle (docs/specs/fsm/forge-run-lifecycle.spec.md). */
export const RUN_STATE: Record<ForgeRunState, { label: string; tone: Tone; phase: number }> = {
  idea: { label: "Idea", tone: "muted", phase: 0 },
  intake: { label: "Intake", tone: "muted", phase: 0 },
  spec_draft: { label: "Spec borrador", tone: "signal", phase: 1 },
  spec_review: { label: "Spec en revisión", tone: "warn", phase: 1 },
  approved: { label: "Aprobado", tone: "ok", phase: 1 },
  planned: { label: "Planificado", tone: "brand", phase: 2 },
  building: { label: "Construyendo", tone: "brand", phase: 2 },
  verifying: { label: "Verificando", tone: "signal", phase: 2 },
  ready_for_review: { label: "Listo para revisión", tone: "warn", phase: 3 },
  merged: { label: "Fusionado", tone: "violet", phase: 3 },
  deployed: { label: "Desplegado", tone: "violet", phase: 4 },
  observing: { label: "Observando", tone: "signal", phase: 4 },
  closed: { label: "Cerrado", tone: "ok", phase: 5 },
  blocked: { label: "Bloqueado", tone: "error", phase: -1 },
  rolled_back: { label: "Revertido", tone: "error", phase: -1 }
};

/** The happy path drawn as a stepper; `blocked`/`rolled_back` are shown as an overlay state. */
export const RUN_PHASES = ["Descubrimiento", "Spec", "Construcción", "Revisión", "Despliegue", "Cierre"] as const;

export const TASK_STATUS: Record<ForgeTaskStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pendiente", tone: "muted" },
  ready: { label: "Lista", tone: "brand" },
  running: { label: "Ejecutando", tone: "signal" },
  blocked_on_dependency: { label: "Espera dependencia", tone: "warn" },
  blocked_on_approval: { label: "Espera aprobación", tone: "warn" },
  succeeded: { label: "Completada", tone: "ok" },
  failed: { label: "Falló", tone: "error" },
  cancelled: { label: "Cancelada", tone: "muted" }
};

export const RISK_TONE: Record<string, Tone> = { low: "ok", medium: "signal", high: "warn", critical: "error" };

export const APPROVAL_LABEL: Record<string, string> = {
  none: "Sin aprobación",
  creator_review: "Revisión del creador",
  ops_admin: "Operaciones",
  security: "Seguridad",
  dual_control: "Doble control"
};

export function runStateMeta(state: string) {
  return RUN_STATE[state as ForgeRunState] ?? { label: state, tone: "muted" as Tone, phase: 0 };
}

/**
 * C18 — predicado UNICO de "evidencia requerida validada" (aprobacion de hito y
 * reserva de fondos). Antes `computePaymentReadiness` solo bloqueaba por
 * evidencia faltante/rechazada: un requisito `submitted` (sin revisar) o
 * `archived` no bloqueaba, y el hito aprobado podia liberar dinero con evidencia
 * requerida sin validar. Regla: TODO requisito `required` debe estar `approved`.
 * Sin requisitos => no bloquea (los hitos sin checklist siguen su camino).
 */
export type EvidenceItemLike = { required: boolean; status: string };

export type EvidenceReadiness = {
  complete: boolean;
  blockers: string[];
  counts: { required: number; approved: number; missing: number; archived: number; rejected: number; submitted: number };
};

export function evaluateRequiredEvidence(items: EvidenceItemLike[]): EvidenceReadiness {
  const required = items.filter((i) => i.required);
  const count = (s: string) => required.filter((i) => i.status === s).length;
  const counts = {
    required: required.length,
    approved: count("approved"),
    missing: count("missing"),
    archived: count("archived"),
    rejected: count("rejected"),
    submitted: count("submitted"),
  };
  const blockers: string[] = [];
  if (counts.missing > 0) blockers.push(`${counts.missing} required evidence item(s) still missing`);
  if (counts.archived > 0) blockers.push(`${counts.archived} required evidence item(s) archived — need an active replacement`);
  if (counts.rejected > 0) blockers.push(`${counts.rejected} evidence item(s) rejected — must be resubmitted`);
  if (counts.submitted > 0) blockers.push(`${counts.submitted} required evidence item(s) submitted — pending review`);
  // Cualquier otro estado desconocido tambien impide dar por validada la evidencia.
  const known = counts.approved + counts.missing + counts.archived + counts.rejected + counts.submitted;
  if (known < counts.required) blockers.push(`${counts.required - known} required evidence item(s) in an unknown state`);
  return { complete: blockers.length === 0, blockers, counts };
}

/** MILESTONE_EVIDENCE_REVALIDATION: enforce (defecto) | shadow (solo observa) | off (rollback). */
export type EvidenceRevalidationMode = "enforce" | "shadow" | "off";

export function resolveEvidenceRevalidationMode(env: NodeJS.ProcessEnv = process.env): EvidenceRevalidationMode {
  const raw = env.MILESTONE_EVIDENCE_REVALIDATION?.trim().toLowerCase();
  return raw === "shadow" || raw === "off" ? raw : "enforce";
}

/**
 * Auto-aprobacion (cliente == profesional asignado): prohibida salvo OPS_ADMIN, o
 * en entornos NO productivos con el flag explicito de sandbox para demos de una org.
 */
export function selfApprovalAllowedInSandbox(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MILESTONE_ALLOW_SELF_APPROVAL?.trim().toLowerCase() === "sandbox" && env.NODE_ENV !== "production";
}

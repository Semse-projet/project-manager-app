import { ForbiddenException } from "@nestjs/common";
import { isOpsAdmin, type ScopeActor } from "../../common/resource-scope.js";
import { publicDisplayName } from "./public-sanitizer.js";
import type { ProfessionalCredentialRecord } from "./professional-credential.service.js";

/**
 * C51 etapa 3 — acceso a `GET /v1/intelligence/credentials/user/:userId` (decisión del dueño, 2026-10-04).
 * El registro ya se buscó DENTRO del tenant del actor. Además exige:
 *  - el propio usuario → registro completo;
 *  - OPS_ADMIN del tenant (el ámbito es el tenant del registro) → registro completo;
 *  - credencial publicada (`publicSlug`) → SOLO los campos públicos;
 *  - cualquier otro caso (credencial sin publicar de otro usuario) ⇒ 403.
 * Los campos públicos excluyen identificadores internos (id, tenantId, userId, orgId) y datos de negocio
 * (`totalManaged`, `activeProjects`, `lastActivityAt`, `updatedAt`).
 */
export type PublicCredentialView = Pick<
  ProfessionalCredentialRecord,
  | "displayName"
  | "completedProjects"
  | "onTimeRate"
  | "disputeRate"
  | "avgClientRating"
  | "trustScore"
  | "specialties"
  | "badges"
  | "verifiedAt"
  | "publicSlug"
>;

export function toPublicCredentialView(record: ProfessionalCredentialRecord): PublicCredentialView {
  return {
    displayName: publicDisplayName(record.displayName, "Profesional verificado"),
    completedProjects: record.completedProjects,
    onTimeRate: record.onTimeRate,
    disputeRate: record.disputeRate,
    avgClientRating: record.avgClientRating,
    trustScore: record.trustScore,
    specialties: record.specialties,
    badges: record.badges,
    verifiedAt: record.verifiedAt,
    publicSlug: record.publicSlug,
  };
}

export function credentialViewForActor(
  actor: ScopeActor,
  record: ProfessionalCredentialRecord | null,
): ProfessionalCredentialRecord | PublicCredentialView | null {
  if (!record) return null;
  if (record.tenantId !== actor.tenantId) throw new ForbiddenException("Credential belongs to another tenant");
  if (record.userId === actor.userId || isOpsAdmin(actor)) return record;
  if (record.publicSlug) return toPublicCredentialView(record);
  throw new ForbiddenException("Credential is not published");
}

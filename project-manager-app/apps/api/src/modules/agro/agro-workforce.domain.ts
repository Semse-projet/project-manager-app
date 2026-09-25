/**
 * Reglas puras de la taxonomía Agro Workforce (sin DB, testeables).
 * Spec: docs/specs/agro/agro-workforce.spec.md
 */

export const AGRO_SECTORS = ["ANIMAL_PRODUCTION", "CROP_PRODUCTION", "MACHINERY", "PROFESSIONAL", "GENERAL"] as const;

export const AGRO_CAPABILITY_CATEGORIES = [
  "FEEDING", "ANIMAL_HANDLING", "HEALTH_WELFARE", "CLEANING_BIOSECURITY", "MACHINERY",
  "LAND_PREPARATION", "IRRIGATION", "HARVEST", "PROCEDURE", "OTHER",
] as const;

export const AGRO_CAPABILITY_LEVELS = ["BASIC", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
export type AgroCapabilityLevel = typeof AGRO_CAPABILITY_LEVELS[number];

export const AGRO_WORKER_CAPABILITY_STATUSES = [
  "SELF_REPORTED", "IN_REVIEW", "VERIFIED", "REJECTED", "EXPIRED", "REVOKED",
] as const;
export type AgroWorkerCapabilityStatus = typeof AGRO_WORKER_CAPABILITY_STATUSES[number];

export const AGRO_VERIFICATION_METHODS = [
  "DIRECT_OBSERVATION", "PRACTICAL_TEST", "DOCUMENT_REVIEW", "CERTIFICATE", "INTERVIEW", "OTHER",
] as const;

export const AGRO_VERIFICATION_RESULTS = ["APPROVED", "REJECTED"] as const;

/** Clave de catálogo: minúsculas, dígitos y guion bajo (p. ej. `lechones_manejo`). */
export const AGRO_CATALOG_KEY_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;

/**
 * Estado efectivo en lectura: una capacidad VERIFIED cuya vigencia venció se
 * muestra como EXPIRED aunque todavía no se haya persistido el cambio.
 */
export function effectiveCapabilityStatus(
  status: string,
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): AgroWorkerCapabilityStatus {
  if (status === "VERIFIED" && expiresAt && expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return (AGRO_WORKER_CAPABILITY_STATUSES as readonly string[]).includes(status)
    ? (status as AgroWorkerCapabilityStatus)
    : "SELF_REPORTED";
}

/**
 * ¿Puede (re)declararse la capacidad? Una capacidad VERIFIED o IN_REVIEW no se
 * sobrescribe con una autodeclaración: cambiar su nivel exige verificación.
 */
export function canRedeclareCapability(status: AgroWorkerCapabilityStatus): boolean {
  return status !== "VERIFIED" && status !== "IN_REVIEW";
}

/** Estados desde los que se puede pedir revisión. */
export function canRequestReview(status: AgroWorkerCapabilityStatus): boolean {
  return status === "SELF_REPORTED" || status === "REJECTED" || status === "EXPIRED";
}

/** Estados verificables (incluye renovación de una VERIFIED/EXPIRED). */
export function canVerifyFrom(status: AgroWorkerCapabilityStatus): boolean {
  return status !== "REVOKED";
}

export function verificationExpiry(
  verifiedAt: Date,
  validityDays: number | null | undefined,
  explicit?: Date | null,
): Date | null {
  if (explicit) return explicit;
  if (!validityDays || validityDays <= 0) return null;
  return new Date(verifiedAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
}

/** Evita ciclos al asignar un padre a una capacidad existente. */
export function wouldCreateCapabilityCycle(
  capabilityId: string,
  newParentId: string,
  parentOf: (id: string) => string | null | undefined,
): boolean {
  let cursor: string | null | undefined = newParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === capabilityId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentOf(cursor);
  }
  return false;
}

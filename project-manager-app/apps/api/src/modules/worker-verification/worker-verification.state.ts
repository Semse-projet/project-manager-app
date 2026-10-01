import { createHash, randomBytes } from "node:crypto";

/**
 * C11 — estado de verificacion POR TENANT (spec worker-verification-tenant).
 * Logica pura: transiciones monotonicas, estado efectivo y nonce de un solo uso.
 */
export type TenantVerificationStatus = "unverified" | "pending" | "verified" | "suspended";

const ORDER: Record<"unverified" | "pending" | "verified", number> = { unverified: 0, pending: 1, verified: 2 };

export function normalizeStatus(value: string | null | undefined): TenantVerificationStatus {
  return value === "pending" || value === "verified" || value === "suspended" ? value : "unverified";
}

/**
 * Monotonico: solo hacia adelante (unverified -> pending -> verified; tambien
 * unverified -> verified cuando una firma valida llega sin paso previo). Nunca
 * se baja ni se sale de `suspended` desde este flujo: eso es una decision
 * explicita de OPS, fuera de la atestacion.
 */
export function canTransition(from: TenantVerificationStatus, to: TenantVerificationStatus): boolean {
  if (from === "suspended" || to === "suspended") return false;
  return ORDER[to] > ORDER[from];
}

/**
 * Estado EFECTIVO de un trabajador en un tenant: la fila por tenant manda; sin
 * fila se lee el valor global legado de User.verificationStatus SOLO como
 * compatibilidad temporal (los verificados nuevos jamas escriben el global).
 */
export function effectiveStatus(
  tenantRowStatus: string | null | undefined,
  legacyGlobalStatus: string | null | undefined,
): TenantVerificationStatus {
  return tenantRowStatus != null ? normalizeStatus(tenantRowStatus) : normalizeStatus(legacyGlobalStatus);
}

export const DEFAULT_CHALLENGE_TTL_SECONDS = 600;

export function challengeTtlSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.WORKER_VERIFICATION_CHALLENGE_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw < 30) return DEFAULT_CHALLENGE_TTL_SECONDS;
  return Math.min(Math.floor(raw), 3600);
}

/** Nonce aleatorio de 256 bits (base64url). Solo se persiste su hash. */
export function generateNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

/** Mensaje que el trabajador debe firmar: ligado a tenant, trabajador y nonce (no reutilizable). */
export function attestationMessage(tenantId: string, workerId: string, nonce: string): string {
  return `semse-verify:v1:${tenantId}:${workerId}:${nonce}`;
}

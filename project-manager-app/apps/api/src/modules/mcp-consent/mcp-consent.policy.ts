import { createHash } from "node:crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MCP_GRANT_MAX_TTL_MS, type McpConsentScope } from "@semse/schemas";
import { hasPermission, normalizeRoles } from "../../common/rbac.js";
import { sameOrg } from "../../common/resource-scope.js";
import { intersectSessionRoles } from "../auth/session-roles.js";
import type { ProjectOwnership } from "../projects/projects.policy.js";

/**
 * Reglas puras de S1/D7 (docs/specs/platform/semse-mcp-delegated-consent.spec.md).
 * Sin I/O: el repositorio y el servicio las aplican sobre filas leídas.
 */

/** Roles con override operativo que la vía MCP nunca hereda (§3: hasScopeAccess deja leer todo el tenant). */
const OPERATIONAL_OVERRIDE_ROLES = new Set(["OPS_ADMIN"]);

/** Q1 + P2: min(refresh de la sesión, tope de 30 días, plazo pedido por el usuario). */
export function computeGrantExpiry(input: {
  now: Date;
  refreshExpiresAt: Date;
  requestedExpiresAt?: Date;
}): Date {
  const cap = input.now.getTime() + MCP_GRANT_MAX_TTL_MS;
  if (input.requestedExpiresAt !== undefined) {
    const requested = input.requestedExpiresAt.getTime();
    if (Number.isNaN(requested) || requested <= input.now.getTime()) {
      throw new BadRequestException("requestedExpiresAt must be in the future");
    }
    if (requested > cap) {
      throw new BadRequestException("requestedExpiresAt exceeds MCP_GRANT_MAX_TTL");
    }
  }
  return new Date(
    Math.min(input.refreshExpiresAt.getTime(), cap, input.requestedExpiresAt?.getTime() ?? Infinity),
  );
}

/**
 * Q2: permisos(activeRoles ∩ session.roles), sin roles con override operativo.
 * Normaliza antes de filtrar para que un alias (ADMIN → OPS_ADMIN) no se cuele.
 */
export function mcpEffectiveRoles(activeRoles: readonly string[], sessionRoles: readonly string[]): string[] {
  return normalizeRoles(intersectSessionRoles(activeRoles, sessionRoles)).filter(
    (role) => !OPERATIONAL_OVERRIDE_ROLES.has(role),
  );
}

/** Q2: cada scope pedido/concedido debe estar cubierto por los roles efectivos actuales. */
export function rolesCoverScopes(roles: readonly string[], scopes: readonly McpConsentScope[]): boolean {
  return scopes.length > 0 && scopes.every((scope) => hasPermission(roles, scope));
}

/** §3 / D7-05b: el proyecto debe pertenecer a la org del grant como cliente o PRO asignado, sin override. */
export function assertProjectInGrantOrg(grantOrgId: string, ownership: ProjectOwnership): void {
  if (!sameOrg(grantOrgId, ownership.clientOrgId) && !sameOrg(grantOrgId, ownership.assignedProOrgId)) {
    throw new ForbiddenException("project is outside the consent organization");
  }
}

/** Huella de la clave de idempotencia, acotada al tenant; nunca se guarda la clave en claro. */
export function idempotencyKeyDigest(tenantId: string, key: string): string {
  return createHash("sha256").update(`${tenantId}:${key}`).digest("hex");
}

/**
 * Huella del payload de aceptación (§5): un reintento idempotente es idéntico solo si
 * coinciden sesión, cliente, recurso, scopes, binding, plazo pedido y versiones.
 */
export function acceptRequestFingerprint(input: {
  sessionId: string;
  oauthIssuer: string;
  oauthClientId: string;
  resourceUri: string;
  scopeSet: readonly string[];
  grantBindingDigest: string;
  requestedExpiresAt?: Date;
  policyVersion: string;
  consentVersion: string;
}): string {
  const canonical = JSON.stringify([
    input.sessionId,
    input.oauthIssuer,
    input.oauthClientId,
    input.resourceUri,
    [...new Set(input.scopeSet)].sort(),
    input.grantBindingDigest,
    input.requestedExpiresAt?.toISOString() ?? null,
    input.policyVersion,
    input.consentVersion,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/** Q6: las fechas de una fila anonimizada se truncan al día (UTC). */
export function truncateToUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/** Q6: momento terminal del que corre la retención, con independencia del estado guardado. */
export function terminalAt(grant: { revokedAt: Date | null; expiresAt: Date }): Date {
  return grant.revokedAt ?? grant.expiresAt;
}

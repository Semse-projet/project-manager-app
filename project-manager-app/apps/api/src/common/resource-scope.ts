import { ForbiddenException, NotFoundException } from "@nestjs/common";

/**
 * C51 — contrato comun de ResourceScope (tenant + organizacion + recurso).
 * Spec: docs/specs/platform/resource-scope.spec.md
 *
 * Antes cada modulo (evidence, milestones, projects, disputes, liens…) repetia
 * la misma regla con copias que divergian (p. ej. solo liens protegia el caso
 * de org vacia). Este modulo es la UNICA implementacion; las politicas de
 * dominio delegan en el y conservan sus mensajes y su API publica.
 *
 * Reglas:
 *  - El alcance se resuelve SIEMPRE desde la base, filtrado por tenant (el
 *    llamador resuelve `ProjectScope`); un recurso de otro tenant se informa
 *    como NOT FOUND (sin oraculo de existencia).
 *  - OPS_ADMIN pasa la regla de organizacion, pero NO cruza tenants.
 *  - Una org vacia/ausente nunca coincide con nada (ni con otra org vacia).
 */
export type ScopeActor = {
  tenantId: string;
  orgId: string;
  userId?: string;
  roles: string[];
};

/** Alcance de un recurso colgado de un proyecto. */
export type ProjectScope = {
  tenantId: string;
  clientOrgId: string | null | undefined;
  assignedProOrgId: string | null | undefined;
};

/**
 * Relacion exigida:
 *  - read   : org cliente u org profesional asignado.
 *  - client : solo org cliente (p. ej. aprobar, ver finanzas, crear hitos).
 *  - pro    : solo org profesional asignado (p. ej. entregar, firmar renuncias).
 *  - ops    : solo OPS_ADMIN.
 */
export type ScopeAccess = "read" | "client" | "pro" | "ops";

export function isOpsAdmin(actor: Pick<ScopeActor, "roles">): boolean {
  return actor.roles.includes("OPS_ADMIN");
}

/** Igualdad de org estricta: ambos lados no vacios. */
export function sameOrg(a: string | null | undefined, b: string | null | undefined): boolean {
  return typeof a === "string" && a.length > 0 && a === b;
}

/** El recurso pertenece al tenant del actor (ni siquiera OPS_ADMIN cruza tenants). */
export function inActorTenant(actor: Pick<ScopeActor, "tenantId">, scope: Pick<ProjectScope, "tenantId">): boolean {
  return typeof actor.tenantId === "string" && actor.tenantId.length > 0 && actor.tenantId === scope.tenantId;
}

export function hasScopeAccess(actor: ScopeActor, scope: ProjectScope, access: ScopeAccess): boolean {
  if (!inActorTenant(actor, scope)) return false;
  if (isOpsAdmin(actor)) return true;
  switch (access) {
    case "ops":
      return false;
    case "client":
      return sameOrg(actor.orgId, scope.clientOrgId);
    case "pro":
      return sameOrg(actor.orgId, scope.assignedProOrgId);
    case "read":
      return sameOrg(actor.orgId, scope.clientOrgId) || sameOrg(actor.orgId, scope.assignedProOrgId);
  }
}

/** 403 si el actor del tenant no tiene la relacion; 404 si el recurso es de otro tenant. */
export function assertScopeAccess(
  actor: ScopeActor,
  scope: ProjectScope,
  access: ScopeAccess,
  deniedMessage: string,
  notFoundMessage = "Resource not found",
): void {
  if (!inActorTenant(actor, scope)) {
    throw new NotFoundException(notFoundMessage);
  }
  if (!hasScopeAccess(actor, scope, access)) {
    throw new ForbiddenException(deniedMessage);
  }
}

/**
 * Para las politicas de dominio cuyo `ownership` ya se resolvio desde la base
 * FILTRADO por el tenant del actor (los repositorios lo hacen): el tenant del
 * alcance es el del actor. El cruce de tenant lo cierra el repositorio (404).
 * Defensa en profundidad: si el ownership trae `tenantId` y difiere del actor,
 * el alcance conserva ese tenant y `hasScopeAccess` niega (tampoco OPS_ADMIN).
 */
export function scopeFromOwnership(
  actor: Pick<ScopeActor, "tenantId">,
  ownership: { clientOrgId?: string | null; assignedProOrgId?: string | null; tenantId?: string | null },
): ProjectScope {
  const tenantId = typeof ownership.tenantId === "string" && ownership.tenantId.length > 0 ? ownership.tenantId : actor.tenantId;
  return { tenantId, clientOrgId: ownership.clientOrgId, assignedProOrgId: ownership.assignedProOrgId };
}

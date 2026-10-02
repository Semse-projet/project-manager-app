import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ResourceScopeResolver } from "../../common/resource-scope.resolver.js";
import {
  assertScopeAccess,
  isOpsAdmin,
  type ScopeActor,
} from "../../common/resource-scope.js";

/**
 * C51 — WorkspaceMemoryAccessPolicy.
 * Spec: docs/specs/platform/resource-scope.spec.md §3.1 (decisión del dueño, 2026-10-01).
 *
 * WorkspaceMemory es memoria COMPARTIDA del workspace/recurso: quien puede ver el
 * recurso puede leer su memoria. El `orgId` de una entrada es provenance del
 * productor, NUNCA un ACL; `sensitivity` es clasificación, no ownership; y la
 * memoria nunca autoriza una acción por sí misma.
 *
 * Esta política se aplica ANTES de tocar el repositorio: se resuelve el recurso
 * dentro del tenant del actor (otro tenant o recurso inexistente ⇒ 404) y se
 * comprueba la relación del actor con él (fuera de las orgs participantes ⇒ 403).
 * Conocer o adivinar un `workspaceId` no basta.
 */
export type WorkspaceTarget =
  | { kind: "project"; projectId: string }
  | { kind: "job"; jobId: string }
  | { kind: "dispute"; disputeId: string }
  | { kind: "worker"; userId: string; facet: string }
  | { kind: "unknown" };

/** Interpreta un `workspaceId`; cualquier forma no reconocida es `unknown` (solo OPS_ADMIN). */
export function parseWorkspaceId(workspaceId: string): WorkspaceTarget {
  const id = typeof workspaceId === "string" ? workspaceId.trim() : "";
  const colon = id.indexOf(":");
  if (colon <= 0) return { kind: "unknown" };
  const prefix = id.slice(0, colon);
  const rest = id.slice(colon + 1);
  if (!rest) return { kind: "unknown" };

  if (prefix === "project" || prefix === "job" || prefix === "dispute") {
    // Un solo segmento de id: sin ":" extra (no se acepta `project:<id>:algo`).
    if (rest.includes(":")) return { kind: "unknown" };
    if (prefix === "project") return { kind: "project", projectId: rest };
    if (prefix === "job") return { kind: "job", jobId: rest };
    return { kind: "dispute", disputeId: rest };
  }
  if (prefix === "worker") {
    const parts = rest.split(":");
    if (parts.length === 2 && parts[0] && parts[1]) return { kind: "worker", userId: parts[0], facet: parts[1] };
  }
  return { kind: "unknown" };
}

const NOT_FOUND = "Workspace not found";
const DENIED = "Actor cannot access this workspace memory";

@Injectable()
export class WorkspaceMemoryAccessPolicy {
  constructor(private readonly resolver: ResourceScopeResolver) {}

  /**
   * Autoriza la LECTURA (listar/buscar) de la memoria de `workspaceId`.
   * Lanza 404 (otro tenant / inexistente) o 403 (mismo tenant, sin relación).
   */
  async assertCanRead(actor: ScopeActor, workspaceId: string): Promise<void> {
    if (typeof actor.tenantId !== "string" || actor.tenantId.length === 0) {
      throw new NotFoundException(NOT_FOUND);
    }
    const target = parseWorkspaceId(workspaceId);

    switch (target.kind) {
      case "project": {
        const scope = await this.resolver.resolveProjectScope(actor.tenantId, target.projectId);
        if (!scope) throw new NotFoundException(NOT_FOUND);
        assertScopeAccess(actor, scope, "read", DENIED, NOT_FOUND);
        return;
      }
      case "job": {
        const scope = await this.resolver.resolveJobScope(actor.tenantId, target.jobId);
        if (!scope) throw new NotFoundException(NOT_FOUND);
        assertScopeAccess(actor, scope, "read", DENIED, NOT_FOUND);
        return;
      }
      case "dispute": {
        const scope = await this.resolver.resolveDisputeScope(actor.tenantId, target.disputeId);
        if (!scope) throw new NotFoundException(NOT_FOUND);
        assertScopeAccess(actor, scope, "read", DENIED, NOT_FOUND);
        return;
      }
      case "worker": {
        // Memoria personal del trabajador: él mismo u OPS_ADMIN (del mismo tenant; el
        // repositorio filtra por tenant). La org no interviene.
        if (isOpsAdmin(actor)) return;
        if (typeof actor.userId === "string" && actor.userId.length > 0 && actor.userId === target.userId) return;
        throw new ForbiddenException(DENIED);
      }
      default: {
        // Forma desconocida: deny-by-default; solo OPS_ADMIN.
        if (isOpsAdmin(actor)) return;
        throw new ForbiddenException(DENIED);
      }
    }
  }
}

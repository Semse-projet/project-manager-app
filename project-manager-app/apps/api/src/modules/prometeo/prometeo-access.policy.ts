import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ResourceScopeResolver } from "../../common/resource-scope.resolver.js";
import { assertScopeAccess, hasScopeAccess, isOpsAdmin, sameOrg, type ScopeActor } from "../../common/resource-scope.js";

/**
 * C51 etapa 3 — acceso a activos y órdenes de trabajo de Prometeo (decisión del dueño, 2026-10-04):
 * cada fila tiene un propietario explícito validado por el servidor (`orgId` del actor al crearla, nunca del cliente).
 *  - Asociada a un proyecto (o job) del tenant ⇒ rigen los permisos de ese proyecto/job (cliente, profesional asignado, OPS_ADMIN).
 *  - Sin asociación válida ⇒ SOLO la org propietaria (`sameOrg`, la org vacía nunca coincide) u OPS_ADMIN del tenant.
 *  - Pertenecer al mismo tenant NUNCA concede acceso por sí solo. Otro tenant ⇒ 404.
 */
export type PrometeoOwnedRow = { tenantId: string; orgId: string; projectId?: string | null; jobId?: string | null };

/** Filtro de listado para no-OPS_ADMIN (undefined = sin restricción, solo OPS_ADMIN del tenant). */
export type PrometeoListScope = { orgId: string; projectIds: string[]; jobIds: string[] };

@Injectable()
export class PrometeoAccessPolicy {
  constructor(private readonly resolver: ResourceScopeResolver) {}

  /** El propietario explícito debe existir: sin org no se crea nada propio. */
  private assertHasOwner(actor: ScopeActor): void {
    if (!actor.orgId || actor.orgId.trim().length === 0) {
      throw new ForbiddenException("An organization is required to own this resource");
    }
  }

  /** Crear: la asociación declarada (proyecto/job) debe ser del tenant y el actor debe participar en ella. */
  async assertCanCreate(actor: ScopeActor, assoc: { projectId?: string; jobId?: string }): Promise<void> {
    this.assertHasOwner(actor);
    if (assoc.projectId) {
      const scope = await this.resolver.resolveProjectScope(actor.tenantId, assoc.projectId, true);
      if (!scope) throw new NotFoundException("Project not found");
      assertScopeAccess(actor, scope, "read", "Actor cannot access this project", "Project not found");
    }
    if (assoc.jobId) {
      const scope = await this.resolver.resolveJobScope(actor.tenantId, assoc.jobId);
      if (!scope) throw new NotFoundException("Job not found");
      assertScopeAccess(actor, scope, "read", "Actor cannot access this job", "Job not found");
    }
    // Una orden con proyecto Y job solo es válida si el job es el del proyecto: si no, los participantes de un
    // proyecto acabarían accediendo a órdenes que declaran pertenecer a otro trabajo.
    if (assoc.projectId && assoc.jobId && !(await this.resolver.jobBelongsToProject(actor.tenantId, assoc.jobId, assoc.projectId))) {
      throw new BadRequestException("jobId does not belong to projectId");
    }
  }

  /** Listar filtrando por un proyecto concreto: el actor debe participar en él. */
  async assertProjectFilter(actor: ScopeActor, projectId: string): Promise<void> {
    const scope = await this.resolver.resolveProjectScope(actor.tenantId, projectId, true);
    if (!scope) throw new NotFoundException("Project not found");
    assertScopeAccess(actor, scope, "read", "Actor cannot access this project", "Project not found");
  }

  /** Alcance del listado sin `projectId`: solo filas propias sin asociación + las de proyectos/jobs donde participa. */
  async listScope(actor: ScopeActor): Promise<PrometeoListScope | undefined> {
    if (isOpsAdmin(actor)) return undefined;
    if (!actor.orgId) return { orgId: "", projectIds: [], jobIds: [] };
    const [projectIds, jobIds] = await Promise.all([
      this.resolver.listAccessibleProjectIds(actor.tenantId, actor.orgId, "read", true),
      this.resolver.listAccessibleJobIds(actor.tenantId, actor.orgId),
    ]);
    return { orgId: actor.orgId, projectIds, jobIds };
  }

  /** Acceso a una fila concreta (404 otro tenant; 403 sin relación). */
  async assertRowAccess(actor: ScopeActor, row: PrometeoOwnedRow | null, notFound: string): Promise<void> {
    if (!row || row.tenantId !== actor.tenantId) throw new NotFoundException(notFound);
    if (isOpsAdmin(actor)) return;
    if (row.projectId) {
      // Asociada a un proyecto: rigen SUS permisos; un proyecto que ya no existe en el tenant solo lo ve OPS_ADMIN.
      const scope = await this.resolver.resolveProjectScope(actor.tenantId, row.projectId, true);
      if (!scope || !hasScopeAccess(actor, scope, "read")) throw new ForbiddenException("Actor cannot access this resource");
      return;
    }
    if (row.jobId) {
      const scope = await this.resolver.resolveJobScope(actor.tenantId, row.jobId);
      if (!scope || !hasScopeAccess(actor, scope, "read")) throw new ForbiddenException("Actor cannot access this resource");
      return;
    }
    // Sin asociación: propiedad explícita.
    if (!sameOrg(actor.orgId, row.orgId)) throw new ForbiddenException("Actor cannot access this resource");
  }
}

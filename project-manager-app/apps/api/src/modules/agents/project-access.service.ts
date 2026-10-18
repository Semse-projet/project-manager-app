import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ResourceScopeResolver } from "../../common/resource-scope.resolver.js";
import { assertScopeAccess, isOpsAdmin, type ScopeActor } from "../../common/resource-scope.js";

/**
 * Hallazgo 0.37 — el copiloto de proyecto y las rutas del coordinador aceptaban cualquier `projectId`.
 * Contrato canónico (spec resource-scope): proyecto inexistente o de otro tenant ⇒ 404; otra organización
 * del mismo tenant ⇒ 403; OPS_ADMIN pasa pero nunca cruza tenants.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly resolver: ResourceScopeResolver) {}

  async assertProjectAccess(actor: ScopeActor, projectId: string, requireLiveJob = false): Promise<void> {
    if (!projectId) throw new NotFoundException("Project not found");
    const scope = await this.resolver.resolveProjectScope(actor.tenantId, projectId, requireLiveJob);
    if (!scope) throw new NotFoundException("Project not found");
    assertScopeAccess(actor, scope, "read", "Actor cannot access this project", "Project not found");
  }

  /**
   * Un plan de trabajo hereda el acceso de su proyecto. Un plan sin proyecto solo lo ve/muta su creador
   * u OPS_ADMIN del mismo tenant.
   */
  async assertPlanAccess(
    actor: ScopeActor,
    plan: { projectId?: string; createdBy: string }
  ): Promise<void> {
    if (plan.projectId) {
      await this.assertProjectAccess(actor, plan.projectId);
      return;
    }
    if (isOpsAdmin(actor) || (actor.userId && actor.userId === plan.createdBy)) return;
    throw new ForbiddenException("Actor cannot access this plan");
  }
}

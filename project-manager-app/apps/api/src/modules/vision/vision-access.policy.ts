import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ResourceScopeResolver } from "../../common/resource-scope.resolver.js";
import { assertScopeAccess, type ScopeActor } from "../../common/resource-scope.js";

/**
 * C51 etapa 3 (migración gradual del resolver) — acceso a los recursos que consulta/analiza vision.
 *
 * Antes, las rutas por `evidenceId`, `jobId` y `milestoneId` leían y escribían `VisionAnalysis` (y descargaban
 * la evidencia) sin tenant ni organización: cualquier usuario con `vision:read`/`vision:run` alcanzaba el análisis
 * de otros tenants y de otras organizaciones. Ahora el recurso se resuelve DENTRO del tenant del actor (otro
 * tenant o inexistente ⇒ 404, sin oráculo de existencia) y exige participación: org cliente, org profesional
 * asignada u OPS_ADMIN del tenant (otra org u org vacía ⇒ 403). Los permisos `vision:*` siguen encima.
 */
@Injectable()
export class VisionAccessPolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeResolver: ResourceScopeResolver,
  ) {}

  private async assertProject(actor: ScopeActor, projectId: string, notFound: string): Promise<void> {
    const scope = await this.scopeResolver.resolveProjectScope(actor.tenantId, projectId);
    if (!scope) throw new NotFoundException(notFound);
    assertScopeAccess(actor, scope, "read", "Actor cannot access this resource", notFound);
  }

  async assertJob(actor: ScopeActor, jobId: string): Promise<void> {
    const scope = await this.scopeResolver.resolveJobScope(actor.tenantId, jobId);
    if (!scope) throw new NotFoundException("Job not found");
    assertScopeAccess(actor, scope, "read", "Actor cannot access this job", "Job not found");
  }

  async assertMilestone(actor: ScopeActor, milestoneId: string): Promise<void> {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, project: { tenantId: actor.tenantId } },
      select: { projectId: true },
    });
    if (!milestone) throw new NotFoundException("Milestone not found");
    await this.assertProject(actor, milestone.projectId, "Milestone not found");
  }

  /** Todas las evidencias deben existir en el tenant del actor y pertenecer a un proyecto en el que participa. */
  async assertEvidence(actor: ScopeActor, evidenceIds: string[]): Promise<void> {
    const ids = [...new Set(evidenceIds)];
    if (ids.length === 0) return;
    const rows = await this.prisma.evidence.findMany({
      where: { id: { in: ids }, tenantId: actor.tenantId },
      select: { id: true, projectId: true },
    });
    if (rows.length !== ids.length) throw new NotFoundException("Evidence not found");
    for (const projectId of new Set(rows.map((r) => r.projectId))) {
      await this.assertProject(actor, projectId, "Evidence not found");
    }
  }

  /** Contexto opcional (`jobId`/`milestoneId`) que el llamador declara junto a las evidencias. */
  async assertContext(actor: ScopeActor, ctx: { jobId?: string; milestoneId?: string }): Promise<void> {
    if (ctx.jobId) await this.assertJob(actor, ctx.jobId);
    if (ctx.milestoneId) await this.assertMilestone(actor, ctx.milestoneId);
  }
}

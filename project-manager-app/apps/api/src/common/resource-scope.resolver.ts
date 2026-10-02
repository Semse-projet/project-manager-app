import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma/prisma.service.js";
import type { ProjectScope } from "./resource-scope.js";

/**
 * C51 etapa 3 — ResourceScopeResolver canónico.
 * Spec: docs/specs/platform/resource-scope.spec.md §3 (etapa 3).
 *
 * UNA sola forma de resolver `tenantId + id de recurso → ProjectScope` (tenant del recurso, org cliente y
 * org profesional asignada), SIEMPRE filtrado por el tenant del actor: un recurso de otro tenant o inexistente
 * devuelve `null` (los llamadores lo informan como 404, sin oráculo de existencia). Las políticas de dominio
 * (`*.policy.ts`) siguen encima: el resolver solo dice DE QUIÉN es el recurso; quién puede hacer qué lo
 * deciden `hasScopeAccess`/`assertScopeAccess` y la política del dominio.
 *
 * Migración GRADUAL (sin big bang): los resolutores duplicados de cada módulo se migran uno a uno con sus
 * pruebas. Hoy lo usa `WorkspaceMemoryAccessPolicy`.
 */
@Injectable()
export class ResourceScopeResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** `Project` del tenant → alcance (cliente = org del `job`; profesional = `assignedProOrgId`). */
  async resolveProjectScope(tenantId: string, projectId: string): Promise<ProjectScope | null> {
    if (!tenantId || !projectId) return null;
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { tenantId: true, assignedProOrgId: true, job: { select: { clientOrgId: true } } },
    });
    if (!project) return null;
    return { tenantId: project.tenantId, clientOrgId: project.job?.clientOrgId, assignedProOrgId: project.assignedProOrgId };
  }

  /** `Job` del tenant → alcance (el profesional existe solo cuando el job ya tiene `Project`). */
  async resolveJobScope(tenantId: string, jobId: string): Promise<ProjectScope | null> {
    if (!tenantId || !jobId) return null;
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
      select: { tenantId: true, clientOrgId: true, project: { select: { assignedProOrgId: true } } },
    });
    if (!job) return null;
    return { tenantId: job.tenantId, clientOrgId: job.clientOrgId, assignedProOrgId: job.project?.assignedProOrgId };
  }

  /** `Dispute` del tenant → alcance de su proyecto. */
  async resolveDisputeScope(tenantId: string, disputeId: string): Promise<ProjectScope | null> {
    if (!tenantId || !disputeId) return null;
    const dispute = await this.prisma.dispute.findFirst({
      where: { id: disputeId, tenantId },
      select: { tenantId: true, project: { select: { assignedProOrgId: true, job: { select: { clientOrgId: true } } } } },
    });
    if (!dispute) return null;
    return {
      tenantId: dispute.tenantId,
      clientOrgId: dispute.project?.job?.clientOrgId,
      assignedProOrgId: dispute.project?.assignedProOrgId,
    };
  }

  /** Igual que `resolveProjectScope` pero lanza 404 si no existe en el tenant. */
  async requireProjectScope(tenantId: string, projectId: string, notFoundMessage = "Resource not found"): Promise<ProjectScope> {
    const scope = await this.resolveProjectScope(tenantId, projectId);
    if (!scope) throw new NotFoundException(notFoundMessage);
    return scope;
  }
}

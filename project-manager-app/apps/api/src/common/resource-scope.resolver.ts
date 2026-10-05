import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
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
 * pruebas. Lo usan `WorkspaceMemoryAccessPolicy`, weather, intelligence, tasks, vision y milestones.
 */
const ID_PAGE_SIZE = 1000;
/** Tope de seguridad: más asociaciones que esto no se enumeran (falla cerrado, no trunca en silencio). */
const MAX_ACCESSIBLE_IDS = 20000;

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
      where: { id: jobId, tenantId, deletedAt: null },
      select: { tenantId: true, clientOrgId: true, project: { select: { assignedProOrgId: true } } },
    });
    if (!job) return null;
    return { tenantId: job.tenantId, clientOrgId: job.clientOrgId, assignedProOrgId: job.project?.assignedProOrgId };
  }

  /** `Milestone` (no eliminado) del tenant → alcance de su proyecto. */
  async resolveMilestoneScope(tenantId: string, milestoneId: string): Promise<ProjectScope | null> {
    if (!tenantId || !milestoneId) return null;
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, deletedAt: null, project: { tenantId } },
      select: { project: { select: { tenantId: true, assignedProOrgId: true, job: { select: { clientOrgId: true } } } } },
    });
    if (!milestone?.project) return null;
    const { project } = milestone;
    return { tenantId: project.tenantId, clientOrgId: project.job?.clientOrgId, assignedProOrgId: project.assignedProOrgId };
  }

  /**
   * Ids de proyecto del tenant en los que la org del actor es cliente o profesional asignada (para listados).
   * Pagina TODOS los ids (nunca trunca en silencio): por encima de `MAX_ACCESSIBLE_IDS` falla cerrado y pide filtrar por proyecto.
   */
  async listAccessibleProjectIds(tenantId: string, orgId: string, access: "read" | "client" = "read"): Promise<string[]> {
    if (!tenantId || !orgId) return [];
    return this.collectIds((cursor) =>
      this.prisma.project.findMany({
        where: { tenantId, ...(access === "client" ? { job: { clientOrgId: orgId } } : { OR: [{ assignedProOrgId: orgId }, { job: { clientOrgId: orgId } }] }) },
        select: { id: true },
        orderBy: { id: "asc" },
        take: ID_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    );
  }

  /** Igual que `listAccessibleProjectIds` para jobs (los eliminados lógicamente no dan acceso). */
  async listAccessibleJobIds(tenantId: string, orgId: string, access: "read" | "client" = "read"): Promise<string[]> {
    if (!tenantId || !orgId) return [];
    return this.collectIds((cursor) =>
      this.prisma.job.findMany({
        where: { tenantId, deletedAt: null, ...(access === "client" ? { clientOrgId: orgId } : { OR: [{ clientOrgId: orgId }, { project: { assignedProOrgId: orgId } }] }) },
        select: { id: true },
        orderBy: { id: "asc" },
        take: ID_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    );
  }

  /** El `job` es el del proyecto indicado (ambos del tenant). Evita asociaciones proyecto/job incompatibles. */
  async jobBelongsToProject(tenantId: string, jobId: string, projectId: string): Promise<boolean> {
    if (!tenantId || !jobId || !projectId) return false;
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId, jobId }, select: { id: true } });
    return project !== null;
  }

  private async collectIds(fetchPage: (cursor?: string) => Promise<Array<{ id: string }>>): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await fetchPage(cursor);
      for (const row of page) ids.push(row.id);
      if (ids.length > MAX_ACCESSIBLE_IDS) {
        throw new UnprocessableEntityException("Too many associated projects or jobs to list; filter by projectId");
      }
      if (page.length < ID_PAGE_SIZE) return ids;
      cursor = page[page.length - 1].id;
    }
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

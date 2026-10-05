import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ResourceScopeResolver } from "../../common/resource-scope.resolver.js";
import { assertScopeAccess, hasScopeAccess, inActorTenant, isOpsAdmin, sameOrg, type ScopeActor } from "../../common/resource-scope.js";

export type FinanceOwnedRow = { tenantId: string; orgId: string; projectId?: string | null; jobId?: string | null };
export type FinanceListScope = { orgId: string; projectIds: string[]; jobIds: string[] };
export type FinanceAssociations = { projectId?: string; jobId?: string };

/** Optional IDs are input, not trusted associations. Never pass arrays/objects to Prisma. */
export function financeId(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) throw new BadRequestException(`${field} must be a non-empty string`);
  return value.trim();
}

/** C51 finance: DOMAIN_INVARIANTS financial policy is client/OPS, not generic project read. */
@Injectable()
export class FinanceAccessPolicy {
  constructor(private readonly resolver: ResourceScopeResolver) {}

  assertOwner(actor: ScopeActor): void {
    if (!actor.tenantId || !actor.orgId?.trim() || !actor.userId) throw new ForbiddenException("An authenticated organization owner is required");
  }

  async assertProjectFilter(actor: ScopeActor, projectId: string): Promise<void> {
    const scope = await this.resolver.requireProjectScope(actor.tenantId, projectId, "Project not found");
    assertScopeAccess(actor, scope, "client", "Actor cannot access project financials", "Project not found");
  }

  async assertCanCreate(actor: ScopeActor, assoc: FinanceAssociations): Promise<string | null> {
    this.assertOwner(actor);
    let clientOrgId: string | null = null;
    if (assoc.projectId) {
      const scope = await this.resolver.requireProjectScope(actor.tenantId, assoc.projectId, "Project not found");
      assertScopeAccess(actor, scope, "client", "Actor cannot access project financials", "Project not found");
      clientOrgId = scope.clientOrgId ?? null;
    }
    if (assoc.jobId) {
      const scope = await this.resolver.resolveJobScope(actor.tenantId, assoc.jobId);
      if (!scope) throw new NotFoundException("Job not found");
      assertScopeAccess(actor, scope, "client", "Actor cannot access job financials", "Job not found");
      clientOrgId ??= scope.clientOrgId ?? null;
    }
    if (assoc.projectId && assoc.jobId && !(await this.resolver.jobBelongsToProject(actor.tenantId, assoc.jobId, assoc.projectId))) {
      throw new BadRequestException("jobId does not belong to projectId");
    }
    return clientOrgId;
  }

  async assertRowAccess(actor: ScopeActor, row: FinanceOwnedRow | null, notFound: string): Promise<void> {
    if (!row || !inActorTenant(actor, row)) throw new NotFoundException(notFound);
    if (isOpsAdmin(actor)) return; // same-tenant OPS can audit orphaned historical rows
    if (row.projectId || row.jobId) {
      const scope = row.projectId
        ? await this.resolver.resolveProjectScope(actor.tenantId, row.projectId)
        : await this.resolver.resolveJobScope(actor.tenantId, row.jobId!);
      if (!scope || !hasScopeAccess(actor, scope, "client")) throw new ForbiddenException("Actor cannot access this financial resource");
      return;
    }
    if (!sameOrg(actor.orgId, row.orgId)) throw new ForbiddenException("Actor cannot access this financial resource");
  }

  async listScope(actor: ScopeActor): Promise<FinanceListScope | undefined> {
    if (!actor.tenantId) throw new NotFoundException("Tenant not found");
    if (isOpsAdmin(actor)) return undefined;
    const [projectIds, jobIds] = await Promise.all([
      this.resolver.listAccessibleProjectIds(actor.tenantId, actor.orgId, "client"),
      this.resolver.listAccessibleJobIds(actor.tenantId, actor.orgId, "client"),
    ]);
    return { orgId: actor.orgId, projectIds, jobIds };
  }
}

/**
 * User-facing outbox visibility for an authenticated organization.
 *
 * "system" is a technical sentinel used by lifecycle producers, never a
 * session org and never a wildcard. Those deliveries are visible only when
 * they reference a Project tied to the caller (client org or assigned pro).
 */

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export const SYSTEM_OUTBOX_ORG_ID = "system";
export const PROJECT_OUTBOX_ENTITY_TYPE = "Project";

export type ProjectLookupClient = Pick<PrismaService, "project">;

export type OutboxOrgScopeWhere = {
  OR: Array<{
    orgId: string;
    entityType?: string;
    entityId?: { in: string[] };
  }>;
};

export type UnreachableOutboxOrgWhere = {
  orgId: { in: [] };
};

export function isUsableOutboxOrgId(orgId: string): boolean {
  return typeof orgId === "string" && orgId.trim().length > 0 && orgId.trim() !== SYSTEM_OUTBOX_ORG_ID;
}

export function outboxVisibleToOrgWhere(
  orgId: string,
  orgProjectIds: string[],
): OutboxOrgScopeWhere | UnreachableOutboxOrgWhere {
  if (!isUsableOutboxOrgId(orgId)) {
    return { orgId: { in: [] } };
  }

  const branches: OutboxOrgScopeWhere["OR"] = [{ orgId }];
  const projectIds = orgProjectIds.filter((id) => typeof id === "string" && id.length > 0);
  if (projectIds.length > 0) {
    branches.push({
      orgId: SYSTEM_OUTBOX_ORG_ID,
      entityType: PROJECT_OUTBOX_ENTITY_TYPE,
      entityId: { in: projectIds },
    });
  }
  return { OR: branches };
}

export async function listProjectIdsVisibleToOrg(
  prisma: ProjectLookupClient,
  tenantId: string,
  orgId: string,
): Promise<string[]> {
  if (!tenantId.trim() || !isUsableOutboxOrgId(orgId)) {
    return [];
  }
  const rows = await prisma.project.findMany({
    where: {
      tenantId,
      OR: [
        { assignedProOrgId: orgId },
        { job: { clientOrgId: orgId, deletedAt: null } },
      ],
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function userFacingOutboxOrgWhere(
  prisma: ProjectLookupClient,
  tenantId: string,
  orgId: string,
): Promise<OutboxOrgScopeWhere | UnreachableOutboxOrgWhere> {
  const projectIds = await listProjectIdsVisibleToOrg(prisma, tenantId, orgId);
  return outboxVisibleToOrgWhere(orgId, projectIds);
}

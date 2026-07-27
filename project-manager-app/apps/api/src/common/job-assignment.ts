import type { Prisma } from "@prisma/client";

/**
 * Single definition of "this professional is engaged on this job", shared by the
 * tracker job list (FieldOpsRepository) and the labor-engine ownership check.
 * They used to keep separate copies and drifted apart: the list offered jobs
 * assigned through a contract or a project (`project.assignedProOrgId`), while
 * the ownership check only accepted bids/reservations, so starting a timer on a
 * job the UI itself proposed failed with "This job is not assigned to you.".
 *
 * Callers must still scope by `tenantId` and `deletedAt: null` themselves.
 */
export function jobAssignmentWhere(input: { orgId: string; userId: string }): Prisma.JobWhereInput[] {
  return [
    { bids: { some: { professionalUserId: input.userId, status: "ACCEPTED" as const } } },
    { reservations: { some: { professionalId: input.userId, status: { in: ["ACTIVE", "ACCEPTED"] } } } },
    { reservations: { some: { professionalOrgId: input.orgId, status: { in: ["ACTIVE", "ACCEPTED"] } } } },
    { contract: { is: { professionalUserId: input.userId, deletedAt: null } } },
    { contract: { is: { professionalOrgId: input.orgId, deletedAt: null } } },
    { project: { is: { assignedProOrgId: input.orgId } } },
  ];
}

import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { RequestContext } from "../../common/request-context.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type ResourceActor = Pick<RequestContext, "tenantId" | "orgId" | "roles">;

export type ChangeOrderLinks = {
  jobId?: string | null;
  buildOpsProjectId?: string | null;
  milestoneId?: string | null;
};

// Candidate links are scalar IDs, not Prisma relations. Resolve ownership
// from the authoritative parents, checking every populated link (not just one).
export async function accessibleChangeOrderLinks(prisma: PrismaService, actor: ResourceActor, links?: ChangeOrderLinks) {
  const isAdmin = actor.roles.includes("OPS_ADMIN");
  if (!isAdmin && !actor.orgId) {
    return { jobId: [], buildOpsProjectId: [], milestoneId: [] };
  }
  const projectScope: Prisma.ProjectWhereInput = {
    tenantId: actor.tenantId,
    job: { tenantId: actor.tenantId, deletedAt: null },
    ...(!isAdmin ? { OR: [
      { assignedProOrgId: actor.orgId },
      { job: { clientOrgId: actor.orgId } },
    ] } : {}),
  };
  const [jobs, builds, milestones] = await Promise.all([
    links && !links.jobId ? [] : prisma.job.findMany({
      where: {
        tenantId: actor.tenantId, deletedAt: null,
        ...(links ? { id: links.jobId! } : {}),
        ...(!isAdmin ? { OR: [
          { clientOrgId: actor.orgId },
          { project: { tenantId: actor.tenantId, assignedProOrgId: actor.orgId } },
        ] } : {}),
      },
      select: { id: true },
    }),
    links && !links.buildOpsProjectId ? [] : prisma.buildOpsProject.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(!isAdmin ? { orgId: actor.orgId } : {}),
        ...(links ? { id: links.buildOpsProjectId! } : {}),
      },
      select: { id: true },
    }),
    links && !links.milestoneId ? [] : prisma.milestone.findMany({
      where: {
        project: projectScope,
        ...(links ? { id: links.milestoneId! } : {}),
      },
      select: { id: true },
    }),
  ]);
  return {
    jobId: jobs.map(({ id }) => id),
    buildOpsProjectId: builds.map(({ id }) => id),
    milestoneId: milestones.map(({ id }) => id),
  };
}


export async function assertChangeOrderLinksAccessible(prisma: PrismaService, actor: ResourceActor, links: ChangeOrderLinks): Promise<void> {
  const allowed = await accessibleChangeOrderLinks(prisma, actor, links);
  const keys = ["jobId", "buildOpsProjectId", "milestoneId"] as const;
  const present = keys.filter((key) => links[key] != null);
  if (!present.length || present.some((key) => !allowed[key].includes(links[key]!))) {
    throw new NotFoundException("Change order resource not found");
  }
}


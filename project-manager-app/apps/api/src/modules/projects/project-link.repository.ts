import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type ProjectLinkRecord = {
  id: string;
  jobId: string;
  assignedProOrgId: string;
  job: {
    clientOrgId: string;
  };
};

export async function findProjectLinkByProjectIdOrThrow(
  prisma: PrismaService,
  input: { tenantId: string; projectId: string }
): Promise<ProjectLinkRecord> {
  const project = (await prisma.project.findFirst({
    where: {
      id: input.projectId,
      tenantId: input.tenantId,
      job: {
        deletedAt: null
      }
    },
    select: {
      id: true,
      jobId: true,
      assignedProOrgId: true,
      job: {
        select: {
          clientOrgId: true
        }
      }
    }
  })) as ProjectLinkRecord | null;

  if (!project) {
    throw new NotFoundException(`Project '${input.projectId}' not found`);
  }

  return project;
}

export async function findProjectLinkByJobIdOrThrow(
  prisma: PrismaService,
  input: { tenantId: string; jobId: string }
): Promise<ProjectLinkRecord> {
  const project = (await prisma.project.findFirst({
    where: {
      tenantId: input.tenantId,
      jobId: input.jobId,
      job: {
        deletedAt: null
      }
    },
    select: {
      id: true,
      jobId: true,
      assignedProOrgId: true,
      job: {
        select: {
          clientOrgId: true
        }
      }
    }
  })) as ProjectLinkRecord | null;

  if (!project) {
    throw new NotFoundException(`Project for job '${input.jobId}' not found`);
  }

  return project;
}

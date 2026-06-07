import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  isLegacyDomainStorageKey,
  isTenantScopedStorageKey,
  normalizeStorageKey,
} from "../../infrastructure/storage/storage-key.js";
import { findProjectLinkByJobIdOrThrow, findProjectLinkByProjectIdOrThrow } from "../projects/project-link.repository.js";
import { assertEvidenceReadable, assertEvidenceWritable, type EvidenceActor, type EvidenceOwnership } from "./evidence.policy.js";

type ActorInput = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

type ScopeInput = ActorInput & {
  projectId?: string;
  jobId?: string;
  milestoneId?: string;
};

export type EvidenceView = {
  id: string;
  tenantId: string;
  projectId: string;
  jobId: string;
  milestoneId?: string;
  uploadedById: string;
  kind: string;
  key: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type EvidenceRow = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  uploadedById: string;
  kind: string;
  bucketKey: string;
  metadataJson: unknown;
  createdAt: Date;
};

@Injectable()
export class EvidenceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async create(input: ScopeInput & { key: string; kind: "PHOTO" | "VIDEO" | "DOCUMENT" }): Promise<EvidenceView> {
    await this.actorContextService.ensureActorContext(input);
    const scope = await this.resolveScope(input);
    assertEvidenceWritable(this.toActor(input), scope.ownership);
    const bucketKey = normalizeEvidenceBucketKey(input.key, input.tenantId);

    const evidence = await this.prisma.evidence.create({
      data: {
        projectId: scope.projectId,
        milestoneId: scope.milestoneId,
        uploadedById: input.userId,
        kind: input.kind,
        bucketKey,
        metadataJson: {
          jobId: scope.jobId
        }
      }
    });

    return {
      id: evidence.id,
      tenantId: input.tenantId,
      projectId: scope.projectId,
      jobId: scope.jobId,
      milestoneId: scope.milestoneId,
      uploadedById: evidence.uploadedById,
      kind: evidence.kind.toLowerCase(),
      key: evidence.bucketKey,
      metadata: { jobId: scope.jobId },
      createdAt: evidence.createdAt.toISOString()
    };
  }

  async listByProject(input: ActorInput & { projectId: string }): Promise<EvidenceView[]> {
    await this.actorContextService.ensureActorContext(input);

    const project = await findProjectLinkByProjectIdOrThrow(this.prisma, input);

    assertEvidenceReadable(this.toActor(input), this.toOwnership(project));

    const rows = (await this.prisma.evidence.findMany({
      where: {
        projectId: input.projectId,
        project: {
          tenantId: input.tenantId
        }
      },
      orderBy: { createdAt: "desc" }
    })) as EvidenceRow[];

    return rows.map((row: EvidenceRow) => ({
      id: row.id,
      tenantId: input.tenantId,
      projectId: row.projectId,
      jobId: project.jobId,
      milestoneId: row.milestoneId ?? undefined,
      uploadedById: row.uploadedById,
      kind: row.kind.toLowerCase(),
      key: row.bucketKey,
      metadata: toRecord(row.metadataJson),
      createdAt: row.createdAt.toISOString()
    }));
  }

  async listByJob(input: ActorInput & { jobId: string }): Promise<EvidenceView[]> {
    await this.actorContextService.ensureActorContext(input);

    let project;
    try {
      project = await findProjectLinkByJobIdOrThrow(this.prisma, input);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return [];
      }

      throw error;
    }

    return this.listByProject({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      projectId: project.id
    });
  }

  async findById(input: ActorInput & { evidenceId: string }): Promise<EvidenceView> {
    await this.actorContextService.ensureActorContext(input);

    const row = (await this.prisma.evidence.findFirst({
      where: {
        id: input.evidenceId,
        project: {
          tenantId: input.tenantId
        }
      },
      include: {
        project: {
          select: {
            jobId: true,
            assignedProOrgId: true,
            job: {
              select: {
                clientOrgId: true
              }
            }
          }
        }
      }
    })) as {
      id: string;
      projectId: string;
      milestoneId: string | null;
      uploadedById: string;
      kind: string;
      bucketKey: string;
      metadataJson: unknown;
      createdAt: Date;
      project: {
        jobId: string;
        assignedProOrgId: string;
        job: {
          clientOrgId: string;
        };
      };
    } | null;

    if (!row) {
      throw new NotFoundException(`Evidence '${input.evidenceId}' not found`);
    }

    assertEvidenceReadable(this.toActor(input), this.toOwnership(row.project));

    return {
      id: row.id,
      tenantId: input.tenantId,
      projectId: row.projectId,
      jobId: row.project.jobId,
      milestoneId: row.milestoneId ?? undefined,
      uploadedById: row.uploadedById,
      kind: row.kind.toLowerCase(),
      key: row.bucketKey,
      metadata: toRecord(row.metadataJson),
      createdAt: row.createdAt.toISOString()
    };
  }

  private async resolveScope(input: ScopeInput): Promise<{
    projectId: string;
    jobId: string;
    milestoneId?: string;
    ownership: EvidenceOwnership;
  }> {
    if (input.milestoneId) {
      const milestone = await this.prisma.milestone.findFirst({
        where: {
          id: input.milestoneId,
          deletedAt: null,
          project: {
            tenantId: input.tenantId
          }
        },
        select: {
          id: true,
          projectId: true,
          project: {
            select: {
              jobId: true,
              assignedProOrgId: true,
              job: {
                select: {
                  clientOrgId: true
                }
              }
            }
          }
        }
      });

      if (!milestone) {
        throw new NotFoundException(`Milestone '${input.milestoneId}' not found`);
      }

      return {
        projectId: milestone.projectId,
        jobId: milestone.project.jobId,
        milestoneId: milestone.id,
        ownership: this.toOwnership(milestone.project)
      };
    }

    if (input.projectId) {
      const project = await findProjectLinkByProjectIdOrThrow(this.prisma, {
        tenantId: input.tenantId,
        projectId: input.projectId
      });

      return {
        projectId: project.id,
        jobId: project.jobId,
        ownership: this.toOwnership(project)
      };
    }

    if (input.jobId) {
      const project = await findProjectLinkByJobIdOrThrow(this.prisma, {
        tenantId: input.tenantId,
        jobId: input.jobId
      });

      return {
        projectId: project.id,
        jobId: project.jobId,
        ownership: this.toOwnership(project)
      };
    }

    throw new NotFoundException("Evidence scope could not be resolved");
  }

  private toActor(input: ActorInput): EvidenceActor {
    return {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles
    };
  }

  private toOwnership(project: { assignedProOrgId: string; job: { clientOrgId: string } }): EvidenceOwnership {
    return {
      clientOrgId: project.job.clientOrgId,
      assignedProOrgId: project.assignedProOrgId
    };
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function normalizeEvidenceBucketKey(key: string, tenantId: string): string {
  try {
    const normalized = normalizeStorageKey(key);
    if (isTenantScopedStorageKey({ key: normalized, tenantId, domain: "evidence" })) {
      return normalized;
    }

    if (process.env.NODE_ENV !== "production" && isLegacyDomainStorageKey(normalized, "evidence")) {
      return normalized;
    }
  } catch {
    // Normalize all malformed-key failures to a stable 400.
  }

  throw new BadRequestException("Evidence key must be a tenant-scoped storage key");
}

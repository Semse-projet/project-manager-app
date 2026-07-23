import crypto from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EVIDENCE_UPLOADED_V1_SCHEMA_REF,
  evidenceUploadedV1EventSchema,
  evidenceUploadedV1PayloadSchema,
} from "@semse/schemas";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  isLegacyDomainStorageKey,
  isTenantScopedStorageKey,
  normalizeStorageKey,
} from "../../infrastructure/storage/storage-key.js";
import { OutboxRepository } from "../domain-events/outbox.repository.js";
import {
  findProjectLinkByJobIdOrThrow,
  findProjectLinkByProjectIdOrThrow,
} from "../projects/project-link.repository.js";
import {
  assertEvidenceReadable,
  assertEvidenceWritable,
  type EvidenceActor,
  type EvidenceOwnership,
} from "./evidence.policy.js";

type ActorInput = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

type ScopeInput = ActorInput & {
  requestId: string;
  projectId?: string;
  jobId?: string;
  milestoneId?: string;
};

type CreateEvidenceInput = ScopeInput & {
  key: string;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT";
  filename?: string;
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
  filename?: string;
  validationStatus: string;
  aiQualityScore: number | null;
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
  validationStatus: string;
  aiQualityScore: unknown;
  createdAt: Date;
};

function toAiQualityScoreNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

@Injectable()
export class EvidenceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  async create(input: CreateEvidenceInput): Promise<EvidenceView> {
    await this.actorContextService.ensureActorContext(input);
    const scope = await this.resolveScope(input);
    assertEvidenceWritable(this.toActor(input), scope.ownership);
    const bucketKey = normalizeEvidenceBucketKey(input.key, input.tenantId);
    const idempotencyKey = evidenceUploadedIdempotencyKey(input.requestId);

    const existing = await this.findExistingByIdempotencyKey(
      input,
      scope,
      idempotencyKey,
      bucketKey,
    );
    if (existing) {
      return existing;
    }

    try {
      const evidence = await this.prisma.$transaction(async (tx) => {
        const created = await tx.evidence.create({
          data: {
            tenantId: input.tenantId,
            projectId: scope.projectId,
            milestoneId: scope.milestoneId,
            uploadedById: input.userId,
            kind: input.kind,
            bucketKey,
            metadataJson: {
              jobId: scope.jobId,
              ...(input.filename ? { filename: input.filename } : {}),
            },
          },
        });

        const recordedAt = new Date();
        const event = evidenceUploadedV1EventSchema.parse({
          eventId: crypto.randomUUID(),
          eventType: "evidence.uploaded.v1",
          version: 1,
          envelopeVersion: 2,
          occurredAt: created.createdAt.toISOString(),
          recordedAt: recordedAt.toISOString(),
          tenantId: input.tenantId,
          orgId: input.orgId,
          module: "evidence",
          entityType: "Evidence",
          entityId: created.id,
          actor: { type: "user", id: input.userId },
          correlationId: input.requestId,
          idempotencyKey,
          schemaRef: EVIDENCE_UPLOADED_V1_SCHEMA_REF,
          payload: {
            evidenceId: created.id,
            projectId: scope.projectId,
            jobId: scope.jobId,
            milestoneId: scope.milestoneId,
            uploaderId: input.userId,
            kind: input.kind,
            bucketKey,
          },
          metadata: { source: "evidence.register" },
        });

        await this.outboxRepository.create(tx, event);
        return created;
      });

      return this.toEvidenceView(input.tenantId, scope, evidence, input.filename);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const raced = await this.findExistingByIdempotencyKey(
        input,
        scope,
        idempotencyKey,
        bucketKey,
      );
      if (raced) {
        return raced;
      }

      throw error;
    }
  }

  private async findExistingByIdempotencyKey(
    input: CreateEvidenceInput,
    scope: { projectId: string; jobId: string; milestoneId?: string },
    idempotencyKey: string,
    bucketKey: string,
  ): Promise<EvidenceView | undefined> {
    const outbox = await this.prisma.domainOutboxEvent.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: input.tenantId,
          idempotencyKey,
        },
      },
      select: { payloadJson: true },
    });

    if (!outbox) {
      return undefined;
    }

    const payload = evidenceUploadedV1PayloadSchema.safeParse(
      outbox.payloadJson,
    );
    if (
      !payload.success ||
      payload.data.projectId !== scope.projectId ||
      payload.data.jobId !== scope.jobId ||
      payload.data.milestoneId !== scope.milestoneId ||
      payload.data.uploaderId !== input.userId ||
      payload.data.kind !== input.kind ||
      payload.data.bucketKey !== bucketKey
    ) {
      throw new BadRequestException(
        "requestId is already bound to a different Evidence command",
      );
    }

    const evidence = await this.prisma.evidence.findFirst({
      where: {
        id: payload.data.evidenceId,
        tenantId: input.tenantId,
        projectId: scope.projectId,
      },
    });

    if (!evidence) {
      throw new BadRequestException(
        "requestId references an incomplete Evidence transaction",
      );
    }

    return this.toEvidenceView(input.tenantId, scope, evidence, input.filename);
  }

  private toEvidenceView(
    tenantId: string,
    scope: { projectId: string; jobId: string; milestoneId?: string },
    evidence: {
      id: string;
      uploadedById: string;
      kind: string;
      bucketKey: string;
      validationStatus?: string;
      aiQualityScore?: unknown;
      createdAt: Date;
    },
    filename?: string,
  ): EvidenceView {
    return {
      id: evidence.id,
      tenantId,
      projectId: scope.projectId,
      jobId: scope.jobId,
      milestoneId: scope.milestoneId,
      uploadedById: evidence.uploadedById,
      kind: evidence.kind.toLowerCase(),
      key: evidence.bucketKey,
      filename,
      validationStatus: evidence.validationStatus ?? "pending",
      aiQualityScore: toAiQualityScoreNumber(evidence.aiQualityScore),
      metadata: { jobId: scope.jobId, ...(filename ? { filename } : {}) },
      createdAt: evidence.createdAt.toISOString(),
    };
  }

  async listByProject(
    input: ActorInput & { projectId: string },
  ): Promise<EvidenceView[]> {
    await this.actorContextService.ensureActorContext(input);

    const project = await findProjectLinkByProjectIdOrThrow(this.prisma, input);

    assertEvidenceReadable(this.toActor(input), this.toOwnership(project));

    const rows = (await this.prisma.evidence.findMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
      },
      orderBy: { createdAt: "desc" },
    })) as EvidenceRow[];

    return rows.map((row: EvidenceRow) => {
      const metadata = toRecord(row.metadataJson);
      const filename = typeof metadata?.filename === "string" ? metadata.filename : undefined;
      return {
        id: row.id,
        tenantId: input.tenantId,
        projectId: row.projectId,
        jobId: project.jobId,
        milestoneId: row.milestoneId ?? undefined,
        uploadedById: row.uploadedById,
        kind: row.kind.toLowerCase(),
        key: row.bucketKey,
        filename,
        validationStatus: row.validationStatus ?? "pending",
        aiQualityScore: toAiQualityScoreNumber(row.aiQualityScore),
        metadata,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async listByJob(
    input: ActorInput & { jobId: string },
  ): Promise<EvidenceView[]> {
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
      projectId: project.id,
    });
  }

  async findById(
    input: ActorInput & { evidenceId: string },
  ): Promise<EvidenceView> {
    await this.actorContextService.ensureActorContext(input);

    const row = (await this.prisma.evidence.findFirst({
      where: {
        id: input.evidenceId,
        tenantId: input.tenantId,
      },
      include: {
        project: {
          select: {
            jobId: true,
            assignedProOrgId: true,
            job: {
              select: {
                clientOrgId: true,
              },
            },
          },
        },
      },
    })) as {
      id: string;
      projectId: string;
      milestoneId: string | null;
      uploadedById: string;
      kind: string;
      bucketKey: string;
      metadataJson: unknown;
      validationStatus: string;
      aiQualityScore: unknown;
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

    const metadata = toRecord(row.metadataJson);
    const filename = typeof metadata?.filename === "string" ? metadata.filename : undefined;

    return {
      id: row.id,
      tenantId: input.tenantId,
      projectId: row.projectId,
      jobId: row.project.jobId,
      milestoneId: row.milestoneId ?? undefined,
      uploadedById: row.uploadedById,
      kind: row.kind.toLowerCase(),
      key: row.bucketKey,
      filename,
      validationStatus: row.validationStatus ?? "pending",
      aiQualityScore: toAiQualityScoreNumber(row.aiQualityScore),
      metadata,
      createdAt: row.createdAt.toISOString(),
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
            tenantId: input.tenantId,
          },
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
                  clientOrgId: true,
                },
              },
            },
          },
        },
      });

      if (!milestone) {
        throw new NotFoundException(
          `Milestone '${input.milestoneId}' not found`,
        );
      }

      return {
        projectId: milestone.projectId,
        jobId: milestone.project.jobId,
        milestoneId: milestone.id,
        ownership: this.toOwnership(milestone.project),
      };
    }

    if (input.projectId) {
      const project = await findProjectLinkByProjectIdOrThrow(this.prisma, {
        tenantId: input.tenantId,
        projectId: input.projectId,
      });

      return {
        projectId: project.id,
        jobId: project.jobId,
        ownership: this.toOwnership(project),
      };
    }

    if (input.jobId) {
      const project = await findProjectLinkByJobIdOrThrow(this.prisma, {
        tenantId: input.tenantId,
        jobId: input.jobId,
      });

      return {
        projectId: project.id,
        jobId: project.jobId,
        ownership: this.toOwnership(project),
      };
    }

    throw new NotFoundException("Evidence scope could not be resolved");
  }

  private toActor(input: ActorInput): EvidenceActor {
    return {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
    };
  }

  private toOwnership(project: {
    assignedProOrgId: string;
    job: { clientOrgId: string };
  }): EvidenceOwnership {
    return {
      clientOrgId: project.job.clientOrgId,
      assignedProOrgId: project.assignedProOrgId,
    };
  }
}

export function evidenceUploadedIdempotencyKey(requestId: string): string {
  const normalized = requestId.trim();
  if (!normalized || normalized.length > 255) {
    throw new BadRequestException("requestId must contain 1 to 255 characters");
  }

  return `evidence.uploaded.v1:${normalized}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
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
    if (
      isTenantScopedStorageKey({
        key: normalized,
        tenantId,
        domain: "evidence",
      })
    ) {
      return normalized;
    }

    if (
      process.env.NODE_ENV !== "production" &&
      isLegacyDomainStorageKey(normalized, "evidence")
    ) {
      return normalized;
    }
  } catch {
    // Normalize all malformed-key failures to a stable 400.
  }

  throw new BadRequestException(
    "Evidence key must be a tenant-scoped storage key",
  );
}

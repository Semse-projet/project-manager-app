import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { type DisputeRecord } from "../../common/domain-store.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { ProjectScope } from "../../common/resource-scope.js";
import { ResourceScopeResolver } from "../../common/resource-scope.resolver.js";
import { findProjectLinkByJobIdOrThrow } from "../projects/project-link.repository.js";
import { lockOpenJob } from "../../common/job-lock.js";
import {
  assertDisputeAssignable,
  assertDisputeCreatable,
  assertDisputeReadable,
  assertDisputeResolvable,
  type DisputeActor,
  type DisputeOwnership
} from "./disputes.policy.js";

type StoredDispute = {
  id: string;
  tenantId: string;
  projectId: string;
  reason: string;
  reasonCode?: string | null;
  status: string;
  raisedById?: string | null;
  assigneeUserId: string | null;
  resolvedById: string | null;
  resolution: string | null;
  resolutionType?: string | null;
  evidenceBundleIds?: string[];
  project?: {
    jobId?: string;
    assignedProOrgId: string;
    job: {
      id?: string;
      clientOrgId: string;
    };
  };
};

@Injectable()
export class DisputesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService,
    private readonly scopeResolver: ResourceScopeResolver
  ) {}

  async list(input: { tenantId: string; orgId: string; userId: string; roles: string[] }): Promise<DisputeRecord[]> {
    await this.actorContextService.ensureActorContext(input);

    const disputes = (await this.prisma.dispute.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        ...this.buildOwnershipWhere(input)
      },
      include: {
        project: {
          include: {
            job: {
              select: {
                clientOrgId: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })) as StoredDispute[];

    return disputes.map((dispute) => this.toRecord(dispute));
  }

  async create(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId?: string;
    jobId?: string;
    reason: string;
  }): Promise<DisputeRecord> {
    await this.actorContextService.ensureActorContext(input);

    const resolvedProjectId = input.projectId
      ? input.projectId
      : (await findProjectLinkByJobIdOrThrow(this.prisma, {
          tenantId: input.tenantId,
          jobId: input.jobId!
        })).id;

    // C51: alcance del proyecto con el resolver canónico (otro tenant o inexistente ⇒ 404).
    const scope = await this.scopeResolver.resolveProjectScope(input.tenantId, resolvedProjectId);

    if (!scope) {
      throw new NotFoundException(`Project '${resolvedProjectId}' not found`);
    }

    assertDisputeCreatable(this.toActor(input), this.toOwnership(scope));

    // Same job row lock as a completion or cancellation (common/job-lock.ts): a
    // dispute cannot be opened on a closed job, nor slip in while one is closing.
    const dispute = (await this.prisma.$transaction(async (tx) => {
      // ProjectScope (C51) carries no jobId; read it inside the same transaction.
      const linked = await tx.project.findFirst({
        where: { id: resolvedProjectId, tenantId: input.tenantId },
        select: { jobId: true },
      });
      if (linked?.jobId) await lockOpenJob(tx, linked.jobId, "open a dispute");

      const existing = await tx.dispute.findFirst({
        where: {
          tenantId: input.tenantId,
          projectId: resolvedProjectId,
          deletedAt: null,
          status: {
            in: ["OPEN", "ASSIGNED", "UNDER_REVIEW"]
          }
        }
      });

      if (existing) {
        throw new ConflictException("an open dispute already exists for this project");
      }

      return tx.dispute.create({
        data: {
          tenantId: input.tenantId,
          projectId: resolvedProjectId,
          raisedById: input.userId,
          reason: input.reason,
          status: "OPEN"
        }
      });
    })) as StoredDispute;

    return this.toRecord(dispute);
  }

  async assign(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
    assigneeUserId: string;
  }): Promise<DisputeRecord> {
    await this.actorContextService.ensureActorContext(input);
    await this.actorContextService.ensureActorContext({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.assigneeUserId
    });
    assertDisputeAssignable(this.toActor(input));

    const existing = (await this.prisma.dispute.findFirst({
      where: {
        id: input.disputeId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      include: {
        project: {
          include: {
            job: {
              select: {
                clientOrgId: true
              }
            }
          }
        }
      }
    })) as StoredDispute | null;

    if (!existing) {
      throw new NotFoundException(`Dispute '${input.disputeId}' not found`);
    }

    if (existing.status === "RESOLVED" || existing.status === "REJECTED") {
      throw new ConflictException("cannot assign a resolved dispute");
    }

    const dispute = (await this.prisma.dispute.update({
      where: { id: existing.id },
      data: {
        assigneeUserId: input.assigneeUserId,
        status: "ASSIGNED"
      }
    })) as StoredDispute;

    return this.toRecord(dispute);
  }

  async getEventContext(input: { tenantId: string; disputeId: string }): Promise<{
    disputeId: string;
    jobId: string;
    projectId: string;
    raisedById?: string;
    reason: string;
  }> {
    const dispute = await this.prisma.dispute.findFirst({
      where: {
        id: input.disputeId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        reason: true,
        raisedById: true,
        projectId: true,
        project: {
          select: {
            jobId: true
          }
        }
      }
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute '${input.disputeId}' not found`);
    }

    return {
      disputeId: dispute.id,
      jobId: dispute.project.jobId,
      projectId: dispute.projectId,
      raisedById: dispute.raisedById ?? undefined,
      reason: dispute.reason
    };
  }

  async archive(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
  }): Promise<{ id: string; archivedAt: string }> {
    await this.actorContextService.ensureActorContext(input);

    const dispute = await this.prisma.dispute.findFirst({
      where: {
        id: input.disputeId,
        tenantId: input.tenantId,
        deletedAt: null,
        ...this.buildOwnershipWhere(input)
      },
      select: {
        id: true
      }
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute '${input.disputeId}' not found`);
    }

    const archivedAt = new Date();
    await this.prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        deletedAt: archivedAt
      }
    });

    return {
      id: dispute.id,
      archivedAt: archivedAt.toISOString()
    };
  }

  async restore(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
  }): Promise<{ id: string; restored: true }> {
    await this.actorContextService.ensureActorContext(input);

    const dispute = await this.prisma.dispute.findFirst({
      where: {
        id: input.disputeId,
        tenantId: input.tenantId,
        ...this.buildOwnershipWhere(input)
      },
      select: {
        id: true,
        deletedAt: true
      }
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute '${input.disputeId}' not found`);
    }

    await this.prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        deletedAt: null
      }
    });

    return {
      id: dispute.id,
      restored: true
    };
  }

  private buildOwnershipWhere(input: { orgId: string; roles: string[] }) {
    if (input.roles.includes("OPS_ADMIN")) {
      return {};
    }

    // Org vacía nunca concede acceso (mismo criterio que `sameOrg`).
    if (!input.orgId) {
      return { id: { in: [] as string[] } };
    }

    return {
      OR: [{ project: { job: { clientOrgId: input.orgId } } }, { project: { assignedProOrgId: input.orgId } }]
    };
  }

  private toActor(input: { tenantId: string; orgId: string; userId: string; roles: string[] }): DisputeActor {
    return {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles
    };
  }

  private toOwnership(scope: ProjectScope): DisputeOwnership {
    return {
      clientOrgId: scope.clientOrgId ?? "",
      assignedProOrgId: scope.assignedProOrgId ?? ""
    };
  }

  /** Alcance del proyecto de la disputa (resolver canónico); 404 si no existe en el tenant. */
  private async requireDisputeScope(tenantId: string, disputeId: string): Promise<ProjectScope> {
    const scope = await this.scopeResolver.resolveDisputeScope(tenantId, disputeId);
    if (!scope) throw new NotFoundException(`Dispute '${disputeId}' not found`);
    return scope;
  }

  async submitEvidence(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
    evidenceIds: string[];
  }): Promise<DisputeRecord> {
    await this.actorContextService.ensureActorContext(input);

    const existing = (await this.prisma.dispute.findFirst({
      where: { id: input.disputeId, tenantId: input.tenantId, deletedAt: null },
      include: { project: { include: { job: { select: { clientOrgId: true } } } } }
    })) as StoredDispute | null;

    if (!existing) throw new NotFoundException(`Dispute '${input.disputeId}' not found`);
    // C51: solo participantes del proyecto (org cliente o profesional asignada) u OPS_ADMIN del tenant.
    assertDisputeReadable(this.toActor(input), this.toOwnership(await this.requireDisputeScope(input.tenantId, existing.id)));
    if (existing.status === "RESOLVED" || existing.status === "REJECTED") {
      throw new ConflictException("cannot attach evidence to a terminal dispute");
    }

    const currentIds: string[] = existing.evidenceBundleIds ?? [];
    const merged = Array.from(new Set([...currentIds, ...input.evidenceIds]));

    const dispute = (await this.prisma.dispute.update({
      where: { id: existing.id },
      data: { evidenceBundleIds: merged }
    })) as StoredDispute;

    return this.toRecord(dispute);
  }

  async markUnderReview(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
  }): Promise<DisputeRecord> {
    await this.actorContextService.ensureActorContext(input);
    assertDisputeAssignable(this.toActor(input));

    const existing = (await this.prisma.dispute.findFirst({
      where: { id: input.disputeId, tenantId: input.tenantId, deletedAt: null },
      include: { project: { include: { job: { select: { clientOrgId: true } } } } }
    })) as StoredDispute | null;

    if (!existing) throw new NotFoundException(`Dispute '${input.disputeId}' not found`);
    if (existing.status !== "ASSIGNED") {
      throw new ConflictException(`dispute must be ASSIGNED before moving to UNDER_REVIEW, current: ${existing.status}`);
    }

    const dispute = (await this.prisma.dispute.update({
      where: { id: existing.id },
      data: { status: "UNDER_REVIEW" }
    })) as StoredDispute;

    return this.toRecord(dispute);
  }

  async resolve(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    disputeId: string;
    resolution: string;
    resolutionType: string;
  }): Promise<DisputeRecord> {
    await this.actorContextService.ensureActorContext(input);

    const existing = (await this.prisma.dispute.findFirst({
      where: { id: input.disputeId, tenantId: input.tenantId, deletedAt: null },
      include: { project: { include: { job: { select: { clientOrgId: true } } } } }
    })) as StoredDispute | null;

    if (!existing) throw new NotFoundException(`Dispute '${input.disputeId}' not found`);

    assertDisputeResolvable(
      this.toActor(input),
      this.toOwnership(await this.requireDisputeScope(input.tenantId, existing.id)),
      existing.status,
      input.resolutionType,
    );

    const dispute = (await this.prisma.dispute.update({
      where: { id: existing.id },
      data: {
        status: "RESOLVED",
        resolution: input.resolution,
        resolutionType: input.resolutionType,
        resolvedById: input.userId,
        resolvedAt: new Date()
      }
    })) as StoredDispute;

    return this.toRecord(dispute);
  }

  private toRecord(dispute: StoredDispute): DisputeRecord {
    const statusMap: Record<string, DisputeRecord["status"]> = {
      OPEN: "open",
      ASSIGNED: "assigned",
      UNDER_REVIEW: "under_review",
      RESOLVED: "resolved",
      REJECTED: "rejected"
    };

    return {
      id: dispute.id,
      tenantId: dispute.tenantId,
      projectId: dispute.projectId,
      reason: dispute.reason,
      reasonCode: dispute.reasonCode ?? undefined,
      status: statusMap[dispute.status] ?? "open",
      assigneeUserId: dispute.assigneeUserId ?? undefined,
      resolvedByUserId: dispute.resolvedById ?? undefined,
      resolution: dispute.resolution ?? undefined,
      resolutionType: dispute.resolutionType ?? undefined,
      evidenceBundleIds: dispute.evidenceBundleIds ?? []
    };
  }
}

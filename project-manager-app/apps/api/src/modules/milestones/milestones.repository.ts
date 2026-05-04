import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { type MilestoneRecord } from "../../common/domain-store.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { databaseEnabled } from "../../infrastructure/persistence/persistence-mode.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { findProjectLinkByJobIdOrThrow, findProjectLinkByProjectIdOrThrow } from "../projects/project-link.repository.js";
import {
  approveMilestoneMemory,
  createMilestoneMemory,
  listMilestonesByProjectMemory,
  rejectMilestoneMemory,
  submitMilestoneMemory
} from "./milestones.memory.js";
import {
  assertMilestoneApprovable,
  assertMilestoneCreatable,
  assertMilestoneReadable,
  assertMilestoneRejectable,
  assertMilestoneSubmittable,
  type MilestoneActor,
  type MilestoneLifecycleSnapshot,
  type MilestoneOwnership
} from "./milestones.policy.js";

const milestoneStatusMap = {
  draft: "DRAFT",
  awaiting_review: "AWAITING_REVIEW",
  submitted: "SUBMITTED",
  approved: "APPROVED",
  rejected: "REJECTED",
  paid: "PAID"
} as const;

type StoredMilestone = {
  id: string;
  projectId: string;
  title: string;
  amount: { toNumber(): number };
  sequence: number;
  status: string;
  project?: {
    jobId: string;
    assignedProOrgId: string;
    job: {
      clientOrgId: string;
    };
  };
  _count?: {
    evidence: number;
  };
};

type MilestoneEventContext = {
  milestoneId: string;
  projectId: string;
  jobId: string;
  evidenceCount: number;
};

function toMilestoneRecord(milestone: StoredMilestone, tenantId: string): MilestoneRecord {
  return {
    id: milestone.id,
    tenantId,
    projectId: milestone.projectId,
    title: milestone.title,
    amount: milestone.amount.toNumber(),
    sequence: milestone.sequence,
    status: milestone.status.toLowerCase() as MilestoneRecord["status"],
    evidenceCount: milestone._count?.evidence ?? 0
  };
}

@Injectable()
export class MilestonesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async create(input: {
    tenantId: string;
    projectId: string;
    title: string;
    amount: number;
    sequence: number;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      return createMilestoneMemory(input);
    }

    await this.actorContextService.ensureActorContext(input);
    const project = await this.findProjectOrThrow(input);
    assertMilestoneCreatable(this.toActor(input), this.toOwnership(project));

    if (input.amount <= 0) {
      throw new BadRequestException("milestone amount must be greater than zero");
    }

    const duplicateSequence = await this.prisma.milestone.findFirst({
      where: {
        projectId: input.projectId,
        deletedAt: null,
        sequence: input.sequence
      },
      select: { id: true }
    });

    if (duplicateSequence) {
      throw new ConflictException(`milestone sequence '${input.sequence}' already exists`);
    }

    const milestone = (await this.prisma.milestone.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        amount: input.amount,
        sequence: input.sequence,
        status: "DRAFT"
      }
    })) as StoredMilestone;

    return toMilestoneRecord(milestone, input.tenantId);
  }

  async listByProject(input: {
    tenantId: string;
    projectId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord[]> {
    if (!databaseEnabled()) {
      return listMilestonesByProjectMemory({
        tenantId: input.tenantId,
        projectId: input.projectId
      });
    }

    await this.actorContextService.ensureActorContext(input);
    const project = await this.findProjectOrThrow(input);
    assertMilestoneReadable(this.toActor(input), this.toOwnership(project));

    const milestones = (await this.prisma.milestone.findMany({
      where: {
        projectId: input.projectId,
        deletedAt: null
      },
      include: {
        _count: {
          select: { evidence: true }
        }
      },
      orderBy: { sequence: "asc" }
    })) as StoredMilestone[];

    return milestones.map((milestone) => toMilestoneRecord(milestone, input.tenantId));
  }

  async submit(input: {
    tenantId: string;
    milestoneId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      return submitMilestoneMemory(input);
    }

    await this.actorContextService.ensureActorContext(input);

    const snapshot = await this.getLifecycleSnapshot(input);
    assertMilestoneSubmittable(this.toActor(input), snapshot);

    const updated = (await this.prisma.milestone.update({
      where: { id: snapshot.milestoneId },
      data: { status: milestoneStatusMap.submitted }
    })) as StoredMilestone;

    return toMilestoneRecord(updated, input.tenantId);
  }

  async approve(input: {
    tenantId: string;
    milestoneId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      return approveMilestoneMemory(input);
    }

    await this.actorContextService.ensureActorContext(input);

    const snapshot = await this.getLifecycleSnapshot(input);
    assertMilestoneApprovable(this.toActor(input), snapshot);

    const updated = (await this.prisma.milestone.update({
      where: { id: snapshot.milestoneId },
      data: { status: milestoneStatusMap.approved }
    })) as StoredMilestone;

    return toMilestoneRecord(updated, input.tenantId);
  }

  async reject(input: {
    tenantId: string;
    milestoneId: string;
    reason: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      return rejectMilestoneMemory(input);
    }

    await this.actorContextService.ensureActorContext(input);

    const snapshot = await this.getLifecycleSnapshot(input);
    assertMilestoneRejectable(this.toActor(input), snapshot);

    const updated = (await this.prisma.milestone.update({
      where: { id: snapshot.milestoneId },
      data: { status: milestoneStatusMap.rejected }
    })) as StoredMilestone;

    return {
      ...toMilestoneRecord(updated, input.tenantId),
      rejectionReason: input.reason,
      reviewDecision: "reject"
    };
  }

  async requestChanges(input: {
    tenantId: string;
    milestoneId: string;
    reason: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord> {
    if (!databaseEnabled()) {
      const milestone = rejectMilestoneMemory(input);
      milestone.status = "draft";
      milestone.reviewDecision = "request_changes";
      milestone.rejectionReason = input.reason;
      return milestone;
    }

    await this.actorContextService.ensureActorContext(input);

    const snapshot = await this.getLifecycleSnapshot(input);
    assertMilestoneRejectable(this.toActor(input), snapshot);

    const updated = (await this.prisma.milestone.update({
      where: { id: snapshot.milestoneId },
      data: { status: milestoneStatusMap.draft }
    })) as StoredMilestone;

    return {
      ...toMilestoneRecord(updated, input.tenantId),
      rejectionReason: input.reason,
      reviewDecision: "request_changes"
    };
  }

  async getEventContext(input: { tenantId: string; milestoneId: string }): Promise<MilestoneEventContext> {
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
            jobId: true
          }
        },
        _count: {
          select: {
            evidence: true
          }
        }
      }
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone '${input.milestoneId}' not found`);
    }

    return {
      milestoneId: milestone.id,
      projectId: milestone.projectId,
      jobId: milestone.project.jobId,
      evidenceCount: milestone._count.evidence
    };
  }

  async listByJob(input: {
    tenantId: string;
    jobId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneRecord[]> {
    if (!databaseEnabled()) {
      const project = await this.findProjectByJobOrThrow(input);
      return this.listByProject({
        tenantId: input.tenantId,
        projectId: project.id,
        userId: input.userId,
        orgId: input.orgId,
        roles: input.roles
      });
    }

    await this.actorContextService.ensureActorContext(input);

    const project = await this.findProjectByJob(input);
    if (!project) {
      const job = await this.prisma.job.findFirst({
        where: {
          id: input.jobId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        select: {
          id: true
        }
      });

      if (!job) {
        throw new NotFoundException(`Job '${input.jobId}' not found`);
      }

      return [];
    }

    return this.listByProject({
      tenantId: input.tenantId,
      projectId: project.id,
      userId: input.userId,
      orgId: input.orgId,
      roles: input.roles
    });
  }

  async resolveProjectIdByJob(input: { tenantId: string; jobId: string }): Promise<string> {
    const project = await this.findProjectByJobOrThrow(input);
    return project.id;
  }

  async countProjectEvidence(input: { tenantId: string; projectId: string }): Promise<number> {
    return this.prisma.evidence.count({
      where: {
        project: { id: input.projectId, tenantId: input.tenantId },
      },
    });
  }

  private async findProjectOrThrow(input: { tenantId: string; projectId: string }) {
    return findProjectLinkByProjectIdOrThrow(this.prisma, input);
  }

  private async findProjectByJobOrThrow(input: { tenantId: string; jobId: string }) {
    return findProjectLinkByJobIdOrThrow(this.prisma, input);
  }

  private async findProjectByJob(input: { tenantId: string; jobId: string }) {
    return (await this.prisma.project.findFirst({
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
    })) as
      | {
          id: string;
          jobId: string;
          assignedProOrgId: string;
          job: { clientOrgId: string };
        }
      | null;
  }

  private async getLifecycleSnapshot(input: {
    tenantId: string;
    milestoneId: string;
    userId: string;
    orgId: string;
    roles: string[];
  }): Promise<MilestoneLifecycleSnapshot> {
    const milestone = await this.findStoredMilestoneOrThrow(input);
    const evidenceCount = await this.prisma.evidence.count({
      where: {
        milestoneId: input.milestoneId,
        project: {
          tenantId: input.tenantId
        }
      }
    });

    return {
      milestoneId: milestone.id,
      currentStatus: milestone.status.toLowerCase() as MilestoneRecord["status"],
      ownership: this.toOwnership(milestone.project!),
      evidenceCount
    };
  }

  private toActor(input: { tenantId: string; orgId: string; userId: string; roles: string[] }): MilestoneActor {
    return {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles
    };
  }

  private toOwnership(input: { assignedProOrgId: string; job: { clientOrgId: string } }): MilestoneOwnership {
    return {
      clientOrgId: input.job.clientOrgId,
      assignedProOrgId: input.assignedProOrgId
    };
  }

  private async findStoredMilestoneOrThrow(input: {
    tenantId: string;
    milestoneId: string;
  }): Promise<StoredMilestone> {
    const milestone = (await this.prisma.milestone.findFirst({
      where: {
        id: input.milestoneId,
        deletedAt: null,
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
    })) as StoredMilestone | null;

    if (!milestone) {
      throw new NotFoundException(`Milestone '${input.milestoneId}' not found`);
    }

    return milestone;
  }
}

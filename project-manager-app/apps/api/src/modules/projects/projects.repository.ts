import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { type EscrowRecord, type PaymentTxnRecord, type ProjectRecord } from "../../common/domain-store.js";
import {
  assertProjectFinancialsReadable,
  assertProjectReadable,
  type ProjectActor,
  type ProjectLifecycleSnapshot,
  type ProjectOwnership
} from "./projects.policy.js";

const projectStatusMap = {
  open: "OPEN",
  in_progress: "IN_PROGRESS",
  blocked: "BLOCKED",
  completed: "COMPLETED",
  cancelled: "CANCELLED"
} as const;

const projectStatusTransitions: Record<ProjectRecord["status"], ProjectRecord["status"][]> = {
  open: ["in_progress", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  completed: [],
  cancelled: []
};

type StoredProject = {
  id: string;
  tenantId: string;
  jobId: string;
  assignedProOrgId: string;
  status: string;
  job: {
    clientOrgId: string;
  };
};

type StoredPaymentTxn = {
  id: string;
  escrowId: string;
  milestoneId: string | null;
  type: string;
  amount: { toNumber(): number };
  status: string;
  createdAt: Date;
  escrow: {
    projectId: string;
    jobId: string | null;
    contractId: string | null;
    project: {
      tenantId: string;
    };
  };
};

type StoredEscrow = {
  id: string;
  projectId: string;
  jobId: string | null;
  contractId: string | null;
  status: string;
  totalAmount: { toNumber(): number };
  currency: string;
  project: {
    tenantId: string;
  };
  transactions: Array<{
    type: string;
    amount: { toNumber(): number };
    status: string;
  }>;
};

@Injectable()
export class ProjectsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async list(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    status?: ProjectRecord["status"];
    jobId?: string;
  }): Promise<ProjectRecord[]> {
    await this.actorContextService.ensureActorContext(input);

    const projects = (await this.prisma.project.findMany({
      where: {
        tenantId: input.tenantId,
        ...this.buildOwnershipWhere(input),
        job: {
          deletedAt: null
        },
        ...(input.status ? { status: projectStatusMap[input.status] } : {}),
        ...(input.jobId ? { jobId: input.jobId } : {})
      },
      include: {
        job: {
          select: {
            clientOrgId: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })) as StoredProject[];

    return projects.map((project) => this.toRecord(project));
  }

  async findById(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }): Promise<ProjectRecord> {
    await this.actorContextService.ensureActorContext(input);

    const project = await this.findStoredProjectOrThrow(input);

    assertProjectReadable(this.toActor(input), this.toOwnership(project));

    return this.toRecord(project);
  }

  async updateStatus(input: {
    tenantId: string;
    projectId: string;
    status: ProjectRecord["status"];
  }): Promise<ProjectRecord> {
    const existing = await this.findStoredProjectOrThrow({
      tenantId: input.tenantId,
      projectId: input.projectId
    });

    const currentStatus = existing.status.toLowerCase() as ProjectRecord["status"];
    if (currentStatus === input.status) {
      return this.toRecord(existing);
    }

    const allowed = projectStatusTransitions[currentStatus];
    if (!allowed.includes(input.status)) {
      throw new ConflictException(`invalid transition from ${currentStatus} to ${input.status}`);
    }

    const updated = (await this.prisma.project.update({
      where: { id: existing.id },
      data: { status: projectStatusMap[input.status] },
      include: {
        job: {
          select: {
            clientOrgId: true
          }
        }
      }
    })) as StoredProject;

    return this.toRecord(updated);
  }

  async listPayments(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }): Promise<PaymentTxnRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const project = await this.findStoredProjectOrThrow(input);
    assertProjectFinancialsReadable(this.toActor(input), this.toOwnership(project));

    const transactions = (await this.prisma.paymentTxn.findMany({
      where: {
        escrow: {
          projectId: input.projectId,
          deletedAt: null,
          project: {
            tenantId: input.tenantId
          }
        }
      },
      include: {
        escrow: {
          include: {
            project: {
              select: {
                tenantId: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })) as StoredPaymentTxn[];

    return transactions.map((transaction) => this.toPaymentTxnRecord(transaction));
  }

  async getEscrowSummary(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }): Promise<{
    escrow: EscrowRecord | null;
    totalDeposited: number;
    totalReleased: number;
    totalRefunded: number;
    available: number;
  }> {
    await this.actorContextService.ensureActorContext(input);
    const project = await this.findStoredProjectOrThrow(input);
    assertProjectFinancialsReadable(this.toActor(input), this.toOwnership(project));

    const escrow = (await this.prisma.paymentEscrow.findFirst({
      where: {
        projectId: input.projectId,
        deletedAt: null,
        project: {
          tenantId: input.tenantId
        }
      },
      include: {
        project: {
          select: {
            tenantId: true
          }
        },
        transactions: {
          select: {
            type: true,
            amount: true,
            status: true
          }
        }
      }
    })) as StoredEscrow | null;

    if (!escrow) {
      return {
        escrow: null,
        totalDeposited: 0,
        totalReleased: 0,
        totalRefunded: 0,
        available: 0
      };
    }

    const totalDeposited = escrow.transactions
      .filter((transaction) => transaction.type === "DEPOSIT" && transaction.status === "SUCCEEDED")
      .reduce((sum, transaction) => sum + transaction.amount.toNumber(), 0);

    const totalReleased = escrow.transactions
      .filter((transaction) => transaction.type === "RELEASE" && transaction.status === "SUCCEEDED")
      .reduce((sum, transaction) => sum + transaction.amount.toNumber(), 0);

    const totalRefunded = escrow.transactions
      .filter((transaction) => transaction.type === "REFUND" && transaction.status === "SUCCEEDED")
      .reduce((sum, transaction) => sum + transaction.amount.toNumber(), 0);

    return {
      escrow: this.toEscrowRecord(escrow),
      totalDeposited,
      totalReleased,
      totalRefunded,
      available: totalDeposited - totalReleased - totalRefunded
    };
  }

  async getStatusChangeContext(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }): Promise<ProjectLifecycleSnapshot> {
    await this.actorContextService.ensureActorContext(input);

    const project = await this.findStoredProjectOrThrow(input);
    const ownership = this.toOwnership(project);
    assertProjectReadable(this.toActor(input), ownership);

    const milestones = await this.prisma.milestone.groupBy({
      by: ["status"],
      where: {
        projectId: input.projectId,
        deletedAt: null
      },
      _count: {
        _all: true
      }
    });

    const escrow = await this.getEscrowSummary(input);
    const activeDisputes = await this.prisma.dispute.count({
      where: {
        projectId: input.projectId,
        deletedAt: null,
        status: {
          in: ["OPEN", "ASSIGNED", "UNDER_REVIEW"]
        }
      }
    });

    const milestoneCounts = {
      total: 0,
      draft: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      paid: 0
    };

    for (const entry of milestones) {
      const count = entry._count._all;
      milestoneCounts.total += count;
      switch (entry.status) {
        case "DRAFT":
          milestoneCounts.draft += count;
          break;
        case "SUBMITTED":
        case "AWAITING_REVIEW":
          milestoneCounts.submitted += count;
          break;
        case "APPROVED":
          milestoneCounts.approved += count;
          break;
        case "REJECTED":
          milestoneCounts.rejected += count;
          break;
        case "PAID":
          milestoneCounts.paid += count;
          break;
        default:
          break;
      }
    }

    return {
      project: this.toRecord(project),
      ownership,
      activeDisputes,
      milestoneCounts,
      escrow: {
        exists: escrow.escrow !== null,
        totalDeposited: escrow.totalDeposited,
        totalReleased: escrow.totalReleased,
        totalRefunded: escrow.totalRefunded,
        available: escrow.available
      }
    };
  }

  private toRecord(project: StoredProject): ProjectRecord {
    return {
      id: project.id,
      tenantId: project.tenantId,
      jobId: project.jobId,
      assignedProOrgId: project.assignedProOrgId,
      status: project.status.toLowerCase() as ProjectRecord["status"]
    };
  }

  private async findStoredProjectOrThrow(input: {
    tenantId: string;
    projectId: string;
  }): Promise<StoredProject> {
    const project = (await this.prisma.project.findFirst({
      where: {
        id: input.projectId,
        tenantId: input.tenantId,
        job: {
          deletedAt: null
        }
      },
      include: {
        job: {
          select: {
            clientOrgId: true
          }
        }
      }
    })) as StoredProject | null;

    if (!project) {
      throw new NotFoundException(`Project '${input.projectId}' not found`);
    }

    return project;
  }

  private buildOwnershipWhere(input: { orgId: string; roles: string[] }) {
    if (input.roles.includes("OPS_ADMIN")) {
      return {};
    }

    return {
      OR: [{ job: { clientOrgId: input.orgId, deletedAt: null } }, { assignedProOrgId: input.orgId }]
    };
  }

  private toActor(input: { tenantId: string; orgId: string; userId: string; roles: string[] }): ProjectActor {
    return {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles
    };
  }

  private toOwnership(project: StoredProject): ProjectOwnership {
    return {
      clientOrgId: project.job.clientOrgId,
      assignedProOrgId: project.assignedProOrgId
    };
  }

  private toPaymentTxnRecord(transaction: StoredPaymentTxn): PaymentTxnRecord {
    return {
      id: transaction.id,
      tenantId: transaction.escrow.project.tenantId,
      escrowId: transaction.escrowId,
      projectId: transaction.escrow.projectId,
      jobId: transaction.escrow.jobId ?? undefined,
      contractId: transaction.escrow.contractId ?? undefined,
      milestoneId: transaction.milestoneId ?? undefined,
      type: transaction.type.toLowerCase() as PaymentTxnRecord["type"],
      amount: transaction.amount.toNumber(),
      status: transaction.status.toLowerCase() as PaymentTxnRecord["status"],
      createdAt: transaction.createdAt.toISOString()
    };
  }

  private toEscrowRecord(escrow: StoredEscrow): EscrowRecord {
    return {
      id: escrow.id,
      tenantId: escrow.project.tenantId,
      projectId: escrow.projectId,
      jobId: escrow.jobId ?? undefined,
      contractId: escrow.contractId ?? undefined,
      status: escrow.status.toLowerCase() as EscrowRecord["status"],
      totalAmount: escrow.totalAmount.toNumber(),
      currency: escrow.currency
    };
  }
}

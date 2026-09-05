import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ProjectLifecycleProjection } from "@semse/schemas";
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
import {
  buildProjectLifecycleProjection,
  isProjectLifecyclePersistenceEnabled
} from "./project-lifecycle-projection.js";

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

  async getLifecycleProjection(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    projectId: string;
  }): Promise<ProjectLifecycleProjection> {
    await this.actorContextService.ensureActorContext(input);

    const projection = await this.calculateLifecycleProjection(input, true);
    if (isProjectLifecyclePersistenceEnabled()) {
      await this.persistLifecycleProjection(input, projection);
    }
    return projection;
  }

  async rebuildLifecycleProjection(input: {
    tenantId: string;
    projectId: string;
  }): Promise<{
    effect: "updated" | "no_op";
    revision: string;
    sourceUpdatedAt: string;
  }> {
    const projection = await this.calculateLifecycleProjection(
      {
        tenantId: input.tenantId,
        orgId: "system",
        userId: "project-lifecycle-projection-consumer",
        roles: ["OPS_ADMIN"],
        projectId: input.projectId,
      },
      false,
    );
    const effect = await this.persistLifecycleProjection(input, projection);
    return {
      effect,
      revision: projection.revision,
      sourceUpdatedAt: projection.sourceUpdatedAt,
    };
  }

  private async calculateLifecycleProjection(
    input: {
      tenantId: string;
      orgId: string;
      userId: string;
      roles: string[];
      projectId: string;
    },
    assertFinancialOwnership: boolean,
  ): Promise<ProjectLifecycleProjection> {
    const sources = await this.prisma.$transaction(
      async (transaction) => {
        const project = await transaction.project.findFirst({
          where: {
            id: input.projectId,
            tenantId: input.tenantId,
            job: {
              deletedAt: null
            }
          },
          select: {
            id: true,
            tenantId: true,
            jobId: true,
            assignedProOrgId: true,
            status: true,
            startAt: true,
            dueAt: true,
            createdAt: true,
            updatedAt: true,
            job: {
              select: {
                title: true,
                status: true,
                deadline: true,
                clientOrgId: true,
                updatedAt: true,
                contract: {
                  where: { deletedAt: null },
                  select: {
                    signedClientAt: true,
                    signedProAt: true,
                    updatedAt: true
                  }
                },
                bids: {
                  where: { status: "ACCEPTED" },
                  select: { id: true }
                }
              }
            }
          }
        });

        if (!project) {
          throw new NotFoundException(`Project '${input.projectId}' not found`);
        }

        if (assertFinancialOwnership) {
          assertProjectFinancialsReadable(this.toActor(input), {
            clientOrgId: project.job.clientOrgId,
            assignedProOrgId: project.assignedProOrgId
          });
        }

        const [milestones, evidence, disputes, escrow, expenses, risk] = await Promise.all([
          transaction.milestone.findMany({
            where: {
              projectId: input.projectId,
              deletedAt: null
            },
            select: {
              id: true,
              amount: true,
              status: true,
              updatedAt: true,
              evidenceItems: {
                select: {
                  id: true,
                  required: true,
                  status: true,
                  updatedAt: true
                }
              }
            }
          }),
          transaction.evidence.findMany({
            where: {
              tenantId: input.tenantId,
              projectId: input.projectId
            },
            select: {
              id: true,
              validationStatus: true,
              updatedAt: true
            }
          }),
          transaction.dispute.findMany({
            where: {
              tenantId: input.tenantId,
              projectId: input.projectId,
              deletedAt: null
            },
            select: {
              id: true,
              status: true,
              reason: true,
              updatedAt: true
            }
          }),
          transaction.paymentEscrow.findFirst({
            where: {
              projectId: input.projectId,
              deletedAt: null,
              project: {
                tenantId: input.tenantId
              }
            },
            select: {
              status: true,
              currency: true,
              updatedAt: true,
              transactions: {
                select: {
                  id: true,
                  type: true,
                  amount: true,
                  status: true,
                  createdAt: true
                }
              }
            }
          }),
          transaction.projectExpense.findMany({
            where: {
              tenantId: input.tenantId,
              projectId: input.projectId
            },
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              isDuplicate: true,
              updatedAt: true
            }
          }),
          transaction.projectRiskScore.findFirst({
            where: {
              tenantId: input.tenantId,
              projectId: input.projectId
            },
            select: {
              overallScore: true,
              disputeRisk: true,
              budgetOverrunRisk: true,
              scheduleRisk: true,
              calculatedAt: true,
              updatedAt: true
            }
          })
        ]);

        return { project, milestones, evidence, disputes, escrow, expenses, risk };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead
      }
    );

    const projection = buildProjectLifecycleProjection({
      project: {
        id: sources.project.id,
        tenantId: sources.project.tenantId,
        jobId: sources.project.jobId,
        title: sources.project.job.title,
        jobStatus: sources.project.job.status,
        status: sources.project.status.toLowerCase() as ProjectRecord["status"],
        ownerOrgId: sources.project.assignedProOrgId,
        startAt: sources.project.startAt,
        dueAt: sources.project.dueAt,
        deadline: sources.project.job.deadline,
        acceptedBidCount: sources.project.job.bids.length,
        contract: sources.project.job.contract,
        jobUpdatedAt: sources.project.job.updatedAt,
        createdAt: sources.project.createdAt,
        updatedAt: sources.project.updatedAt
      },
      milestones: sources.milestones.map((milestone) => ({
        id: milestone.id,
        amount: milestone.amount.toNumber(),
        status: milestone.status,
        updatedAt: milestone.updatedAt,
        evidenceItems: milestone.evidenceItems
      })),
      evidence: sources.evidence.map((item) => ({
        id: item.id,
        validationStatus: item.validationStatus,
        updatedAt: item.updatedAt
      })),
      disputes: sources.disputes,
      escrow: sources.escrow
        ? {
            status: sources.escrow.status,
            currency: sources.escrow.currency,
            updatedAt: sources.escrow.updatedAt,
            transactions: sources.escrow.transactions.map((transaction) => ({
              ...transaction,
              amount: transaction.amount.toNumber()
            }))
          }
        : null,
      expenses: sources.expenses.map((expense) => ({
        ...expense,
        amount: expense.amount.toNumber()
      })),
      risk: sources.risk
        ? {
            ...sources.risk,
            disputeRisk: sources.risk.disputeRisk.toNumber(),
            budgetOverrunRisk: sources.risk.budgetOverrunRisk.toNumber(),
            scheduleRisk: sources.risk.scheduleRisk.toNumber()
          }
        : null
    });

    return projection;
  }

  /** Rebuildable read model; source tables remain the only write authority. */
  private async persistLifecycleProjection(
    input: { tenantId: string; projectId: string },
    projection: ProjectLifecycleProjection
  ): Promise<"updated" | "no_op"> {
    const sourceUpdatedAt = new Date(projection.sourceUpdatedAt);
    const data = {
      tenantId: input.tenantId,
      schemaVersion: projection.schemaVersion,
      revision: projection.revision,
      snapshotJson: projection as unknown as Prisma.InputJsonValue,
      sourceUpdatedAt,
      generatedAt: new Date(projection.generatedAt)
    };
    let current = await this.prisma.projectLifecycleProjection.findUnique({
      where: { projectId: input.projectId },
      select: { id: true, revision: true, sourceUpdatedAt: true }
    });

    if (
      current?.revision === projection.revision ||
      (current && current.sourceUpdatedAt.getTime() > sourceUpdatedAt.getTime())
    ) {
      return "no_op";
    }

    if (!current) {
      try {
        await this.prisma.projectLifecycleProjection.create({
          data: {
            projectId: input.projectId,
            ...data
          }
        });
        return "updated";
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }
        current = await this.prisma.projectLifecycleProjection.findUnique({
          where: { projectId: input.projectId },
          select: { id: true, revision: true, sourceUpdatedAt: true }
        });
      }
    }

    if (
      !current ||
      current.revision === projection.revision ||
      current.sourceUpdatedAt.getTime() > sourceUpdatedAt.getTime()
    ) {
      return "no_op";
    }

    const updated = await this.prisma.projectLifecycleProjection.updateMany({
      where: {
        id: current.id,
        projectId: input.projectId,
        revision: current.revision,
        sourceUpdatedAt: {
          lte: sourceUpdatedAt
        }
      },
      data
    });
    return updated.count === 1 ? "updated" : "no_op";
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

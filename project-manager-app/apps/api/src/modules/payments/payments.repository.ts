import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import prismaClientPackage from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { type PaymentTxnRecord } from "../../common/domain-store.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { findProjectLinkByJobIdOrThrow, findProjectLinkByProjectIdOrThrow } from "../projects/project-link.repository.js";
import { assertProjectFinancialsReadable, type ProjectActor, type ProjectOwnership } from "../projects/projects.policy.js";

const { Prisma } = prismaClientPackage as typeof import("@prisma/client");

type PaymentTx = PrismaTypes.TransactionClient & Pick<PrismaService, "milestone" | "paymentEscrow" | "paymentTxn">;

@Injectable()
export class PaymentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async ensureProject(input: { tenantId: string; projectId: string; orgId: string; userId: string; roles?: string[] }) {
    await this.actorContextService.ensureActorContext(input);

    const project = await findProjectLinkByProjectIdOrThrow(this.prisma, input);

    assertProjectFinancialsReadable(this.toActor(input), this.toOwnership(project));

    return project;
  }

  async ensureProjectByJob(input: { tenantId: string; jobId: string; orgId: string; userId: string; roles?: string[] }) {
    await this.actorContextService.ensureActorContext(input);

    const project = await findProjectLinkByJobIdOrThrow(this.prisma, input);

    assertProjectFinancialsReadable(this.toActor(input), this.toOwnership(project));

    return project;
  }

  async findProjectByJobOptional(input: { tenantId: string; jobId: string }) {
    return this.prisma.project.findFirst({
      where: { jobId: input.jobId, tenantId: input.tenantId },
      select: { id: true, assignedProOrgId: true, tenantId: true, jobId: true, status: true }
    });
  }

  async ensureMilestone(input: { tenantId: string; milestoneId: string; orgId: string; userId: string }) {
    await this.actorContextService.ensureActorContext(input);

    const milestone = await this.prisma.milestone.findFirst({
      where: {
        id: input.milestoneId,
        deletedAt: null,
        project: {
          tenantId: input.tenantId
        }
      }
    });

    if (!milestone) {
      throw new NotFoundException(`Milestone '${input.milestoneId}' not found`);
    }

    return milestone;
  }

  async findEscrowByProject(projectId: string) {
    return this.prisma.paymentEscrow.findFirst({
      where: {
        projectId,
        deletedAt: null
      }
    });
  }

  async hasOpenDisputeForProject(projectId: string): Promise<boolean> {
    const dispute = await this.prisma.dispute.findFirst({
      where: {
        projectId,
        deletedAt: null,
        status: {
          in: ["OPEN", "ASSIGNED", "UNDER_REVIEW"]
        }
      },
      select: { id: true }
    });

    return Boolean(dispute);
  }

  async getReleasedAmount(escrowId: string): Promise<number> {
    const result = await this.prisma.paymentTxn.aggregate({
      where: {
        escrowId,
        type: "RELEASE",
        status: "SUCCEEDED"
      },
      _sum: {
        amount: true
      }
    });

    return result._sum.amount?.toNumber() ?? 0;
  }

  async depositFunds(input: {
    projectId: string;
    jobId?: string;
    contractId?: string;
    currency: string;
    amount: number;
    providerRef: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as PaymentTx;
      const existing = await db.paymentEscrow.findFirst({
        where: {
          projectId: input.projectId,
          deletedAt: null
        }
      });

      const escrow = existing
        ? await db.paymentEscrow.update({
            where: { id: existing.id },
            data: {
              totalAmount: existing.totalAmount.plus(input.amount),
              jobId: existing.jobId ?? input.jobId,
              contractId: existing.contractId ?? input.contractId
            }
          })
        : await db.paymentEscrow.create({
            data: {
              projectId: input.projectId,
              jobId: input.jobId,
              contractId: input.contractId,
              providerRef: input.providerRef,
              currency: input.currency,
              totalAmount: input.amount,
              status: "active"
            }
          });

      const transaction = await db.paymentTxn.create({
        data: {
          escrowId: escrow.id,
          type: "DEPOSIT",
          amount: input.amount,
          providerRef: input.providerRef,
          status: "SUCCEEDED"
        },
        include: {
          escrow: {
            include: {
              project: true
            }
          }
        }
      });

      return {
        escrow,
        transaction: this.toRecord(transaction)
      };
    });
  }

  async releaseFunds(input: {
    escrowId: string;
    milestoneId: string;
    amount: number;
    providerRef: string;
  }): Promise<PaymentTxnRecord> {
    return this.prisma.$transaction(
      async (tx) => {
        const db = tx as PaymentTx;
        const escrow = await db.paymentEscrow.findUnique({
          where: { id: input.escrowId }
        });

        if (!escrow || escrow.deletedAt) {
          throw new NotFoundException(`Escrow '${input.escrowId}' not found`);
        }

        const released = await db.paymentTxn.aggregate({
          where: {
            escrowId: input.escrowId,
            type: "RELEASE",
            status: "SUCCEEDED"
          },
          _sum: {
            amount: true
          }
        });

        const releasedAmount = released._sum.amount?.toNumber() ?? 0;
        const available = Number(escrow.totalAmount) - releasedAmount;

        if (input.amount > available) {
          throw new ConflictException("insufficient escrow funds for release");
        }

        const transaction = await db.paymentTxn.create({
          data: {
            escrowId: input.escrowId,
            milestoneId: input.milestoneId,
            type: "RELEASE",
            amount: input.amount,
            providerRef: input.providerRef,
            status: "SUCCEEDED"
          },
          include: {
            escrow: {
              include: {
                project: true
              }
            }
          }
        });

        await db.milestone.update({
          where: { id: input.milestoneId },
          data: { status: "PAID" }
        });

        return this.toRecord(transaction);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  }

  private toRecord(transaction: {
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
  }): PaymentTxnRecord {
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

  private toActor(input: { tenantId: string; orgId: string; userId: string; roles?: string[] }): ProjectActor {
    return {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles ?? []
    };
  }

  private toOwnership(project: { job: { clientOrgId: string }; assignedProOrgId: string }): ProjectOwnership {
    return {
      clientOrgId: project.job.clientOrgId,
      assignedProOrgId: project.assignedProOrgId
    };
  }
}

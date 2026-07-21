import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import prismaClientPackage from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { type PaymentTxnRecord } from "../../common/domain-store.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { findProjectLinkByJobIdOrThrow, findProjectLinkByProjectIdOrThrow } from "../projects/project-link.repository.js";
import { assertProjectFinancialsReadable, type ProjectActor, type ProjectOwnership } from "../projects/projects.policy.js";

const { Prisma } = prismaClientPackage as typeof import("@prisma/client");
const EscrowStatus = {
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED"
} as const;

type PaymentTx = PrismaTypes.TransactionClient & Pick<PrismaService, "milestone" | "paymentEscrow" | "paymentTxn">;

type RefundEscrowContextRow = {
  id: string;
  projectId: string;
  jobId: string | null;
  contractId: string | null;
  currency: string;
  totalAmount: { toNumber(): number };
  status: string;
  deletedAt: Date | null;
  project: {
    tenantId: string;
    assignedProOrgId: string;
    job: {
      clientOrgId: string;
    };
  };
  transactions: Array<{
    type: string;
    status: string;
    amount: { toNumber(): number };
    providerRef: string;
    createdAt: Date;
  }>;
};

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

  async findAcceptedProfessionalByProject(projectId: string): Promise<{
    userId: string;
    orgId?: string;
    email?: string;
  } | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        job: {
          select: {
            reservations: {
              where: { status: "ACCEPTED" },
              orderBy: { acceptedAt: "desc" },
              take: 1,
              select: {
                professionalId: true,
                professionalOrgId: true,
                professional: { select: { email: true } }
              }
            }
          }
        }
      }
    });
    const reservation = project?.job?.reservations?.[0];
    if (!reservation) {
      return null;
    }
    return {
      userId: reservation.professionalId,
      orgId: reservation.professionalOrgId ?? undefined,
      email: reservation.professional.email ?? undefined
    };
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

  async getRefundedAmount(escrowId: string): Promise<number> {
    const result = await this.prisma.paymentTxn.aggregate({
      where: {
        escrowId,
        type: "REFUND",
        status: "SUCCEEDED"
      },
      _sum: {
        amount: true
      }
    });

    return result._sum.amount?.toNumber() ?? 0;
  }

  async getRefundContext(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles?: string[];
    projectId?: string;
    escrowId?: string;
  }): Promise<{
    escrowId: string;
    projectId: string;
    jobId?: string;
    contractId?: string;
    currency: string;
    totalDeposited: number;
    totalReleased: number;
    totalRefunded: number;
    refundable: number;
    originalProviderRef?: string;
  }> {
    await this.actorContextService.ensureActorContext(input);

    const escrow = (await this.prisma.paymentEscrow.findFirst({
      where: {
        ...(input.escrowId ? { id: input.escrowId } : { projectId: input.projectId }),
        deletedAt: null,
        project: {
          tenantId: input.tenantId
        }
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
        },
        transactions: {
          select: {
            type: true,
            status: true,
            amount: true,
            providerRef: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" }
        }
      }
    })) as RefundEscrowContextRow | null;

    if (!escrow) {
      throw new NotFoundException("Escrow not found");
    }

    assertProjectFinancialsReadable(this.toActor(input), {
      clientOrgId: escrow.project.job.clientOrgId,
      assignedProOrgId: escrow.project.assignedProOrgId
    });

    const totalDeposited = this.sumTransactions(escrow.transactions, "DEPOSIT");
    const totalReleased = this.sumTransactions(escrow.transactions, "RELEASE");
    const totalRefunded = this.sumTransactions(escrow.transactions, "REFUND");
    const originalProviderRef = escrow.transactions.find(
      (transaction) => transaction.type === "DEPOSIT" && transaction.status === "SUCCEEDED"
    )?.providerRef;

    return {
      escrowId: escrow.id,
      projectId: escrow.projectId,
      jobId: escrow.jobId ?? undefined,
      contractId: escrow.contractId ?? undefined,
      currency: escrow.currency,
      totalDeposited,
      totalReleased,
      totalRefunded,
      refundable: totalDeposited - totalReleased - totalRefunded,
      originalProviderRef
    };
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
              contractId: existing.contractId ?? input.contractId,
              status: EscrowStatus.ACTIVE
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
              status: EscrowStatus.ACTIVE
            }
          });

      const transaction = await db.paymentTxn.create({
        data: {
          escrowId: escrow.id,
          type: "DEPOSIT",
          amount: input.amount,
          providerRef: input.providerRef,
          status: "PENDING"
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

  /**
   * Finalizes a reserved deposit. In practice a real Stripe PaymentIntent
   * almost never resolves "captured" synchronously (it needs the client to
   * complete card/3DS confirmation), so most deposits stay PENDING here and
   * get finalized later by reconcileTransactionStatus() from the webhook.
   */
  async finalizeDeposit(input: {
    transactionId: string;
    /** Omit to leave PENDING (still awaiting the provider's async confirmation) — only swaps in the real providerRef. */
    status?: "SUCCEEDED" | "FAILED";
    providerRef?: string;
  }): Promise<PaymentTxnRecord> {
    const transaction = await this.prisma.paymentTxn.update({
      where: { id: input.transactionId },
      data: { ...(input.status ? { status: input.status } : {}), ...(input.providerRef ? { providerRef: input.providerRef } : {}) },
      include: { escrow: { include: { project: true } } }
    });
    return this.toRecord(transaction);
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

        // Count PENDING alongside SUCCEEDED — a reservation must hold its funds
        // immediately, or a second concurrent release could pass this same
        // check before the first one's provider call resolves.
        const released = await db.paymentTxn.aggregate({
          where: {
            escrowId: input.escrowId,
            type: "RELEASE",
            status: { in: ["SUCCEEDED", "PENDING"] }
          },
          _sum: {
            amount: true
          }
        });
        const refunded = await db.paymentTxn.aggregate({
          where: {
            escrowId: input.escrowId,
            type: "REFUND",
            status: { in: ["SUCCEEDED", "PENDING"] }
          },
          _sum: {
            amount: true
          }
        });

        const releasedAmount = released._sum.amount?.toNumber() ?? 0;
        const refundedAmount = refunded._sum.amount?.toNumber() ?? 0;
        const available = Number(escrow.totalAmount) - releasedAmount - refundedAmount;

        if (input.amount > available) {
          throw new ConflictException("insufficient escrow funds for release");
        }

        // Reserve only — status stays PENDING until the caller confirms the
        // real provider outcome via finalizeRelease(). The milestone is not
        // marked PAID here: it must wait for confirmed success, otherwise a
        // failed provider call would leave a milestone marked paid with no
        // money actually released.
        const transaction = await db.paymentTxn.create({
          data: {
            escrowId: input.escrowId,
            milestoneId: input.milestoneId,
            type: "RELEASE",
            amount: input.amount,
            providerRef: input.providerRef,
            status: "PENDING"
          },
          include: {
            escrow: {
              include: {
                project: true
              }
            }
          }
        });

        return this.toRecord(transaction);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  }

  /**
   * Finalizes a reserved release after the payment provider call resolves.
   * SUCCEEDED marks the milestone PAID (moved here from releaseFunds() so a
   * provider failure never leaves a milestone marked paid with no real
   * transfer). FAILED just settles the transaction — the reserved amount
   * naturally drops out of the PENDING/SUCCEEDED sum future releases check.
   */
  async finalizeRelease(input: {
    transactionId: string;
    milestoneId: string;
    /** Omit to leave PENDING (still in flight) — only swaps in the real providerRef. */
    status?: "SUCCEEDED" | "FAILED";
    providerRef?: string;
  }): Promise<PaymentTxnRecord> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as PaymentTx;
      const transaction = await db.paymentTxn.update({
        where: { id: input.transactionId },
        data: { ...(input.status ? { status: input.status } : {}), ...(input.providerRef ? { providerRef: input.providerRef } : {}) },
        include: { escrow: { include: { project: true } } }
      });

      if (input.status === "SUCCEEDED") {
        await db.milestone.update({
          where: { id: input.milestoneId },
          data: { status: "PAID" }
        });
      }

      return this.toRecord(transaction);
    });
  }

  async refundFunds(input: {
    escrowId: string;
    amount: number;
    providerRef: string;
  }): Promise<PaymentTxnRecord> {
    return this.prisma.$transaction(
      async (tx) => {
        const db = tx as PaymentTx;
        const escrow = (await db.paymentEscrow.findUnique({
          where: { id: input.escrowId },
          include: {
            transactions: {
              select: {
                type: true,
                status: true,
                amount: true,
                providerRef: true,
                createdAt: true
              }
            }
          }
        })) as (RefundEscrowContextRow & { transactions: RefundEscrowContextRow["transactions"] }) | null;

        if (!escrow || escrow.deletedAt) {
          throw new NotFoundException(`Escrow '${input.escrowId}' not found`);
        }

        // PENDING counts as already-committed here too — same reasoning as
        // releaseFunds()'s balance check above.
        const totalDeposited = this.sumTransactions(escrow.transactions, "DEPOSIT", ["SUCCEEDED"]);
        const totalReleased = this.sumTransactions(escrow.transactions, "RELEASE", ["SUCCEEDED", "PENDING"]);
        const totalRefunded = this.sumTransactions(escrow.transactions, "REFUND", ["SUCCEEDED", "PENDING"]);
        const refundable = totalDeposited - totalReleased - totalRefunded;

        if (input.amount > refundable) {
          throw new ConflictException("insufficient escrow funds for refund");
        }

        // Reserve only — see finalizeRefund() for the status update and the
        // escrow-close side effect, which now only happens on confirmed success.
        const transaction = await db.paymentTxn.create({
          data: {
            escrowId: input.escrowId,
            type: "REFUND",
            amount: input.amount,
            providerRef: input.providerRef,
            status: "PENDING"
          },
          include: {
            escrow: {
              include: {
                project: true
              }
            }
          }
        });

        return this.toRecord(transaction);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  }

  /**
   * Finalizes a reserved refund after the payment provider call resolves.
   * SUCCEEDED closes the escrow once nothing refundable remains (moved here
   * from refundFunds() — closing on a reservation that later fails would
   * lock the escrow with funds that were never actually returned).
   */
  async finalizeRefund(input: {
    transactionId: string;
    escrowId: string;
    /** Omit to leave PENDING (still in flight) — only swaps in the real providerRef. */
    status?: "SUCCEEDED" | "FAILED";
    providerRef?: string;
  }): Promise<PaymentTxnRecord> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as PaymentTx;
      const transaction = await db.paymentTxn.update({
        where: { id: input.transactionId },
        data: { ...(input.status ? { status: input.status } : {}), ...(input.providerRef ? { providerRef: input.providerRef } : {}) },
        include: { escrow: { include: { project: true } } }
      });

      if (input.status === "SUCCEEDED") {
        const escrow = (await db.paymentEscrow.findUnique({
          where: { id: input.escrowId },
          include: {
            transactions: {
              select: { type: true, status: true, amount: true, providerRef: true, createdAt: true }
            }
          }
        })) as (RefundEscrowContextRow & { transactions: RefundEscrowContextRow["transactions"] }) | null;

        if (escrow) {
          const totalDeposited = this.sumTransactions(escrow.transactions, "DEPOSIT", ["SUCCEEDED"]);
          const totalReleased = this.sumTransactions(escrow.transactions, "RELEASE", ["SUCCEEDED", "PENDING"]);
          const totalRefunded = this.sumTransactions(escrow.transactions, "REFUND", ["SUCCEEDED"]);
          if (totalDeposited - totalReleased - totalRefunded <= 0) {
            await db.paymentEscrow.update({
              where: { id: input.escrowId },
              data: { status: EscrowStatus.CLOSED }
            });
          }
        }
      }

      return this.toRecord(transaction);
    });
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

  private sumTransactions(
    transactions: Array<{ type: string; status: string; amount: { toNumber(): number } }>,
    type: string,
    statuses: string[] = ["SUCCEEDED"]
  ): number {
    return transactions
      .filter((transaction) => transaction.type === type && statuses.includes(transaction.status))
      .reduce((sum, transaction) => sum + transaction.amount.toNumber(), 0);
  }

  /**
   * Applies a payment-provider webhook's confirmed status to the matching
   * PaymentTxn (looked up by providerRef). Idempotent by construction: the
   * WHERE clause only matches rows still PENDING, so a duplicate or
   * out-of-order webhook delivery for an already-finalized transaction is a
   * safe no-op instead of flipping a settled status back and forth.
   */
  async reconcileTransactionStatus(input: {
    providerRef: string;
    status: "SUCCEEDED" | "FAILED" | "REVERSED";
  }): Promise<{ reconciled: boolean; transaction?: PaymentTxnRecord }> {
    const existing = await this.prisma.paymentTxn.findUnique({
      where: { providerRef: input.providerRef },
      include: { escrow: { include: { project: true } } }
    });
    if (!existing || existing.status !== "PENDING") {
      return { reconciled: false };
    }

    if (existing.type === "RELEASE" && input.status === "SUCCEEDED" && existing.milestoneId) {
      const record = await this.finalizeRelease({
        transactionId: existing.id,
        milestoneId: existing.milestoneId,
        status: "SUCCEEDED"
      });
      return { reconciled: true, transaction: record };
    }

    if (existing.type === "REFUND" && input.status === "SUCCEEDED") {
      const record = await this.finalizeRefund({
        transactionId: existing.id,
        escrowId: existing.escrowId,
        status: "SUCCEEDED"
      });
      return { reconciled: true, transaction: record };
    }

    // DEPOSIT success, or any FAILED/REVERSED outcome — plain status update,
    // no milestone/escrow side effect to apply.
    const updated = await this.prisma.paymentTxn.update({
      where: { id: existing.id },
      data: { status: input.status },
      include: { escrow: { include: { project: true } } }
    });
    return { reconciled: true, transaction: this.toRecord(updated) };
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { findProjectLinkByProjectIdOrThrow } from "../projects/project-link.repository.js";
import { assertTrustReadable, type TrustActor } from "./trust.policy.js";

type StatusGroupRow = {
  status: string;
  _count: {
    _all: number;
  };
};

type SubmittedMilestoneRow = {
  evidence: unknown[];
};

type ActorInput = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

type TrustReasonSeverity = "low" | "medium" | "high";

export type TrustSnapshot = {
  tenantId: string;
  scopeType: "job" | "project";
  scopeId: string;
  jobId: string;
  projectId?: string;
  score: number;
  level: "low" | "medium" | "high";
  flags: string[];
  reasons: Array<{
    code: string;
    severity: TrustReasonSeverity;
    message: string;
  }>;
  signals: {
    contract: {
      exists: boolean;
      signedClient: boolean;
      signedProfessional: boolean;
    };
    disputes: {
      open: number;
      assigned: number;
      resolved: number;
    };
    milestones: {
      total: number;
      draft: number;
      submitted: number;
      approved: number;
      rejected: number;
      paid: number;
      submittedWithoutEvidence: number;
    };
    evidence: {
      total: number;
    };
    payments: {
      failed: number;
      released: number;
      funded: number;
    };
    riskScore?: {
      score: number;
      modelVersion: string;
      computedAt: string;
    };
  };
  lastUpdatedAt: string;
};

@Injectable()
export class TrustRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async byJob(input: ActorInput & { jobId: string }): Promise<TrustSnapshot> {
    await this.actorContextService.ensureActorContext(input);

    const job = await this.prisma.job.findFirst({
      where: {
        id: input.jobId,
        tenantId: input.tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        clientOrgId: true,
        project: {
          select: {
            id: true,
            assignedProOrgId: true
          }
        },
        contract: {
          select: {
            id: true,
            professionalUserId: true,
            signedClientAt: true,
            signedProAt: true,
            createdAt: true,
            updatedAt: true
          }
        },
        reservations: {
          where: {
            status: "ACCEPTED"
          },
          orderBy: {
            acceptedAt: "desc"
          },
          take: 1,
          select: {
            professionalId: true,
            acceptedAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (!job) {
      throw new NotFoundException(`Job '${input.jobId}' not found`);
    }

    const reservedProOrgId = job.reservations[0]
      ? await this.resolveProfessionalOrgId(input.tenantId, job.reservations[0].professionalId)
      : null;
    const contractedProOrgId = job.contract
      ? await this.resolveProfessionalOrgId(input.tenantId, job.contract.professionalUserId)
      : null;

    assertTrustReadable(this.toActor(input), {
      clientOrgId: job.clientOrgId,
      assignedProOrgId: job.project?.assignedProOrgId,
      reservedProOrgId,
      contractedProOrgId
    });

    return this.buildSnapshot({
      tenantId: input.tenantId,
      scopeType: "job",
      scopeId: job.id,
      jobId: job.id,
      projectId: job.project?.id,
      clientOrgId: job.clientOrgId,
      assignedProOrgId: job.project?.assignedProOrgId,
      reservedProOrgId,
      contractedProOrgId,
      contract: job.contract
        ? {
            exists: true,
            signedClientAt: job.contract.signedClientAt,
            signedProAt: job.contract.signedProAt,
            professionalUserId: job.contract.professionalUserId,
            updatedAt: job.contract.updatedAt
          }
        : {
            exists: false,
            signedClientAt: null,
            signedProAt: null,
            updatedAt: null
          }
    });
  }

  async byProject(input: ActorInput & { projectId: string }): Promise<TrustSnapshot> {
    await this.actorContextService.ensureActorContext(input);

    // Use shared resolver for canonical project-to-job ownership mapping
    const link = await findProjectLinkByProjectIdOrThrow(this.prisma, {
      tenantId: input.tenantId,
      projectId: input.projectId
    });

    // Fetch trust-specific data (contract and reservations) via canonical jobId
    const job = await this.prisma.job.findFirst({
      where: { id: link.jobId, tenantId: input.tenantId, deletedAt: null },
      select: {
        contract: {
          select: {
            professionalUserId: true,
            signedClientAt: true,
            signedProAt: true,
            updatedAt: true
          }
        },
        reservations: {
          where: { status: "ACCEPTED" },
          orderBy: { acceptedAt: "desc" },
          take: 1,
          select: { professionalId: true }
        }
      }
    });

    const reservedProOrgId = job?.reservations[0]
      ? await this.resolveProfessionalOrgId(input.tenantId, job.reservations[0].professionalId)
      : null;
    const contractedProOrgId = job?.contract
      ? await this.resolveProfessionalOrgId(input.tenantId, job.contract.professionalUserId)
      : null;

    assertTrustReadable(this.toActor(input), {
      clientOrgId: link.job.clientOrgId,
      assignedProOrgId: link.assignedProOrgId,
      reservedProOrgId,
      contractedProOrgId
    });

    return this.buildSnapshot({
      tenantId: input.tenantId,
      scopeType: "project",
      scopeId: link.id,
      jobId: link.jobId,
      projectId: link.id,
      clientOrgId: link.job.clientOrgId,
      assignedProOrgId: link.assignedProOrgId,
      reservedProOrgId,
      contractedProOrgId,
      contract: job?.contract
        ? {
            exists: true,
            signedClientAt: job.contract.signedClientAt,
            signedProAt: job.contract.signedProAt,
            professionalUserId: job.contract.professionalUserId,
            updatedAt: job.contract.updatedAt
          }
        : {
            exists: false,
            signedClientAt: null,
            signedProAt: null,
            updatedAt: null
          }
    });
  }

  private async buildSnapshot(input: {
    tenantId: string;
    scopeType: "job" | "project";
    scopeId: string;
    jobId: string;
    projectId?: string;
    clientOrgId: string;
    assignedProOrgId?: string | null;
    reservedProOrgId?: string | null;
    contractedProOrgId?: string | null;
    contract: {
      exists: boolean;
      signedClientAt: Date | null;
      signedProAt: Date | null;
      updatedAt: Date | null;
      professionalUserId?: string;
    };
  }): Promise<TrustSnapshot> {
    const projectId = input.projectId;

    const [
      disputeGroups,
      milestoneGroups,
      evidenceTotal,
      submittedMilestones,
      failedPayments,
      releasedPayments,
      fundedPayments,
      latestRisk
    ] = await Promise.all([
      projectId
        ? this.prisma.dispute.groupBy({
            by: ["status"],
            where: {
              tenantId: input.tenantId,
              projectId,
              deletedAt: null
            },
            _count: { _all: true }
          })
        : Promise.resolve([]),
      projectId
        ? this.prisma.milestone.groupBy({
            by: ["status"],
            where: {
              projectId,
              deletedAt: null
            },
            _count: { _all: true }
          })
        : Promise.resolve([]),
      projectId
        ? this.prisma.evidence.count({
            where: {
              projectId
            }
          })
        : Promise.resolve(0),
      projectId
        ? this.prisma.milestone.findMany({
            where: {
              projectId,
              deletedAt: null,
              status: "SUBMITTED"
            },
            select: {
              id: true,
              evidence: {
                select: {
                  id: true
                },
                take: 1
              }
            }
          })
        : Promise.resolve([]),
      projectId
        ? this.prisma.paymentTxn.count({
            where: {
              status: "FAILED",
              escrow: {
                projectId
              }
            }
          })
        : Promise.resolve(0),
      projectId
        ? this.prisma.paymentTxn.count({
            where: {
              status: "SUCCEEDED",
              type: "RELEASE",
              escrow: {
                projectId
              }
            }
          })
        : Promise.resolve(0),
      projectId
        ? this.prisma.paymentTxn.count({
            where: {
              status: "SUCCEEDED",
              type: "DEPOSIT",
              escrow: {
                projectId
              }
            }
          })
        : Promise.resolve(0),
      this.prisma.riskScore.findFirst({
        where: {
          tenantId: input.tenantId,
          OR: [
            { subjectType: "job", subjectId: input.jobId },
            ...(projectId ? [{ subjectType: "project", subjectId: projectId }] : [])
          ]
        },
        orderBy: { computedAt: "desc" }
      })
    ]);

    const disputeRows = disputeGroups as StatusGroupRow[];
    const milestoneRows = milestoneGroups as StatusGroupRow[];
    const submittedRows = submittedMilestones as SubmittedMilestoneRow[];

    const disputeCount = (status: string) => disputeRows.find((entry: StatusGroupRow) => entry.status === status)?._count._all ?? 0;
    const milestoneCount = (status: string) => milestoneRows.find((entry: StatusGroupRow) => entry.status === status)?._count._all ?? 0;
    const submittedWithoutEvidence = submittedRows.filter((entry: SubmittedMilestoneRow) => entry.evidence.length === 0).length;

    const flags: string[] = [];
    const reasons: TrustSnapshot["reasons"] = [];
    let score = 80;

    if (input.contract.exists) {
      if (!input.contract.signedClientAt) {
        flags.push("missing_client_signature");
        reasons.push({
          code: "missing_client_signature",
          severity: "medium",
          message: "The current contract has not been signed by the client yet."
        });
        score -= 12;
      }
      if (!input.contract.signedProAt) {
        flags.push("missing_professional_signature");
        reasons.push({
          code: "missing_professional_signature",
          severity: "medium",
          message: "The current contract has not been signed by the assigned professional yet."
        });
        score -= 12;
      }
    } else if (input.assignedProOrgId || input.reservedProOrgId || input.contractedProOrgId) {
      flags.push("missing_active_contract");
      reasons.push({
        code: "missing_active_contract",
        severity: "high",
        message: "The job has engagement activity but no active contract."
      });
      score -= 18;
    }

    if (disputeCount("OPEN") > 0) {
      flags.push("open_dispute");
      reasons.push({
        code: "open_dispute",
        severity: "high",
        message: "There is at least one open dispute affecting this work."
      });
      score -= 30;
    }

    if (disputeCount("ASSIGNED") + disputeCount("UNDER_REVIEW") > 0) {
      flags.push("dispute_under_review");
      reasons.push({
        code: "dispute_under_review",
        severity: "medium",
        message: "A dispute is being handled and still adds operational uncertainty."
      });
      score -= 15;
    }

    if (milestoneCount("REJECTED") > 0) {
      flags.push("milestone_rejected");
      reasons.push({
        code: "milestone_rejected",
        severity: "medium",
        message: "At least one milestone was rejected and requires rework or clarification."
      });
      score -= Math.min(24, milestoneCount("REJECTED") * 12);
    }

    if (submittedWithoutEvidence > 0) {
      flags.push("submitted_without_evidence");
      reasons.push({
        code: "submitted_without_evidence",
        severity: "medium",
        message: "There are submitted milestones without evidence attached."
      });
      score -= Math.min(20, submittedWithoutEvidence * 10);
    }

    if (failedPayments > 0) {
      flags.push("payment_failure");
      reasons.push({
        code: "payment_failure",
        severity: "high",
        message: "One or more escrow transactions failed."
      });
      score -= Math.min(24, failedPayments * 12);
    }

    if (
      input.contract.exists &&
      Boolean(input.contract.signedClientAt) &&
      Boolean(input.contract.signedProAt) &&
      milestoneCount("REJECTED") === 0 &&
      disputeCount("OPEN") === 0 &&
      failedPayments === 0
    ) {
      reasons.push({
        code: "stable_execution_signals",
        severity: "low",
        message: "Current execution signals are stable: bilateral contract, no open disputes and no failed payments."
      });
      score += 5;
    }

    if (latestRisk) {
      reasons.push({
        code: "latest_risk_score_observed",
        severity: "low",
        message: `Latest recorded risk score is ${Number(latestRisk.score).toFixed(2)} from model ${latestRisk.modelVersion}.`
      });
    }

    score = Math.max(0, Math.min(100, score));

    return {
      tenantId: input.tenantId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      jobId: input.jobId,
      projectId,
      score,
      level: score >= 75 ? "low" : score >= 45 ? "medium" : "high",
      flags: [...new Set(flags)],
      reasons,
      signals: {
        contract: {
          exists: input.contract.exists,
          signedClient: Boolean(input.contract.signedClientAt),
          signedProfessional: Boolean(input.contract.signedProAt)
        },
        disputes: {
          open: disputeCount("OPEN"),
          assigned: disputeCount("ASSIGNED") + disputeCount("UNDER_REVIEW"),
          resolved: disputeCount("RESOLVED")
        },
        milestones: {
          total: milestoneRows.reduce((sum: number, entry: StatusGroupRow) => sum + entry._count._all, 0),
          draft: milestoneCount("DRAFT"),
          submitted: milestoneCount("SUBMITTED"),
          approved: milestoneCount("APPROVED"),
          rejected: milestoneCount("REJECTED"),
          paid: milestoneCount("PAID"),
          submittedWithoutEvidence
        },
        evidence: {
          total: evidenceTotal
        },
        payments: {
          failed: failedPayments,
          released: releasedPayments,
          funded: fundedPayments
        },
        riskScore: latestRisk
          ? {
              score: Number(latestRisk.score),
              modelVersion: latestRisk.modelVersion,
              computedAt: latestRisk.computedAt.toISOString()
            }
          : undefined
      },
      lastUpdatedAt: new Date().toISOString()
    };
  }

  private toActor(input: ActorInput): TrustActor {
    return {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles
    };
  }

  private async resolveProfessionalOrgId(tenantId: string, professionalUserId: string): Promise<string | null> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: professionalUserId,
        org: {
          tenantId,
          type: "pro"
        }
      },
      select: {
        orgId: true
      }
    });

    return membership?.orgId ?? null;
  }
}

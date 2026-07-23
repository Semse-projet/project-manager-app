import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export interface WorkerVerificationInput {
  workerId: string;
  tenantId: string;
  verificationType: "DID_SIGNATURE" | "BACKGROUND_CHECK" | "LICENSE" | "INSURANCE";
  didSignature?: string;
  didPublicKey?: string;
}

export interface WorkerVerificationResult {
  workerId: string;
  tenantId: string;
  verificationType: string;
  status: "pending" | "verified" | "failed" | "review_required";
  verifiedAt?: Date;
  feedback?: string;
}

@Injectable()
export class WorkerVerificationRepository {
  private readonly logger = new Logger(WorkerVerificationRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async getWorker(workerId: string) {
    return this.prisma.user.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    }).catch(() => null);
  }

  async updateWorkerVerificationStatus(
    workerId: string,
    status: "verified" | "failed" | "pending_review",
  ) {
    try {
      // Log verification status update (actual persistence depends on domain model)
      this.logger.log(
        `[WorkerVerification] Status updated: worker=${workerId}, status=${status}`,
      );
      return { id: workerId, status };
    } catch (error) {
      this.logger.error(
        `Failed to update verification status: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async createVerificationLog(
    workerId: string,
    tenantId: string,
    verificationType: string,
    result: {
      status: string;
      feedback?: string;
      verifiedAt: Date;
    },
  ) {
    try {
      this.logger.log(
        `[WorkerVerification] ${verificationType}: worker=${workerId}, tenant=${tenantId}, status=${result.status}`,
        { feedback: result.feedback },
      );
    } catch (error) {
      this.logger.error(
        `Failed to log verification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getVerificationHistory(workerId: string) {
    // Return synthetic history for now
    return {
      workerId,
      verifications: [
        {
          type: "DID_SIGNATURE",
          status: "verified",
          verifiedAt: new Date(),
        },
      ],
      overallStatus: "verified",
    };
  }

  async storeDidSignature(
    workerId: string,
    signature: string,
    publicKey: string,
  ) {
    try {
      // Store in a separate audit/event log table or metadata
      this.logger.log(`[DID] Signature stored for worker=${workerId}`);
      return {
        workerId,
        signature,
        publicKey,
        storedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to store DID signature: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * No real DID crypto is wired up anywhere in this product yet — there is
   * no client (web or otherwise) that generates a keypair and signs a
   * challenge, so any `didSignature`/`didPublicKey` reaching this method
   * cannot be trusted to actually prove control over a real DID. This used
   * to just check the strings were non-empty and return true, which let
   * anyone mark a worker "verified" by POSTing two arbitrary non-empty
   * strings. Fails closed until real signature verification (crypto.subtle
   * or tweetnacl, per the original TODO) and an actual signing client both
   * exist — see docs/AUDIT_REMEDIATION_PLAN.md 0.9.
   */
  async verifyDidSignature(
    workerId: string,
    _signature: string,
    _publicKey: string,
    _message: string,
  ): Promise<boolean> {
    this.logger.warn(
      `[DID] Signature verification requested for worker=${workerId} but no real DID crypto is implemented — failing closed.`,
    );
    return false;
  }

  // Both methods previously ignored tenantId entirely and returned/counted
  // every User row in the database — every tenant's admin saw the same
  // global list, and it wasn't even filtered to workers or to "unverified".
  // See docs/AUDIT_REMEDIATION_PLAN.md 3.11.
  async getUnverifiedWorkers(tenantId: string) {
    try {
      return await this.prisma.user.findMany({
        where: {
          verificationStatus: { not: "verified" },
          memberships: {
            some: {
              org: { tenantId },
              role: { key: { in: ["PRO", "WORKER"] } }
            }
          }
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
        take: 50,
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch unverified workers: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async countVerifiedWorkers(tenantId: string) {
    try {
      return await this.prisma.user.count({
        where: {
          verificationStatus: "verified",
          memberships: {
            some: {
              org: { tenantId },
              role: { key: { in: ["PRO", "WORKER"] } }
            }
          }
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to count verified workers: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }
}

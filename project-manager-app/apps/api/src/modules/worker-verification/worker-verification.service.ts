import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  WorkerVerificationRepository,
} from "./worker-verification.repository.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

export interface VerificationState {
  workerId: string;
  status: "pending" | "signing" | "signed" | "verified" | "failed";
  didSignature?: string;
  feedback?: string;
  verifiedAt?: Date;
}

export interface VerificationRequest {
  workerId: string;
  tenantId: string;
  verificationType: "DID_SIGNATURE" | "BACKGROUND_CHECK" | "LICENSE" | "INSURANCE";
  didSignature?: string;
  didPublicKey?: string;
}

@Injectable()
export class WorkerVerificationService {
  private readonly logger = new Logger(WorkerVerificationService.name);
  private verificationStates = new Map<string, VerificationState>();

  constructor(
    private readonly repository: WorkerVerificationRepository,
    private readonly sseBus?: SseEventBusService,
  ) {}

  /** 404 (no existence oracle) unless the worker is a member of one of the actor's tenant orgs. */
  private async requireWorkerInTenant(workerId: string, tenantId: string) {
    const worker = await this.repository.getWorkerInTenant(workerId, tenantId);
    if (!worker) {
      throw new NotFoundException(`Worker ${workerId} not found`);
    }
    return worker;
  }

  async initiateVerification(
    request: VerificationRequest,
  ): Promise<VerificationState> {
    try {
      const worker = await this.repository.getWorkerInTenant(request.workerId, request.tenantId);
      if (!worker) {
        throw new NotFoundException(
          `Worker ${request.workerId} not found`,
        );
      }

      const state: VerificationState = {
        workerId: request.workerId,
        status: "pending",
      };

      this.verificationStates.set(request.workerId, state);

      // Emit SSE event
      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "initiated", {
          workerId: request.workerId,
          tenantId: request.tenantId,
          verificationType: request.verificationType,
          status: "pending",
          timestamp: new Date().toISOString(),
        });
      }

      return state;
    } catch (error) {
      this.logger.error(
        `Initiate verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async submitDidSignature(
    workerId: string,
    tenantId: string,
    didSignature: string,
    didPublicKey: string,
  ): Promise<VerificationState> {
    try {
      await this.requireWorkerInTenant(workerId, tenantId);
      let state = this.verificationStates.get(workerId);
      if (!state) {
        state = {
          workerId,
          status: "pending",
        };
        this.verificationStates.set(workerId, state);
      }

      state.status = "signing";

      // Emit signing progress
      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "signing", {
          workerId,
          tenantId,
          progress: 30,
        });
      }

      // Store signature
      await this.repository.storeDidSignature(
        workerId,
        didSignature,
        didPublicKey,
      );

      state.status = "signed";
      state.didSignature = didSignature;

      // Emit signed event
      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "signed", {
          workerId,
          tenantId,
          progress: 60,
        });
      }

      // Verify signature
      const isValid = await this.verifyDidSignature(
        workerId,
        didSignature,
        didPublicKey,
      );

      if (isValid) {
        state.status = "verified";
        state.verifiedAt = new Date();

        // Update worker status
        await this.repository.updateWorkerVerificationStatus(
          workerId,
          "verified",
        );

        // Log verification
        await this.repository.createVerificationLog(
          workerId,
          tenantId,
          "DID_SIGNATURE",
          {
            status: "verified",
            verifiedAt: new Date(),
          },
        );

        // Emit verified event
        if (this.sseBus) {
          this.sseBus.emit("worker-verification", "verified", {
            workerId,
            tenantId,
            status: "verified",
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        state.status = "failed";
        state.feedback = "DID signature verification failed";

        // Emit failed event
        if (this.sseBus) {
          this.sseBus.emit("worker-verification", "verification_failed", {
            workerId,
            tenantId,
            reason: "DID signature invalid",
          });
        }
      }

      return state;
    } catch (error) {
      this.logger.error(
        `Submit DID signature failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async getVerificationStatus(workerId: string, tenantId: string): Promise<VerificationState> {
    await this.requireWorkerInTenant(workerId, tenantId);
    let state = this.verificationStates.get(workerId);
    if (!state) {
      state = {
        workerId,
        status: "pending",
      };
    }
    return state;
  }

  /**
   * Honest history: no per-verification log is persisted yet
   * (createVerificationLog only writes to the application log), so this
   * reports the real User.verificationStatus and an empty list — it used to
   * return a synthetic "verified" entry for every workerId.
   */
  async getVerificationHistory(workerId: string, tenantId: string) {
    const worker = await this.requireWorkerInTenant(workerId, tenantId);
    return {
      workerId,
      verifications: [] as Array<{ type: string; status: string; verifiedAt: Date }>,
      overallStatus: worker.verificationStatus,
      historyAvailable: false,
    };
  }

  async listUnverifiedWorkers(tenantId: string) {
    return this.repository.getUnverifiedWorkers(tenantId);
  }

  async getVerificationStats(tenantId: string) {
    const verified = await this.repository.countVerifiedWorkers(tenantId);
    const unverified = await this.repository.getUnverifiedWorkers(tenantId);

    return {
      tenantId,
      totalWorkers: verified + unverified.length,
      verifiedCount: verified,
      unverifiedCount: unverified.length,
      verificationRate: Math.round(
        (verified / (verified + unverified.length)) * 100,
      ),
    };
  }

  private async verifyDidSignature(
    workerId: string,
    didSignature: string,
    didPublicKey: string,
  ): Promise<boolean> {
    try {
      // In production, use crypto.subtle or tweetnacl library
      const isValid = await this.repository.verifyDidSignature(
        workerId,
        didSignature,
        didPublicKey,
        `verify_${workerId}`,
      );

      return isValid;
    } catch (error) {
      this.logger.error(
        `DID verification error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

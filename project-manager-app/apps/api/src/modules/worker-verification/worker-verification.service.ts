import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
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

/** Quien ejecuta la accion (identidad autenticada, nunca del body). */
export interface VerificationActor {
  userId: string;
  roles: string[];
}

export interface VerificationRequest {
  workerId: string;
  tenantId: string;
  actor?: VerificationActor;
  verificationType: "DID_SIGNATURE" | "BACKGROUND_CHECK" | "LICENSE" | "INSURANCE";
  didSignature?: string;
  didPublicKey?: string;
}

@Injectable()
export class WorkerVerificationService {
  private readonly logger = new Logger(WorkerVerificationService.name);

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

  /**
   * C11 — precondicion de atestacion: solo el propio trabajador (o OPS_ADMIN)
   * puede iniciar o presentar una atestacion de identidad sobre un trabajador.
   * Tener `worker:write` en el tenant NO basta: antes cualquier holder podia
   * atestar a otro trabajador. Sin actor => se rechaza (fail closed).
   */
  private assertMayAttest(actor: VerificationActor | undefined, workerId: string): void {
    if (actor && (actor.userId === workerId || actor.roles.includes("OPS_ADMIN"))) return;
    throw new ForbiddenException("Only the worker themself or an OPS_ADMIN can attest this worker's identity");
  }

  /**
   * C11 — el estado se DERIVA de User.verificationStatus (fuente durable y
   * unica entre instancias). Antes vivia en un Map en memoria: se perdia al
   * reiniciar y cada replica veia un estado distinto. Los estados intermedios
   * (signing/signed) y "failed" son transitorios de una sola peticion y no se
   * persisten.
   */
  private stateFromPersisted(workerId: string, verificationStatus: string): VerificationState {
    switch (verificationStatus) {
      case "verified":
        return { workerId, status: "verified" };
      case "suspended":
        return { workerId, status: "failed", feedback: "worker verification is suspended" };
      default: // "unverified" | "pending"
        return { workerId, status: "pending" };
    }
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

      this.assertMayAttest(request.actor, request.workerId);
      // Persiste "pending" solo desde "unverified"; nunca degrada verified/suspended.
      await this.repository.markPendingIfUnverified(request.workerId);
      const refreshed = await this.repository.getWorkerInTenant(request.workerId, request.tenantId);
      const state = this.stateFromPersisted(request.workerId, refreshed?.verificationStatus ?? worker.verificationStatus);

      // Emit SSE event
      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "initiated", {
          workerId: request.workerId,
          tenantId: request.tenantId,
          verificationType: request.verificationType,
          status: state.status,
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
    actor?: VerificationActor,
  ): Promise<VerificationState> {
    try {
      const worker = await this.requireWorkerInTenant(workerId, tenantId);
      this.assertMayAttest(actor, workerId);

      // Un trabajador suspendido no se re-verifica por esta via (hace falta una
      // decision humana explicita fuera de este flujo).
      if (worker.verificationStatus === "suspended") {
        return this.stateFromPersisted(workerId, worker.verificationStatus);
      }

      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "signing", { workerId, tenantId, progress: 30 });
      }

      await this.repository.storeDidSignature(workerId, didSignature, didPublicKey);

      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "signed", { workerId, tenantId, progress: 60 });
      }

      const isValid = await this.verifyDidSignature(workerId, didSignature, didPublicKey);

      if (isValid) {
        // "verified" solo llega aqui si la criptografia DID REAL valido la firma
        // (hoy verifyDidSignature falla cerrado). Se persiste de verdad.
        const changed = await this.repository.markVerified(workerId);
        const verifiedAt = new Date();

        await this.repository.createVerificationLog(workerId, tenantId, "DID_SIGNATURE", {
          status: "verified",
          verifiedAt,
        });

        if (this.sseBus) {
          this.sseBus.emit("worker-verification", "verified", {
            workerId,
            tenantId,
            status: "verified",
            timestamp: verifiedAt.toISOString(),
          });
        }
        return { workerId, status: "verified", verifiedAt: changed ? verifiedAt : undefined };
      }

      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "verification_failed", {
          workerId,
          tenantId,
          reason: "DID signature invalid",
        });
      }
      // Fallo transitorio de esta peticion: no se persiste ni se degrada el estado.
      return { workerId, status: "failed", feedback: "DID signature verification failed" };
    } catch (error) {
      this.logger.error(
        `Submit DID signature failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async getVerificationStatus(workerId: string, tenantId: string): Promise<VerificationState> {
    const worker = await this.requireWorkerInTenant(workerId, tenantId);
    return this.stateFromPersisted(workerId, worker.verificationStatus);
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

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  WorkerVerificationRepository,
} from "./worker-verification.repository.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

import {
  attestationMessage,
  canTransition,
  challengeTtlSeconds,
  generateNonce,
  hashNonce,
  type TenantVerificationStatus,
} from "./worker-verification.state.js";

export interface VerificationState {
  workerId: string;
  status: "pending" | "signing" | "signed" | "verified" | "failed";
  didSignature?: string;
  feedback?: string;
  verifiedAt?: Date;
  /** Solo al iniciar: nonce de UN SOLO USO que el trabajador debe firmar (no se vuelve a mostrar). */
  challenge?: { nonce: string; expiresAt: Date; message: string };
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
   * puede iniciar o presentar una atestacion sobre un trabajador. Sin actor =>
   * se rechaza (fail closed).
   */
  private assertMayAttest(actor: VerificationActor | undefined, workerId: string): void {
    if (actor && (actor.userId === workerId || actor.roles.includes("OPS_ADMIN"))) return;
    throw new ForbiddenException("Only the worker themself or an OPS_ADMIN can attest this worker's identity");
  }

  /**
   * Estado de la API derivado del estado EFECTIVO por tenant (WorkerVerification,
   * con el global legado solo como compatibilidad). `signing/signed/failed` son
   * transitorios de una peticion y no se persisten.
   */
  private toState(workerId: string, status: TenantVerificationStatus): VerificationState {
    switch (status) {
      case "verified":
        return { workerId, status: "verified" };
      case "suspended":
        return { workerId, status: "failed", feedback: "worker verification is suspended" };
      default:
        return { workerId, status: "pending" };
    }
  }

  async initiateVerification(request: VerificationRequest): Promise<VerificationState> {
    try {
      await this.requireWorkerInTenant(request.workerId, request.tenantId);
      this.assertMayAttest(request.actor, request.workerId);

      const current = await this.repository.getEffectiveStatus(request.tenantId, request.workerId);
      // Verificado o suspendido: no se emite desafio ni se cambia nada.
      if (current === "verified" || current === "suspended") {
        return this.toState(request.workerId, current);
      }

      // unverified -> pending (monotonico, atomico, con evento). Si ya es pending, no-op.
      if (canTransition(current, "pending")) {
        await this.repository.transitionTenantStatus({
          tenantId: request.tenantId,
          userId: request.workerId,
          from: ["unverified"],
          to: "pending",
          eventType: "status_changed",
          actorUserId: request.actor?.userId,
        });
      }

      const nonce = generateNonce();
      const expiresAt = new Date(Date.now() + challengeTtlSeconds() * 1000);
      await this.repository.issueChallenge({
        tenantId: request.tenantId,
        userId: request.workerId,
        nonceHash: hashNonce(nonce),
        expiresAt,
        actorUserId: request.actor?.userId,
      });

      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "initiated", {
          workerId: request.workerId,
          tenantId: request.tenantId,
          verificationType: request.verificationType,
          status: "pending",
          timestamp: new Date().toISOString(),
        });
      }

      return {
        workerId: request.workerId,
        status: "pending",
        challenge: { nonce, expiresAt, message: attestationMessage(request.tenantId, request.workerId, nonce) },
      };
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
    nonce: string,
    actor?: VerificationActor,
  ): Promise<VerificationState> {
    try {
      await this.requireWorkerInTenant(workerId, tenantId);
      this.assertMayAttest(actor, workerId);

      const current = await this.repository.getEffectiveStatus(tenantId, workerId);
      if (current === "suspended") return this.toState(workerId, current);
      if (current === "verified") return this.toState(workerId, current); // idempotente

      if (typeof nonce !== "string" || nonce.length < 16 || nonce.length > 128) {
        throw new BadRequestException("A valid challenge nonce is required (start verification first)");
      }

      // Un solo uso, ligado a tenant+trabajador, con caducidad. Se consume ANTES de
      // validar la firma: un intento fallido tambien quema el desafio (no se reintenta).
      const consumed = await this.repository.consumeChallenge({
        tenantId,
        userId: workerId,
        nonceHash: hashNonce(nonce),
      });
      if (!consumed) {
        await this.repository.appendEvent({
          tenantId,
          userId: workerId,
          type: "signature_rejected",
          actorUserId: actor?.userId,
          metadata: { reason: "challenge_invalid_expired_or_used" },
        });
        return { workerId, status: "failed", feedback: "challenge is invalid, expired or already used" };
      }

      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "signing", { workerId, tenantId, progress: 30 });
      }

      await this.repository.storeDidSignature(workerId, didSignature, didPublicKey);

      const isValid = await this.verifyDidSignature(
        workerId,
        didSignature,
        didPublicKey,
        attestationMessage(tenantId, workerId, nonce),
      );

      if (isValid) {
        // "verified" solo llega aqui si la criptografia DID REAL valido la firma sobre el
        // mensaje ligado al nonce (hoy verifyDidSignature falla cerrado).
        const changed = await this.repository.transitionTenantStatus({
          tenantId,
          userId: workerId,
          from: ["unverified", "pending"],
          to: "verified",
          eventType: "verified",
          actorUserId: actor?.userId,
          metadata: { method: "DID_SIGNATURE" },
        });
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

      await this.repository.appendEvent({
        tenantId,
        userId: workerId,
        type: "signature_rejected",
        actorUserId: actor?.userId,
        metadata: { reason: "signature_invalid" },
      });
      if (this.sseBus) {
        this.sseBus.emit("worker-verification", "verification_failed", {
          workerId,
          tenantId,
          reason: "DID signature invalid",
        });
      }
      // Fallo de esta peticion: no se persiste ni se degrada el estado.
      return { workerId, status: "failed", feedback: "DID signature verification failed" };
    } catch (error) {
      this.logger.error(
        `Submit DID signature failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async getVerificationStatus(workerId: string, tenantId: string): Promise<VerificationState> {
    await this.requireWorkerInTenant(workerId, tenantId);
    return this.toState(workerId, await this.repository.getEffectiveStatus(tenantId, workerId));
  }

  /** Historial REAL y auditable (append-only) de la verificacion del trabajador en este tenant. */
  async getVerificationHistory(workerId: string, tenantId: string) {
    await this.requireWorkerInTenant(workerId, tenantId);
    const [overallStatus, events] = await Promise.all([
      this.repository.getEffectiveStatus(tenantId, workerId),
      this.repository.listEvents(tenantId, workerId),
    ]);
    return {
      workerId,
      overallStatus,
      historyAvailable: true,
      verifications: events
        .filter((e) => e.type === "verified")
        .map((e) => ({ type: "DID_SIGNATURE", status: "verified", verifiedAt: e.occurredAt })),
      events: events.map((e) => ({
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        occurredAt: e.occurredAt,
        reason: (e.metadataJson as { reason?: string } | null)?.reason ?? null,
      })),
    };
  }

  async listUnverifiedWorkers(tenantId: string) {
    return this.repository.getUnverifiedWorkers(tenantId);
  }

  async getVerificationStats(tenantId: string) {
    const { total, verified } = await this.repository.getVerificationCounts(tenantId);
    return {
      tenantId,
      totalWorkers: total,
      verifiedCount: verified,
      unverifiedCount: total - verified,
      verificationRate: total === 0 ? 0 : Math.round((verified / total) * 100),
    };
  }

  private async verifyDidSignature(
    workerId: string,
    didSignature: string,
    didPublicKey: string,
    message: string,
  ): Promise<boolean> {
    try {
      // En produccion se usara crypto real (crypto.subtle / tweetnacl) sobre `message`.
      return await this.repository.verifyDidSignature(workerId, didSignature, didPublicKey, message);
    } catch (error) {
      this.logger.error(
        `DID verification error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

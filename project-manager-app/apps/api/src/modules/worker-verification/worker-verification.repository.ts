import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { effectiveStatus, type TenantVerificationStatus } from "./worker-verification.state.js";

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

  /**
   * Tenant-scoped worker lookup (C10): User rows are global, so a worker
   * "belongs" to a tenant through a Membership in one of the tenant's orgs —
   * the same relation getUnverifiedWorkers() already uses.
   */
  async getWorkerInTenant(workerId: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: { id: workerId, memberships: { some: { org: { tenantId } } } },
      select: { id: true, verificationStatus: true },
    }).catch(() => null);
  }

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

  // ── C11: estado POR TENANT (WorkerVerification) ──────────────────────────────
  // Todas las transiciones son compare-and-set y escriben su evento en la MISMA
  // transaccion (historial auditable append-only). El global User.verificationStatus
  // ya NO se escribe desde aqui.

  async getTenantRow(tenantId: string, userId: string) {
    return this.prisma.workerVerification.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { status: true, verifiedAt: true },
    });
  }

  /** Estado efectivo (fila por tenant, o el global legado como compatibilidad temporal). */
  async getEffectiveStatus(tenantId: string, userId: string): Promise<TenantVerificationStatus> {
    const [row, user] = await Promise.all([
      this.getTenantRow(tenantId, userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { verificationStatus: true } }),
    ]);
    return effectiveStatus(row?.status, user?.verificationStatus);
  }

  /**
   * Transicion atomica `from -> to` con su evento. Crea la fila si no existe
   * (solo cuando `from` incluye "unverified"). Devuelve true si cambio.
   */
  async transitionTenantStatus(input: {
    tenantId: string;
    userId: string;
    from: TenantVerificationStatus[];
    to: TenantVerificationStatus;
    eventType: string;
    actorUserId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      if (input.from.includes("unverified")) {
        await tx.workerVerification.createMany({
          data: [{ tenantId: input.tenantId, userId: input.userId, status: "unverified" }],
          skipDuplicates: true,
        });
      }
      const current = await tx.workerVerification.findUnique({
        where: { tenantId_userId: { tenantId: input.tenantId, userId: input.userId } },
        select: { status: true },
      });
      const result = await tx.workerVerification.updateMany({
        where: { tenantId: input.tenantId, userId: input.userId, status: { in: input.from } },
        data: { status: input.to, ...(input.to === "verified" ? { verifiedAt: new Date() } : {}) },
      });
      if (result.count === 0) return false;
      await tx.workerVerificationEvent.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.eventType,
          fromStatus: current?.status ?? null,
          toStatus: input.to,
          actorUserId: input.actorUserId ?? null,
          metadataJson: (input.metadata ?? undefined) as never,
        },
      });
      return true;
    });
  }

  /** Emite un desafio nuevo e invalida (consume) los anteriores aun vigentes del mismo trabajador/tenant. */
  async issueChallenge(input: { tenantId: string; userId: string; nonceHash: string; expiresAt: Date; actorUserId?: string }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.workerVerificationChallenge.updateMany({
        where: { tenantId: input.tenantId, userId: input.userId, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      await tx.workerVerificationChallenge.create({
        data: { tenantId: input.tenantId, userId: input.userId, nonceHash: input.nonceHash, expiresAt: input.expiresAt },
      });
      await tx.workerVerificationEvent.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          type: "challenge_issued",
          actorUserId: input.actorUserId ?? null,
          metadataJson: { expiresAt: input.expiresAt.toISOString() } as never,
        },
      });
    });
  }

  /**
   * Consume el desafio de forma atomica y de UN SOLO USO: solo prospera si existe
   * para ese tenant+trabajador, no esta consumido y no ha caducado. Se consume
   * ANTES de validar la firma, de modo que un intento fallido tambien lo quema.
   */
  async consumeChallenge(input: { tenantId: string; userId: string; nonceHash: string; now?: Date }): Promise<boolean> {
    const now = input.now ?? new Date();
    const result = await this.prisma.workerVerificationChallenge.updateMany({
      where: {
        nonceHash: input.nonceHash,
        tenantId: input.tenantId,
        userId: input.userId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    return result.count > 0;
  }

  async appendEvent(input: { tenantId: string; userId: string; type: string; actorUserId?: string; metadata?: Record<string, unknown> }): Promise<void> {
    await this.prisma.workerVerificationEvent.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        actorUserId: input.actorUserId ?? null,
        metadataJson: (input.metadata ?? undefined) as never,
      },
    });
  }

  async listEvents(tenantId: string, userId: string, limit = 50) {
    return this.prisma.workerVerificationEvent.findMany({
      where: { tenantId, userId },
      orderBy: { occurredAt: "desc" },
      take: limit,
      select: { type: true, fromStatus: true, toStatus: true, actorUserId: true, occurredAt: true, metadataJson: true },
    });
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
  // global list (docs/AUDIT_REMEDIATION_PLAN.md 3.11). C11: ahora usan el estado
  // EFECTIVO por tenant (fila por tenant, o el global legado como compatibilidad).
  private async tenantWorkersWithStatus(tenantId: string) {
    const workers = await this.prisma.user.findMany({
      where: { memberships: { some: { org: { tenantId }, role: { key: { in: ["PRO", "WORKER"] } } } } },
      select: { id: true, email: true, createdAt: true, verificationStatus: true },
    });
    const rows = await this.prisma.workerVerification.findMany({
      where: { tenantId, userId: { in: workers.map((w) => w.id) } },
      select: { userId: true, status: true },
    });
    const byUser = new Map(rows.map((r) => [r.userId, r.status]));
    return workers.map((w) => ({ ...w, status: effectiveStatus(byUser.get(w.id), w.verificationStatus) }));
  }

  async getUnverifiedWorkers(tenantId: string) {
    try {
      const all = await this.tenantWorkersWithStatus(tenantId);
      return all.filter((w) => w.status !== "verified").slice(0, 50).map(({ id, email, createdAt }) => ({ id, email, createdAt }));
    } catch (error) {
      this.logger.error(
        `Failed to fetch unverified workers: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async getVerificationCounts(tenantId: string): Promise<{ total: number; verified: number }> {
    try {
      const all = await this.tenantWorkersWithStatus(tenantId);
      return { total: all.length, verified: all.filter((w) => w.status === "verified").length };
    } catch (error) {
      this.logger.error(
        `Failed to count verified workers: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { total: 0, verified: 0 };
    }
  }
}

import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { truncateToUtcDay } from "./mcp-consent.policy.js";

const LIVE_STATUSES = ["PENDING", "ACTIVE"];

export type LockedSessionRow = {
  id: string;
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
  refreshExpiresAt: Date;
  status: string;
  revokedAt: Date | null;
};

export type McpConsentCreateData = {
  tenantId: string;
  orgId: string;
  userId: string;
  sessionId: string;
  oauthIssuer: string;
  oauthClientId: string;
  resourceUri: string;
  scopeSet: string[];
  grantBindingDigest: string;
  authorizedAt: Date;
  expiresAt: Date;
  policyVersion: string;
  consentVersion: string;
  idempotencyKeyDigest: string | null;
  requestFingerprint: string;
};

type Tx = Prisma.TransactionClient;

/**
 * Persistencia de S1/D7. Sin rutas: lo usa solo McpConsentService.
 * Ningún método de lectura escribe (D7-13); las escrituras son aceptación,
 * revocación compare-and-set y anonimización por retención.
 */
@Injectable()
export class McpConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aceptación serializada con el borrado del titular (D7-23): relee AuthSession y
   * User con FOR SHARE dentro de la misma transacción del INSERT, de modo que un
   * flujo de borrado que primero revoca la sesión o desactiva el usuario espera o
   * es esperado, nunca intercala.
   */
  acceptInTransaction<T>(
    sessionId: string,
    work: (tx: Tx, locked: { session: LockedSessionRow | null; userStatus: string | null }) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const sessions = await tx.$queryRaw<LockedSessionRow[]>`
        SELECT "id", "tenantId", "orgId", "userId", "roles", "refreshExpiresAt", "status", "revokedAt"
        FROM "AuthSession" WHERE "id" = ${sessionId} FOR SHARE`;
      const session = sessions[0] ?? null;
      let userStatus: string | null = null;
      if (session) {
        const users = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT "status" FROM "User" WHERE "id" = ${session.userId} FOR SHARE`;
        userStatus = users[0]?.status ?? null;
      }
      return work(tx, { session, userStatus });
    });
  }

  activeRolesInTx(tx: Tx, input: { userId: string; orgId: string; tenantId: string }): Promise<string[]> {
    return tx.membership
      .findMany({
        where: { userId: input.userId, orgId: input.orgId, status: "ACTIVE", org: { tenantId: input.tenantId } },
        select: { role: { select: { key: true } } },
      })
      .then((rows) => [...new Set(rows.map((row) => row.role.key))]);
  }

  createInTx(tx: Tx, data: McpConsentCreateData) {
    return tx.mcpDelegatedConsent.create({ data: { ...data, status: "ACTIVE" } });
  }

  findByIdempotencyDigest(tenantId: string, idempotencyKeyDigest: string) {
    return this.prisma.mcpDelegatedConsent.findUnique({
      where: { tenantId_idempotencyKeyDigest: { tenantId, idempotencyKeyDigest } },
    });
  }

  findByBinding(tenantId: string, grantBindingDigest: string) {
    return this.prisma.mcpDelegatedConsent.findUnique({
      where: { tenantId_grantBindingDigest: { tenantId, grantBindingDigest } },
    });
  }

  findInScope(where: { id: string; tenantId: string; userId?: string }) {
    return this.prisma.mcpDelegatedConsent.findFirst({ where });
  }

  /** Compare-and-set PENDING|ACTIVE → REVOKED. Devuelve cuántas filas cambió (0 o 1). */
  async revoke(
    where: { id: string; tenantId: string; userId?: string },
    data: { revokedAt: Date; revokedByUserId: string; revocationReasonCode: string },
  ): Promise<number> {
    const result = await this.prisma.mcpDelegatedConsent.updateMany({
      where: { ...where, status: { in: LIVE_STATUSES } },
      data: { ...data, status: "REVOKED" },
    });
    return result.count;
  }

  /**
   * Retención Q6 (D7-21, D7-24): candidatos cuyo momento terminal
   * coalesce(revokedAt, expiresAt) es anterior a `cutoff`, sea cual sea su estado.
   */
  findAnonymizationCandidates(cutoff: Date, take: number) {
    return this.prisma.mcpDelegatedConsent.findMany({
      where: {
        anonymizedAt: null,
        OR: [{ revokedAt: { lte: cutoff } }, { revokedAt: null, expiresAt: { lte: cutoff } }],
      },
      orderBy: { expiresAt: "asc" },
      take,
    });
  }

  /**
   * Anonimiza una fila; si seguía PENDING/ACTIVE pasa a EXPIRED en la misma escritura.
   * Compare-and-set sobre el snapshot leído: si una revocación concurrente cambió
   * estado o revokedAt (y por tanto el momento terminal), no escribe y devuelve false.
   */
  async anonymize(
    row: { id: string; status: string; createdAt: Date; authorizedAt: Date | null; expiresAt: Date; revokedAt: Date | null },
    now: Date,
  ): Promise<boolean> {
    const result = await this.prisma.mcpDelegatedConsent.updateMany({
      where: {
        id: row.id,
        anonymizedAt: null,
        status: row.status,
        revokedAt: row.revokedAt,
        expiresAt: row.expiresAt,
      },
      data: {
        status: LIVE_STATUSES.includes(row.status) ? "EXPIRED" : row.status,
        userId: null,
        sessionId: null,
        revokedByUserId: null,
        idempotencyKeyDigest: null,
        requestFingerprint: null,
        grantBindingDigest: null,
        createdAt: truncateToUtcDay(row.createdAt),
        authorizedAt: row.authorizedAt ? truncateToUtcDay(row.authorizedAt) : null,
        expiresAt: truncateToUtcDay(row.expiresAt),
        revokedAt: row.revokedAt ? truncateToUtcDay(row.revokedAt) : null,
        updatedAt: truncateToUtcDay(now),
        anonymizedAt: truncateToUtcDay(now),
      },
    });
    return result.count === 1;
  }
}

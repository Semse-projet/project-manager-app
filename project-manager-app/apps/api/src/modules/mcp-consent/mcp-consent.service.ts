import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { performance } from "node:perf_hooks";
import {
  MCP_GRANT_RETENTION_DAYS,
  acceptMcpConsentInputSchema,
  mcpConsentRevocationReasonSchema,
  type AcceptMcpConsentInput,
  type McpConsentRevocationReason,
  type McpConsentScope,
} from "@semse/schemas";
import { hasPermission } from "../../common/rbac.js";
import { AuthRepository } from "../auth/auth.repository.js";
import {
  acceptRequestFingerprint,
  computeGrantExpiry,
  idempotencyKeyDigest,
  mcpEffectiveRoles,
  rolesCoverScopes,
} from "./mcp-consent.policy.js";
import { McpConsentRepository } from "./mcp-consent.repository.js";

/** Emisor, recurso y clientes admitidos. Los fija la capa D2 (pendiente); nunca vienen del cliente MCP. */
export type McpConsentTrust = {
  oauthIssuer: string;
  resourceUri: string;
  allowedClientIds: readonly string[];
  /** Versiones de política vigentes: un grant emitido bajo otra no autoriza (D7-09). */
  acceptedPolicyVersions: readonly string[];
};
export const MCP_CONSENT_TRUST = Symbol("MCP_CONSENT_TRUST");
/** Reloj inyectable para pruebas de expiración y retención. */
export const MCP_CONSENT_CLOCK = Symbol("MCP_CONSENT_CLOCK");
/** Testable monotonic source for one shared authorization time budget. */
export const MCP_CONSENT_MONOTONIC_CLOCK = Symbol("MCP_CONSENT_MONOTONIC_CLOCK");

/** Contexto server-trusted para el camino de lectura D4. Nunca incluye roles con override operativo. */
export type McpReadContext = {
  grantId: string;
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

const AUTHORITY_DEADLINE_MS = 1000;
const ACTIVE_USER_STATUS = "active";
const ACTIVE_SESSION_STATUS = "ACTIVE";

/**
 * Servicio interno de S1/D7 (fase B). Sin controller ni ruta: no hay forma de
 * llamarlo desde HTTP/MCP hasta la fase C, que además exige D2 y el flag
 * MCP_S1_SERVER_ENABLED. Spec: docs/specs/platform/semse-mcp-delegated-consent.spec.md.
 */
@Injectable()
export class McpConsentService {
  constructor(
    private readonly repository: McpConsentRepository,
    private readonly authRepository: AuthRepository,
    @Inject(MCP_CONSENT_TRUST) private readonly trust: McpConsentTrust,
    @Optional() @Inject(MCP_CONSENT_CLOCK) clock?: () => Date,
    @Optional() @Inject(MCP_CONSENT_MONOTONIC_CLOCK) monotonicClock?: () => number,
  ) {
    this.clock = clock ?? (() => new Date());
    this.monotonicClock = monotonicClock ?? (() => performance.now());
  }

  private readonly clock: () => Date;
  private readonly monotonicClock: () => number;

  /** §5 aceptar. `sessionId` lo aporta el flujo de consentimiento confiable (D2), no el cliente. */
  async accept(rawInput: AcceptMcpConsentInput) {
    const parsed = acceptMcpConsentInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new BadRequestException("Invalid MCP consent request");
    const input = parsed.data;
    this.assertTrusted(input.oauthIssuer, input.oauthClientId, input.resourceUri);
    if (!this.trust.acceptedPolicyVersions.includes(input.policyVersion)) {
      throw new ForbiddenException("Consent policy version not accepted");
    }
    const scopeSet = [...new Set(input.scopeSet)].sort();
    const requestFingerprint = acceptRequestFingerprint({ ...input, scopeSet });

    try {
      return await this.repository.acceptInTransaction(input.sessionId, async (tx, { session, userStatus }) => {
        const activeRoles = session ? await this.repository.activeRolesInTx(tx, session) : [];
        // Sampled after the locks and the membership read: waiting on a lock must not
        // let an already-expired session produce an ACTIVE grant.
        const now = this.clock();
        if (
          !session ||
          session.status !== ACTIVE_SESSION_STATUS ||
          session.revokedAt !== null ||
          session.refreshExpiresAt.getTime() <= now.getTime() ||
          userStatus !== ACTIVE_USER_STATUS
        ) {
          throw new UnauthorizedException("Invalid or revoked auth session");
        }
        if (!rolesCoverScopes(mcpEffectiveRoles(activeRoles, session.roles), scopeSet)) {
          throw new ForbiddenException("Requested scopes exceed current permissions");
        }
        const digest = input.idempotencyKey ? idempotencyKeyDigest(session.tenantId, input.idempotencyKey) : null;
        return this.repository.createInTx(tx, {
          tenantId: session.tenantId,
          orgId: session.orgId,
          userId: session.userId,
          sessionId: session.id,
          oauthIssuer: input.oauthIssuer,
          oauthClientId: input.oauthClientId,
          resourceUri: input.resourceUri,
          scopeSet,
          grantBindingDigest: input.grantBindingDigest,
          authorizedAt: now,
          expiresAt: computeGrantExpiry({
            now,
            refreshExpiresAt: session.refreshExpiresAt,
            requestedExpiresAt: input.requestedExpiresAt,
          }),
          policyVersion: input.policyVersion,
          consentVersion: input.consentVersion,
          idempotencyKeyDigest: digest,
          requestFingerprint,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        try {
          return await this.resolveDuplicate(input, requestFingerprint);
        } catch (resolutionError) {
          this.rethrowPrismaAvailability(resolutionError);
          throw resolutionError;
        }
      }
      this.rethrowPrismaAvailability(error);
      throw error;
    }
  }

  /** Fail closed when the consent store cannot establish or serve a connection. */
  private rethrowPrismaAvailability(error: unknown): void {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P1001", "P1002", "P1008", "P1017", "P2024", "P2034"].includes(error.code)) ||
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      throw new ServiceUnavailableException("Consent authority unavailable");
    }
  }

  /**
   * §5 verificar en cada llamada. Solo lectura (D7-13): no escribe ni marca EXPIRED.
   * El token ya fue verificado por la capa D2; aquí se exige el grant y se relee la autoridad.
   */
  async authorizeRead(input: {
    tenantId: string;
    grantBindingDigest: string;
    oauthIssuer: string;
    oauthClientId: string;
    resourceUri: string;
    scope: McpConsentScope;
  }): Promise<McpReadContext> {
    // D7 has a single monotonic budget; future D2 must pass the same
    // end-to-end deadline starting before external token introspection.
    const deadlineAt = this.monotonicClock() + AUTHORITY_DEADLINE_MS;
    const now = this.clock();
    this.assertTrusted(input.oauthIssuer, input.oauthClientId, input.resourceUri);
    const grant = await this.withDeadline(deadlineAt, () =>
      this.repository.findByBinding(input.tenantId, input.grantBindingDigest),
    );
    if (
      !grant ||
      grant.status !== "ACTIVE" ||
      grant.anonymizedAt !== null ||
      grant.userId === null ||
      grant.sessionId === null ||
      grant.expiresAt.getTime() <= now.getTime() ||
      grant.oauthIssuer !== input.oauthIssuer ||
      grant.oauthClientId !== input.oauthClientId ||
      grant.resourceUri !== input.resourceUri ||
      !this.trust.acceptedPolicyVersions.includes(grant.policyVersion) ||
      !grant.scopeSet.includes(input.scope)
    ) {
      throw new UnauthorizedException("MCP consent not valid");
    }

    const sessionId = grant.sessionId;
    const snapshot = await this.withDeadline(deadlineAt, () =>
      this.authRepository.findActiveSessionAuthorization(sessionId),
    );
    if (
      !snapshot ||
      snapshot.userStatus !== ACTIVE_USER_STATUS ||
      snapshot.session.userId !== grant.userId ||
      snapshot.session.orgId !== grant.orgId ||
      snapshot.session.tenantId !== grant.tenantId ||
      snapshot.session.refreshExpiresAt.getTime() <= now.getTime()
    ) {
      throw new UnauthorizedException("MCP consent not valid");
    }
    const roles = mcpEffectiveRoles(snapshot.activeRoles, snapshot.session.roles);
    if (!rolesCoverScopes(roles, [input.scope])) {
      throw new ForbiddenException("MCP consent not valid");
    }
    this.assertWithinDeadline(deadlineAt);
    // The deadline bounds latency, not validity: re-check both expiries after the lookups.
    const checkedAt = this.clock().getTime();
    if (grant.expiresAt.getTime() <= checkedAt || snapshot.session.refreshExpiresAt.getTime() <= checkedAt) {
      throw new UnauthorizedException("MCP consent not valid");
    }
    return { grantId: grant.id, tenantId: grant.tenantId, orgId: grant.orgId, userId: grant.userId, roles };
  }

  /** Q5 nivel 1: el propio usuario revoca su grant. Idempotente. */
  async revokeOwn(actor: { tenantId: string; userId: string }, grantId: string) {
    return this.revokeWithin(
      { id: grantId, tenantId: actor.tenantId, userId: actor.userId },
      actor.userId,
      "user_requested",
    );
  }

  /** Q5 nivel 3 (v1): OPS_ADMIN revoca un grant de su tenant, uno a uno y con motivo. */
  async revokeAsTenantOps(
    actor: { tenantId: string; userId: string; roles: string[] },
    grantId: string,
    reason: McpConsentRevocationReason,
  ) {
    if (!hasPermission(actor.roles, "mcp:consents:revoke:tenant")) {
      throw new ForbiddenException("Missing permission mcp:consents:revoke:tenant");
    }
    return this.revokeWithin(
      { id: grantId, tenantId: actor.tenantId },
      actor.userId,
      mcpConsentRevocationReasonSchema.parse(reason),
    );
  }

  /**
   * Q6: anonimiza grants cuyo momento terminal coalesce(revokedAt, expiresAt) tiene más
   * de 90 días, aunque sigan ACTIVE porque el mantenimiento no corrió (D7-24).
   */
  async anonymizeDue(take = 100): Promise<number> {
    const now = this.clock();
    const cutoff = new Date(now.getTime() - MCP_GRANT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let anonymized = 0;
    for (const row of await this.repository.findAnonymizationCandidates(cutoff, take)) {
      if (await this.repository.anonymize(row, now)) anonymized += 1;
    }
    return anonymized;
  }

  private async revokeWithin(
    where: { id: string; tenantId: string; userId?: string },
    revokedByUserId: string,
    revocationReasonCode: McpConsentRevocationReason,
  ) {
    await this.repository.revoke(where, { revokedAt: this.clock(), revokedByUserId, revocationReasonCode });
    const grant = await this.repository.findInScope(where);
    if (!grant) throw new NotFoundException("MCP consent not found");
    return grant;
  }

  private async resolveDuplicate(input: AcceptMcpConsentInput, requestFingerprint: string) {
    const existing = input.idempotencyKey
      ? await this.findByIdempotency(input.sessionId, input.idempotencyKey)
      : null;
    if (existing && existing.requestFingerprint === requestFingerprint) {
      return existing;
    }
    throw new ConflictException("MCP consent conflicts with an existing grant");
  }

  private async findByIdempotency(sessionId: string, idempotencyKey: string) {
    const snapshot = await this.authRepository.findActiveSessionById(sessionId);
    if (!snapshot) return null;
    return this.repository.findByIdempotencyDigest(
      snapshot.tenantId,
      idempotencyKeyDigest(snapshot.tenantId, idempotencyKey),
    );
  }

  private assertTrusted(oauthIssuer: string, oauthClientId: string, resourceUri: string): void {
    if (
      oauthIssuer !== this.trust.oauthIssuer ||
      resourceUri !== this.trust.resourceUri ||
      !this.trust.allowedClientIds.includes(oauthClientId)
    ) {
      throw new ForbiddenException("Untrusted OAuth issuer, client or resource");
    }
  }

  private assertWithinDeadline(deadlineAt: number): void {
    if (this.monotonicClock() >= deadlineAt) {
      throw new ServiceUnavailableException("Authorization authority unavailable");
    }
  }

  /** Do not restart the authorization timeout for each authority lookup. */
  private async withDeadline<T>(deadlineAt: number, lookup: () => Promise<T>): Promise<T> {
    this.assertWithinDeadline(deadlineAt);
    const remainingMs = Math.max(1, Math.ceil(deadlineAt - this.monotonicClock()));
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        lookup(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new ServiceUnavailableException("Authorization authority unavailable")),
            remainingMs,
          );
        }),
      ]);
      this.assertWithinDeadline(deadlineAt);
      return result;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Authorization authority unavailable");
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
}

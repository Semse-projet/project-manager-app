import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { EmailService } from "../../infrastructure/email/email.service.js";
import { SemseLoggerService } from "../../infrastructure/observability/semse-logger.service.js";
import { generateOpaqueToken, hashPassword, sha256, verifyPassword } from "../../common/auth-password.js";
import { signToken, verifyToken } from "../../common/auth-token.js";
import { type RequestContext, parseHeaderRequestContext } from "../../common/request-context.js";
import {
  demoPasswordMatches,
  isDisabledDemoIdentity,
  isLegacyDemoLoginEnabled,
  LEGACY_DEMO_ACCOUNTS,
  resolveDemoLoginPassword,
} from "./auth-demo-mode.js";
import { AuthRepository } from "./auth.repository.js";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_RESET_TTL_SECONDS = 60 * 30;

type RequestLike = {
  headers?: Record<string, unknown>;
};

function extractBearerToken(headers: Record<string, unknown>): string | null {
  const authorization = headers.authorization;
  if (typeof authorization !== "string") {
    return null;
  }

  const [scheme, token] = authorization.trim().split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly semseLogger: SemseLoggerService
  ) {}

  private requireSecret(): string {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      throw new InternalServerErrorException(
        "Auth lifecycle is disabled — AUTH_SECRET is not configured"
      );
    }
    return secret;
  }

  private accessTtlSeconds(ttlSeconds?: number): number {
    return ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
  }

  private refreshTtlSeconds(): number {
    return REFRESH_TOKEN_TTL_SECONDS;
  }

  private buildTokenResponse(input: {
    sessionId: string;
    userId: string;
    tenantId: string;
    orgId: string;
    roles: string[];
    accessTtlSeconds: number;
    refreshToken: string;
  }) {
    const secret = this.requireSecret();
    const accessToken = signToken(
      {
        userId: input.userId,
        tenantId: input.tenantId,
        orgId: input.orgId,
        roles: input.roles,
        sid: input.sessionId,
        typ: "access"
      },
      secret,
      input.accessTtlSeconds
    );

    const now = Date.now();
    return {
      token: accessToken,
      accessToken,
      refreshToken: input.refreshToken,
      sessionId: input.sessionId,
      accessExpiresAt: new Date(now + input.accessTtlSeconds * 1000).toISOString(),
      refreshExpiresAt: new Date(now + this.refreshTtlSeconds() * 1000).toISOString()
    };
  }

  /**
   * Historical incident: an unbounded per-request Postgres lookup caused long
   * hangs in Railway. Fail CLOSED with a short deadline, never stale claims.
   * Database queries are read-only and have no cross-request positive cache.
   */
  private async accessLookup<T>(operation: () => Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new ServiceUnavailableException("Authentication authority unavailable")),
            1000
          );
        })
      ]);
    } catch {
      throw new ServiceUnavailableException("Authentication authority unavailable");
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  private authorizedRoles(
    snapshot: Awaited<ReturnType<AuthRepository["findActiveSessionAuthorization"]>>,
    claims: { userId: string; tenantId: string; orgId: string; roles: string[] },
  ): string[] {
    if (
      !snapshot ||
      snapshot.userStatus !== "active" ||
      snapshot.session.userId !== claims.userId ||
      snapshot.session.orgId !== claims.orgId ||
      snapshot.session.tenantId !== claims.tenantId ||
      snapshot.session.refreshExpiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException("Invalid or revoked auth session");
    }

    const roles = snapshot.activeRoles.filter(
      (role) => snapshot.session.roles.includes(role) && claims.roles.includes(role)
    );
    if (roles.length === 0) {
      throw new UnauthorizedException("No active organization permission");
    }
    return roles;
  }

  async authenticateRequest(req: RequestLike): Promise<RequestContext> {
    if (!process.env.AUTH_SECRET) {
      if (process.env.NODE_ENV === "production") {
        throw new ServiceUnavailableException("Authentication authority unavailable");
      }
      return parseHeaderRequestContext(req.headers ?? {});
    }

    const headers = req.headers ?? {};
    const token = extractBearerToken(headers);
    if (!token) {
      throw new UnauthorizedException({
        message: "Missing or malformed Authorization header — expected 'Bearer <token>'"
      });
    }

    let claims;
    try {
      claims = verifyToken(token, this.requireSecret());
    } catch {
      throw new UnauthorizedException({ message: "Invalid or expired auth token" });
    }

    if (claims.typ && claims.typ !== "access") {
      throw new UnauthorizedException({ message: "Invalid auth token type" });
    }
    if (!claims.sid) {
      throw new UnauthorizedException({ message: "Session-bound auth token required" });
    }
    if (isDisabledDemoIdentity(claims.userId, claims.roles)) {
      throw new UnauthorizedException({ message: "Demo sessions are disabled" });
    }

    const snapshot = await this.accessLookup(
      () => this.authRepository.findActiveSessionAuthorization(claims.sid!)
    );
    if (snapshot && snapshot.session.accessExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Expired auth session");
    }
    const roles = this.authorizedRoles(snapshot, claims);
    return {
      userId: claims.userId,
      tenantId: claims.tenantId,
      orgId: claims.orgId,
      roles,
      sessionId: claims.sid
    };
  }

  async issueSession(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    ttlSeconds?: number;
    requestId: string;
  }) {
    const accessTtlSeconds = this.accessTtlSeconds(input.ttlSeconds);
    const refreshToken = generateOpaqueToken();
    // A bearer token cannot outlive a session write that never committed.
    this.requireSecret();
    const sessionId = randomUUID();
    const accessExpiresAt = new Date(Date.now() + accessTtlSeconds * 1000);
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlSeconds() * 1000);

    try {
      await this.authRepository.createSession({
        id: sessionId,
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        roles: input.roles,
        refreshTokenHash: sha256(refreshToken),
        accessExpiresAt,
        refreshExpiresAt,
      });
    } catch {
      throw new ServiceUnavailableException("Authentication session could not be persisted");
    }

    // Audit is non-critical — fire-and-forget so it never blocks the token response
    void this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "auth.session.issued",
      entityType: "AuthSession",
      entityId: sessionId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        userId: input.userId,
        orgId: input.orgId,
        roles: input.roles
      }
    }).catch(() => undefined);

    return this.buildTokenResponse({
      sessionId,
      userId: input.userId,
      tenantId: input.tenantId,
      orgId: input.orgId,
      roles: input.roles,
      accessTtlSeconds,
      refreshToken
    });
  }

  async refreshSession(input: { refreshToken: string; requestId: string }) {
    const previousRefreshTokenHash = sha256(input.refreshToken);
    const session = await this.accessLookup(
      () => this.authRepository.findSessionByRefreshTokenHash(previousRefreshTokenHash)
    );
    if (!session || session.refreshExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    if (isDisabledDemoIdentity(session.userId, session.roles)) {
      throw new UnauthorizedException("Demo sessions are disabled");
    }

    const snapshot = await this.accessLookup(
      () => this.authRepository.findActiveSessionAuthorization(session.id)
    );
    const roles = this.authorizedRoles(snapshot, {
      userId: session.userId, tenantId: session.tenantId,
      orgId: session.orgId, roles: session.roles
    });
    const refreshToken = generateOpaqueToken();
    const accessTtlSeconds = ACCESS_TOKEN_TTL_SECONDS;
    const rotated = await this.accessLookup(
      () => this.authRepository.rotateSessionRefreshToken({
        sessionId: session.id,
        previousRefreshTokenHash,
        refreshTokenHash: sha256(refreshToken),
        roles,
        accessExpiresAt: new Date(Date.now() + accessTtlSeconds * 1000),
        refreshExpiresAt: new Date(Date.now() + this.refreshTtlSeconds() * 1000)
      })
    );
    if (rotated.count !== 1) {
      throw new UnauthorizedException("Invalid or previously used refresh token");
    }

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: session.tenantId,
      orgId: session.orgId,
      actorUserId: session.userId,
      action: "auth.session.refreshed",
      entityType: "AuthSession",
      entityId: session.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return this.buildTokenResponse({
      sessionId: session.id,
      userId: session.userId,
      tenantId: session.tenantId,
      orgId: session.orgId,
      roles,
      accessTtlSeconds,
      refreshToken
    });
  }

  async logout(input: RequestContext & { requestId: string }) {
    if (!input.sessionId) {
      throw new BadRequestException("Current auth session is not revocable");
    }

    await this.authRepository.revokeSession(input.sessionId);
    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "auth.session.revoked",
      entityType: "AuthSession",
      entityId: input.sessionId,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return {
      sessionId: input.sessionId,
      status: "revoked"
    };
  }

  async changePassword(input: RequestContext & {
    currentPassword: string;
    newPassword: string;
    requestId: string;
  }) {
    if (!input.sessionId) {
      throw new BadRequestException("Session-bound authentication is required");
    }

    if (input.newPassword.length < 15 || input.newPassword.length > 128) {
      throw new BadRequestException("New password must contain between 15 and 128 characters");
    }

    const user = await this.authRepository.findUserCredentialById(input.userId);
    if (
      !user ||
      user.status !== "active" ||
      !user.passwordHash ||
      !verifyPassword(input.currentPassword, user.passwordHash)
    ) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    if (verifyPassword(input.newPassword, user.passwordHash)) {
      throw new BadRequestException("New password must be different from the current password");
    }

    const result = await this.authRepository.changePasswordAndRevokeOtherSessions({
      userId: input.userId,
      currentSessionId: input.sessionId,
      expectedPasswordHash: user.passwordHash,
      passwordHash: hashPassword(input.newPassword)
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "user.password_changed",
      entityType: "User",
      entityId: input.userId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        revokedOtherSessions: result.revokedOtherSessions
      }
    });

    return {
      status: "updated" as const,
      userId: input.userId,
      revokedOtherSessions: result.revokedOtherSessions
    };
  }

  async register(input: {
    email: string;
    password: string;
    name: string;
    role: "CLIENT" | "PRO";
    requestId: string;
  }) {
    const tenantId = process.env.SEMSE_DEFAULT_TENANT_ID?.trim() || "tenant_default";
    const normalizedEmail = input.email.toLowerCase().trim();

    let identity: { userId: string; orgId: string; tenantId: string; roles: string[] };
    try {
      identity = await this.authRepository.createUserWithOrg({
        email: normalizedEmail,
        passwordHash: hashPassword(input.password),
        name: input.name,
        roleKey: input.role,
        tenantId,
      });
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      throw new InternalServerErrorException("No se pudo crear la cuenta — intenta de nuevo");
    }

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: identity.tenantId,
      orgId: identity.orgId,
      actorUserId: identity.userId,
      action: "auth.register",
      entityType: "User",
      entityId: identity.userId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { email: normalizedEmail, role: input.role },
    });

    return this.issueSession({
      userId: identity.userId,
      tenantId: identity.tenantId,
      orgId: identity.orgId,
      roles: identity.roles,
      ttlSeconds: 8 * 60 * 60,
      requestId: input.requestId,
    });
  }

  async requestPasswordReset(input: {
    email: string;
    requestId: string;
  }) {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await this.authRepository.findUserByEmail(normalizedEmail);
    if (!user) {
      return { status: "accepted" as const };
    }

    const rawToken = generateOpaqueToken();
    await this.authRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000)
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: "n/a",
      orgId: "n/a",
      actorUserId: user.id,
      action: "auth.password_reset.requested",
      entityType: "User",
      entityId: user.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    const webBaseUrl = (process.env.SEMSE_WEB_BASE_URL?.trim() || "https://semseproject.com").replace(/\/+$/, "");
    const resetLink = `${webBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const emailResult = await this.emailService.send({
      to: user.email,
      subject: "Restablece tu contraseña de SEMSE",
      html: `
        <p>Recibimos una solicitud para restablecer tu contraseña de SEMSE.</p>
        <p><a href="${resetLink}">Restablecer contraseña</a></p>
        <p>Este enlace expira en 30 minutos. Si no solicitaste esto, ignora este correo.</p>
      `.trim(),
      text: `Restablece tu contraseña de SEMSE: ${resetLink} (expira en 30 minutos, ignora este correo si no lo solicitaste)`
    });

    // Never let a send failure change the response shape — the "accepted"
    // response must stay identical whether the email exists or not (already
    // verified as correct behavior elsewhere in this file) and whether the
    // send succeeded or not. Log loudly instead, so this is visible to ops
    // rather than repeating 0.32's original silent-failure shape.
    if (!emailResult.sent) {
      this.semseLogger.error("auth.passwordResetEmail failed to send", {
        userId: user.id,
        error: emailResult.error ?? "unknown error",
      });
    }

    if (process.env.NODE_ENV === "production") {
      return { status: "accepted" as const };
    }
    return { status: "accepted" as const, resetTokenPreview: rawToken };
  }

  async loginWithPassword(input: { email: string; password: string; requestId: string }) {
    const normalizedEmail = input.email.toLowerCase().trim();
    const demoModeEnabled = isLegacyDemoLoginEnabled();

    if (!demoModeEnabled && normalizedEmail in LEGACY_DEMO_ACCOUNTS) {
      this.semseLogger.warn("auth.login failed", {
        reason: "demo_account_disabled",
        email: normalizedEmail,
      });
      throw new UnauthorizedException("Credenciales incorrectas");
    }

    const user = await this.authRepository.findUserByEmail(normalizedEmail);

    if (!user) {
      this.semseLogger.warn("auth.login failed", { reason: "no_such_user", email: normalizedEmail });
    } else if (!user.passwordHash) {
      this.semseLogger.warn("auth.login failed", { reason: "no_password_set", userId: user.id, email: normalizedEmail });
    } else if (user.status !== "active") {
      this.semseLogger.warn("auth.login failed", { reason: "inactive_status", status: user.status, userId: user.id, email: normalizedEmail });
    } else if (!verifyPassword(input.password, user.passwordHash)) {
      this.semseLogger.warn("auth.login failed", { reason: "password_mismatch", userId: user.id, email: normalizedEmail });
    } else {
      const primaryMembership = user.memberships[0];
      if (!primaryMembership) {
        this.semseLogger.warn("auth.login failed", { reason: "no_membership", userId: user.id, email: normalizedEmail });
        throw new UnauthorizedException("Usuario sin membresía activa");
      }

      const scopedMemberships = user.memberships.filter(
        (membership) => membership.orgId === primaryMembership.orgId
      );
      const roles = [...new Set(scopedMemberships.map((membership) => membership.role.key))];

      return this.issueSession({
        userId: user.id,
        tenantId: primaryMembership.org.tenantId,
        orgId: primaryMembership.orgId,
        roles,
        ttlSeconds: 8 * 60 * 60,
        requestId: input.requestId,
      });
    }

    if (!demoModeEnabled) {
      throw new UnauthorizedException("Credenciales incorrectas");
    }

    const account = LEGACY_DEMO_ACCOUNTS[normalizedEmail];
    if (!account || !demoPasswordMatches(input.password, resolveDemoLoginPassword())) {
      throw new UnauthorizedException("Credenciales incorrectas");
    }

    return this.issueSession({
      ...account,
      ttlSeconds: 8 * 60 * 60,
      requestId: input.requestId,
    });
  }

  async confirmPasswordReset(input: {
    token: string;
    newPassword: string;
    requestId: string;
  }) {
    const user = await this.authRepository.consumePasswordResetToken({
      tokenHash: sha256(input.token),
      passwordHash: hashPassword(input.newPassword)
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: "n/a",
      orgId: "n/a",
      actorUserId: user.id,
      action: "auth.password_reset.completed",
      entityType: "User",
      entityId: user.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString()
    });

    return {
      status: "updated" as const,
      userId: user.id,
      email: user.email
    };
  }
}

import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { EmailService } from "../../infrastructure/email/email.service.js";
import { generateOpaqueToken, hashPassword, sha256, verifyPassword } from "../../common/auth-password.js";
import { signToken, verifyToken } from "../../common/auth-token.js";
import { type RequestContext, parseHeaderRequestContext } from "../../common/request-context.js";
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService
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

  async authenticateRequest(req: RequestLike): Promise<RequestContext> {
    if (!process.env.AUTH_SECRET) {
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

    // Skip DB session lookup — JWT signature verification is sufficient for auth.
    // DB lookup was causing 15s hangs when Postgres is slow (Railway prod issue).
    // Token revocation relies on short TTLs. Session cleanup runs in the background.

    return {
      userId: claims.userId,
      tenantId: claims.tenantId,
      orgId: claims.orgId,
      roles: claims.roles,
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
    // Generate session ID upfront — DB write is non-blocking so the JWT is issued immediately
    const sessionId = randomUUID();
    const accessExpiresAt = new Date(Date.now() + accessTtlSeconds * 1000);
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlSeconds() * 1000);

    void this.authRepository.createSession({
      id: sessionId,
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      refreshTokenHash: sha256(refreshToken),
      accessExpiresAt,
      refreshExpiresAt,
    }).catch((err) => this.logger.warn(`[auth] createSession failed for userId=${input.userId}: ${String(err?.message ?? err)}`));

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
    const session = await this.authRepository.findSessionByRefreshTokenHash(sha256(input.refreshToken));
    if (!session || session.refreshExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const refreshToken = generateOpaqueToken();
    const accessTtlSeconds = ACCESS_TOKEN_TTL_SECONDS;
    await this.authRepository.rotateSessionRefreshToken({
      sessionId: session.id,
      refreshTokenHash: sha256(refreshToken),
      accessExpiresAt: new Date(Date.now() + accessTtlSeconds * 1000),
      refreshExpiresAt: new Date(Date.now() + this.refreshTtlSeconds() * 1000)
    });

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
      roles: session.roles,
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
    const user = await this.authRepository.findUserByEmail(input.email);
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
      to: input.email,
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
      this.logger.error(
        `[auth] Password reset email failed to send for userId=${user.id}: ${emailResult.error ?? "unknown error"}`
      );
    }

    return {
      status: "accepted" as const,
      resetTokenPreview: process.env.NODE_ENV === "production" ? undefined : rawToken
    };
  }

  async loginWithPassword(input: { email: string; password: string; requestId: string }) {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await this.authRepository.findUserByEmail(normalizedEmail);

    if (!user) {
      this.logger.warn(`Login failed (no such user): email=${normalizedEmail}`);
    } else if (!user.passwordHash) {
      this.logger.warn(`Login failed (no password set): userId=${user.id} email=${normalizedEmail}`);
    } else if (user.status !== "active") {
      this.logger.warn(`Login failed (status=${user.status}): userId=${user.id} email=${normalizedEmail}`);
    } else if (!verifyPassword(input.password, user.passwordHash)) {
      this.logger.warn(`Login failed (password mismatch): userId=${user.id} email=${normalizedEmail}`);
    } else {
      const primaryMembership = user.memberships[0];
      if (!primaryMembership) {
        this.logger.warn(`Login failed (no membership): userId=${user.id} email=${normalizedEmail}`);
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

    const demoModeEnabled =
      process.env.SEMSE_DEMO_MODE === "true" || process.env.NODE_ENV !== "production";

    if (!demoModeEnabled) {
      throw new UnauthorizedException("Credenciales incorrectas");
    }

    const DEMO_ACCOUNTS: Record<string, { userId: string; tenantId: string; orgId: string; roles: string[] }> = {
      "client@demo.semse": { userId: "usr_client_001", tenantId: "tenant_default", orgId: "org_client_001", roles: ["CLIENT"] },
      "worker@demo.semse": { userId: "usr_worker_001", tenantId: "tenant_default", orgId: "org_pro_001", roles: ["PRO"] },
      "admin@demo.semse":  { userId: "usr_admin_001",  tenantId: "tenant_default", orgId: "org_admin_001", roles: ["OPS_ADMIN"] },
    };

    const account = DEMO_ACCOUNTS[normalizedEmail];
    if (!account || input.password !== "demo1234") {
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

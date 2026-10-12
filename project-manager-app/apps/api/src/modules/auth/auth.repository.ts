import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

const ACTIVE_RESET_STATUS = "ACTIVE";
const CONSUMED_RESET_STATUS = "CONSUMED";
const ACTIVE_SESSION_STATUS = "ACTIVE";
const REVOKED_SESSION_STATUS = "REVOKED";

type AuthTransactionClient = Pick<PrismaService, "passwordResetToken" | "user" | "authSession">;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get client(): PrismaService {
    return this.prisma;
  }

  createSession(input: {
    id?: string;
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    refreshTokenHash: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
  }) {
    return this.client.authSession.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        roles: input.roles,
        refreshTokenHash: input.refreshTokenHash,
        accessExpiresAt: input.accessExpiresAt,
        refreshExpiresAt: input.refreshExpiresAt,
        status: ACTIVE_SESSION_STATUS
      }
    });
  }

  findActiveSessionById(sessionId: string) {
    return this.client.authSession.findFirst({
      where: {
        id: sessionId,
        status: ACTIVE_SESSION_STATUS,
        revokedAt: null
      }
    });
  }

  /**
   * Resolve durable session state AND the current org roles.
   * AuthSession has no Prisma relation to User, so read the linked rows explicitly.
   * This method never creates identity or membership records.
   */
  async findActiveSessionAuthorization(sessionId: string) {
    const session = await this.findActiveSessionById(sessionId);
    if (!session) return null;

    const [user, memberships] = await Promise.all([
      this.client.user.findUnique({
        where: { id: session.userId },
        select: { status: true }
      }),
      this.client.membership.findMany({
        where: {
          userId: session.userId,
          orgId: session.orgId,
          status: "ACTIVE",
          org: { tenantId: session.tenantId }
        },
        select: { role: { select: { key: true } } }
      })
    ]);

    return {
      session,
      userStatus: user?.status ?? null,
      activeRoles: [...new Set(memberships.map((membership) => membership.role.key))]
    };
  }

  findSessionByRefreshTokenHash(refreshTokenHash: string) {
    return this.client.authSession.findFirst({
      where: {
        refreshTokenHash,
        status: ACTIVE_SESSION_STATUS,
        revokedAt: null
      }
    });
  }

  /**
   * Compare-and-swap rotation closes parallel refresh and logout races.
   * A stale token may NOT overwrite the new one or resurrect a revoked session.
   */
  async rotateSessionRefreshToken(input: {
    sessionId: string;
    previousRefreshTokenHash: string;
    refreshTokenHash: string;
    roles: string[];
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
  }) {
    return this.client.authSession.updateMany({
      where: {
        id: input.sessionId,
        refreshTokenHash: input.previousRefreshTokenHash,
        status: ACTIVE_SESSION_STATUS,
        revokedAt: null,
        refreshExpiresAt: { gt: new Date() }
      },
      data: {
        refreshTokenHash: input.refreshTokenHash,
        roles: input.roles,
        accessExpiresAt: input.accessExpiresAt,
        refreshExpiresAt: input.refreshExpiresAt,
        lastUsedAt: new Date()
      }
    });
  }

  async revokeSession(sessionId: string) {
    await this.client.authSession.updateMany({
      where: {
        id: sessionId,
        status: ACTIVE_SESSION_STATUS,
        revokedAt: null
      },
      data: {
        status: REVOKED_SESSION_STATUS,
        revokedAt: new Date()
      }
    });
  }

  async revokeUserSessions(sessionId: string, userId: string) {
    await this.client.authSession.updateMany({
      where: {
        id: { not: sessionId },
        userId,
        status: ACTIVE_SESSION_STATUS,
        revokedAt: null
      },
      data: {
        status: REVOKED_SESSION_STATUS,
        revokedAt: new Date()
      }
    });
  }

  findUserCredentialById(userId: string) {
    return this.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true
      }
    });
  }

  async changePasswordAndRevokeOtherSessions(input: {
    userId: string;
    currentSessionId: string;
    expectedPasswordHash: string;
    passwordHash: string;
  }): Promise<{ revokedOtherSessions: number }> {
    return this.client.$transaction(async (tx) => {
      const authTx = tx as AuthTransactionClient;

      const updated = await authTx.user.updateMany({
        where: {
          id: input.userId,
          passwordHash: input.expectedPasswordHash
        },
        data: { passwordHash: input.passwordHash }
      });
      if (updated.count !== 1) {
        throw new UnauthorizedException("Current password is no longer valid");
      }

      const revoked = await authTx.authSession.updateMany({
        where: {
          userId: input.userId,
          id: { not: input.currentSessionId },
          status: ACTIVE_SESSION_STATUS,
          revokedAt: null
        },
        data: {
          status: REVOKED_SESSION_STATUS,
          revokedAt: new Date()
        }
      });

      return { revokedOtherSessions: revoked.count };
    });
  }

  findUserByEmail(email: string) {
    return this.client.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        memberships: {
          where: {
            status: "ACTIVE"
          },
          select: {
            orgId: true,
            role: {
              select: {
                key: true
              }
            },
            org: {
              select: {
                tenantId: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
  }

  createPasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.client.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        status: ACTIVE_RESET_STATUS
      }
    });
  }

  async createUserWithOrg(input: {
    email: string;
    passwordHash: string;
    name: string;
    roleKey: "CLIENT" | "PRO";
    tenantId: string;
  }): Promise<{ userId: string; orgId: string; tenantId: string; roles: string[] }> {
    return this.client.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
      if (existing) throw new ConflictException("El email ya está registrado");

      const role = await tx.role.findUnique({ where: { key: input.roleKey } });
      if (!role) throw new InternalServerErrorException(`Rol '${input.roleKey}' no encontrado — ejecuta el seed primero`);

      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          status: "active",
          verificationStatus: "unverified",
        },
      });

      const org = await tx.org.create({
        data: {
          tenantId: input.tenantId,
          type: input.roleKey,
          name: input.name,
        },
      });

      await tx.membership.create({
        data: { userId: user.id, orgId: org.id, roleId: role.id },
      });

      await tx.userProfile.create({
        data: { userId: user.id, displayName: input.name },
      });

      return { userId: user.id, orgId: org.id, tenantId: input.tenantId, roles: [input.roleKey] };
    });
  }

  async consumePasswordResetToken(input: {
    tokenHash: string;
    passwordHash: string;
  }) {
    return this.client.$transaction(async (tx) => {
      const authTx = tx as AuthTransactionClient;

      const token = await authTx.passwordResetToken.findFirst({
        where: {
          tokenHash: input.tokenHash,
          status: ACTIVE_RESET_STATUS,
          consumedAt: null,
          expiresAt: { gt: new Date() }
        }
      });

      if (!token) {
        throw new UnauthorizedException("Invalid or expired password reset token");
      }

      await authTx.passwordResetToken.update({
        where: { id: token.id },
        data: {
          status: CONSUMED_RESET_STATUS,
          consumedAt: new Date()
        }
      });

      const user = await authTx.user.update({
        where: { id: token.userId },
        data: { passwordHash: input.passwordHash },
        select: {
          id: true,
          email: true
        }
      });

      await authTx.authSession.updateMany({
        where: {
          userId: token.userId,
          status: ACTIVE_SESSION_STATUS,
          revokedAt: null
        },
        data: {
          status: REVOKED_SESSION_STATUS,
          revokedAt: new Date()
        }
      });

      return user;
    });
  }
}

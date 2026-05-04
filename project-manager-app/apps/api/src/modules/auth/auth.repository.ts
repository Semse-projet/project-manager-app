import { Injectable, UnauthorizedException } from "@nestjs/common";
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

  findSessionByRefreshTokenHash(refreshTokenHash: string) {
    return this.client.authSession.findFirst({
      where: {
        refreshTokenHash,
        status: ACTIVE_SESSION_STATUS,
        revokedAt: null
      }
    });
  }

  async rotateSessionRefreshToken(input: {
    sessionId: string;
    refreshTokenHash: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
  }) {
    return this.client.authSession.update({
      where: { id: input.sessionId },
      data: {
        refreshTokenHash: input.refreshTokenHash,
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

  findUserByEmail(email: string) {
    return this.client.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        memberships: {
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

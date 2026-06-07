import { Injectable, NotFoundException } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type StoredUser = {
  id: string;
  email: string;
  phone: string | null;
  status: string;
  verificationStatus: string;
  trustScore: { toNumber(): number } | number;
  riskLevel: string;
  flags: string[];
  createdAt: Date;
  updatedAt: Date;
};

type StoredUserProfile = {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  trades: string[];
  availability: boolean;
  assistantTone: string | null;
  assistantLanguage: string | null;
  assistantVerbosity: string | null;
  unifiedMode: boolean;
  expertMode: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type StoredMembership = {
  userId: string;
  orgId: string;
  roleId: string;
  createdAt: Date;
  org: {
    id: string;
    name: string;
    type: string;
  };
  role: {
    id: string;
    key: string;
    name: string;
  };
};

export type UserRecord = {
  id: string;
  email: string;
  phone?: string;
  status: string;
  verificationStatus: string;
  trustScore: number;
  riskLevel: string;
  flags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type AssistantTone = "friendly" | "formal" | "technical" | "executive";
export type AssistantLanguage = "es" | "en";
export type AssistantVerbosity = "short" | "balanced" | "detailed";

export type UserProfileRecord = {
  userId: string;
  displayName?: string;
  bio?: string;
  location?: string;
  trades: string[];
  availability: boolean;
  assistantTone?: AssistantTone;
  assistantLanguage?: AssistantLanguage;
  assistantVerbosity?: AssistantVerbosity;
  unifiedMode: boolean;
  expertMode: boolean;
  updatedAt: Date;
};

export type UserMembershipRecord = {
  userId: string;
  orgId: string;
  roleId: string;
  org: {
    id: string;
    name: string;
    type: string;
  };
  role: {
    id: string;
    key: string;
    name: string;
  };
  createdAt: Date;
};

@Injectable()
export class UsersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async findUsersByTenant(input: {
    tenantId: string;
    orgId: string;
    userId: string;
  }): Promise<UserRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const users = (await this.prisma.user.findMany({
      where: {
        memberships: {
          some: {
            org: {
              tenantId: input.tenantId
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })) as StoredUser[];

    return users.map((user) => this.toUserRecord(user));
  }

  async findUserById(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetUserId: string;
  }): Promise<UserRecord> {
    await this.actorContextService.ensureActorContext(input);
    const user = (await this.prisma.user.findFirst({
      where: {
        id: input.targetUserId,
        memberships: {
          some: {
            org: {
              tenantId: input.tenantId
            }
          }
        }
      }
    })) as StoredUser | null;

    if (!user) {
      throw new NotFoundException(`User '${input.targetUserId}' not found`);
    }

    return this.toUserRecord(user);
  }

  async findMembershipsByUser(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetUserId: string;
  }): Promise<UserMembershipRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const memberships = (await this.prisma.membership.findMany({
      where: {
        userId: input.targetUserId,
        org: {
          tenantId: input.tenantId
        }
      },
      include: {
        org: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        role: {
          select: {
            id: true,
            key: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })) as StoredMembership[];

    return memberships.map((membership) => ({
      userId: membership.userId,
      orgId: membership.orgId,
      roleId: membership.roleId,
      org: membership.org,
      role: membership.role,
      createdAt: membership.createdAt
    }));
  }

  async verifyUser(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetUserId: string;
  }): Promise<UserRecord> {
    await this.actorContextService.ensureActorContext(input);

    await this.findUserById({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      targetUserId: input.targetUserId
    });

    const user = (await this.prisma.user.update({
      where: { id: input.targetUserId },
      data: {
        verificationStatus: "verified"
      }
    })) as StoredUser;

    return this.toUserRecord(user);
  }

  async updateUserStatus(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetUserId: string;
    status: string;
  }): Promise<UserRecord> {
    await this.actorContextService.ensureActorContext(input);

    await this.findUserById({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      targetUserId: input.targetUserId
    });

    const user = (await this.prisma.user.update({
      where: { id: input.targetUserId },
      data: {
        status: input.status
      }
    })) as StoredUser;

    return this.toUserRecord(user);
  }

  async findProfile(userId: string): Promise<UserProfileRecord | null> {
    const profile = (await this.prisma.userProfile.findUnique({
      where: { userId }
    })) as StoredUserProfile | null;

    return profile ? this.toProfileRecord(profile) : null;
  }

  async upsertProfile(
    userId: string,
    data: {
      displayName?: string; bio?: string; location?: string; trades?: string[]; availability?: boolean;
      assistantTone?: string; assistantLanguage?: string; assistantVerbosity?: string;
      unifiedMode?: boolean; expertMode?: boolean;
    }
  ): Promise<UserProfileRecord> {
    const profile = (await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: data.displayName ?? null,
        bio: data.bio ?? null,
        location: data.location ?? null,
        trades: data.trades ?? [],
        availability: data.availability ?? true,
        assistantTone: data.assistantTone ?? null,
        assistantLanguage: data.assistantLanguage ?? null,
        assistantVerbosity: data.assistantVerbosity ?? null,
        unifiedMode: data.unifiedMode ?? false,
        expertMode: data.expertMode ?? false,
      },
      update: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.trades !== undefined && { trades: data.trades }),
        ...(data.availability !== undefined && { availability: data.availability }),
        ...(data.assistantTone !== undefined && { assistantTone: data.assistantTone }),
        ...(data.assistantLanguage !== undefined && { assistantLanguage: data.assistantLanguage }),
        ...(data.assistantVerbosity !== undefined && { assistantVerbosity: data.assistantVerbosity }),
        ...(data.unifiedMode !== undefined && { unifiedMode: data.unifiedMode }),
        ...(data.expertMode !== undefined && { expertMode: data.expertMode }),
      }
    })) as StoredUserProfile;

    return this.toProfileRecord(profile);
  }

  private toProfileRecord(profile: StoredUserProfile): UserProfileRecord {
    return {
      userId: profile.userId,
      displayName: profile.displayName ?? undefined,
      bio: profile.bio ?? undefined,
      location: profile.location ?? undefined,
      trades: profile.trades,
      availability: profile.availability,
      assistantTone: (profile.assistantTone as AssistantTone | undefined) ?? undefined,
      assistantLanguage: (profile.assistantLanguage as AssistantLanguage | undefined) ?? undefined,
      assistantVerbosity: (profile.assistantVerbosity as AssistantVerbosity | undefined) ?? undefined,
      unifiedMode: profile.unifiedMode,
      expertMode: profile.expertMode,
      updatedAt: profile.updatedAt
    };
  }

  private toUserRecord(user: StoredUser): UserRecord {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone ?? undefined,
      status: user.status,
      verificationStatus: user.verificationStatus,
      trustScore: Number(user.trustScore),
      riskLevel: user.riskLevel,
      flags: user.flags,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

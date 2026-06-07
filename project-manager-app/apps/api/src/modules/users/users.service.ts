import { ForbiddenException, Inject, Injectable, Optional } from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { DomainEventBus } from "../domain-events/domain-event-bus.service.js";
import {
  canReadUser,
  canReadUserMemberships,
  canUpdateUserStatus,
  canVerifyUser,
  type UserActor
} from "./users.policy.js";
import {
  type UserMembershipRecord,
  type UserProfileRecord,
  type UserRecord,
  UsersRepository
} from "./users.repository.js";

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly domainEventBus: DomainEventBus,
    @Optional() @Inject(OPERATIONAL_CONTEXT_SERVICE)
    private readonly operationalContext?: OperationalContextService,
  ) {}

  async listUsers(actor: UserActor): Promise<UserRecord[]> {
    return this.usersRepository.findUsersByTenant(actor);
  }

  async getUser(actor: UserActor, userId: string): Promise<UserRecord> {
    if (!canReadUser(actor, userId)) {
      throw new ForbiddenException("Cannot read this user");
    }

    return this.usersRepository.findUserById({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      targetUserId: userId
    });
  }

  async listMemberships(actor: UserActor, userId: string): Promise<UserMembershipRecord[]> {
    if (!canReadUserMemberships(actor, userId)) {
      throw new ForbiddenException("Cannot read memberships for this user");
    }

    return this.usersRepository.findMembershipsByUser({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      targetUserId: userId
    });
  }

  async verifyUser(input: UserActor & {
    targetUserId: string;
    verificationType: "email" | "phone" | "id_document" | "background_check";
    requestId: string;
  }): Promise<UserRecord> {
    if (!canVerifyUser(input)) {
      throw new ForbiddenException("Cannot verify users");
    }

    const user = await this.usersRepository.verifyUser({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      targetUserId: input.targetUserId
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "user.verify",
      entityType: "User",
      entityId: user.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        verificationStatus: user.verificationStatus,
        verificationType: input.verificationType
      }
    });

    await this.domainEventBus.emit({
      type: "user.verified",
      meta: {
        tenantId: input.tenantId,
        correlationId: `user:${user.id}:verified`,
        actorId: input.userId,
        actorType: "user",
        occurredAt: new Date().toISOString(),
        version: 1
      },
      payload: {
        userId: user.id,
        verificationType: input.verificationType,
        verifiedAt: new Date().toISOString()
      },
      triggers: ["trust-match", "notification", "audit"]
    }, {
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      requestId: input.requestId
    });

    return user;
  }

  async getMyProfile(actor: UserActor): Promise<UserProfileRecord> {
    const profile = await this.usersRepository.findProfile(actor.userId);
    return profile ?? {
      userId: actor.userId,
      trades: [],
      availability: true,
      unifiedMode: false,
      expertMode: false,
      updatedAt: new Date()
    };
  }

  async updateMyProfile(input: UserActor & {
    data: {
      displayName?: string; bio?: string; location?: string; trades?: string[]; availability?: boolean;
      assistantTone?: string; assistantLanguage?: string; assistantVerbosity?: string;
      unifiedMode?: boolean; expertMode?: boolean;
    };
    requestId: string;
  }): Promise<UserProfileRecord> {
    const profile = await this.usersRepository.upsertProfile(input.userId, input.data);

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "user.profile.update",
      entityType: "UserProfile",
      entityId: input.userId,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: input.data
    });

    this.operationalContext?.invalidateScope({
      tenantId: input.tenantId,
      userId: input.userId,
      source: "user.profile.update",
      reason: "user profile updated",
    });

    return profile;
  }

  async updateUserStatus(input: UserActor & {
    targetUserId: string;
    status: "active" | "pending" | "suspended";
    requestId: string;
  }): Promise<UserRecord> {
    if (!canUpdateUserStatus(input)) {
      throw new ForbiddenException("Cannot update user status");
    }

    const current = await this.usersRepository.findUserById({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      targetUserId: input.targetUserId
    });

    if (current.status === input.status) {
      return current;
    }

    const user = await this.usersRepository.updateUserStatus({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      targetUserId: input.targetUserId,
      status: input.status
    });

    await this.auditService.append({
      id: `aud_${Date.now()}`,
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.userId,
      action: "user.status.update",
      entityType: "User",
      entityId: user.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      beforeJson: {
        status: current.status
      },
      afterJson: {
        status: user.status
      }
    });

    this.operationalContext?.invalidateScope({
      tenantId: input.tenantId,
      source: "user.status.update",
      reason: `user status changed to ${user.status}`,
    });

    return user;
  }
}

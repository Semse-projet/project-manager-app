import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import type { OperationalContextService } from "../ai-models/context/operational-context.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "../ai-models/context/operational-context.token.js";
import { DomainEventBus } from "../domain-events/domain-event-bus.service.js";
import { WorkspaceMemoryRepository } from "../knowledge/workspace-memory.repository.js";
import { buildVerificationRequestWorkspaceMemoryRecord } from "../knowledge/workspace-memory.business-records.js";
import {
  canReadUser,
  canReadUserMemberships,
  canRequestVerification,
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
    private readonly workspaceMemory: WorkspaceMemoryRepository,
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

  /**
   * docs/specs/core/universal-identity-multi-role.spec.md §5 — read-only,
   * no audit_log per that contract. Reuses findMembershipsByUser scoped to
   * the actor's own tenant (same boundary as every other membership read);
   * capabilities are the actor's own Membership rows, one per org/role.
   */
  async getMyCapabilities(actor: UserActor): Promise<{ role: string; orgId: string; verifiedAt: string | null }[]> {
    const memberships = await this.usersRepository.findMembershipsByUser({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      targetUserId: actor.userId
    });

    // verifiedAt: no per-Membership verification timestamp exists yet in the
    // schema (only account-level User.verificationStatus) — null until that
    // gap is closed, not fabricated.
    return memberships.map((membership) => ({
      role: membership.role.key,
      orgId: membership.orgId,
      verifiedAt: null
    }));
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

  /**
   * Queues a verification request for OPS_ADMIN review — never executes the
   * verification itself (verifyUser above stays the only path that does
   * that). Closes AUDIT_REMEDIATION_PLAN.md 2.28: the worker-facing
   * "Verificar" buttons used to call verifyUser directly and always got a
   * 403, since only OPS_ADMIN can call it.
   */
  async requestVerification(input: UserActor & {
    targetUserId: string;
    verificationType: "email" | "phone" | "id_document" | "background_check";
  }): Promise<{ status: "pending"; verificationType: string; requestedAt: string }> {
    if (!canRequestVerification(input, input.targetUserId)) {
      throw new ForbiddenException("Cannot request verification for this user");
    }

    const requestedAt = new Date().toISOString();
    const record = buildVerificationRequestWorkspaceMemoryRecord({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.targetUserId,
      verificationType: input.verificationType,
      status: "pending",
      requestedAt
    });
    await this.workspaceMemory.append(record);

    return { status: "pending", verificationType: input.verificationType, requestedAt };
  }

  /** OPS_ADMIN-only queue of pending verification requests across the whole
   * tenant — every worker's own request lives in their own workspace, so this
   * needs the tenant-wide query, not the single-workspace one. */
  async listVerificationRequests(actor: UserActor): Promise<Array<{
    userId: string;
    verificationType: string;
    status: string;
    requestedAt?: string;
  }>> {
    if (!canVerifyUser(actor)) {
      throw new ForbiddenException("Cannot view verification requests");
    }

    const records = await this.workspaceMemory.queryAcrossTenant({
      tenantId: actor.tenantId,
      tags: ["verification", "request", "status:pending"],
      kinds: ["decision"]
    });

    return records.map((record) => {
      const body = record.body ? JSON.parse(record.body) as Record<string, unknown> : {};
      return {
        userId: record.sourceRef ?? record.createdBy,
        verificationType: String(body.verificationType ?? ""),
        status: String(body.status ?? "pending"),
        requestedAt: typeof body.requestedAt === "string" ? body.requestedAt : undefined
      };
    });
  }

  /** OPS_ADMIN reviews a pending request. Approving also runs the real
   * verifyUser() flow (same effect as clicking "Iniciar verificación" from
   * the unverified-workers list) — rejecting only marks the request closed,
   * it does not touch the user's verificationStatus. */
  async reviewVerificationRequest(input: UserActor & {
    targetUserId: string;
    verificationType: "email" | "phone" | "id_document" | "background_check";
    decision: "approved" | "rejected";
    requestId: string;
    note?: string;
  }): Promise<{ status: "approved" | "rejected" }> {
    if (!canVerifyUser(input)) {
      throw new ForbiddenException("Cannot review verification requests");
    }

    const existing = await this.workspaceMemory.query({
      tenantId: input.tenantId,
      workspaceId: `worker:${input.targetUserId}:verification`,
      kinds: ["decision"],
      tags: ["verification", "request", `type:${input.verificationType}`]
    });
    if (existing.length === 0) {
      throw new NotFoundException("No verification request found for this user/type");
    }

    const requestedAt = existing[0].body
      ? (JSON.parse(existing[0].body) as { requestedAt?: string }).requestedAt
      : undefined;

    const record = buildVerificationRequestWorkspaceMemoryRecord({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.targetUserId,
      verificationType: input.verificationType,
      status: input.decision,
      requestedAt: requestedAt ?? new Date().toISOString(),
      reviewedBy: input.userId,
      reviewedAt: new Date().toISOString(),
      reviewNote: input.note
    });
    await this.workspaceMemory.append(record);

    if (input.decision === "approved") {
      await this.verifyUser({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        roles: input.roles,
        targetUserId: input.targetUserId,
        verificationType: input.verificationType,
        requestId: input.requestId
      });
    }

    return { status: input.decision };
  }

  async getMyProfile(actor: UserActor): Promise<UserProfileRecord> {
    const profile = await this.usersRepository.findProfile(actor.userId);
    return profile ?? {
      userId: actor.userId,
      trades: [],
      availability: true,
      unifiedMode: false,
      expertMode: false,
      proximityCheckInMode: "ask",
      updatedAt: new Date()
    };
  }

  async updateMyProfile(input: UserActor & {
    data: {
      displayName?: string; bio?: string; location?: string; trades?: string[]; availability?: boolean;
      assistantTone?: string; assistantLanguage?: string; assistantVerbosity?: string;
      unifiedMode?: boolean; expertMode?: boolean; proximityCheckInMode?: "ask" | "auto" | "off";
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

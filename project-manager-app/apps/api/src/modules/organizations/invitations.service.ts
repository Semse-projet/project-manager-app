import crypto from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { hasPermission } from "../../common/rbac.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/**
 * BO-01 — invitaciones personales a una organización.
 * Spec: docs/specs/core/org-invitations.spec.md
 */

export const INVITABLE_ROLES = ["WORKER"] as const;
const DEFAULT_EXPIRY_DAYS = 7;

export type InvitationActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type InvitationSummary = {
  invitationId: string;
  status: string;
  roleKey: string;
  recipientMasked: string;
  expiresAt: Date;
  lastSentAt: Date | null;
  createdAt: Date;
};

export function isOrgInvitationsEnabled(): boolean {
  return process.env.SEMSE_ORG_INVITATIONS_ENABLED === "true";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashContact(email: string): string {
  const key = process.env.SEMSE_INVITATION_HASH_KEY ?? process.env.AUTH_SECRET ?? "semse-invitation-dev-key";
  return crypto.createHmac("sha256", key).update(email).digest("hex");
}

function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function expiryFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertEnabled(): void {
    if (!isOrgInvitationsEnabled()) {
      throw new NotFoundException();
    }
  }

  /** Roles efectivos del actor en la Org objetivo (ACTIVE, mismo tenant) o 404/403. */
  private async requireOrgPermission(actor: InvitationActor, orgId: string, permission: string): Promise<void> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: actor.userId, orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } },
      include: { role: true }
    });
    if (memberships.length === 0) {
      throw new NotFoundException();
    }
    const roles = memberships.map((membership) => membership.role.key);
    if (!hasPermission(roles, permission)) {
      throw new ForbiddenException();
    }
  }

  async create(
    actor: InvitationActor,
    orgId: string,
    input: { email: string; role: string; expiresInDays?: number }
  ): Promise<InvitationSummary & { token: string | null }> {
    this.assertEnabled();
    await this.requireOrgPermission(actor, orgId, "org:members:invite");

    if (!(INVITABLE_ROLES as readonly string[]).includes(input.role)) {
      throw new UnprocessableEntityException("Rol no invitable");
    }

    const email = normalizeEmail(input.email);
    const contactHash = hashContact(email);
    const now = new Date();

    const existing = await this.prisma.orgInvitation.findFirst({
      where: { tenantId: actor.tenantId, orgId, contactHash, status: "PENDING", expiresAt: { gt: now } }
    });
    if (existing) {
      // Idempotente: el token original no es recuperable; para uno nuevo, reenviar.
      return { ...this.toSummary(existing), token: null };
    }

    const token = newToken();
    const created = await this.prisma.orgInvitation.create({
      data: {
        tenantId: actor.tenantId,
        orgId,
        inviterUserId: actor.userId,
        contactEmail: email,
        contactHash,
        roleKey: input.role,
        tokenHash: hashToken(token),
        expiresAt: expiryFromNow(input.expiresInDays ?? DEFAULT_EXPIRY_DAYS),
        lastSentAt: now
      }
    });
    return { ...this.toSummary(created), token: `${created.id}.${token}` };
  }

  async list(actor: InvitationActor, orgId: string, status?: string): Promise<InvitationSummary[]> {
    this.assertEnabled();
    await this.requireOrgPermission(actor, orgId, "org:invitations:read");
    const rows = await this.prisma.orgInvitation.findMany({
      where: { tenantId: actor.tenantId, orgId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return rows.map((row) => this.toSummary(row));
  }

  async cancel(actor: InvitationActor, orgId: string, invitationId: string, reason: string): Promise<{ status: string }> {
    this.assertEnabled();
    await this.requireOrgPermission(actor, orgId, "org:invitations:cancel");
    const result = await this.prisma.orgInvitation.updateMany({
      where: { id: invitationId, tenantId: actor.tenantId, orgId, status: "PENDING" },
      data: { status: "CANCELED", canceledAt: new Date(), canceledByUserId: actor.userId, cancelReason: reason }
    });
    if (result.count === 0) {
      await this.throwNotPendingOrMissing(actor.tenantId, orgId, invitationId);
    }
    return { status: "CANCELED" };
  }

  async resend(actor: InvitationActor, orgId: string, invitationId: string): Promise<InvitationSummary & { token: string }> {
    this.assertEnabled();
    await this.requireOrgPermission(actor, orgId, "org:members:invite");
    const token = newToken();
    const now = new Date();
    const result = await this.prisma.orgInvitation.updateMany({
      where: { id: invitationId, tenantId: actor.tenantId, orgId, status: "PENDING" },
      data: { tokenHash: hashToken(token), expiresAt: expiryFromNow(DEFAULT_EXPIRY_DAYS), lastSentAt: now }
    });
    if (result.count === 0) {
      await this.throwNotPendingOrMissing(actor.tenantId, orgId, invitationId);
    }
    const row = await this.prisma.orgInvitation.findFirst({ where: { id: invitationId, tenantId: actor.tenantId, orgId } });
    if (!row) throw new NotFoundException();
    return { ...this.toSummary(row), token: `${row.id}.${token}` };
  }

  /** Vista previa pública: no consume el token ni revela si el destinatario tiene cuenta. */
  async preview(token: string): Promise<{ companyName: string; roleKey: string; expiresAt: Date; recipientMasked: string }> {
    this.assertEnabled();
    const invitation = await this.findByToken(token);
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException();
    }
    const org = await this.prisma.org.findFirst({ where: { id: invitation.orgId, tenantId: invitation.tenantId } });
    if (!org) throw new NotFoundException();
    return {
      companyName: org.name,
      roleKey: invitation.roleKey,
      expiresAt: invitation.expiresAt,
      recipientMasked: maskEmail(invitation.contactEmail)
    };
  }

  async accept(
    actor: { userId: string },
    input: { token: string; requestId: string }
  ): Promise<{ membership: { orgId: string; role: string; status: "ACTIVE" }; next: "ONBOARDING" }> {
    this.assertEnabled();
    const invitation = await this.findByToken(input.token);
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId }, select: { id: true, email: true } });
    if (!invitation || !user || normalizeEmail(user.email) !== invitation.contactEmail) {
      throw new NotFoundException();
    }
    const done = { membership: { orgId: invitation.orgId, role: invitation.roleKey, status: "ACTIVE" as const }, next: "ONBOARDING" as const };

    if (invitation.status === "ACCEPTED") {
      if (invitation.acceptedByUserId === user.id) return done;
      throw new GoneException();
    }
    if (invitation.status !== "PENDING" || invitation.expiresAt.getTime() <= Date.now()) {
      throw new GoneException();
    }

    const role = await this.prisma.role.findUnique({ where: { key: invitation.roleKey } });
    if (!role) throw new UnprocessableEntityException("Rol no disponible");

    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.orgInvitation.updateMany({
        where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "ACCEPTED", acceptedByUserId: user.id, acceptedAt: new Date() }
      });
      if (claimed.count === 0) return "LOST_RACE" as const;

      const existing = await tx.membership.findMany({ where: { userId: user.id, orgId: invitation.orgId } });
      if (existing.some((m) => m.status !== "ACTIVE")) {
        throw new ConflictException("La membresía requiere reinstalación autorizada");
      }
      if (!existing.some((m) => m.roleId === role.id)) {
        await tx.membership.create({ data: { userId: user.id, orgId: invitation.orgId, roleId: role.id, status: "ACTIVE" } });
      }
      return "ACCEPTED" as const;
    });

    if (outcome === "LOST_RACE") {
      const current = await this.prisma.orgInvitation.findUnique({ where: { id: invitation.id } });
      if (current?.status === "ACCEPTED" && current.acceptedByUserId === user.id) return done;
      throw new GoneException();
    }

    await this.audit.append({
      tenantId: invitation.tenantId,
      orgId: invitation.orgId,
      actorUserId: user.id,
      action: "membership.created",
      entityType: "Membership",
      entityId: `${user.id}:${invitation.orgId}`,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: { invitationId: invitation.id, role: invitation.roleKey }
    });
    return done;
  }

  private async findByToken(token: string) {
    const dot = token.indexOf(".");
    if (dot <= 0) return null;
    const id = token.slice(0, dot);
    const secret = token.slice(dot + 1);
    if (!secret) return null;
    const invitation = await this.prisma.orgInvitation.findUnique({ where: { tokenHash: hashToken(secret) } });
    return invitation && invitation.id === id ? invitation : null;
  }

  private async throwNotPendingOrMissing(tenantId: string, orgId: string, invitationId: string): Promise<never> {
    const row = await this.prisma.orgInvitation.findFirst({ where: { id: invitationId, tenantId, orgId } });
    if (!row) throw new NotFoundException();
    throw new ConflictException("La invitación ya no está pendiente");
  }

  private toSummary(row: {
    id: string;
    status: string;
    roleKey: string;
    contactEmail: string;
    expiresAt: Date;
    lastSentAt: Date | null;
    createdAt: Date;
  }): InvitationSummary {
    return {
      invitationId: row.id,
      status: row.status,
      roleKey: row.roleKey,
      recipientMasked: maskEmail(row.contactEmail),
      expiresAt: row.expiresAt,
      lastSentAt: row.lastSentAt,
      createdAt: row.createdAt
    };
  }
}

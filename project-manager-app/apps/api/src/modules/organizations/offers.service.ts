import { ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { hasPermission } from "../../common/rbac.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type OfferActor = { tenantId: string; orgId: string; userId: string; roles: string[] };
type Db = Prisma.TransactionClient;
const MANAGE = "org:offers:manage";
export function isBusinessOffersEnabled(): boolean { return process.env.SEMSE_BUSINESS_OFFERS_ENABLED === "true"; }

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private assertEnabled(): void { if (!isBusinessOffersEnabled()) throw new NotFoundException(); }

  private async transaction<T>(run: (tx: Db) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.prisma.$transaction(run, { isolationLevel: "Serializable" }); }
      catch (error) {
        if (attempt >= 2 || (error as { code?: string }).code !== "P2034") throw error;
      }
    }
  }

  private async requireManage(tx: Db, actor: OfferActor, orgId: string): Promise<void> {
    const memberships = await tx.membership.findMany({
      where: { userId: actor.userId, orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } }, include: { role: true }
    });
    if (!memberships.length) throw new NotFoundException();
    const roles = memberships.map(m => m.role.key);
    if (!hasPermission(roles, MANAGE)) throw new ForbiddenException();
    if (roles.includes("OPS_ADMIN")) return;
    const owner = await tx.orgOwnership.findFirst({ where: { orgId, tenantId: actor.tenantId, ownerUserId: actor.userId } });
    if (!owner) throw new ForbiddenException();
  }

  private async record(tx: Db, actor: Pick<OfferActor, "tenantId" | "orgId" | "userId">, action: string,
    entityType: string, entityId: string, requestId: string, afterJson: Record<string, unknown> = {}): Promise<void> {
    await this.audit.append({ tenantId: actor.tenantId, orgId: actor.orgId, actorUserId: actor.userId,
      action, entityType, entityId, requestId, timestamp: new Date().toISOString(), afterJson }, tx);
  }

  /** Explicit OPS verification, never automatic legacy backfill or ownership transfer. */
  async verifyOwner(actor: OfferActor, orgId: string, requestId: string,
    input: { ownerUserId: string; evidenceRef: string; reason: string; ticket: string }) {
    this.assertEnabled();
    return this.transaction(async tx => {
      const memberships = await tx.membership.findMany({ where: { userId: actor.userId, orgId,
        status: "ACTIVE", org: { tenantId: actor.tenantId } }, include: { role: true } });
      if (!memberships.length) throw new NotFoundException();
      if (!memberships.some(m => m.role.key === "OPS_ADMIN")) throw new ForbiddenException();
      const target = await tx.membership.findMany({ where: { userId: input.ownerUserId, orgId,
        status: "ACTIVE", org: { tenantId: actor.tenantId } }, include: { role: true } });
      if (!target.some(m => m.role.key === "CLIENT")) throw new UnprocessableEntityException("Owner must have an active CLIENT membership");
      if (await tx.orgOwnership.findFirst({ where: { orgId, tenantId: actor.tenantId } })) throw new ConflictException("Ownership already verified");
      await tx.orgOwnership.create({ data: { orgId, tenantId: actor.tenantId, ownerUserId: input.ownerUserId,
        verifiedByUserId: actor.userId, evidenceRef: input.evidenceRef, reason: input.reason, ticket: input.ticket } });
      await this.record(tx, { ...actor, orgId }, "organization.owner_verified", "Org", orgId, requestId,
        { ownerUserId: input.ownerUserId, ticket: input.ticket });
      return { orgId, ownerUserId: input.ownerUserId };
    });
  }

  async create(actor: OfferActor, orgId: string, requestId: string,
    input: { recipientUserId: string; positionTitle: string; startsAt?: Date; compensationNote?: string; expiresInDays?: number }) {
    this.assertEnabled();
    return this.transaction(async tx => {
      await this.requireManage(tx, actor, orgId);
      if (input.recipientUserId === actor.userId) throw new UnprocessableEntityException("No se puede ofertar a uno mismo");
      const recipient = await tx.membership.findMany({ where: { userId: input.recipientUserId, orgId,
        status: "ACTIVE", org: { tenantId: actor.tenantId } }, include: { role: true } });
      if (!recipient.some(m => m.role.key === "WORKER")) throw new UnprocessableEntityException("El destinatario debe ser un trabajador activo de la organización");
      if (await tx.businessOffer.findFirst({ where: { tenantId: actor.tenantId, orgId,
        recipientUserId: input.recipientUserId, status: "SENT", expiresAt: { gt: new Date() } } })) throw new ConflictException("Ya existe una oferta vigente para esta persona");
      const row = await tx.businessOffer.create({ data: { tenantId: actor.tenantId, orgId, issuedByUserId: actor.userId,
        recipientUserId: input.recipientUserId, positionTitle: input.positionTitle, classificationDeclared: "NOT_RECORDED",
        startsAt: input.startsAt ?? null, compensationNote: input.compensationNote ?? null,
        expiresAt: new Date(Date.now() + (input.expiresInDays ?? 7) * 86400000) } });
      await this.record(tx, { ...actor, orgId }, "business_offer.sent", "BusinessOffer", row.id, requestId, { recipientUserId: input.recipientUserId });
      return this.toView(row);
    });
  }

  async list(actor: OfferActor, orgId: string, status?: string) {
    this.assertEnabled();
    return this.transaction(async tx => {
      await this.requireManage(tx, actor, orgId);
      const rows = await tx.businessOffer.findMany({ where: { tenantId: actor.tenantId, orgId, ...(status ? { status } : {}) },
        include: { engagement: { select: { id: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
      return rows.map(row => ({ ...this.toView(row), engagementId: row.engagement?.id ?? null, engagementStatus: row.engagement?.status ?? null }));
    });
  }

  async revoke(actor: OfferActor, orgId: string, offerId: string, requestId: string) {
    this.assertEnabled();
    return this.transaction(async tx => {
      await this.requireManage(tx, actor, orgId);
      const result = await tx.businessOffer.updateMany({ where: { id: offerId, tenantId: actor.tenantId, orgId, status: "SENT" },
        data: { status: "REVOKED", revokedAt: new Date(), revokedByUserId: actor.userId } });
      if (!result.count) {
        if (!await tx.businessOffer.findFirst({ where: { id: offerId, tenantId: actor.tenantId, orgId } })) throw new NotFoundException();
        throw new ConflictException("La oferta ya no está pendiente de respuesta");
      }
      await this.record(tx, { ...actor, orgId }, "business_offer.revoked", "BusinessOffer", offerId, requestId);
      return { status: "REVOKED" };
    });
  }

  async listMine(user: { userId: string }) {
    this.assertEnabled();
    const rows = await this.prisma.businessOffer.findMany({ where: { recipientUserId: user.userId }, orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map(row => this.toView(row));
  }

  async respond(user: { userId: string }, offerId: string, decision: "ACCEPT" | "DECLINE", requestId: string) {
    this.assertEnabled();
    return this.transaction(async tx => {
      const offer = await tx.businessOffer.findFirst({ where: { id: offerId, recipientUserId: user.userId } });
      if (!offer) throw new NotFoundException();
      const status = decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
      if (offer.status === status) return { status };
      if (offer.status !== "SENT" || offer.expiresAt.getTime() <= Date.now()) throw new GoneException();
      const claimed = await tx.businessOffer.updateMany({ where: { id: offerId, recipientUserId: user.userId,
        tenantId: offer.tenantId, orgId: offer.orgId, status: "SENT", expiresAt: { gt: new Date() } }, data: { status, respondedAt: new Date() } });
      if (!claimed.count) {
        const current = await tx.businessOffer.findFirst({ where: { id: offerId, recipientUserId: user.userId } });
        if (current?.status === status) return { status };
        throw new GoneException();
      }
      if (status === "ACCEPTED") await tx.businessEngagement.create({ data: { tenantId: offer.tenantId, orgId: offer.orgId, userId: user.userId, offerId } });
      await this.record(tx, { tenantId: offer.tenantId, orgId: offer.orgId, userId: user.userId },
        "business_offer.responded", "BusinessOffer", offerId, requestId, { decision: status });
      return { status };
    });
  }

  async confirm(actor: OfferActor, orgId: string, offerId: string, requestId: string) {
    this.assertEnabled();
    return this.transaction(async tx => {
      await this.requireManage(tx, actor, orgId);
      const offer = await tx.businessOffer.findFirst({ where: { id: offerId, tenantId: actor.tenantId, orgId } });
      if (!offer) throw new NotFoundException();
      const now = new Date();
      const result = await tx.businessEngagement.updateMany({ where: { offerId, tenantId: actor.tenantId, orgId, status: "PENDING_CONFIRMATION" },
        data: { status: "ACTIVE", activatedByUserId: actor.userId, activatedAt: now, legalConfirmedAt: now } });
      if (!result.count) throw new ConflictException("No hay un engagement pendiente de confirmación para esta oferta");
      await this.record(tx, { ...actor, orgId }, "business_engagement.activated", "BusinessEngagement", offerId, requestId,
        { recipientUserId: offer.recipientUserId });
      return { status: "ACTIVE" };
    });
  }

  async endEngagement(actor: OfferActor, orgId: string, engagementId: string, reason: string, requestId: string) {
    this.assertEnabled();
    return this.transaction(async tx => {
      await this.requireManage(tx, actor, orgId);
      const result = await tx.businessEngagement.updateMany({ where: { id: engagementId, tenantId: actor.tenantId, orgId,
        status: { in: ["PENDING_CONFIRMATION", "ACTIVE"] } }, data: { status: "ENDED", endedAt: new Date(), endedByUserId: actor.userId, endedReason: reason } });
      if (!result.count) {
        if (!await tx.businessEngagement.findFirst({ where: { id: engagementId, tenantId: actor.tenantId, orgId } })) throw new NotFoundException();
        throw new ConflictException("El engagement ya terminó");
      }
      await this.record(tx, { ...actor, orgId }, "business_engagement.ended", "BusinessEngagement", engagementId, requestId);
      return { status: "ENDED" };
    });
  }

  private toView(row: { id: string; orgId: string; recipientUserId: string; positionTitle: string; startsAt: Date | null;
    compensationNote: string | null; status: string; expiresAt: Date; respondedAt: Date | null; createdAt: Date }) {
    return { offerId: row.id, orgId: row.orgId, recipientUserId: row.recipientUserId, positionTitle: row.positionTitle,
      startsAt: row.startsAt, compensationNote: row.compensationNote, status: row.status, expiresAt: row.expiresAt,
      respondedAt: row.respondedAt, createdAt: row.createdAt };
  }
}

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
 * BO-05 — ofertas internas y engagement empresa-profesional.
 * Spec: docs/specs/core/business-offers.spec.md
 *
 * Una oferta NO es un contrato legal ni concede permisos: aceptarla crea un
 * engagement PENDING_CONFIRMATION; solo la confirmación explícita del patrón
 * (con confirmación legal declarada) lo activa. Sin firma ni nómina.
 */

/** OPEN-03: la clasificación W-2/1099 no se pide ni se infiere; la columna se conserva sin uso. */
const CLASSIFICATION_NOT_RECORDED = "NOT_RECORDED";
const DEFAULT_EXPIRY_DAYS = 7;
const MANAGE = "org:offers:manage";

export type OfferActor = { tenantId: string; orgId: string; userId: string; roles: string[] };

export function isBusinessOffersEnabled(): boolean {
  return process.env.SEMSE_BUSINESS_OFFERS_ENABLED === "true";
}

function expiryFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

type OfferRow = {
  id: string;
  orgId: string;
  tenantId: string;
  recipientUserId: string;
  positionTitle: string;
  classificationDeclared: string;
  startsAt: Date | null;
  compensationNote: string | null;
  status: string;
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertEnabled(): void {
    if (!isBusinessOffersEnabled()) {
      throw new NotFoundException();
    }
  }

  private async requireManage(actor: OfferActor, orgId: string): Promise<void> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: actor.userId, orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } },
      include: { role: true }
    });
    if (memberships.length === 0) {
      throw new NotFoundException();
    }
    if (!hasPermission(memberships.map((m) => m.role.key), MANAGE)) {
      throw new ForbiddenException();
    }
  }

  private async record(
    tenantId: string,
    orgId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    requestId: string,
    afterJson: Record<string, unknown>
  ): Promise<void> {
    await this.audit.append({
      tenantId,
      orgId,
      actorUserId,
      action,
      entityType,
      entityId,
      requestId,
      timestamp: new Date().toISOString(),
      afterJson
    });
  }

  async create(
    actor: OfferActor,
    orgId: string,
    requestId: string,
    input: {
      recipientUserId: string;
      positionTitle: string;
      startsAt?: Date;
      compensationNote?: string;
      expiresInDays?: number;
    }
  ) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    if (input.recipientUserId === actor.userId) {
      throw new UnprocessableEntityException("No se puede ofertar a uno mismo");
    }
    // Conservador: solo a quien ya aceptó una invitación y es WORKER ACTIVE de esta Org.
    const recipientMemberships = await this.prisma.membership.findMany({
      where: { userId: input.recipientUserId, orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } },
      include: { role: true }
    });
    if (!recipientMemberships.some((m) => m.role.key === "WORKER")) {
      throw new UnprocessableEntityException("El destinatario debe ser un trabajador activo de la organización");
    }
    const open = await this.prisma.businessOffer.findFirst({
      where: {
        tenantId: actor.tenantId,
        orgId,
        recipientUserId: input.recipientUserId,
        status: "SENT",
        expiresAt: { gt: new Date() }
      }
    });
    if (open) {
      throw new ConflictException("Ya existe una oferta vigente para esta persona");
    }
    const offer = await this.prisma.businessOffer.create({
      data: {
        tenantId: actor.tenantId,
        orgId,
        issuedByUserId: actor.userId,
        recipientUserId: input.recipientUserId,
        positionTitle: input.positionTitle,
        classificationDeclared: CLASSIFICATION_NOT_RECORDED,
        startsAt: input.startsAt ?? null,
        compensationNote: input.compensationNote ?? null,
        expiresAt: expiryFromNow(input.expiresInDays ?? DEFAULT_EXPIRY_DAYS)
      }
    });
    await this.record(actor.tenantId, orgId, actor.userId, "business_offer.sent", "BusinessOffer", offer.id, requestId, {
      recipientUserId: input.recipientUserId
    });
    return this.toView(offer);
  }

  async list(actor: OfferActor, orgId: string, status?: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const rows = await this.prisma.businessOffer.findMany({
      where: { tenantId: actor.tenantId, orgId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return rows.map((row) => this.toView(row));
  }

  async revoke(actor: OfferActor, orgId: string, offerId: string, requestId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const result = await this.prisma.businessOffer.updateMany({
      where: { id: offerId, tenantId: actor.tenantId, orgId, status: "SENT" },
      data: { status: "REVOKED", revokedAt: new Date(), revokedByUserId: actor.userId }
    });
    if (result.count === 0) {
      const row = await this.prisma.businessOffer.findFirst({ where: { id: offerId, tenantId: actor.tenantId, orgId } });
      if (!row) throw new NotFoundException();
      throw new ConflictException("La oferta ya no está pendiente de respuesta");
    }
    await this.record(actor.tenantId, orgId, actor.userId, "business_offer.revoked", "BusinessOffer", offerId, requestId, {});
    return { status: "REVOKED" };
  }

  /** Ofertas dirigidas al usuario autenticado (nunca de terceros). */
  async listMine(user: { userId: string }) {
    this.assertEnabled();
    const rows = await this.prisma.businessOffer.findMany({
      where: { recipientUserId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return rows.map((row) => this.toView(row));
  }

  async respond(user: { userId: string }, offerId: string, decision: "ACCEPT" | "DECLINE", requestId: string) {
    this.assertEnabled();
    const offer = await this.prisma.businessOffer.findFirst({ where: { id: offerId, recipientUserId: user.userId } });
    if (!offer) {
      throw new NotFoundException();
    }
    const target = decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
    if (offer.status === target) {
      return { status: target };
    }
    if (offer.status !== "SENT" || offer.expiresAt.getTime() <= Date.now()) {
      throw new GoneException();
    }
    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.businessOffer.updateMany({
        where: { id: offer.id, status: "SENT", expiresAt: { gt: new Date() } },
        data: { status: target, respondedAt: new Date() }
      });
      if (claimed.count === 0) return "LOST_RACE" as const;
      if (target === "ACCEPTED") {
        await tx.businessEngagement.create({
          data: { tenantId: offer.tenantId, orgId: offer.orgId, userId: user.userId, offerId: offer.id }
        });
      }
      return "DONE" as const;
    });
    if (outcome === "LOST_RACE") {
      const current = await this.prisma.businessOffer.findFirst({ where: { id: offer.id } });
      if (current?.status === target) return { status: target };
      throw new GoneException();
    }
    await this.record(offer.tenantId, offer.orgId, user.userId, "business_offer.responded", "BusinessOffer", offer.id, requestId, {
      decision: target
    });
    return { status: target };
  }

  /** El patrón activa el engagement tras aceptar la persona y declarar la confirmación legal. */
  async confirm(actor: OfferActor, orgId: string, offerId: string, requestId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const offer = await this.prisma.businessOffer.findFirst({ where: { id: offerId, tenantId: actor.tenantId, orgId } });
    if (!offer) throw new NotFoundException();
    const now = new Date();
    const result = await this.prisma.businessEngagement.updateMany({
      where: { offerId, tenantId: actor.tenantId, orgId, status: "PENDING_CONFIRMATION" },
      data: { status: "ACTIVE", activatedByUserId: actor.userId, activatedAt: now, legalConfirmedAt: now }
    });
    if (result.count === 0) {
      throw new ConflictException("No hay un engagement pendiente de confirmación para esta oferta");
    }
    await this.record(actor.tenantId, orgId, actor.userId, "business_engagement.activated", "BusinessEngagement", offerId, requestId, {
      recipientUserId: offer.recipientUserId
    });
    return { status: "ACTIVE" };
  }

  async endEngagement(actor: OfferActor, orgId: string, engagementId: string, reason: string, requestId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const result = await this.prisma.businessEngagement.updateMany({
      where: { id: engagementId, tenantId: actor.tenantId, orgId, status: { in: ["PENDING_CONFIRMATION", "ACTIVE"] } },
      data: { status: "ENDED", endedAt: new Date(), endedByUserId: actor.userId, endedReason: reason }
    });
    if (result.count === 0) {
      const row = await this.prisma.businessEngagement.findFirst({ where: { id: engagementId, tenantId: actor.tenantId, orgId } });
      if (!row) throw new NotFoundException();
      throw new ConflictException("El engagement ya terminó");
    }
    await this.record(actor.tenantId, orgId, actor.userId, "business_engagement.ended", "BusinessEngagement", engagementId, requestId, {});
    return { status: "ENDED" };
  }

  private toView(row: OfferRow) {
    return {
      offerId: row.id,
      orgId: row.orgId,
      recipientUserId: row.recipientUserId,
      positionTitle: row.positionTitle,
      startsAt: row.startsAt,
      compensationNote: row.compensationNote,
      status: row.status,
      expiresAt: row.expiresAt,
      respondedAt: row.respondedAt,
      createdAt: row.createdAt
    };
  }
}

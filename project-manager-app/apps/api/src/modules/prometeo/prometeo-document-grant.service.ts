import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ResourceScopeResolver } from "../../common/resource-scope.resolver.js";
import { isOpsAdmin, sameOrg, type ScopeActor } from "../../common/resource-scope.js";

/**
 * C51/P0 S1: explicit, revocable cross-organization sharing.
 * The grant is document-specific; a projectId or legacy visibility label alone
 * can never establish access to another organization's content.
 *
 * All grant mutations write AuditLog in the SAME Postgres transaction.
 */
@Injectable()
export class PrometeoDocumentGrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ResourceScopeResolver,
  ) {}

  private async verify(actor: ScopeActor, documentId: string, recipientOrgId: string) {
    const doc = await this.prisma.prometeoDocument.findFirst({
      where: { id: documentId, tenantId: actor.tenantId },
      select: { id: true, tenantId: true, orgId: true, projectId: true },
    });
    if (!doc) throw new NotFoundException("Prometeo document not found");
    if (!isOpsAdmin(actor) && !sameOrg(actor.orgId, doc.orgId)) {
      throw new ForbiddenException("Only the owning organization can manage document shares");
    }
    if (!doc.projectId) throw new BadRequestException("Sharing requires a verified project");

    const project = await this.resolver.resolveProjectScope(actor.tenantId, doc.projectId);
    if (!project) throw new NotFoundException("Project not found");
    const participants = [project.clientOrgId, project.assignedProOrgId];
    // Historical project associations were not always verified. Fail closed.
    if (!participants.includes(doc.orgId)) {
      throw new ForbiddenException("Document owner is not part of its linked project");
    }
    if (!recipientOrgId || recipientOrgId === doc.orgId || !participants.includes(recipientOrgId)) {
      throw new ForbiddenException("Recipient is not another participant organization of the project");
    }
    return { doc, projectId: doc.projectId };
  }

  async grant(actor: ScopeActor, documentId: string, recipientOrgId: string, requestId: string) {
    const actorUserId = actor.userId;
    if (!actorUserId) throw new ForbiddenException("Authenticated actor required");
    const { doc, projectId } = await this.verify(actor, documentId, recipientOrgId);
    return this.prisma.$transaction(async (tx) => {
      const stillExists = await tx.prometeoDocument.findFirst({
        where: { id: doc.id, tenantId: actor.tenantId, orgId: doc.orgId, projectId },
        select: { id: true },
      });
      if (!stillExists) throw new NotFoundException("Prometeo document not found");

      const existing = await tx.prometeoDocumentGrant.findUnique({
        where: { documentId_recipientOrgId: { documentId: doc.id, recipientOrgId } },
      });
      if (existing && !existing.revokedAt) return existing; // idempotent, no duplicate audit

      const grant = existing
        ? await tx.prometeoDocumentGrant.update({
            where: { id: existing.id },
            data: { tenantId: actor.tenantId, projectId, grantedByUserId: actorUserId, revokedAt: null, revokedByUserId: null },
          })
        : await tx.prometeoDocumentGrant.create({
            data: { tenantId: actor.tenantId, documentId: doc.id, projectId, recipientOrgId, grantedByUserId: actorUserId },
          });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId,
          entityType: "PrometeoDocumentGrant",
          entityId: grant.id,
          action: "PROMETEO_DOCUMENT_SHARE_GRANTED",
          beforeJson: existing ? { revokedAt: existing.revokedAt?.toISOString() ?? null } : {},
          afterJson: { documentId: doc.id, projectId, recipientOrgId, requestId },
        },
      });
      return grant;
    });
  }

  async revoke(actor: ScopeActor, documentId: string, recipientOrgId: string, requestId: string) {
    const actorUserId = actor.userId;
    if (!actorUserId) throw new ForbiddenException("Authenticated actor required");
    const { doc, projectId } = await this.verify(actor, documentId, recipientOrgId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.prometeoDocumentGrant.findFirst({
        where: { documentId: doc.id, recipientOrgId, tenantId: actor.tenantId, projectId, revokedAt: null },
      });
      if (!existing) throw new NotFoundException("Active document grant not found");
      const updated = await tx.prometeoDocumentGrant.updateMany({
        where: { id: existing.id, tenantId: actor.tenantId, revokedAt: null },
        data: { revokedAt: new Date(), revokedByUserId: actorUserId },
      });
      if (updated.count !== 1) throw new NotFoundException("Active document grant not found");
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId,
          entityType: "PrometeoDocumentGrant",
          entityId: existing.id,
          action: "PROMETEO_DOCUMENT_SHARE_REVOKED",
          beforeJson: { documentId: doc.id, projectId, recipientOrgId, revokedAt: null },
          afterJson: { revokedByUserId: actorUserId, requestId },
        },
      });
      return { id: existing.id, documentId, recipientOrgId, revoked: true };
    });
  }
}

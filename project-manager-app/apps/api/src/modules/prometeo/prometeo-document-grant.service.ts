import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { ResourceScopeResolver } from "../../common/resource-scope.resolver.js";
import { isOpsAdmin, sameOrg, type ScopeActor } from "../../common/resource-scope.js";
import { isPrometeoDocumentSharingEnabled } from "./prometeo-document-sharing.flag.js";

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

  private async verifyOwner(actor: ScopeActor, documentId: string) {
    const doc = await this.prisma.prometeoDocument.findFirst({
      where: { id: documentId, tenantId: actor.tenantId },
      select: { id: true, tenantId: true, orgId: true, projectId: true },
    });
    if (!doc) throw new NotFoundException("Prometeo document not found");
    if (!isOpsAdmin(actor) && !sameOrg(actor.orgId, doc.orgId)) {
      throw new ForbiddenException("Only the owning organization can manage document shares");
    }
    return doc;
  }

  private async verify(actor: ScopeActor, documentId: string, recipientOrgId: string) {
    const doc = await this.verifyOwner(actor, documentId);
    if (!doc.projectId) throw new BadRequestException("Sharing requires a verified project");

    const project = await this.resolver.resolveProjectScope(actor.tenantId, doc.projectId, true);
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
    if (!isPrometeoDocumentSharingEnabled()) throw new ServiceUnavailableException("Document sharing is not activated");
    const actorUserId = actor.userId;
    if (!actorUserId) throw new ForbiddenException("Authenticated actor required");
    const { doc, projectId } = await this.verify(actor, documentId, recipientOrgId);
    // Retry unique/serialization races as full transactions, preserving atomic audit.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
      const stillExists = await tx.prometeoDocument.findFirst({
        where: { id: doc.id, tenantId: actor.tenantId, orgId: doc.orgId, projectId },
        select: { id: true },
      });
      if (!stillExists) throw new NotFoundException("Prometeo document not found");

      const existing = await tx.prometeoDocumentGrant.findUnique({
        where: { documentId_recipientOrgId: { documentId: doc.id, recipientOrgId } },
      });
      if (existing && !existing.revokedAt) {
        // A document can be reassociated with another project. Never report
        // success for an old grant whose project/tenant differs from this one.
        // The owner must explicitly revoke and grant under the new scope.
        if (existing.tenantId !== actor.tenantId || existing.projectId !== projectId) {
          throw new ConflictException("Stale document grant: revoke before sharing under another project");
        }
        return existing; // unchanged active grant is idempotent; no duplicate audit
      }

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
          action: "prometeo.document_share_granted",
          beforeJson: existing ? { revokedAt: existing.revokedAt?.toISOString() ?? null } : {},
          afterJson: { documentId: doc.id, projectId, recipientOrgId, requestId },
        },
      });
      return grant;
        }, { isolationLevel: "Serializable" });
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err
          ? (err as { code?: unknown }).code : undefined;
        if ((code === "P2002" || code === "P2034") && attempt < 2) continue;
        throw err;
      }
    }
    throw new Error("Document sharing retry limit exceeded");
  }

  async revoke(actor: ScopeActor, documentId: string, recipientOrgId: string, requestId: string) {
    const actorUserId = actor.userId;
    if (!actorUserId) throw new ForbiddenException("Authenticated actor required");
    // Revocation is always allowed for the owner even after reassignment or
    // removal of the former recipient; otherwise an old grant could resurrect.
    const doc = await this.verifyOwner(actor, documentId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.prometeoDocumentGrant.findFirst({
        where: { documentId: doc.id, recipientOrgId, tenantId: actor.tenantId, revokedAt: null },
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
          action: "prometeo.document_share_revoked",
          beforeJson: { documentId: doc.id, projectId: existing.projectId, recipientOrgId, revokedAt: null },
          afterJson: { revokedByUserId: actorUserId, requestId },
        },
      });
      return { id: existing.id, documentId, recipientOrgId, revoked: true };
    });
  }
}

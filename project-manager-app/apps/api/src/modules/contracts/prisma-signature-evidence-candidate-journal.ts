import { ConflictException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { PendingEvidenceJournal, PendingSignatureEvidence } from "./signature-evidence-capture.js";

/**
 * Write-only pending evidence journal, not a VerifiedContractExecution writer.
 * All owner scope comes from an authenticated provider adapter's canonical
 * context; there is no request-body API exposing this store.
 */
@Injectable()
export class PrismaSignatureEvidenceCandidateJournal implements PendingEvidenceJournal {
  constructor(private readonly prisma: PrismaService) {}

  async record(candidate: PendingSignatureEvidence): Promise<void> {
    const { tenantId, connectionId, providerId, contractId, externalRequestId,
      documentVersionSha256, signedPdfSha256, certificateSha256, auditLogSha256,
      signedPdfRef, certificateRef, auditLogRef } = candidate;
    if (candidate.status !== "PENDING_VERIFICATION" ||
        ![documentVersionSha256, signedPdfSha256, certificateSha256, auditLogSha256]
          .every(value => /^[a-f0-9]{64}$/.test(value)) ||
        ![tenantId, connectionId, providerId, contractId, externalRequestId].every(Boolean) ||
        !signedPdfRef || !certificateRef || !auditLogRef ||
        /^(?:https?:)?\/\//i.test(signedPdfRef) ||
        /^(?:https?:)?\/\//i.test(certificateRef) ||
        /^(?:https?:)?\/\//i.test(auditLogRef) ||
        new Set([signedPdfRef, certificateRef, auditLogRef]).size !== 3 ||
        candidate.signers.length !== 2) {
      throw new ConflictException("invalid or externally-addressed signature evidence candidate");
    }

    // An external ID from a caller must never make a new contract look signed.
    // Only a previously dispatched tenant/connection/contract envelope may
    // have evidence candidates, and only after outbound send was journaled.
    const matchingDispatch = await this.prisma.signatureDispatchOutbox.findFirst({
      where: { tenantId, connectionId, providerId, contractId, externalRequestId, status: "SENT" },
      select: { id: true },
    });
    if (!matchingDispatch) {
      throw new ConflictException("signature evidence has no scoped, sent provider request");
    }

    try {
      await this.prisma.contractSignatureEvidenceCandidate.create({
        data: {
          tenantId, connectionId, providerId, contractId, externalRequestId,
          documentVersionSha256, signedPdfSha256, certificateSha256, auditLogSha256,
          signedPdfRef, certificateRef, auditLogRef,
          signerProofsJson: candidate.signers as unknown as Prisma.InputJsonValue,
          status: "PENDING_VERIFICATION",
        },
        select: { id: true },
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new ConflictException("signature evidence candidate already recorded; reconcile, never overwrite");
      }
      throw error;
    }
  }
}

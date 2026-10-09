import { ConflictException, Injectable } from "@nestjs/common";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { OriginalContractAuthority, StepUpConsentRepository } from "./contract-signature-verification-preflight.js";
import type { SignedSignerConsentReceipt } from "./verified-signer-consent.js";

/**
 * Authenticated server-side canonical contract/outbox lookup. This does not
 * accept any PDF hash, actor, signer email, or "verified" boolean from a
 * public request body. The persisted original-PDF SHA must be server-owned.
 */
@Injectable()
export class PrismaOriginalContractSignatureAuthority implements OriginalContractAuthority {
  constructor(private readonly prisma: PrismaService) {}

  async read(scope: { tenantId: string; contractId: string }) {
    const row = await this.prisma.contract.findFirst({
      where: {
        id: scope.contractId, deletedAt: null,
        job: { tenantId: scope.tenantId, deletedAt: null },
      },
      select: {
        id: true, canonicalPdfSha256: true,
        clientUserId: true, professionalUserId: true,
        clientUser: { select: { email: true } },
        professionalUser: { select: { email: true } },
        job: { select: { tenantId: true } },
      },
    });
    if (!row || !row.canonicalPdfSha256 ||
        row.clientUserId === row.professionalUserId ||
        !row.clientUser.email || !row.professionalUser.email) {
      throw new ConflictException("canonical contract/original PDF or human parties unavailable");
    }
    return {
      tenantId: row.job.tenantId, contractId: row.id,
      canonicalPdfSha256: row.canonicalPdfSha256,
      clientUserId: row.clientUserId,
      professionalUserId: row.professionalUserId,
      clientEmail: row.clientUser.email,
      professionalEmail: row.professionalUser.email,
    };
  }

  async assertSent(input: {
    tenantId: string; contractId: string; connectionId: string;
    providerId: string; externalRequestId: string;
  }) {
    const dispatch = await this.prisma.signatureDispatchOutbox.findFirst({
      where: { ...input, status: "SENT" },
      select: { id: true },
    });
    if (!dispatch) throw new ConflictException("no sent signature dispatch for this exact tenant envelope");
  }
}

/**
 * Trusted READ ONLY source of consent. Rows must originate from a
 * separately authenticated step-up issuer; this service cannot insert
 * consent, cannot mark a contract executed and cannot modify escrow.
 */
@Injectable()
export class PrismaStepUpConsentRepository implements StepUpConsentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async load(scope: { tenantId: string; contractId: string; externalRequestId: string }):
    Promise<readonly SignedSignerConsentReceipt[]> {
    const rows = await this.prisma.contractSignerStepUpReceipt.findMany({
      where: { ...scope, providerId: "documenso", revokedAt: null },
      orderBy: { role: "asc" },
    });
    return rows.map(row => ({
      version: 1 as const,
      tenantId: row.tenantId, contractId: row.contractId,
      connectionId: row.connectionId, providerId: row.providerId,
      externalRequestId: row.externalRequestId,
      documentVersionSha256: row.documentVersionSha256,
      userId: row.userId,
      role: row.role as SignedSignerConsentReceipt["role"],
      email: row.email, providerRecipientId: row.providerRecipientId,
      authChallengeId: row.authChallengeId,
      stepUpMethod: row.stepUpMethod as SignedSignerConsentReceipt["stepUpMethod"],
      identityVerifiedAt: row.identityVerifiedAt,
      consentedAt: row.consentedAt,
      challengeExpiresAt: row.challengeExpiresAt,
      mac: row.mac,
    }));
  }
}

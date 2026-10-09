import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { DocumensoArtifactDownloader } from "./documenso-artifact-downloader.js";
import { ContractSignatureVerificationPreflight } from "./contract-signature-verification-preflight.js";
import { verifyPdfCmsSignature } from "./pdf-cms-signature-verifier.js";
import { PrivateVolumeSignatureArtifactStore } from "./private-volume-signature-artifact.store.js";
import {
  PrismaOriginalContractSignatureAuthority,
  PrismaStepUpConsentRepository,
} from "./prisma-contract-signature-authority.js";
import { PrismaSignatureEvidenceCandidateJournal } from "./prisma-signature-evidence-candidate-journal.js";

const SHA64 = /^[a-f0-9]{64}$/;

/**
 * Server-only composition root: it has NO NestJS controller, no scheduler,
 * and no endpoint to create VerifiedContractExecution. In particular, this
 * cannot send Documenso envelopes or authorize an escrow transfer.
 *
 * The issuer service, real Documenso staging, trusted NSS and dedicated volume
 * require separate documented activation and end-to-end authorization review.
 */
export function buildDocumensoSignaturePreflight(input: {
  prisma: PrismaService;
  tenantId: string;
  connectionId: string;
  instanceOrigin: string;
  apiToken: string;
  privateEvidenceRoot: string;
  approvedNssTrustDirectory: string;
  consentMacKeyHex: string;
  fetchImpl?: typeof fetch;
}): ContractSignatureVerificationPreflight {
  if (!SHA64.test(input.consentMacKeyHex) ||
      !input.tenantId || !input.connectionId || !input.apiToken ||
      !input.instanceOrigin || !input.privateEvidenceRoot ||
      !input.approvedNssTrustDirectory) {
    throw new Error("verification preflight missing server-owned consent key, trust or provider configuration");
  }
  const authority = new PrismaOriginalContractSignatureAuthority(input.prisma);
  const provider = new DocumensoArtifactDownloader({
    tenantId: input.tenantId,
    connectionId: input.connectionId,
    instanceOrigin: input.instanceOrigin,
    apiToken: input.apiToken,
    outbox: {
      assertOwned: scope => authority.assertSent({ ...scope, providerId: "documenso" }),
    },
    fetchImpl: input.fetchImpl,
  });
  return new ContractSignatureVerificationPreflight(
    authority,
    provider,
    new PrismaStepUpConsentRepository(input.prisma),
    Buffer.from(input.consentMacKeyHex, "hex"),
    { validate: pdf => verifyPdfCmsSignature(pdf, input.approvedNssTrustDirectory) },
    new PrivateVolumeSignatureArtifactStore(input.privateEvidenceRoot),
    new PrismaSignatureEvidenceCandidateJournal(input.prisma),
  );
}

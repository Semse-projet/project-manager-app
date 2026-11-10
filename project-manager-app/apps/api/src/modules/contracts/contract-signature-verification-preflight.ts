import { createHash } from "node:crypto";
import type { DocumensoArtifactDownloader } from "./documenso-artifact-downloader.js";
import type { EvidenceArtifactStore, PendingEvidenceJournal, PendingSignatureEvidence } from "./signature-evidence-capture.js";
import { assertIndependentSignerConsents, type SignedSignerConsentReceipt } from "./verified-signer-consent.js";

export interface OriginalContractAuthority {
  /** Server-owned canonical original, never a caller documentHash/pdfUrl. */
  read(scope: { tenantId: string; contractId: string }): Promise<{
    tenantId: string;
    contractId: string;
    clientUserId: string;
    professionalUserId: string;
    clientEmail: string;
    professionalEmail: string;
    canonicalPdfSha256: string;
  }>;
  /** Scope a sent envelope to this exact tenant/connection/contract. */
  assertSent(input: {
    tenantId: string;
    contractId: string;
    connectionId: string;
    providerId: string;
    externalRequestId: string;
  }): Promise<void>;
}

export interface StepUpConsentRepository {
  /**
   * Must be a server-only trusted store (signed challenge receipts from
   * authenticated users). Never accept receipts from API/webhook payload.
   */
  load(input: { tenantId: string; contractId: string; externalRequestId: string }):
    Promise<readonly SignedSignerConsentReceipt[]>;
}

export interface IndependentPdfValidator {
  validate(pdf: Uint8Array): Promise<{ signedPdfSha256: string; signatureCount: number }>;
}

export interface SignaturePreflightScope {
  tenantId: string;
  contractId: string;
  connectionId: string;
  externalRequestId: string;
}

const SHA = /^[a-f0-9]{64}$/;
const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const email = (v: string): string => v.trim().toLowerCase();

/**
 * Orchestrates fresh authenticated provider downloads, independent cryptographic
 * signature validation, canonical signer+step-up consent and immutable storage.
 * The ONLY possible persisted status is PENDING_VERIFICATION. It has no authority
 * to create VerifiedContractExecution, make escrow eligible or emit fully_executed.
 *
 * Wiring to real credentials and Documenso instance remains DISABLED until
 * staging identity/consent and certificate trust chains have been validated.
 */
export class ContractSignatureVerificationPreflight {
  constructor(
    private readonly authority: OriginalContractAuthority,
    private readonly documenso: Pick<DocumensoArtifactDownloader, "download">,
    private readonly consents: StepUpConsentRepository,
    private readonly verificationKey: Uint8Array,
    private readonly pdfValidator: IndependentPdfValidator,
    private readonly artifacts: EvidenceArtifactStore,
    private readonly journal: PendingEvidenceJournal,
  ) {}

  async run(scope: SignaturePreflightScope): Promise<PendingSignatureEvidence> {
    if (!scope.tenantId || !scope.contractId || !scope.connectionId ||
        !/^envelope_[a-zA-Z0-9_-]{1,120}$/.test(scope.externalRequestId)) {
      throw new Error("missing authenticated signature preflight scope");
    }
    const contract = await this.authority.read({
      tenantId: scope.tenantId, contractId: scope.contractId,
    });
    if (contract.tenantId !== scope.tenantId ||
        contract.contractId !== scope.contractId ||
        !SHA.test(contract.canonicalPdfSha256) ||
        !contract.clientEmail || !contract.professionalEmail ||
        !contract.clientUserId || !contract.professionalUserId ||
        contract.clientUserId === contract.professionalUserId ||
        email(contract.clientEmail) === email(contract.professionalEmail)) {
      throw new Error("immutable canonical contract or distinct human signers unavailable");
    }
    await this.authority.assertSent({ ...scope, providerId: "documenso" });
    const completion = await this.documenso.download(scope);
    if (completion.status !== "UNVERIFIED_PROVIDER_BYTES" ||
        completion.externalRequestId !== scope.externalRequestId ||
        completion.recipients.length !== 2) {
      throw new Error("provider completion cannot establish a canonical signed envelope");
    }
    const parties = [
      { role: "client" as const, userId: contract.clientUserId, email: contract.clientEmail },
      { role: "professional" as const, userId: contract.professionalUserId, email: contract.professionalEmail },
    ];
    const expected = new Map(parties.map(p => [email(p.email), p]));
    if (completion.recipients.some(r => !expected.has(email(r.email))) ||
        new Set(completion.recipients.map(r => email(r.email))).size !== 2 ||
        new Set(completion.recipients.map(r => r.id)).size !== 2) {
      throw new Error("provider recipient does not match both canonical contract users");
    }
    const signers = completion.recipients.map(r => {
      const party = expected.get(email(r.email))!;
      return {
        ...scope, providerId: "documenso",
        documentVersionSha256: contract.canonicalPdfSha256,
        userId: party.userId, role: party.role,
        email: party.email, providerRecipientId: r.id,
        providerSignedAt: r.signedAt,
      };
    });
    const stepUp = await this.consents.load({
      tenantId: scope.tenantId, contractId: scope.contractId,
      externalRequestId: scope.externalRequestId,
    });
    assertIndependentSignerConsents(signers, stepUp, this.verificationKey);
    // A provider-supplied hash alone cannot establish that the certificate
    // and audit trail are actual PDF artifacts. Reject empty/non-PDF evidence
    // before any immutable storage or candidate journal write.
    for (const [kind, bytes] of [
      ["signed PDF", completion.signedPdf],
      ["completion certificate", completion.certificate],
      ["audit log", completion.auditLog],
    ] as const) {
      if (!(bytes instanceof Uint8Array) || bytes.byteLength < 8 ||
          Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
        throw new Error(`Documenso ${kind} is not a valid PDF artifact`);
      }
    }
    const pdf = await this.pdfValidator.validate(completion.signedPdf);
    if (pdf.signatureCount < 1 || pdf.signedPdfSha256 !== digest(completion.signedPdf) ||
        pdf.signedPdfSha256 !== completion.signedPdfSha256 ||
        completion.certificateSha256 !== digest(completion.certificate) ||
        completion.auditLogSha256 !== digest(completion.auditLog)) {
      throw new Error("cryptographic PDF or provider artifact hash verification failed");
    }

    // Hash-verified bytes are stored before the candidate journal; journal
    // failure creates safe orphans, NEVER an escrow-authoritative proof.
    const signedPdfRef = await this.artifacts.putImmutable({
      tenantId: scope.tenantId, contractId: scope.contractId, kind: "SIGNED_PDF",
      sha256: pdf.signedPdfSha256, content: completion.signedPdf, mimeType: "application/pdf",
    });
    const certificateRef = await this.artifacts.putImmutable({
      tenantId: scope.tenantId, contractId: scope.contractId, kind: "PROVIDER_CERTIFICATE",
      sha256: completion.certificateSha256, content: completion.certificate, mimeType: "application/pdf",
    });
    const auditLogRef = await this.artifacts.putImmutable({
      tenantId: scope.tenantId, contractId: scope.contractId, kind: "PROVIDER_AUDIT_LOG",
      sha256: completion.auditLogSha256, content: completion.auditLog, mimeType: "application/pdf",
    });
    if (!signedPdfRef || !certificateRef || !auditLogRef ||
        new Set([signedPdfRef, certificateRef, auditLogRef]).size !== 3) {
      throw new Error("missing or duplicate immutable private evidence references");
    }
    const candidate: PendingSignatureEvidence = {
      ...scope, providerId: "documenso",
      documentVersionSha256: contract.canonicalPdfSha256,
      signedPdfSha256: pdf.signedPdfSha256,
      certificateSha256: completion.certificateSha256,
      auditLogSha256: completion.auditLogSha256,
      signedPdfRef, certificateRef, auditLogRef,
      signers: signers.map(s => {
        const receipt = stepUp.find(c => c.role === s.role)!;
        return {
          ...s, providerSignerId: s.providerRecipientId,
          signedAt: s.providerSignedAt, consentRecordedAt: receipt.consentedAt,
          signedDocumentVersionSha256: contract.canonicalPdfSha256,
        };
      }),
      status: "PENDING_VERIFICATION",
    };
    await this.journal.record(candidate);
    return candidate;
  }
}

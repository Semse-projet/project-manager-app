import { createHash } from "node:crypto";

/**
 * Evidence CAPTURE only. Deliberately never returns VERIFIED_EXECUTED.
 * A provider's COMPLETED response is a hint until its origin, certificate,
 * signed PDF, signer identities, consent and contract version are independently
 * authenticated and a separate transactional approval step completes.
 *
 * Do not register this service as an HTTP endpoint or a payment authority.
 */
export type SignaturePartyRole = "client" | "professional";
export type SignatureEvidenceStatus = "PENDING_VERIFICATION";

export interface CanonicalSignatureAgreement {
  tenantId: string;
  connectionId: string;
  contractId: string;
  providerId: string;
  externalRequestId: string;
  documentVersionSha256: string;
  parties: readonly {
    role: SignaturePartyRole;
    userId: string;
    email: string;
  }[];
}

export interface ReportedSigner {
  role: SignaturePartyRole;
  userId: string;
  email: string;
  providerSignerId: string;
  signedAt: string;
  consentRecordedAt: string;
  signedDocumentVersionSha256: string;
}

export interface ProviderCompletionBundle {
  tenantId: string;
  connectionId: string;
  contractId: string;
  providerId: string;
  externalRequestId: string;
  documentVersionSha256: string;
  status: "COMPLETED" | "PARTIAL" | "PENDING" | "DECLINED" | "CANCELLED";
  signers: readonly ReportedSigner[];
  signedPdf: Uint8Array;
  certificate: Uint8Array;
  auditLog: Uint8Array;
  certificateMimeType: "application/pdf" | "application/json";
}

export interface EvidenceArtifactStore {
  /** Return an immutable, tenant-scoped reference; never a public file URL. */
  putImmutable(input: {
    tenantId: string;
    contractId: string;
    kind: "SIGNED_PDF" | "PROVIDER_CERTIFICATE" | "PROVIDER_AUDIT_LOG";
    sha256: string;
    content: Uint8Array;
    mimeType: string;
  }): Promise<string>;
}

export interface PendingSignatureEvidence {
  tenantId: string;
  connectionId: string;
  contractId: string;
  providerId: string;
  externalRequestId: string;
  documentVersionSha256: string;
  signedPdfSha256: string;
  certificateSha256: string;
  auditLogSha256: string;
  signedPdfRef: string;
  certificateRef: string;
  auditLogRef: string;
  signers: readonly ReportedSigner[];
  status: SignatureEvidenceStatus;
}

/**
 * Server-only adapter. The implementer MUST authenticate directly to the
 * pinned provider origin and fetch the completion/certificate, not accept
 * webhook/request-body fields as if they were authoritative.
 */
export interface AuthenticatedCompletionSource {
  fetch(input: CanonicalSignatureAgreement): Promise<ProviderCompletionBundle>;
}

export interface PendingEvidenceJournal {
  record(candidate: PendingSignatureEvidence): Promise<void>;
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireSha256(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("invalid canonical PDF version hash");
  }
}

function requireDate(value: string, description: string): number {
  const date = Date.parse(value);
  if (!value || !Number.isFinite(date)) {
    throw new Error(`invalid ${description} timestamp`);
  }
  return date;
}

/**
 * Captures candidate artifacts for later independent verification.
 * No authority to send envelopes, accept a signature, emit
 * contract.fully_executed or approve escrow.
 */
export class SignatureEvidenceCapture {
  constructor(
    private readonly source: AuthenticatedCompletionSource,
    private readonly artifacts: EvidenceArtifactStore,
    private readonly journal: PendingEvidenceJournal,
  ) {}

  async capture(agreement: CanonicalSignatureAgreement): Promise<PendingSignatureEvidence> {
    requireSha256(agreement.documentVersionSha256);
    if (![agreement.tenantId, agreement.connectionId, agreement.contractId,
      agreement.providerId, agreement.externalRequestId].every(Boolean)) {
      throw new Error("missing canonical contract or provider scope");
    }
    if (agreement.parties.length !== 2 ||
        new Set(agreement.parties.map(p => p.role)).size !== 2 ||
        !agreement.parties.some(p => p.role === "client") ||
        !agreement.parties.some(p => p.role === "professional") ||
        agreement.parties.some(p => !p.email || !p.userId) ||
        new Set(agreement.parties.map(p => p.userId)).size !== 2 ||
        new Set(agreement.parties.map(p => normalizedEmail(p.email))).size !== 2) {
      throw new Error("canonical parties must contain client and professional");
    }

    const bundle = await this.source.fetch(agreement);
    for (const key of ["tenantId", "connectionId", "contractId",
      "providerId", "externalRequestId", "documentVersionSha256"] as const) {
      if (!bundle || bundle[key] !== agreement[key]) {
        throw new Error(`provider evidence mismatch: ${key}`);
      }
    }
    if (bundle.status !== "COMPLETED") {
      throw new Error("provider envelope has not completed");
    }
    if (bundle.signers.length !== 2) {
      throw new Error("provider must attest exactly two signers");
    }

    const usedSignerIds = new Set<string>();
    for (const party of agreement.parties) {
      const matches = bundle.signers.filter(s => s.role === party.role);
      if (matches.length !== 1) throw new Error("missing or duplicate provider signer role");
      const signer = matches[0]!;
      if (!signer.userId || signer.userId !== party.userId ||
          normalizedEmail(signer.email) !== normalizedEmail(party.email)) {
        throw new Error("provider signer identity mismatch");
      }
      if (!signer.providerSignerId || usedSignerIds.has(signer.providerSignerId)) {
        throw new Error("missing or duplicate provider signer ID");
      }
      usedSignerIds.add(signer.providerSignerId);
      if (signer.signedDocumentVersionSha256 !== agreement.documentVersionSha256) {
        throw new Error("signer did not sign canonical contract version");
      }
      const consent = requireDate(signer.consentRecordedAt, "consent");
      const signed = requireDate(signer.signedAt, "signature");
      if (consent > signed) throw new Error("signer consent must precede signature");
    }

    // Byte sanity and content hashes are *not* PDF signature/certificate
    // cryptographic validation. The downstream verifier must perform that.
    if (!(bundle.signedPdf instanceof Uint8Array) ||
        bundle.signedPdf.length < 8 ||
        Buffer.from(bundle.signedPdf.subarray(0, 5)).toString("ascii") !== "%PDF-") {
      throw new Error("missing or malformed signed PDF");
    }
    if (!(bundle.certificate instanceof Uint8Array) || bundle.certificate.length < 8 ||
        !["application/pdf", "application/json"].includes(bundle.certificateMimeType)) {
      throw new Error("missing or malformed provider certificate");
    }
    if (!(bundle.auditLog instanceof Uint8Array) || bundle.auditLog.length < 8 ||
        Buffer.from(bundle.auditLog.subarray(0, 5)).toString("ascii") !== "%PDF-") {
      throw new Error("missing or malformed provider audit log PDF");
    }

    const signedPdfSha256 = digest(bundle.signedPdf);
    const certificateSha256 = digest(bundle.certificate);
    const auditLogSha256 = digest(bundle.auditLog);
    // Store immutable artifacts BEFORE journal record. On partial failure,
    // an orphan may remain but no verified execution can be fabricated.
    const signedPdfRef = await this.artifacts.putImmutable({
      tenantId: agreement.tenantId, contractId: agreement.contractId,
      kind: "SIGNED_PDF", sha256: signedPdfSha256, content: bundle.signedPdf,
      mimeType: "application/pdf",
    });
    const certificateRef = await this.artifacts.putImmutable({
      tenantId: agreement.tenantId, contractId: agreement.contractId,
      kind: "PROVIDER_CERTIFICATE", sha256: certificateSha256,
      content: bundle.certificate, mimeType: bundle.certificateMimeType,
    });
    const auditLogRef = await this.artifacts.putImmutable({
      tenantId: agreement.tenantId, contractId: agreement.contractId,
      kind: "PROVIDER_AUDIT_LOG", sha256: auditLogSha256,
      content: bundle.auditLog, mimeType: "application/pdf",
    });
    if (!signedPdfRef || !certificateRef || !auditLogRef ||
        new Set([signedPdfRef, certificateRef, auditLogRef]).size !== 3) {
      throw new Error("immutable evidence storage did not return unique private references");
    }

    const candidate: PendingSignatureEvidence = {
      tenantId: agreement.tenantId,
      connectionId: agreement.connectionId,
      contractId: agreement.contractId,
      providerId: agreement.providerId,
      externalRequestId: agreement.externalRequestId,
      documentVersionSha256: agreement.documentVersionSha256,
      signedPdfSha256,
      certificateSha256,
      auditLogSha256,
      signedPdfRef,
      certificateRef,
      auditLogRef,
      signers: bundle.signers.map(s => ({ ...s })),
      status: "PENDING_VERIFICATION",
    };
    await this.journal.record(candidate);
    return candidate;
  }
}

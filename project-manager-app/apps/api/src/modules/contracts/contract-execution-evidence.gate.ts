import { ConflictException } from "@nestjs/common";

/**
 * Escrow authorization must come from an authoritative, transactionally
 * promoted VERIFIED_EXECUTED record. Neither legacy signature timestamps nor
 * PENDING_VERIFICATION candidates are a substitute.
 *
 * Pure fail-closed policy; NOT yet wired into economic commands. Production
 * hookup requires a DB reader, transaction boundary, rollout and canary.
 */
export interface VerifiedContractExecution {
  tenantId: string;
  contractId: string;
  documentVersionSha256: string;
  clientUserId: string;
  professionalUserId: string;
  providerId: string;
  externalRequestId: string;
  signedPdfSha256: string;
  certificateSha256: string;
  signedPdfRef: string;
  certificateRef: string;
  authorizedPolicyDecisionId: string;
  verifiedAt: Date;
  status: "VERIFIED_EXECUTED" | "REVOKED" | "QUARANTINED";
}

export interface EscrowContractScope {
  tenantId: string;
  contractId: string;
  documentVersionSha256: string;
  clientUserId: string;
  professionalUserId: string;
}

const sha256 = /^[a-f0-9]{64}$/;

export function assertContractExecutionVerified(
  scope: EscrowContractScope,
  execution: VerifiedContractExecution | null | undefined,
): asserts execution is VerifiedContractExecution {
  if (!execution || execution.status !== "VERIFIED_EXECUTED" ||
      execution.tenantId !== scope.tenantId ||
      execution.contractId !== scope.contractId ||
      execution.documentVersionSha256 !== scope.documentVersionSha256 ||
      execution.clientUserId !== scope.clientUserId ||
      execution.professionalUserId !== scope.professionalUserId ||
      !scope.tenantId || !scope.contractId ||
      !scope.clientUserId || !scope.professionalUserId ||
      !sha256.test(scope.documentVersionSha256) ||
      ![execution.signedPdfSha256, execution.certificateSha256].every(v => sha256.test(v)) ||
      !execution.providerId || !execution.externalRequestId ||
      !execution.signedPdfRef || !execution.certificateRef ||
      !execution.authorizedPolicyDecisionId ||
      /^(?:https?:)?\/\//i.test(execution.signedPdfRef) ||
      /^(?:https?:)?\/\//i.test(execution.certificateRef) ||
      !(execution.verifiedAt instanceof Date) ||
      !Number.isFinite(execution.verifiedAt.getTime())) {
    throw new ConflictException(
      "escrow requires independently verified contract execution and sealed signature evidence",
    );
  }
}

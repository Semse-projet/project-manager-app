import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A consent receipt is issued ONLY by the authenticated step-up challenge
 * service (not provided here). This verifier cannot issue, sign, or fabricate
 * a receipt and is intentionally not registered as an HTTP endpoint.
 *
 * A Documenso "SIGNED" recipient status is NOT a human identity/consent
 * proof. This binds separate SEMSE step-up identity evidence to the exact
 * immutable source PDF and canonical party.
 */
export type ContractSignerRole = "client" | "professional";
export type StepUpMethod = "webauthn" | "totp" | "identity_provider";

export interface SignedSignerConsentReceipt {
  version: 1;
  tenantId: string;
  contractId: string;
  connectionId: string;
  providerId: string;
  externalRequestId: string;
  documentVersionSha256: string;
  userId: string;
  role: ContractSignerRole;
  email: string;
  providerRecipientId: string;
  authChallengeId: string;
  stepUpMethod: StepUpMethod;
  identityVerifiedAt: string;
  consentedAt: string;
  challengeExpiresAt: string;
  /** Hex HMAC-SHA256 issued by separate authenticated approval service. */
  mac: string;
}

export interface CanonicalConsentSigner {
  tenantId: string;
  contractId: string;
  connectionId: string;
  providerId: string;
  externalRequestId: string;
  documentVersionSha256: string;
  userId: string;
  role: ContractSignerRole;
  email: string;
  providerRecipientId: string;
  providerSignedAt: string;
}

const SHA = /^[a-f0-9]{64}$/;
const validMethods = new Set<StepUpMethod>(["webauthn", "totp", "identity_provider"]);

function epoch(s: string): number {
  // Require timezone to prevent locale-sensitive or ambiguous comparisons.
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(s)) {
    throw new Error("consent receipt timestamps require ISO8601 timezone");
  }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) throw new Error("invalid consent receipt timestamp");
  return t;
}

function signedPayload(receipt: SignedSignerConsentReceipt): string {
  // Versioned, fixed-order canonical payload. Excludes MAC.
  return JSON.stringify([
    "SEMSE_SIGNER_CONSENT_V1",
    receipt.version,
    receipt.tenantId, receipt.contractId, receipt.connectionId,
    receipt.providerId, receipt.externalRequestId,
    receipt.documentVersionSha256, receipt.userId,
    receipt.role, receipt.email, receipt.providerRecipientId,
    receipt.authChallengeId, receipt.stepUpMethod,
    receipt.identityVerifiedAt, receipt.consentedAt, receipt.challengeExpiresAt,
  ]);
}

function checkOne(
  signer: CanonicalConsentSigner,
  receipt: SignedSignerConsentReceipt,
  key: Uint8Array,
): void {
  if (!key || key.length < 32) throw new Error("dedicated step-up consent verification key unavailable");
  if (receipt.version !== 1 || !SHA.test(receipt.documentVersionSha256) ||
      !validMethods.has(receipt.stepUpMethod) ||
      !receipt.authChallengeId || !receipt.providerRecipientId ||
      !SHA.test(receipt.mac)) {
    throw new Error("consent receipt shape or algorithm invalid");
  }
  for (const field of [
    "tenantId", "contractId", "connectionId", "providerId",
    "externalRequestId", "documentVersionSha256", "userId",
    "role", "email", "providerRecipientId",
  ] as const) {
    const expected = field === "email" ? signer.email.trim().toLowerCase() : signer[field];
    const actual = field === "email" ? receipt.email.trim().toLowerCase() : receipt[field];
    if (!expected || actual !== expected) {
      throw new Error(`consent identity/contract scope mismatch: ${field}`);
    }
  }
  const mac = createHmac("sha256", key).update(signedPayload(receipt)).digest();
  const provided = Buffer.from(receipt.mac, "hex");
  if (provided.length !== mac.length || !timingSafeEqual(provided, mac)) {
    throw new Error("consent receipt MAC invalid");
  }
  const verified = epoch(receipt.identityVerifiedAt);
  const consented = epoch(receipt.consentedAt);
  const expires = epoch(receipt.challengeExpiresAt);
  const providerSigned = epoch(signer.providerSignedAt);
  if (verified > consented || consented > providerSigned ||
      providerSigned > expires || expires <= verified ||
      expires - verified > 15 * 60_000) {
    throw new Error("consent challenge chronology expired or invalid");
  }
}

/** Never accepts the same canonical human or challenge for two signer roles. */
export function assertIndependentSignerConsents(
  signers: readonly CanonicalConsentSigner[],
  receipts: readonly SignedSignerConsentReceipt[],
  serverVerificationKey: Uint8Array,
): void {
  if (signers.length !== 2 || receipts.length !== 2 ||
      new Set(signers.map(s => s.role)).size !== 2 ||
      !signers.some(s => s.role === "client") ||
      !signers.some(s => s.role === "professional") ||
      new Set(signers.map(s => s.userId)).size !== 2 ||
      new Set(signers.map(s => s.email.trim().toLowerCase())).size !== 2 ||
      new Set(signers.map(s => s.providerRecipientId)).size !== 2 ||
      new Set(receipts.map(s => s.authChallengeId)).size !== 2) {
    throw new Error("two independent canonical human signers are required");
  }
  for (const signer of signers) {
    const matches = receipts.filter(receipt => receipt.role === signer.role);
    if (matches.length !== 1) throw new Error("missing or duplicate signer consent");
    checkOne(signer, matches[0]!, serverVerificationKey);
  }
}

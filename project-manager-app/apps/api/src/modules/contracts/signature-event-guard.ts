import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Transport-independent event admission guard. Signature verification is
 * provider-specific and MUST occur before calling this function.
 * This guard does not itself verify a Documenso webhook.
 */
export interface VerifiedSignatureEvent {
  provider: "documenso" | "hellosign" | "docusign";
  providerEventId: string;
  externalRequestId: string;
  tenantId: string;
  contractId: string;
  eventType: string;
  verified: true;
}

export interface SignatureRequestBinding {
  provider: VerifiedSignatureEvent["provider"];
  externalRequestId: string;
  tenantId: string;
  contractId: string;
}

export function assertSignatureEventBound(
  event: VerifiedSignatureEvent,
  binding: SignatureRequestBinding,
): string {
  if (event.verified !== true || !event.providerEventId?.trim() ||
      !event.externalRequestId?.trim() || !event.tenantId?.trim() ||
      !event.contractId?.trim() || !event.eventType?.trim()) {
    throw new Error("Signature event is incomplete or unverified");
  }
  const pairs = [
    [event.provider, binding.provider],
    [event.externalRequestId, binding.externalRequestId],
    [event.tenantId, binding.tenantId],
    [event.contractId, binding.contractId],
  ] as const;
  for (const [actual, expected] of pairs) {
    if (!actual || !expected) throw new Error("Signature event binding missing");
    const a = createHash("sha256").update(actual).digest();
    const b = createHash("sha256").update(expected).digest();
    if (!timingSafeEqual(a, b)) throw new Error("Signature event binding mismatch");
  }
  return createHash("sha256")
    .update(JSON.stringify([event.provider, event.tenantId, event.providerEventId]))
    .digest("hex");
}

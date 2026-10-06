export interface WebhookReplayStore {
  /** Returns true only when the nonce was atomically recorded for the first time. */
  claim(tenantId: string, connectionId: string, nonce: string, expiresAt: string): Promise<boolean>;
}

export interface WebhookSignatureVerifier {
  /** Provider-specific verifier. Implementations must use constant-time comparison where applicable. */
  verify(args: { payload: string; signature: string; timestamp: string; secretRef: string }): Promise<boolean>;
}

export type WebhookTrustResult =
  | { trusted: true }
  | { trusted: false; code: 'WEBHOOK_TIMESTAMP_INVALID' | 'WEBHOOK_SIGNATURE_INVALID' | 'WEBHOOK_REPLAY'; reason: string };

export async function verifyWebhookTrust(args: {
  tenantId: string;
  connectionId: string;
  payload: string;
  signature: string;
  timestamp: string;
  nonce: string;
  secretRef: string;
  verifier: WebhookSignatureVerifier;
  replayStore: WebhookReplayStore;
  now?: () => Date;
  toleranceSeconds?: number;
}): Promise<WebhookTrustResult> {
  const now = (args.now ?? (() => new Date()))();
  const signedAt = new Date(args.timestamp);
  const toleranceMs = (args.toleranceSeconds ?? 300) * 1000;
  if (!Number.isFinite(signedAt.getTime()) || Math.abs(now.getTime() - signedAt.getTime()) > toleranceMs) {
    return { trusted: false, code: 'WEBHOOK_TIMESTAMP_INVALID', reason: 'Webhook timestamp is outside the accepted window' };
  }

  const signatureValid = await args.verifier.verify({
    payload: args.payload,
    signature: args.signature,
    timestamp: args.timestamp,
    secretRef: args.secretRef,
  });
  if (!signatureValid) return { trusted: false, code: 'WEBHOOK_SIGNATURE_INVALID', reason: 'Webhook signature verification failed' };

  const expiresAt = new Date(now.getTime() + toleranceMs).toISOString();
  const firstSeen = await args.replayStore.claim(args.tenantId, args.connectionId, args.nonce, expiresAt);
  if (!firstSeen) return { trusted: false, code: 'WEBHOOK_REPLAY', reason: 'Webhook nonce has already been consumed' };
  return { trusted: true };
}

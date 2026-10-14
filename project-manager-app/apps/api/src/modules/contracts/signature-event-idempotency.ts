/**
 * Atomic replay barrier for verified signature events.
 *
 * Implementations MUST persist the unique key in a shared durable database,
 * use a unique constraint, and commit the claim and any business state changes
 * in the SAME transaction. Do not substitute process-local memory in production.
 */
export interface SignatureEventClaimStore {
  /**
   * Returns true only for the first committed claim.
   * Must be atomic and scoped to the same transaction as downstream effects.
   * Errors must reject, never default to true.
   */
  claimOnce(replayKey: string): Promise<boolean>;
}

export async function applyVerifiedSignatureEventOnce(
  replayKey: string,
  store: SignatureEventClaimStore,
  apply: () => Promise<void>,
): Promise<"applied" | "duplicate"> {
  if (!/^[a-f0-9]{64}$/.test(replayKey)) {
    throw new Error("Invalid signature event replay key");
  }
  // The store and callback MUST share a transaction. The wrapper cannot
  // provide transactionality itself; callers must not use separate commits.
  const claimed = await store.claimOnce(replayKey);
  if (claimed !== true && claimed !== false) {
    throw new Error("Signature event claim store returned an invalid result");
  }
  if (!claimed) return "duplicate";
  await apply();
  return "applied";
}

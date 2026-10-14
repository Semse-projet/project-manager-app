/**
 * Durable replay barrier contract for verified signature events.
 * The transaction manager MUST atomically commit the unique replay claim
 * and the associated business changes, or roll back both on any failure.
 */
export interface SignatureEventClaimStore {
  /** Insert a replay key under a database UNIQUE constraint; return false on conflict. */
  claimOnce(replayKey: string): Promise<boolean>;
}

export interface SignatureEventTransactionManager<TStore extends SignatureEventClaimStore = SignatureEventClaimStore> {
  transaction<T>(work: (store: TStore) => Promise<T>): Promise<T>;
}

export async function applyVerifiedSignatureEventOnce<TStore extends SignatureEventClaimStore>(
  replayKey: string,
  manager: SignatureEventTransactionManager<TStore>,
  apply: (store: TStore) => Promise<void>,
): Promise<"applied" | "duplicate"> {
  if (!/^[a-f0-9]{64}$/.test(replayKey)) {
    throw new Error("Invalid signature event replay key");
  }
  return manager.transaction(async (store) => {
    const claimed = await store.claimOnce(replayKey);
    if (claimed !== true && claimed !== false) {
      throw new Error("Signature event claim store returned an invalid result");
    }
    if (!claimed) return "duplicate";
    await apply(store);
    return "applied";
  });
}

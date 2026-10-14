import type { PrismaClient } from "@prisma/client";
import type { SignatureEventTransactionManager } from "./signature-event-idempotency.js";

/**
 * PostgreSQL-backed replay barrier.
 * Requires the signature_event_claims migration to have run.
 * Callers MUST execute every downstream business mutation through the
 * provided transaction client; never use the root Prisma client in apply().\n * The generic replay interface does not yet expose tx to business callbacks;\n * do not connect payment or contract side effects until that is implemented.
 */
export function prismaSignatureEventManager(
  prisma: PrismaClient,
): SignatureEventTransactionManager {
  return {
    async transaction<T>(work: (store: {
      claimOnce(replayKey: string): Promise<boolean>;
    }) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx) => {
        const store = {
          async claimOnce(replayKey: string): Promise<boolean> {
            const inserted = await tx.$executeRaw`
              INSERT INTO signature_event_claims (replay_key)
              VALUES (${replayKey})
              ON CONFLICT (replay_key) DO NOTHING
            `;
            return inserted === 1;
          },
          tx,
        };
        return work(store);
      });
    },
  };
}

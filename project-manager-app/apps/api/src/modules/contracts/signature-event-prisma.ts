import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  SignatureEventClaimStore,
  SignatureEventTransactionManager,
} from "./signature-event-idempotency.js";

/**
 * A verified signature event's replay claim and business effects MUST use
 * the same Prisma transaction client. Never use root prisma inside apply().
 */
export interface PrismaSignatureEventStore extends SignatureEventClaimStore {
  readonly tx: Prisma.TransactionClient;
}

export function prismaSignatureEventManager(
  prisma: PrismaClient,
): SignatureEventTransactionManager<PrismaSignatureEventStore> {
  return {
    async transaction<T>(work: (store: PrismaSignatureEventStore) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx) => {
        const store: PrismaSignatureEventStore = {
          tx,
          async claimOnce(replayKey: string): Promise<boolean> {
            const inserted = await tx.$executeRaw`
              INSERT INTO signature_event_claims (replay_key)
              VALUES (${replayKey})
              ON CONFLICT (replay_key) DO NOTHING
            `;
            return inserted === 1;
          },
        };
        return work(store);
      });
    },
  };
}

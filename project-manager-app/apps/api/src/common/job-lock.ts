import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

/**
 * Serializes a job's terminal transitions (completed/cancelled) with money moving
 * into its escrow. Both sides take this row lock inside their own transaction, so
 * a closure check can never read the escrow while a deposit is being reserved,
 * and a deposit can never land after the job was closed.
 */
export async function lockJobRow(tx: Prisma.TransactionClient, jobId: string): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT "status"::text AS status FROM "Job" WHERE "id" = ${jobId} FOR UPDATE`;
  return rows[0]?.status ?? null;
}

const CLOSED_JOB_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

/** For money moving in: locks the job and refuses it once the job is closed. */
export async function lockOpenJobForFunding(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
  const status = await lockJobRow(tx, jobId);
  if (status && CLOSED_JOB_STATUSES.has(status.toUpperCase())) {
    throw new ConflictException(`cannot fund escrow: job is ${status.toLowerCase()}`);
  }
}

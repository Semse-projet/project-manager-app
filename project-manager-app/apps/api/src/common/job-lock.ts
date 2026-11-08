import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

/**
 * Serializes a job's status writes (transitions, completion, cancellation) with what
 * must not happen after a close: money moving into its escrow, a reservation, a
 * dispute, a milestone change. Every side takes this row lock inside its own
 * transaction, so a closure check cannot miss a concurrent write, and none of those
 * writes can land on a job that was already closed.
 */
export async function lockJobRow(tx: Prisma.TransactionClient, jobId: string): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT "status"::text AS status FROM "Job" WHERE "id" = ${jobId} FOR UPDATE`;
  return rows[0]?.status ?? null;
}

const CLOSED_JOB_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

/** Locks the job and refuses `action` once the job is completed or cancelled. */
export async function lockOpenJob(tx: Prisma.TransactionClient, jobId: string, action: string): Promise<void> {
  const status = await lockJobRow(tx, jobId);
  if (status && CLOSED_JOB_STATUSES.has(status.toUpperCase())) {
    throw new ConflictException(`cannot ${action}: job is ${status.toLowerCase()}`);
  }
}

/** For money moving in: locks the job and refuses it once the job is closed. */
export function lockOpenJobForFunding(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
  return lockOpenJob(tx, jobId, "fund escrow");
}

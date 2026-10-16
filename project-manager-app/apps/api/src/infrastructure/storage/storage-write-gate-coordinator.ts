import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  assertStorageWriteAdmission,
  assertStorageWritePublication,
  StorageWriteGateBlockedError,
  type StorageWriteGatePhase,
} from "./storage-write-gate-state.js";

export type StorageWriteKind =
  | "ORIGINAL_STORE" | "ORIGINAL_DELETE"
  | "MULTIPART_CREATE" | "MULTIPART_PART" | "MULTIPART_COMPLETE"
  | "EVIDENCE_REGISTER" | "BROWSER_EVIDENCE";

export type StorageWriteTicket = Readonly<{
  id: string;
  scope: string;
  epoch: bigint;
  writerInstanceId: string;
  kind: StorageWriteKind;
}>;

type GateRow = {
  scope: string;
  phase: StorageWriteGatePhase;
  epoch: bigint;
  coverageDigest: string | null;
};
type TicketRow = {
  id: string;
  scope: string;
  epoch: bigint;
  writerInstanceId: string;
  state: string;
};
type QueryTx = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

function validateIdentifier(value: string, field: string): void {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{5,190}$/.test(value)) {
    throw new StorageWriteGateBlockedError(`invalid_${field}`);
  }
}
function validateKind(kind: string): asserts kind is StorageWriteKind {
  if (!["ORIGINAL_STORE", "ORIGINAL_DELETE", "MULTIPART_CREATE", "MULTIPART_PART",
    "MULTIPART_COMPLETE", "EVIDENCE_REGISTER", "BROWSER_EVIDENCE"].includes(kind)) {
    throw new StorageWriteGateBlockedError("invalid_kind");
  }
}

/**
 * T-008 / S1b: DURABLE ADMISSION LEDGER ONLY.
 *
 * No module provider, route, controller or production StorageService calls this
 * class in this slice. Do not interpret its presence as an operational freeze.
 *
 * Serialization invariant: every writer admission and EVERY future transition
 * to DRAINING must SELECT the identical gate row FOR UPDATE in the same DB
 * transaction before inserting a ticket or changing phase. A post-admission
 * ticket stays ACTIVE until publication/cleanup and reference registration are
 * complete, never just until the stream finishes.
 *
 * A killed process leaves an ACTIVE row which blocks later FROZEN; never use
 * lease timeouts as proof that the process cannot still publish. The next
 * slice must implement audited operator transition, fencing, and Evidence
 * reconciliation before this can be wired to production.
 */
@Injectable()
export class StorageWriteGateCoordinator {
  constructor(private readonly prisma: PrismaService) {}

  private async lockedGate(tx: QueryTx, scope: string): Promise<GateRow> {
    const rows = await tx.$queryRaw<GateRow[]>`
      SELECT "scope", "phase", "epoch", "coverageDigest"
      FROM "StorageWriteGate" WHERE "scope" = ${scope}
      FOR UPDATE
    `;
    if (rows.length !== 1) {
      // No silent implicit OPEN when a migration or DB initialization is missing.
      throw new StorageWriteGateBlockedError("gate_not_provisioned");
    }
    return rows[0];
  }

  async admitWrite(input: {
    scope: string;
    kind: StorageWriteKind;
    writerInstanceId: string;
  }): Promise<StorageWriteTicket> {
    validateIdentifier(input.scope, "scope");
    validateIdentifier(input.writerInstanceId, "writer_instance");
    validateKind(input.kind);
    return this.prisma.$transaction(async (tx) => {
      const gate = await this.lockedGate(tx, input.scope);
      assertStorageWriteAdmission({
        phase: gate.phase,
        activeOperations: 0,
        ambiguousOperations: 0,
        writerCoverageComplete: gate.coverageDigest !== null,
      }, true);
      const id = randomUUID();
      // Ticket insertion and phase check commit atomically. No networking /
      // filesystem writes can begin until the caller obtains this ticket.
      await tx.$executeRaw`
        INSERT INTO "StorageWriteOperation"
          ("id", "scope", "epoch", "kind", "writerInstanceId", "state")
        VALUES (${id}::uuid, ${input.scope}, ${gate.epoch},
                ${input.kind}, ${input.writerInstanceId}, 'ACTIVE')
      `;
      return {
        id, scope: input.scope, epoch: gate.epoch,
        kind: input.kind, writerInstanceId: input.writerInstanceId,
      };
    }, { maxWait: 3000, timeout: 8000 });
  }

  /**
   * Check a ticket immediately before irreversible mutation. This is NOT a
   * durable fencing primitive by itself: the operation must remain ACTIVE
   * until publication and post-write DB work are finished.
   */
  async assertActive(ticket: StorageWriteTicket): Promise<void> {
    validateIdentifier(ticket.scope, "scope");
    validateIdentifier(ticket.writerInstanceId, "writer_instance");
    validateKind(ticket.kind);
    await this.prisma.$transaction(async (tx) => {
      const gate = await this.lockedGate(tx, ticket.scope);
      const rows = await tx.$queryRaw<TicketRow[]>`
        SELECT "id", "scope", "epoch", "writerInstanceId", "state"
        FROM "StorageWriteOperation"
        WHERE "id" = ${ticket.id}::uuid AND "scope" = ${ticket.scope}
        FOR UPDATE
      `;
      if (rows.length !== 1 ||
          rows[0].state !== "ACTIVE" ||
          rows[0].epoch !== ticket.epoch ||
          rows[0].epoch !== gate.epoch ||
          rows[0].writerInstanceId !== ticket.writerInstanceId) {
        throw new StorageWriteGateBlockedError("invalid_active_ticket");
      }
      assertStorageWritePublication({
        phase: gate.phase,
        activeOperations: 1,
        ambiguousOperations: 0,
        writerCoverageComplete: gate.coverageDigest !== null,
      }, true, true);
    }, { maxWait: 3000, timeout: 8000 });
  }

  /**
   * Call only AFTER the filesystem publication/deletion AND its metadata
   * writes succeeded, or after a clean failure with staging cleaned up.
   * Errors keep the ticket ACTIVE (safe stop, not automatic release).
   */
  async settleWrite(
    ticket: StorageWriteTicket,
    outcome: "COMPLETED" | "FAILED_CLEAN",
  ): Promise<void> {
    if (outcome !== "COMPLETED" && outcome !== "FAILED_CLEAN") {
      throw new StorageWriteGateBlockedError("invalid_outcome");
    }
    validateIdentifier(ticket.scope, "scope");
    validateIdentifier(ticket.writerInstanceId, "writer_instance");
    await this.prisma.$transaction(async (tx) => {
      const gate = await this.lockedGate(tx, ticket.scope);
      if (gate.phase === "FROZEN") {
        throw new StorageWriteGateBlockedError("frozen_with_active_ticket");
      }
      const rows = await tx.$queryRaw<TicketRow[]>`
        SELECT "id", "scope", "epoch", "writerInstanceId", "state"
        FROM "StorageWriteOperation"
        WHERE "id" = ${ticket.id}::uuid AND "scope" = ${ticket.scope}
        FOR UPDATE
      `;
      if (rows.length !== 1 || rows[0].state !== "ACTIVE" ||
          rows[0].epoch !== ticket.epoch ||
          rows[0].epoch !== gate.epoch ||
          rows[0].writerInstanceId !== ticket.writerInstanceId) {
        throw new StorageWriteGateBlockedError("invalid_active_ticket");
      }
      const updated = await tx.$executeRaw`
        UPDATE "StorageWriteOperation"
        SET "state" = ${outcome}, "finishedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${ticket.id}::uuid AND "scope" = ${ticket.scope}
          AND "state" = 'ACTIVE'
      `;
      if (updated !== 1) throw new StorageWriteGateBlockedError("settlement_conflict");
    }, { maxWait: 3000, timeout: 8000 });
  }

  /** Read-only status; never infer safe freeze from this alone. */
  async inspect(scope: string): Promise<{
    phase: StorageWriteGatePhase;
    epoch: bigint;
    activeOperations: number;
    coverageDigestPresent: boolean;
  }> {
    validateIdentifier(scope, "scope");
    return this.prisma.$transaction(async (tx) => {
      const gate = await this.lockedGate(tx, scope);
      const counts = await tx.$queryRaw<Array<{ active: bigint }>>`
        SELECT count(*)::bigint AS "active"
        FROM "StorageWriteOperation"
        WHERE "scope" = ${scope} AND "state" = 'ACTIVE'
      `;
      return {
        phase: gate.phase,
        epoch: gate.epoch,
        activeOperations: Number(counts[0]?.active ?? 0n),
        coverageDigestPresent: gate.coverageDigest !== null,
      };
    }, { maxWait: 3000, timeout: 8000 });
  }
}

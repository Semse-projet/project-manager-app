import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  resolveStorageWriteGateTransition,
  StorageWriteGateBlockedError,
  type StorageWriteGateAction,
  type StorageWriteGatePhase,
} from "./storage-write-gate-state.js";

/**
 * T-008: transactional phase transitions under the same PostgreSQL row lock
 * used by writer admission. The staging control plane supplies authenticated
 * operator metadata; production exposure remains separately prohibited.
 */
export type StorageTransitionAuthority = Readonly<{
  actorUserId: string;
  actorAuthorized: boolean;
  auditTicket: string;
  /** Legacy/internal compatibility only; never trusted as thaw authority. */
  recoveryWindowClosed?: boolean;
}>;

type AuditReplayRow = {
  action: string;
  phaseAfter: StorageWriteGatePhase;
  epochAfter: bigint;
  requestDigest: string | null;
};

function validateControlMetadata(input: {
  reason?: string;
  idempotencyKey?: string;
  requestDigest?: string;
}): void {
  const any = input.reason !== undefined ||
    input.idempotencyKey !== undefined ||
    input.requestDigest !== undefined;
  if (!any) return;
  if (
    typeof input.reason !== "string" ||
    input.reason.trim().length < 3 ||
    input.reason.trim().length > 1000
  ) {
    throw new StorageWriteGateBlockedError("invalid_reason");
  }
  if (
    typeof input.idempotencyKey !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(input.idempotencyKey)
  ) {
    throw new StorageWriteGateBlockedError("invalid_idempotency_key");
  }
  if (
    typeof input.requestDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.requestDigest)
  ) {
    throw new StorageWriteGateBlockedError("invalid_request_digest");
  }
}

@Injectable()
export class StorageWriteGateTransitionService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(input: {
    scope: string;
    expectedEpoch: bigint;
    action: StorageWriteGateAction;
    authority: StorageTransitionAuthority;
    reason?: string;
    idempotencyKey?: string;
    requestDigest?: string;
  }): Promise<{phase: StorageWriteGatePhase; epoch: bigint}> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{5,190}$/.test(input.scope)) {
      throw new StorageWriteGateBlockedError("invalid_scope");
    }
    if (!Number.isSafeInteger(Number(input.expectedEpoch)) || input.expectedEpoch <= 0n) {
      throw new StorageWriteGateBlockedError("invalid_epoch");
    }
    if (!input.authority.actorAuthorized || !input.authority.actorUserId?.trim()) {
      throw new StorageWriteGateBlockedError("administrator_required");
    }
    validateControlMetadata(input);
    const ticket = input.authority.auditTicket;

    return this.prisma.$transaction(async tx => {
      // Serialize idempotency with admission/transition on the same gate row.
      // Exact concurrent retries therefore cannot both observe a missing audit.
      const rows = await tx.$queryRaw<Array<{
        scope: string;
        phase: StorageWriteGatePhase;
        epoch: bigint;
        coverageDigest: string | null;
        recoveryWindowDigest: string | null;
      }>>`
        SELECT "scope", "phase", "epoch", "coverageDigest", "recoveryWindowDigest"
        FROM "StorageWriteGate"
        WHERE "scope" = ${input.scope}
        FOR UPDATE
      `;
      if (rows.length !== 1) throw new StorageWriteGateBlockedError("gate_not_provisioned");
      const gate = rows[0]!;

      if (input.idempotencyKey) {
        const replay = await tx.$queryRaw<AuditReplayRow[]>`
          SELECT "action", "phaseAfter", "epochAfter", "requestDigest"
          FROM "StorageWriteGateAudit"
          WHERE "scope" = ${input.scope}
            AND "idempotencyKey" = ${input.idempotencyKey}
          LIMIT 1
        `;
        if (replay.length === 1) {
          const row = replay[0]!;
          if (row.action !== input.action || row.requestDigest !== input.requestDigest) {
            throw new StorageWriteGateBlockedError("idempotency_conflict");
          }
          return {phase: row.phaseAfter, epoch: row.epochAfter};
        }
      }

      if (gate.epoch !== input.expectedEpoch) {
        throw new StorageWriteGateBlockedError("stale_epoch");
      }

      const counts = await tx.$queryRaw<Array<{active: bigint}>>`
        SELECT count(*)::bigint AS "active"
        FROM "StorageWriteOperation"
        WHERE "scope" = ${input.scope} AND "state" = 'ACTIVE'
      `;
      const active = counts[0]?.active ?? 0n;
      if (active > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new StorageWriteGateBlockedError("active_count_overflow");
      }
      if (input.action === "ABORT_DRAIN" && active !== 0n) {
        throw new StorageWriteGateBlockedError("active_operations");
      }

      const phase = resolveStorageWriteGateTransition({
        phase: gate.phase,
        activeOperations: Number(active),
        ambiguousOperations: 0,
        writerCoverageComplete: gate.coverageDigest !== null,
      }, {
        action: input.action,
        administratorAuthorized: true,
        ticket,
        authorityAvailable: true,
        recoveryWindowClosed: gate.recoveryWindowDigest !== null,
      });

      const reopening = input.action === "THAW" || input.action === "ABORT_DRAIN";
      const beginningDrain = input.action === "BEGIN_DRAIN";
      const enteringFrozen = input.action === "MARK_FROZEN";
      const nextEpoch = gate.epoch + (reopening ? 1n : 0n);
      const nextCoverageDigest =
        reopening || beginningDrain ? null : gate.coverageDigest;
      // Evidence used to abort a drain is never sufficient to thaw a later
      // FROZEN window. MARK_FROZEN forces a fresh post-freeze close attestation.
      const nextRecoveryWindowDigest =
        reopening || beginningDrain || enteringFrozen ? null : gate.recoveryWindowDigest;

      const updated = await tx.$executeRaw`
        UPDATE "StorageWriteGate"
        SET "phase" = ${phase},
            "epoch" = ${nextEpoch},
            "coverageDigest" = ${nextCoverageDigest},
            "recoveryWindowDigest" = ${nextRecoveryWindowDigest},
            "operatorTicket" = ${ticket},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "scope" = ${input.scope} AND "epoch" = ${gate.epoch}
      `;
      if (updated !== 1) {
        throw new StorageWriteGateBlockedError("transition_conflict");
      }

      await tx.$executeRaw`
        INSERT INTO "StorageWriteGateAudit"
          ("id", "scope", "epochBefore", "epochAfter", "phaseBefore", "phaseAfter",
           "action", "actorUserId", "ticket", "reason", "idempotencyKey",
           "requestDigest", "occurredAt")
        VALUES (
          gen_random_uuid(), ${input.scope}, ${gate.epoch}, ${nextEpoch},
          ${gate.phase}, ${phase}, ${input.action},
          ${input.authority.actorUserId}, ${ticket},
          ${input.reason ?? null}, ${input.idempotencyKey ?? null},
          ${input.requestDigest ?? null}, CURRENT_TIMESTAMP
        )
      `;
      return {phase, epoch: nextEpoch};
    }, {maxWait: 3000, timeout: 8000});
  }
}

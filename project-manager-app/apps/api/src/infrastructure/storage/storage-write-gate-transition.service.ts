import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  resolveStorageWriteGateTransition,
  StorageWriteGateBlockedError,
  type StorageWriteGateAction,
  type StorageWriteGatePhase,
} from "./storage-write-gate-state.js";

/**
 * T-008 S2a: internal, transactional phase transitions.
 * Not exported from StorageModule and NOT exposed over HTTP in this slice.
 * This service alone cannot certify writer coverage or a production freeze.
 *
 * IMPORTANT: actorAuthorized and recoveryWindowClosed are verified decisions
 * from a future privileged policy service, NOT request/body flags.
 */
export type StorageTransitionAuthority = Readonly<{
  actorUserId: string;
  actorAuthorized: boolean;
  auditTicket: string;
  recoveryWindowClosed: boolean;
}>;

@Injectable()
export class StorageWriteGateTransitionService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(input: {
    scope: string;
    expectedEpoch: bigint;
    action: StorageWriteGateAction;
    authority: StorageTransitionAuthority;
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
    const ticket = input.authority.auditTicket;

    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{
        scope: string; phase: StorageWriteGatePhase; epoch: bigint;
        coverageDigest: string | null;
      }>>`
        SELECT "scope", "phase", "epoch", "coverageDigest"
        FROM "StorageWriteGate"
        WHERE "scope" = ${input.scope}
        FOR UPDATE
      `;
      if (rows.length !== 1) throw new StorageWriteGateBlockedError("gate_not_provisioned");
      const gate = rows[0]!;
      if (gate.epoch !== input.expectedEpoch) {
        throw new StorageWriteGateBlockedError("stale_epoch");
      }
      const counts = await tx.$queryRaw<Array<{active: bigint}>>`
        SELECT count(*)::bigint AS "active"
        FROM "StorageWriteOperation"
        WHERE "scope" = ${input.scope} AND "state" = 'ACTIVE'
      `;
      const active = counts[0]?.active ?? 0n;
      if (active > BigInt(Number.MAX_SAFE_INTEGER)) throw new StorageWriteGateBlockedError("active_count_overflow");
      // Never bump the epoch on ABORT_DRAIN while pre-admitted writes are
      // active: their tokens would be fenced out without a clean settlement.
      // An operator must wait for zero ACTIVE (or perform audited recovery).
      if (input.action === "ABORT_DRAIN" && active !== 0n) {
        throw new StorageWriteGateBlockedError("active_operations");
      }
      const phase = resolveStorageWriteGateTransition({
        phase: gate.phase,
        activeOperations: Number(active),
        // Until recovery can prove termination, all abandoned ACTIVE tickets
        // remain counted as active and prevent MARK_FROZEN.
        ambiguousOperations: 0,
        writerCoverageComplete: gate.coverageDigest !== null,
      }, {
        action: input.action,
        administratorAuthorized: true,
        ticket,
        authorityAvailable: true,
        recoveryWindowClosed: input.authority.recoveryWindowClosed,
      });
      // Draining preserves the epoch so pre-admitted writers can finish.
      // Reopening bumps epoch, invalidating stale tokens AND the writer
      // coverage attestation. Every freeze cycle must establish current
      // deployment/writer coverage again before MARK_FROZEN can pass.
      const reopening = input.action === "THAW" || input.action === "ABORT_DRAIN";
      const nextEpoch = gate.epoch + (reopening ? 1n : 0n);
      const nextCoverageDigest = reopening ? null : gate.coverageDigest;
      const updated = await tx.$executeRaw`
        UPDATE "StorageWriteGate"
        SET "phase" = ${phase}, "epoch" = ${nextEpoch},
            "coverageDigest" = ${nextCoverageDigest},
            "operatorTicket" = ${ticket}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "scope" = ${input.scope} AND "epoch" = ${gate.epoch}
      `;
      if (updated !== 1) throw new StorageWriteGateBlockedError("transition_conflict");
      // Only anonymous operational identifiers in audit; never original paths
      // or image bytes. Transaction rollback must roll back phase AND audit.
      await tx.$executeRaw`
        INSERT INTO "StorageWriteGateAudit"
          ("id", "scope", "epochBefore", "epochAfter", "phaseBefore", "phaseAfter",
           "action", "actorUserId", "ticket", "occurredAt")
        VALUES (gen_random_uuid(), ${input.scope}, ${gate.epoch}, ${nextEpoch},
                ${gate.phase}, ${phase}, ${input.action},
                ${input.authority.actorUserId}, ${ticket}, CURRENT_TIMESTAMP)
      `;
      return {phase, epoch: nextEpoch};
    }, {maxWait: 3000, timeout: 8000});
  }
}

import { Injectable } from "@nestjs/common";
import {
  StorageWriteGateBlockedError,
  assertStorageWriteAdmission,
} from "./storage-write-gate-state.js";
import {
  StorageWriteGateCoordinator,
  type StorageWriteKind,
  type StorageWriteTicket,
} from "./storage-write-gate-coordinator.js";

/**
 * T-008 S2b: one admitted write lifecycle. An "ACTIVE" ticket covers the full
 * externally visible mutation AND dependent metadata, not merely the bytes.
 *
 * Standalone internal component, NOT provided by StorageModule yet.
 * Caller must hold the same ticket from before its first write through the
 * final Evidence/Postgres operation. This is not a freeze implementation.
 */
@Injectable()
export class StorageWriteOperationBoundary {
  constructor(private readonly coordinator: StorageWriteGateCoordinator) {}

  async run<T>(input: {
    scope: string;
    writerInstanceId: string;
    kind: StorageWriteKind;
    /** Executes the complete mutation, including filesystem and metadata. */
    work: (ticket: StorageWriteTicket) => Promise<T>;
    /**
     * Optional proof of clean failure. Must throw if either staging cleanup or
     * Evidence/DB reconciliation is incomplete. A missing proof leaves ACTIVE
     * to block FROZEN until a human-authorized investigation.
     */
    proveCleanFailure?: (ticket: StorageWriteTicket, cause: unknown) => Promise<void>;
  }): Promise<T> {
    const ticket = await this.coordinator.admitWrite({
      scope: input.scope,
      writerInstanceId: input.writerInstanceId,
      kind: input.kind,
    });
    let result: T;
    try {
      // No bytes are admitted before the persistent ticket is committed.
      await this.coordinator.assertActive(ticket);
      result = await input.work(ticket);
    } catch (cause) {
      // Work failed: never assume an original was unpublished. Only a caller
      // able to prove that neither bytes nor metadata remain may settle clean.
      if (!input.proveCleanFailure) throw cause;
      try {
        await input.proveCleanFailure(ticket, cause);
        await this.coordinator.settleWrite(ticket, "FAILED_CLEAN");
      } catch {
        // Leave ACTIVE on cleanup/DB uncertainty, preserving original error.
        throw cause;
      }
      throw cause;
    }
    // Work succeeded, possibly having published immutable bytes. A settlement
    // error is a DISTINCT uncertainty and MUST NOT invoke cleanup callbacks.
    // The ACTIVE ticket intentionally remains until audited reconciliation.
    await this.coordinator.settleWrite(ticket, "COMPLETED");
    return result;
  }

  /**
   * Recheck persistent ticket before irreversible publication or unlink.
   * Validation alone cannot prove all writers are instrumented: it must be
   * followed by a complete writer inventory / SDD freeze certification.
   */
  /**
   * Advisory only: a previously issued upload plan is NOT an active ticket.
   * PUT/store must separately admit a durable ticket under the DB row lock.
   * Intended for isolated staging tests; no production freeze certification.
   */
  async assertPlanOpen(scope: string): Promise<void> {
    const current = await this.coordinator.inspect(scope);
    assertStorageWriteAdmission({
      phase: current.phase,
      activeOperations: current.activeOperations,
      ambiguousOperations: 0,
      writerCoverageComplete: current.coverageDigestPresent,
    }, true);
  }

  async beforePublish(ticket: StorageWriteTicket): Promise<void> {
    if (!ticket?.id || !ticket.scope) {
      throw new StorageWriteGateBlockedError("missing_active_ticket");
    }
    await this.coordinator.assertActive(ticket);
  }
}

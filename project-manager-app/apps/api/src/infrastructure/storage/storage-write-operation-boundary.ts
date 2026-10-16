import { Injectable } from "@nestjs/common";
import {
  StorageWriteGateBlockedError,
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
    try {
      // Calls outside the DB lock must not begin before admission commits.
      await this.coordinator.assertActive(ticket);
      const result = await input.work(ticket);
      // No reply success until settlement is durable.
      await this.coordinator.settleWrite(ticket, "COMPLETED");
      return result;
    } catch (cause) {
      // Ambiguous failure: do NOT silently release the active ticket. For
      // example a successful link() followed by a failed Evidence insert may
      // have published a real original; callers must reconcile before thaw.
      if (!input.proveCleanFailure) throw cause;
      try {
        await input.proveCleanFailure(ticket, cause);
        await this.coordinator.settleWrite(ticket, "FAILED_CLEAN");
      } catch {
        // Preserve the original error without claiming cleanup succeeded.
        // The persisted ACTIVE ticket is the fail-closed recovery blocker.
        throw cause;
      }
      throw cause;
    }
  }

  /**
   * Recheck persistent ticket before irreversible publication or unlink.
   * Validation alone cannot prove all writers are instrumented: it must be
   * followed by a complete writer inventory / SDD freeze certification.
   */
  async beforePublish(ticket: StorageWriteTicket): Promise<void> {
    if (!ticket?.id || !ticket.scope) {
      throw new StorageWriteGateBlockedError("missing_active_ticket");
    }
    await this.coordinator.assertActive(ticket);
  }
}

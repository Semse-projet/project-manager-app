/**
 * T-008: pure, deterministic state transition guards for the storage write gate.
 *
 * IMPORTANT: These checks are NOT a lock, persisted gate or runtime enforcement.
 * The caller MUST use a single database-serialized transaction for admission,
 * phase transitions and active operation accounting. No production writer calls
 * this module until the durable coordinator is implemented and validated.
 */
export type StorageWriteGatePhase = "OPEN" | "DRAINING" | "FROZEN";
export type StorageWriteGateAction = "BEGIN_DRAIN" | "MARK_FROZEN" | "THAW" | "ABORT_DRAIN";

export type StorageWriteGateSnapshot = Readonly<{
  phase: StorageWriteGatePhase;
  activeOperations: number;
  ambiguousOperations: number;
  writerCoverageComplete: boolean;
}>;

export type StorageWriteGateTransition = Readonly<{
  action: StorageWriteGateAction;
  administratorAuthorized: boolean;
  ticket: string;
  authorityAvailable: boolean;
  /** Required when returning to OPEN; prevents an accidental automatic thaw. */
  recoveryWindowClosed?: boolean;
}>;

export class StorageWriteGateBlockedError extends Error {
  readonly code = "STORAGE_WRITE_GATE_BLOCKED";
  readonly reason: string;
  constructor(reason: string) {
    super(`Storage write gate blocked: ${reason}`);
    this.reason = reason;
    this.name = "StorageWriteGateBlockedError";
  }
}

function deny(reason: string): never {
  throw new StorageWriteGateBlockedError(reason);
}

function validateSnapshot(snapshot: StorageWriteGateSnapshot): void {
  if (!["OPEN", "DRAINING", "FROZEN"].includes(snapshot.phase)) deny("invalid_phase");
  if (!Number.isSafeInteger(snapshot.activeOperations) || snapshot.activeOperations < 0 ||
      !Number.isSafeInteger(snapshot.ambiguousOperations) || snapshot.ambiguousOperations < 0 ||
      typeof snapshot.writerCoverageComplete !== "boolean") deny("invalid_snapshot");
  if (snapshot.phase === "FROZEN" &&
      (snapshot.activeOperations !== 0 || snapshot.ambiguousOperations !== 0 || !snapshot.writerCoverageComplete)) {
    deny("inconsistent_frozen_snapshot");
  }
}

/** Admission (not publication) must be evaluated inside the authoritative DB lock. */
export function assertStorageWriteAdmission(
  snapshot: StorageWriteGateSnapshot,
  authorityAvailable: boolean,
): void {
  if (!authorityAvailable) deny("authority_unavailable");
  validateSnapshot(snapshot);
  if (snapshot.phase !== "OPEN") deny("not_open");
}

/**
 * A pre-admitted writer may complete during DRAINING. It is never permitted
 * to publish after FROZEN. The persisted ACTIVE ticket must be fenced by the
 * DB coordinator; a boolean supplied by an API caller is NOT a capability.
 */
export function assertStorageWritePublication(
  snapshot: StorageWriteGateSnapshot,
  authorityAvailable: boolean,
  activeTicketVerified: boolean,
): void {
  if (!authorityAvailable) deny("authority_unavailable");
  validateSnapshot(snapshot);
  if (!activeTicketVerified) deny("missing_active_ticket");
  if (snapshot.phase === "FROZEN") deny("already_frozen");
}

/**
 * Pure transition authorization. The returned state is a *proposal only*;
 * caller must persist state and audit atomically under a database row lock.
 */
export function resolveStorageWriteGateTransition(
  snapshot: StorageWriteGateSnapshot,
  request: StorageWriteGateTransition,
): StorageWriteGatePhase {
  if (!request.authorityAvailable) deny("authority_unavailable");
  validateSnapshot(snapshot);
  if (!request.administratorAuthorized) deny("administrator_required");
  if (typeof request.ticket !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/.test(request.ticket)) {
    deny("invalid_audit_ticket");
  }
  switch (request.action) {
    case "BEGIN_DRAIN":
      if (snapshot.phase !== "OPEN") deny("transition_conflict");
      return "DRAINING";
    case "MARK_FROZEN":
      if (snapshot.phase !== "DRAINING") deny("transition_conflict");
      if (!snapshot.writerCoverageComplete) deny("writer_coverage_incomplete");
      if (snapshot.ambiguousOperations > 0) deny("ambiguous_operations");
      if (snapshot.activeOperations > 0) deny("active_operations");
      return "FROZEN";
    case "THAW":
      if (snapshot.phase !== "FROZEN") deny("transition_conflict");
      if (request.recoveryWindowClosed !== true) deny("recovery_window_not_closed");
      return "OPEN";
    case "ABORT_DRAIN":
      if (snapshot.phase !== "DRAINING") deny("transition_conflict");
      if (request.recoveryWindowClosed !== true) deny("recovery_window_not_closed");
      return "OPEN";
    default:
      return deny("invalid_action");
  }
}

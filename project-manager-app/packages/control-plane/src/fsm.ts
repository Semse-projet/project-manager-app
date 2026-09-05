import type { CapabilityObservedState } from "./types.js";

export interface CapabilityTransitionGuards {
  manifestValid?: boolean;
  dependenciesResolved?: boolean;
  planDigestRecorded?: boolean;
  targetRecorded?: boolean;
  policyDecisionRecorded?: boolean;
  policyAllowed?: boolean;
  approvalsSatisfied?: boolean;
  grantValid?: boolean;
  bindingCurrent?: boolean;
  leaseHeld?: boolean;
  livenessPassed?: boolean;
  requiredReadinessPassed?: boolean;
  rollbackRevisionAddressable?: boolean;
  incompatibleLease?: boolean;
  newOperation?: boolean;
}

export interface CapabilityTransitionResult {
  previousState: CapabilityObservedState;
  currentState: CapabilityObservedState;
  auditRequired: true;
  eventRequired: true;
}

const transitions: Readonly<Record<CapabilityObservedState, readonly CapabilityObservedState[]>> = {
  PENDING: ["PLANNED"],
  PLANNED: ["AWAITING_APPROVAL", "APPLYING", "BLOCKED"],
  AWAITING_APPROVAL: ["APPLYING", "BLOCKED"],
  APPLYING: ["VERIFYING", "DEGRADED", "ROLLING_BACK"],
  VERIFYING: ["ACTIVE", "DEGRADED", "ROLLING_BACK"],
  ACTIVE: ["APPLYING", "SUSPENDING", "DEGRADED"],
  DEGRADED: ["APPLYING", "ROLLING_BACK", "BLOCKED"],
  SUSPENDING: ["SUSPENDED", "DEGRADED"],
  SUSPENDED: ["PLANNED"],
  ROLLING_BACK: ["ROLLED_BACK", "BLOCKED"],
  ROLLED_BACK: ["PLANNED", "SUSPENDED"],
  BLOCKED: ["PLANNED"],
};

export class CapabilityTransitionError extends Error {
  readonly from: CapabilityObservedState;
  readonly to: CapabilityObservedState;

  constructor(from: CapabilityObservedState, to: CapabilityObservedState) {
    super(`capability transition denied: ${from} -> ${to}`);
    this.name = "CapabilityTransitionError";
    this.from = from;
    this.to = to;
  }
}

function planningGuardsSatisfied(guards: CapabilityTransitionGuards): boolean {
  return Boolean(
    guards.manifestValid &&
      guards.dependenciesResolved &&
      guards.planDigestRecorded &&
      guards.targetRecorded &&
      guards.policyDecisionRecorded,
  );
}

function applyGuardsSatisfied(guards: CapabilityTransitionGuards): boolean {
  return Boolean(
    guards.policyAllowed &&
      guards.approvalsSatisfied &&
      guards.grantValid &&
      guards.bindingCurrent &&
      guards.leaseHeld,
  );
}

export function canTransitionCapability(
  from: CapabilityObservedState,
  to: CapabilityObservedState,
  guards: CapabilityTransitionGuards,
): boolean {
  if (!transitions[from].includes(to)) return false;

  if (from === "PENDING" && to === "PLANNED") {
    return planningGuardsSatisfied(guards);
  }
  if (to === "APPLYING") {
    return applyGuardsSatisfied(guards);
  }
  if (from === "VERIFYING" && to === "ACTIVE") {
    return Boolean(guards.livenessPassed && guards.requiredReadinessPassed);
  }
  if (to === "ROLLING_BACK") {
    return Boolean(guards.rollbackRevisionAddressable && guards.grantValid);
  }
  if (from === "ACTIVE" && to === "SUSPENDING") {
    return guards.incompatibleLease === false;
  }
  if (
    (from === "BLOCKED" || from === "ROLLED_BACK" || from === "SUSPENDED") &&
    to === "PLANNED"
  ) {
    return guards.newOperation === true;
  }
  return true;
}

export function transitionCapability(
  from: CapabilityObservedState,
  to: CapabilityObservedState,
  guards: CapabilityTransitionGuards,
): CapabilityTransitionResult {
  if (!canTransitionCapability(from, to, guards)) {
    throw new CapabilityTransitionError(from, to);
  }
  return {
    previousState: from,
    currentState: to,
    auditRequired: true,
    eventRequired: true,
  };
}

export function capabilityTransitionsFrom(
  state: CapabilityObservedState,
): readonly CapabilityObservedState[] {
  return transitions[state];
}

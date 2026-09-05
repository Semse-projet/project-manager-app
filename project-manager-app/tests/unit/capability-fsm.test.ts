import assert from "node:assert/strict";
import test from "node:test";

import {
  CapabilityTransitionError,
  canTransitionCapability,
  transitionCapability,
} from "../../packages/control-plane/src/fsm.ts";

const plannedGuard = {
  manifestValid: true,
  dependenciesResolved: true,
  planDigestRecorded: true,
  targetRecorded: true,
  policyDecisionRecorded: true,
};

test("T-011: accepts canonical capability transitions with their guards", () => {
  assert.equal(
    canTransitionCapability("PENDING", "PLANNED", plannedGuard),
    true,
  );
  assert.equal(
    canTransitionCapability("PLANNED", "APPLYING", {
      policyAllowed: true,
      approvalsSatisfied: true,
      grantValid: true,
      bindingCurrent: true,
      leaseHeld: true,
    }),
    true,
  );
  assert.equal(
    canTransitionCapability("VERIFYING", "ACTIVE", {
      livenessPassed: true,
      requiredReadinessPassed: true,
    }),
    true,
  );
});

test("T-011: rejects missing guards and transitions absent from the canonical FSM", () => {
  assert.equal(
    canTransitionCapability("VERIFYING", "ACTIVE", {
      livenessPassed: true,
      requiredReadinessPassed: false,
    }),
    false,
  );
  assert.equal(canTransitionCapability("PENDING", "ACTIVE", {}), false);
  assert.throws(
    () => transitionCapability("ACTIVE", "ROLLED_BACK", {}),
    CapabilityTransitionError,
  );
});

test("T-011: blocked, rolled-back and suspended states re-enter only through a new operation", () => {
  for (const state of ["BLOCKED", "ROLLED_BACK", "SUSPENDED"] as const) {
    assert.equal(canTransitionCapability(state, "PLANNED", {}), false);
    assert.equal(
      canTransitionCapability(state, "PLANNED", { newOperation: true }),
      true,
    );
  }
});

test("T-011: a material transition requires audit and a domain event", () => {
  const result = transitionCapability("PENDING", "PLANNED", plannedGuard);

  assert.deepEqual(result, {
    previousState: "PENDING",
    currentState: "PLANNED",
    auditRequired: true,
    eventRequired: true,
  });
});

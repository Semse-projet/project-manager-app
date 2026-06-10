import test from "node:test";
import assert from "node:assert/strict";

type EscrowStatus = "pending" | "funded" | "held" | "partially_released" | "released" | "disputed" | "refunded";

function canTransitionEscrow(from: EscrowStatus, to: EscrowStatus): boolean {
  const transitions: Record<EscrowStatus, EscrowStatus[]> = {
    pending: ["funded"],
    funded: ["held"],
    held: ["partially_released", "released", "disputed"],
    partially_released: ["held", "released"],
    released: [],
    disputed: ["held", "released", "refunded"],
    refunded: [],
  };
  return transitions[from].includes(to);
}

test("escrow FSM: funding and hold are valid", () => {
  assert.ok(canTransitionEscrow("pending", "funded"));
  assert.ok(canTransitionEscrow("funded", "held"));
});

test("escrow FSM: held can partially release or fully release", () => {
  assert.ok(canTransitionEscrow("held", "partially_released"));
  assert.ok(canTransitionEscrow("held", "released"));
});

test("escrow FSM: dispute can resolve to held/released/refunded", () => {
  assert.ok(canTransitionEscrow("disputed", "held"));
  assert.ok(canTransitionEscrow("disputed", "released"));
  assert.ok(canTransitionEscrow("disputed", "refunded"));
});

test("escrow FSM: terminal states stay terminal", () => {
  assert.ok(!canTransitionEscrow("released", "held"));
  assert.ok(!canTransitionEscrow("refunded", "held"));
});

test("escrow FSM: release cannot exceed available balance", () => {
  function canReleaseAmount(totalAmount: number, releasedSoFar: number, amount: number): boolean {
    return amount <= totalAmount - releasedSoFar;
  }

  assert.ok(canReleaseAmount(1000, 250, 250));
  assert.ok(!canReleaseAmount(1000, 900, 200));
});

test("escrow FSM: disputed escrow blocks non-obligatory releases", () => {
  function canRelease(disputeOpen: boolean): boolean {
    return !disputeOpen;
  }

  assert.ok(canRelease(false));
  assert.ok(!canRelease(true));
});

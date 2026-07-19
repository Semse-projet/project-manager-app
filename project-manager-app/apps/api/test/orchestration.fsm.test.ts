import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  isTerminal,
  nextOrchestrationStatus,
} from "../dist/modules/orchestration/orchestration.fsm.js";

test("valid transitions", () => {
  assert.equal(canTransition("idle", "interpreting"), true);
  assert.equal(canTransition("interpreting", "ambiguity_resolving"), true);
  assert.equal(canTransition("interpreting", "agent_consultation"), true);
  assert.equal(canTransition("ambiguity_resolving", "agent_consultation"), true);
  assert.equal(canTransition("agent_consultation", "execution"), true);
  assert.equal(canTransition("execution", "completed"), true);
});

test("any active state can fail", () => {
  for (const s of ["idle", "interpreting", "ambiguity_resolving", "agent_consultation", "execution"] as const) {
    assert.equal(canTransition(s, "failed"), true);
  }
});

test("terminal states have no outgoing transitions", () => {
  assert.equal(canTransition("completed", "idle"), false);
  assert.equal(canTransition("failed", "idle"), false);
});

test("invalid transitions rejected", () => {
  assert.equal(canTransition("idle", "completed"), false);
  assert.equal(canTransition("interpreting", "execution"), false);
});

test("nextOrchestrationStatus returns target when legal", () => {
  assert.equal(nextOrchestrationStatus("idle", "interpreting"), "interpreting");
});

test("nextOrchestrationStatus throws when illegal", () => {
  assert.throws(() => nextOrchestrationStatus("idle", "completed"), /Illegal orchestration transition/);
});

test("isTerminal", () => {
  assert.equal(isTerminal("completed"), true);
  assert.equal(isTerminal("failed"), true);
  assert.equal(isTerminal("idle"), false);
});

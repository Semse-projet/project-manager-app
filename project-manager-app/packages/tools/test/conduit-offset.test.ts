import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateConduitOffset,
  assertBenderVerifiedForMarking,
  InvalidConduitOffsetInputError,
  UnverifiedBenderError,
} from "../dist/index.js";

test("golden case: 6in offset @ 30deg -> 12in spacing", () => {
  const result = calculateConduitOffset({ offsetIn: 6, angleDeg: 30 });
  assert.ok(Math.abs(result.spacingIn - 12) < 1e-9, `expected 12, got ${result.spacingIn}`);
  assert.equal(result.offsetIn, 6);
  assert.equal(result.angleDeg, 30);
});

test("spacing formula matches offset / sin(angle) for a non-golden case", () => {
  const result = calculateConduitOffset({ offsetIn: 4, angleDeg: 45 });
  const expected = 4 / Math.sin((45 * Math.PI) / 180);
  assert.ok(Math.abs(result.spacingIn - expected) < 1e-9);
});

test("theoretical shrink is a distinct field using offset * tan(angle/2), never conflated with spacing", () => {
  const result = calculateConduitOffset({ offsetIn: 6, angleDeg: 30 });
  const expectedShrink = 6 * Math.tan(((30 * Math.PI) / 180) / 2);
  assert.ok(Math.abs(result.theoreticalShrinkIn - expectedShrink) < 1e-9);
  assert.notEqual(result.theoreticalShrinkIn, result.spacingIn);
});

test("rejects non-finite or out-of-range inputs instead of returning corrupted geometry", () => {
  assert.throws(() => calculateConduitOffset({ offsetIn: 0, angleDeg: 30 }), InvalidConduitOffsetInputError);
  assert.throws(() => calculateConduitOffset({ offsetIn: 6, angleDeg: 0 }), InvalidConduitOffsetInputError);
  assert.throws(() => calculateConduitOffset({ offsetIn: 6, angleDeg: 180 }), InvalidConduitOffsetInputError);
  assert.throws(() => calculateConduitOffset({ offsetIn: Number.NaN, angleDeg: 30 }), InvalidConduitOffsetInputError);
});

test("unverified bender profile hard-blocks marking synthesis", () => {
  assert.throws(
    () => assertBenderVerifiedForMarking({ verified: false }),
    UnverifiedBenderError
  );
});

test("verified bender profile passes the marking guard", () => {
  assert.doesNotThrow(() =>
    assertBenderVerifiedForMarking({ verified: true, profile: { name: "Greenlee 555" } })
  );
});

test("geometry stays available even when the caller never reaches marking synthesis", () => {
  // Simulates a caller with an unverified bender: geometry must still be computable independently.
  const geometry = calculateConduitOffset({ offsetIn: 6, angleDeg: 30 });
  assert.ok(Number.isFinite(geometry.spacingIn));
  let markingBlocked = false;
  try {
    assertBenderVerifiedForMarking({ verified: false });
  } catch (err) {
    markingBlocked = err instanceof UnverifiedBenderError;
  }
  assert.ok(markingBlocked, "marking must be blocked while geometry remains available");
});

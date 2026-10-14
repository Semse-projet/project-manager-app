import test from "node:test";
import assert from "node:assert/strict";
import { applyVerifiedSignatureEventOnce } from "../dist/modules/contracts/signature-event-idempotency.js";

const key = "a".repeat(64);

test("first event applies and duplicate does not apply", async () => {
  const claimed = new Set<string>();
  const store = { async claimOnce(k: string) {
    if (claimed.has(k)) return false;
    claimed.add(k);
    return true;
  } };
  let effects = 0;
  assert.equal(await applyVerifiedSignatureEventOnce(key, store, async () => { effects++; }), "applied");
  assert.equal(await applyVerifiedSignatureEventOnce(key, store, async () => { effects++; }), "duplicate");
  assert.equal(effects, 1);
});

test("invalid replay keys fail before calling store", async () => {
  let called = false;
  await assert.rejects(applyVerifiedSignatureEventOnce("not-a-hash", {
    async claimOnce() { called = true; return true; },
  }, async () => {}), /Invalid/);
  assert.equal(called, false);
});

test("claim store failures fail closed", async () => {
  let effects = 0;
  await assert.rejects(applyVerifiedSignatureEventOnce(key, {
    async claimOnce(): Promise<boolean> { throw new Error("database unavailable"); },
  }, async () => { effects++; }), /database unavailable/);
  assert.equal(effects, 0);
});

test("invalid claim store result cannot authorize side effects", async () => {
  let effects = 0;
  await assert.rejects(applyVerifiedSignatureEventOnce(key, {
    async claimOnce(): Promise<boolean> { return undefined as unknown as boolean; },
  }, async () => { effects++; }), /invalid result/);
  assert.equal(effects, 0);
});

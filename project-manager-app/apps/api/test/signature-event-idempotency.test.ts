import test from "node:test";
import assert from "node:assert/strict";
import {
  applyVerifiedSignatureEventOnce,
  type SignatureEventTransactionManager,
} from "../dist/modules/contracts/signature-event-idempotency.js";

const key = "a".repeat(64);

/** Test-only transactional fake: production MUST use a durable database. */
function createManager() {
  const committed = new Set<string>();
  const manager: SignatureEventTransactionManager = {
    async transaction(work) {
      const pending = new Set(committed);
      const result = await work({
        async claimOnce(k) {
          if (pending.has(k)) return false;
          pending.add(k);
          return true;
        },
      });
      committed.clear();
      for (const k of pending) committed.add(k);
      return result;
    },
  };
  return { manager, committed };
}

test("first event applies and duplicate does not apply", async () => {
  const { manager } = createManager();
  let effects = 0;
  assert.equal(await applyVerifiedSignatureEventOnce(key, manager, async () => { effects++; }), "applied");
  assert.equal(await applyVerifiedSignatureEventOnce(key, manager, async () => { effects++; }), "duplicate");
  assert.equal(effects, 1);
});

test("invalid replay key fails before opening a transaction", async () => {
  let called = false;
  await assert.rejects(applyVerifiedSignatureEventOnce("invalid", {
    async transaction() { called = true; throw new Error("unexpected"); },
  }, async () => {}), /Invalid/);
  assert.equal(called, false);
});

test("claim store failure fails closed", async () => {
  let effects = 0;
  await assert.rejects(applyVerifiedSignatureEventOnce(key, {
    async transaction(work) {
      return work({ async claimOnce(): Promise<boolean> { throw new Error("database unavailable"); } });
    },
  }, async () => { effects++; }), /database unavailable/);
  assert.equal(effects, 0);
});

test("invalid claim result cannot authorize side effects", async () => {
  let effects = 0;
  await assert.rejects(applyVerifiedSignatureEventOnce(key, {
    async transaction(work) {
      return work({ async claimOnce(): Promise<boolean> { return undefined as unknown as boolean; } });
    },
  }, async () => { effects++; }), /invalid result/);
  assert.equal(effects, 0);
});

test("failed business operation rolls back replay claim", async () => {
  const { manager, committed } = createManager();
  await assert.rejects(applyVerifiedSignatureEventOnce(key, manager, async () => {
    throw new Error("effect failed");
  }), /effect failed/);
  assert.equal(committed.has(key), false);
  assert.equal(await applyVerifiedSignatureEventOnce(key, manager, async () => {}), "applied");
});

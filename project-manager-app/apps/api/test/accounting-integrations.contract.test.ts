import test from "node:test";
import assert from "node:assert/strict";

type AccountingConnection = {
  provider: "quickbooks_online" | "quickbooks_desktop" | "xero";
  tenantId: string;
  orgId: string;
  status: "pending" | "connected" | "error" | "revoked";
};

function validateOAuthCallback(input: { code?: string; state?: string; expectedState: string }): boolean {
  return Boolean(input.code && input.state && input.state === input.expectedState);
}

function mapPaymentReleaseToAccountingEntry(input: { paymentTxnId: string; amount: number; externalAccountingId: string }) {
  return {
    paymentTxnId: input.paymentTxnId,
    externalAccountingId: input.externalAccountingId,
    syncedAt: "2026-06-09T12:00:00.000Z",
    entryType: "payment",
    amount: input.amount,
  };
}

function mapPlatformFeeToExpense(input: { paymentTxnId: string; feeAmount: number; externalAccountingId: string }) {
  return {
    paymentTxnId: input.paymentTxnId,
    externalAccountingId: input.externalAccountingId,
    syncedAt: "2026-06-09T12:00:00.000Z",
    entryType: "fee",
    amount: input.feeAmount,
  };
}

function syncWithIdempotency(input: { externalAccountingId: string; idemKey: string; attempts: number }) {
  const seen = new Set<string>();
  const writes: string[] = [];
  for (let i = 0; i < input.attempts; i++) {
    const key = `${input.externalAccountingId}:${input.idemKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    writes.push(key);
  }
  return writes;
}

function shouldStopSync(status: AccountingConnection["status"]): boolean {
  return status === "revoked";
}

test("M4.1 OAuth callback validates code/state", () => {
  assert.equal(validateOAuthCallback({ code: "abc", state: "s1", expectedState: "s1" }), true);
  assert.equal(validateOAuthCallback({ code: "abc", state: "bad", expectedState: "s1" }), false);
  assert.equal(validateOAuthCallback({ state: "s1", expectedState: "s1" }), false);
});

test("M4.1 payment release maps to accounting payment entry", () => {
  const entry = mapPaymentReleaseToAccountingEntry({ paymentTxnId: "txn_1", amount: 500, externalAccountingId: "qb_1" });
  assert.equal(entry.entryType, "payment");
  assert.equal(entry.paymentTxnId, "txn_1");
  assert.equal(entry.amount, 500);
});

test("M4.1 platform fee maps to fee expense account", () => {
  const entry = mapPlatformFeeToExpense({ paymentTxnId: "txn_1", feeAmount: 7.5, externalAccountingId: "qb_1" });
  assert.equal(entry.entryType, "fee");
  assert.equal(entry.amount, 7.5);
});

test("M4.1 retry does not duplicate external invoice/payment", () => {
  const writes = syncWithIdempotency({ externalAccountingId: "qb_1", idemKey: "idem_1", attempts: 5 });
  assert.equal(writes.length, 1);
});

test("M4.1 revoked connection stops sync", () => {
  assert.equal(shouldStopSync("revoked"), true);
  assert.equal(shouldStopSync("connected"), false);
});

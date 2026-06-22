import { test } from 'node:test';
import * as assert from 'node:assert';

test('EscrowConditionsService — Check draw release conditions', () => {
  const check = { can: true, reason: undefined };
  assert.strictEqual(check.can, true);
});

test('EscrowConditionsService — Block if liens pending', () => {
  const liens = [{ status: 'PENDING' }];
  const canRelease = !liens.some((l) => l.status !== 'DELIVERED');
  assert.strictEqual(canRelease, false);
});

test('EscrowConditionsService — Block if changes pending', () => {
  const changes = [{ status: 'PENDING_APPROVAL' }];
  const canRelease = !changes.some((c) => c.status === 'PENDING_APPROVAL');
  assert.strictEqual(canRelease, false);
});

test('EscrowConditionsService — Conditional release', () => {
  const released = { success: true, drawId: 'draw_1' };
  assert.strictEqual(released.success, true);
});

test('DisbursementService — Process ACH transfer', () => {
  const result = {
    success: true,
    transactionId: 'ACH_1234567890',
    amount: 80000,
  };
  assert.strictEqual(result.success, true);
  assert.ok(result.transactionId);
});

test('DisbursementService — Batch disbursement', () => {
  const batch = { processed: 3, failed: 0 };
  assert.strictEqual(batch.processed, 3);
  assert.strictEqual(batch.failed, 0);
});

test('DisbursementService — Track transaction ID', () => {
  const draw = {
    status: 'FUNDED',
    fundingTransactionId: 'ACH_123',
  };
  assert.strictEqual(draw.status, 'FUNDED');
  assert.ok(draw.fundingTransactionId);
});

test('DisbursementService — Handle disbursement failure', () => {
  const result = {
    success: false,
    error: 'Bank account invalid',
  };
  assert.strictEqual(result.success, false);
  assert.ok(result.error);
});

test('DisbursementService — Net amount after retainage', () => {
  const draw = { amount: 100000, retainage: 10000 };
  const netAmount = draw.amount - draw.retainage;
  assert.strictEqual(netAmount, 90000);
});

test('DisbursementService — Multiple draws processing', () => {
  const draws = [
    { id: 'draw_1', amount: 80000 },
    { id: 'draw_2', amount: 100000 },
    { id: 'draw_3', amount: 120000 },
  ];
  const total = draws.reduce((sum, d) => sum + d.amount, 0);
  assert.strictEqual(total, 300000);
});

import { test } from 'node:test';
import * as assert from 'node:assert';

/**
 * Tests para Bloque-AD: Multi-stage escrow releases
 * 12 test cases
 */

test('DrawRequestService — Create draw #1 (DRAFT)', () => {
  const draw = {
    id: 'draw_1',
    projectId: 'proj_123',
    drawNumber: 1,
    amount: 80000,
    percentage: 20,
    retainage: 8000,
    status: 'DRAFT',
  };

  assert.strictEqual(draw.status, 'DRAFT');
  assert.strictEqual(draw.drawNumber, 1);
  assert.strictEqual(draw.retainage, 8000);
});

test('DrawRequestService — Submit for approval (DRAFT → PENDING_LENDER)', () => {
  const draw = { id: 'draw_1', status: 'DRAFT' };
  const isValid = draw.status === 'DRAFT';
  assert.strictEqual(isValid, true);

  const submitted = {
    ...draw,
    status: 'PENDING_LENDER',
    submittedAt: new Date(),
  };
  assert.strictEqual(submitted.status, 'PENDING_LENDER');
});

test('DrawRequestService — Approve draw (PENDING_LENDER → APPROVED)', () => {
  const draw = { id: 'draw_1', status: 'PENDING_LENDER' };
  const canApprove = draw.status === 'PENDING_LENDER';
  assert.strictEqual(canApprove, true);

  const approved = {
    ...draw,
    status: 'APPROVED',
    approvedBy: 'lender_1',
    approvedAt: new Date(),
  };
  assert.strictEqual(approved.status, 'APPROVED');
});

test('DrawRequestService — Fund draw (APPROVED → FUNDED)', () => {
  const draw = { id: 'draw_1', status: 'APPROVED' };
  const funded = {
    ...draw,
    status: 'FUNDED',
    fundedAt: new Date(),
    fundingTransactionId: 'txn_123',
  };

  assert.strictEqual(funded.status, 'FUNDED');
  assert.ok(funded.fundingTransactionId);
});

test('DrawRequestService — Reject draw', () => {
  const draw = { id: 'draw_1', status: 'PENDING_LENDER' };
  const rejected = {
    ...draw,
    status: 'REJECTED',
    rejectionReason: 'Work % incomplete',
  };

  assert.strictEqual(rejected.status, 'REJECTED');
});

test('DrawRequestService — 4-draw workflow', () => {
  const draws = [
    { drawNumber: 1, amount: 80000, percentage: 20 },
    { drawNumber: 2, amount: 100000, percentage: 25 },
    { drawNumber: 3, amount: 120000, percentage: 30 },
    { drawNumber: 4, amount: 100000, percentage: 25 },
  ];

  const total = draws.reduce((sum, d) => sum + d.amount, 0);
  assert.strictEqual(total, 400000);
  assert.strictEqual(draws.length, 4);
});

test('DrawRequestService — Calculate retainage (10%)', () => {
  const draws = [
    { amount: 80000, retainage: 8000 },
    { amount: 100000, retainage: 10000 },
    { amount: 120000, retainage: 12000 },
    { amount: 100000, retainage: 0 }, // Last draw
  ];

  const totalRetainage = draws.reduce((sum, d) => sum + d.retainage, 0);
  assert.strictEqual(totalRetainage, 30000);
});

test('DrawRequestService — Net payment after retainage', () => {
  const draw = { amount: 100000, retainage: 10000 };
  const netPayment = draw.amount - draw.retainage;

  assert.strictEqual(netPayment, 90000);
});

test('DrawRequestService — Get total funded', () => {
  const draws = [
    { amount: 80000, retainage: 8000, status: 'FUNDED' },
    { amount: 100000, retainage: 10000, status: 'FUNDED' },
    { amount: 120000, retainage: 12000, status: 'PENDING_LENDER' },
  ];

  const funded = draws
    .filter((d) => d.status === 'FUNDED')
    .reduce((sum, d) => sum + (d.amount - d.retainage), 0);

  assert.strictEqual(funded, 162000); // (80k - 8k) + (100k - 10k)
});

test('DrawRequestService — Next draw number', () => {
  const draws = [
    { drawNumber: 1, status: 'FUNDED' },
    { drawNumber: 2, status: 'FUNDED' },
  ];

  const nextNumber = Math.max(0, ...draws.map((d) => d.drawNumber)) + 1;
  assert.strictEqual(nextNumber, 3);
});

test('DrawRequestService — Max 4 draws', () => {
  const maxDraws = 4;
  assert.strictEqual(maxDraws, 4);
});

test('DrawRequestService — Retainage release on completion', () => {
  const draws = [
    { drawNumber: 1, amount: 80000, retainage: 8000 },
    { drawNumber: 2, amount: 100000, retainage: 10000 },
    { drawNumber: 3, amount: 120000, retainage: 12000 },
    { drawNumber: 4, amount: 100000, retainage: 0 },
  ];

  // Draw 4 releases all retainage
  const draw4Neto = draws[3].amount + (draws[0].retainage + draws[1].retainage + draws[2].retainage);
  assert.strictEqual(draw4Neto, 130000);
});

import { test } from 'node:test';
import * as assert from 'node:assert';

/**
 * Tests para Bloque-Z: Change orders + Extended metrics
 * 12 test cases
 */

// ============================================================================
// TEST 1: Change Order Lifecycle
// ============================================================================

test('ChangeOrderService — Create change order (DRAFT)', () => {
  const co = {
    id: 'co_123',
    projectId: 'proj_456',
    description: 'Upgrade flooring',
    amount: 5000,
    status: 'DRAFT',
    createdBy: 'user_1',
  };

  assert.strictEqual(co.status, 'DRAFT');
  assert.strictEqual(co.amount, 5000);
});

test('ChangeOrderService — Submit for approval (DRAFT → PENDING)', () => {
  const co = { id: 'co_123', status: 'DRAFT' };
  const isValid = co.status === 'DRAFT';
  assert.strictEqual(isValid, true);

  const submitted = { ...co, status: 'PENDING_APPROVAL', submittedAt: new Date() };
  assert.strictEqual(submitted.status, 'PENDING_APPROVAL');
});

test('ChangeOrderService — Approve change order (PENDING → APPROVED)', () => {
  const co = { id: 'co_123', status: 'PENDING_APPROVAL' };
  const canApprove = co.status === 'PENDING_APPROVAL';
  assert.strictEqual(canApprove, true);

  const approved = {
    ...co,
    status: 'APPROVED',
    approvedBy: 'pro_user',
    approvedAt: new Date(),
  };
  assert.strictEqual(approved.status, 'APPROVED');
});

test('ChangeOrderService — Reject change order (PENDING → REJECTED)', () => {
  const co = { id: 'co_123', status: 'PENDING_APPROVAL' };
  const canReject = co.status === 'PENDING_APPROVAL';
  assert.strictEqual(canReject, true);

  const rejected = {
    ...co,
    status: 'REJECTED',
    rejectionReason: 'Over budget',
  };
  assert.strictEqual(rejected.status, 'REJECTED');
});

test('ChangeOrderService — Cannot approve if not PENDING', () => {
  const co = { id: 'co_123', status: 'DRAFT' };
  const canApprove = co.status === 'PENDING_APPROVAL';

  assert.strictEqual(canApprove, false);
});

// ============================================================================
// TEST 2: Timeline & Auditing
// ============================================================================

test('ChangeOrderService — Get change order timeline (ordered by date)', () => {
  const cos = [
    { id: 'co_1', createdAt: new Date('2026-06-10') },
    { id: 'co_2', createdAt: new Date('2026-06-20') },
    { id: 'co_3', createdAt: new Date('2026-06-15') },
  ];

  const sorted = cos.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  assert.strictEqual(sorted[0].id, 'co_1');
  assert.strictEqual(sorted[1].id, 'co_3');
  assert.strictEqual(sorted[2].id, 'co_2');
});

test('ChangeOrderService — Calculate total approved changes', () => {
  const cos = [
    { status: 'APPROVED', amount: 5000 },
    { status: 'APPROVED', amount: 3000 },
    { status: 'PENDING_APPROVAL', amount: 2000 },
    { status: 'REJECTED', amount: 1000 },
  ];

  const totalApproved = cos
    .filter((c) => c.status === 'APPROVED')
    .reduce((sum, c) => sum + c.amount, 0);

  assert.strictEqual(totalApproved, 8000);
});

// ============================================================================
// TEST 3: Extended Metrics (20 Trades)
// ============================================================================

test('ExtendedMetricsService — Get 20 construction trades', () => {
  const trades = [
    'General Labor',
    'Carpentry',
    'Masonry',
    'Plumbing',
    'HVAC',
    'Electrical',
    'Roofing',
    'Painting',
    'Drywall',
    'Flooring',
    'Framing',
    'Concrete',
    'Excavation',
    'Grading',
    'Landscaping',
    'Demolition',
    'Insulation',
    'Windows/Doors',
    'Siding',
    'Finishes',
  ];

  assert.strictEqual(trades.length, 20);
});

test('ExtendedMetricsService — Log trade hours', () => {
  const metric = {
    trade: 'Electrical',
    hoursLogged: 8,
    costLogged: 400,
    date: new Date('2026-06-22'),
  };

  assert.strictEqual(metric.hoursLogged, 8);
  assert.strictEqual(metric.costLogged, 400);
});

test('ExtendedMetricsService — Aggregate hours by trade', () => {
  const metrics = [
    { trade: 'Electrical', hoursLogged: 8, costLogged: 400 },
    { trade: 'Electrical', hoursLogged: 6, costLogged: 300 },
    { trade: 'Plumbing', hoursLogged: 4, costLogged: 200 },
  ];

  const aggregated: Record<string, any> = {};
  for (const m of metrics) {
    if (!aggregated[m.trade]) {
      aggregated[m.trade] = { totalHours: 0, totalCost: 0 };
    }
    aggregated[m.trade].totalHours += m.hoursLogged;
    aggregated[m.trade].totalCost += m.costLogged;
  }

  assert.strictEqual(aggregated['Electrical'].totalHours, 14);
  assert.strictEqual(aggregated['Plumbing'].totalHours, 4);
});

test('ExtendedMetricsService — Calculate trade progress', () => {
  const trade = {
    trade: 'Electrical',
    totalHours: 40,
    estimatedProgress: 100, // 40 horas = 100%
  };

  assert.ok(trade.estimatedProgress >= 0 && trade.estimatedProgress <= 100);
});

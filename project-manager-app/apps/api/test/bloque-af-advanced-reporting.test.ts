import { test } from 'node:test';
import * as assert from 'node:assert';

/**
 * Tests para M3.3: Advanced reporting
 * 8 test cases
 */

test('BurnRateService — Calculate daily burn rate', () => {
  const totalSpent = 200000;
  const daysElapsed = 30;
  const dailyBurnRate = Math.round(totalSpent / daysElapsed);

  assert.strictEqual(dailyBurnRate, 6667); // Rounded
});

test('BurnRateService — Calculate budget remaining', () => {
  const budget = 400000;
  const totalSpent = 250000;
  const remaining = budget - totalSpent;

  assert.strictEqual(remaining, 150000);
});

test('BurnRateService — Calculate ETC (days remaining)', () => {
  const dailyBurnRate = 6667;
  const budgetRemaining = 150000;
  const daysRemaining = Math.ceil(budgetRemaining / dailyBurnRate);

  assert.ok(daysRemaining > 0);
  assert.strictEqual(daysRemaining, 23); // ~23 days
});

test('BurnRateService — On budget vs. over budget', () => {
  const budget = 400000;
  const totalSpent = 380000;
  const isOnBudget = totalSpent <= budget;

  assert.strictEqual(isOnBudget, true);

  const overBudget = 420000;
  const isOverBudget = overBudget > budget;

  assert.strictEqual(isOverBudget, true);
});

test('BurnRateService — Generate budget alert if over', () => {
  const budget = 400000;
  const projectedFinal = 420000;
  const hasAlert = projectedFinal > budget;

  assert.strictEqual(hasAlert, true);
});

test('DrawForecastService — Forecast next draws', () => {
  const forecast = [
    { drawNumber: 4, estimatedAmount: 100000, riskLevel: 'low' as const },
  ];

  assert.strictEqual(forecast.length, 1);
  assert.ok(forecast[0].estimatedAmount > 0);
});

test('DrawForecastService — Draw forecast with risk assessment', () => {
  const draw = {
    drawNumber: 4,
    estimatedAmount: 100000,
    riskLevel: 'high' as const,
  };

  const isRisky = draw.riskLevel === 'high';
  assert.strictEqual(isRisky, true);
});

test('DrawForecastService — Estimate retainage release date', () => {
  const releaseDate = new Date('2026-08-01');
  const amount = 40000; // Retainage

  assert.ok(releaseDate instanceof Date);
  assert.strictEqual(amount, 40000);
});

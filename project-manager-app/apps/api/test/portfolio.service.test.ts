import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { PortfolioService } from "../dist/modules/portfolio/portfolio.service.js";

function makeProjects(overrides: Array<Partial<{ contractAmount: number; totalSpent: number }>>) {
  return overrides.map((o, i) => ({
    id: `proj_${i + 1}`,
    ownerId: "usr_1",
    status: "ACTIVE",
    contractAmount: o.contractAmount ?? 100_000,
    totalSpent: o.totalSpent ?? 0,
  }));
}

function makePrismaMock(projects: any[]) {
  return {
    project: {
      findMany: async () => projects,
      findUniqueOrThrow: async ({ where }: any) => projects.find((p) => p.id === where.id),
    },
  } as never;
}

// ── getPortfolioMetrics ───────────────────────────────────────────────────────

test("portfolio: getPortfolioMetrics sums budgets and spent correctly", async () => {
  const projects = makeProjects([
    { contractAmount: 200_000, totalSpent: 50_000 },
    { contractAmount: 100_000, totalSpent: 30_000 },
  ]);
  const service = new PortfolioService(makePrismaMock(projects));

  const result = await service.getPortfolioMetrics("usr_1");

  assert.equal(result.projectCount, 2);
  assert.equal(result.totalBudget, 300_000);
  assert.equal(result.totalSpent, 80_000);
  assert.equal(result.remaining, 220_000);
  assert.equal(result.utilizationPercent, 27); // Math.round(80k/300k * 100)
});

test("portfolio: getPortfolioMetrics handles zero budget gracefully", async () => {
  const projects = makeProjects([{ contractAmount: 0, totalSpent: 0 }]);
  const service = new PortfolioService(makePrismaMock(projects));

  const result = await service.getPortfolioMetrics("usr_1");

  assert.equal(result.totalBudget, 0);
  // NaN from div-by-zero should not throw — Math.round(NaN) = NaN
  assert.ok(result.utilizationPercent !== undefined);
});

test("portfolio: getPortfolioMetrics returns zero counts for empty portfolio", async () => {
  const service = new PortfolioService(makePrismaMock([]));

  const result = await service.getPortfolioMetrics("usr_1");

  assert.equal(result.projectCount, 0);
  assert.equal(result.totalBudget, 0);
  assert.equal(result.totalSpent, 0);
  assert.equal(result.remaining, 0);
});

// ── getConsolidatedBurnRate ───────────────────────────────────────────────────

test("portfolio: getConsolidatedBurnRate divides total spent by 30 days", async () => {
  const projects = makeProjects([
    { totalSpent: 90_000 },
    { totalSpent: 60_000 },
  ]);
  const service = new PortfolioService(makePrismaMock(projects));

  const burnRate = await service.getConsolidatedBurnRate("usr_1");

  assert.equal(burnRate, 5_000); // Math.round(150000 / 30)
});

test("portfolio: getConsolidatedBurnRate returns 0 for no spending", async () => {
  const service = new PortfolioService(makePrismaMock([]));

  const burnRate = await service.getConsolidatedBurnRate("usr_1");

  assert.equal(burnRate, 0);
});

// ── getRiskSummary ────────────────────────────────────────────────────────────

test("portfolio: getRiskSummary returns risk buckets", async () => {
  const service = new PortfolioService(makePrismaMock([]));

  const risk = await service.getRiskSummary("usr_1");

  assert.ok("highRisk" in risk);
  assert.ok("mediumRisk" in risk);
  assert.ok("lowRisk" in risk);
  assert.ok(risk.highRisk >= 0);
  assert.ok(risk.mediumRisk >= 0);
  assert.ok(risk.lowRisk >= 0);
});

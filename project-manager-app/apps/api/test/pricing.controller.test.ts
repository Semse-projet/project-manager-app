import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { PricingController } from "../dist/modules/pricing/pricing.controller.js";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: { "x-request-id": "req_pricing_1" },
    authContext: {
      tenantId: "tenant_1",
      orgId: "org_1",
      userId: "usr_pro_1",
      roles: ["PRO"],
    },
    ...overrides,
  };
}

const STUB_PRICES = [
  { commodityCode: "WPU0531", name: "Softwood Lumber", currentIndex: 312.4, unit: "MBF", lastUpdated: "2026-06-01" },
  { commodityCode: "WPU1012", name: "Steel", currentIndex: 289.1, unit: "ton", lastUpdated: "2026-06-01" },
];

// ── Permission declarations ───────────────────────────────────────────────────

test("pricing controller declares correct @RequirePermissions", () => {
  const expectations: Array<[string, string]> = [
    ["getMaterialPrices", "projects:read"],
    ["getPricingStatus",  "ops:dashboard:read"],
    ["refreshPrices",     "ops:dashboard:read"],
    ["getMyRates",        "projects:read"],
    ["upsertMyRates",     "projects:read"],
    ["deleteMyRates",     "projects:read"],
  ];

  for (const [method, permission] of expectations) {
    const meta = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, PricingController.prototype[method]);
    assert.deepEqual(meta, [permission], `${method} should require ${permission}`);
  }
});

// ── getMaterialPrices ─────────────────────────────────────────────────────────

test("pricing controller: getMaterialPrices returns prices with BLS source tag", async () => {
  const controller = new PricingController(
    {
      async getCurrentPrices() { return STUB_PRICES; },
      async getPricingStatus() { return {}; },
      async refreshPrices() { return {}; },
    } as never,
    {
      async getOverride() { return null; },
      async upsertOverride() { return {}; },
      async deleteOverride() {},
    } as never,
  );

  const result = await controller.getMaterialPrices(makeReq() as never);
  assert.equal(result.requestId, "req_pricing_1");
  assert.equal(result.data.source, "BLS_PPI_CACHE");
  assert.equal(result.data.prices.length, 2);
});

// ── getPricingStatus ──────────────────────────────────────────────────────────

test("pricing controller: getPricingStatus returns cache status", async () => {
  const controller = new PricingController(
    {
      async getCurrentPrices() { return []; },
      async getPricingStatus() {
        return { lastRefreshed: "2026-06-01T00:00:00Z", commoditiesCount: 25, isStale: false };
      },
      async refreshPrices() { return {}; },
    } as never,
    {
      async getOverride() { return null; },
      async upsertOverride() { return {}; },
      async deleteOverride() {},
    } as never,
  );

  const result = await controller.getPricingStatus(makeReq() as never);
  assert.equal(result.data.isStale, false);
  assert.equal(result.data.commoditiesCount, 25);
});

// ── refreshPrices ─────────────────────────────────────────────────────────────

test("pricing controller: refreshPrices triggers service and returns result", async () => {
  let refreshCalled = false;
  const controller = new PricingController(
    {
      async getCurrentPrices() { return []; },
      async getPricingStatus() { return {}; },
      async refreshPrices() {
        refreshCalled = true;
        return { refreshed: 25, failedCommodities: 0, durationMs: 1234 };
      },
    } as never,
    {
      async getOverride() { return null; },
      async upsertOverride() { return {}; },
      async deleteOverride() {},
    } as never,
  );

  const result = await controller.refreshPrices(makeReq() as never);
  assert.equal(refreshCalled, true);
  assert.equal(result.data.refreshed, 25);
  assert.equal(result.data.failedCommodities, 0);
});

// ── getMyRates ────────────────────────────────────────────────────────────────

test("pricing controller: getMyRates returns null override with hasCustomRates=false when no override", async () => {
  const controller = new PricingController(
    {
      async getCurrentPrices() { return []; },
      async getPricingStatus() { return {}; },
      async refreshPrices() { return {}; },
    } as never,
    {
      async getOverride() { return null; },
      async upsertOverride() { return {}; },
      async deleteOverride() {},
    } as never,
  );

  const result = await controller.getMyRates(makeReq() as never);
  assert.equal(result.data.override, null);
  assert.equal(result.data.hasCustomRates, false);
  assert.ok(typeof result.data.nationalBaselineHourlyRate === "number");
});

test("pricing controller: getMyRates returns override with hasCustomRates=true when set", async () => {
  const STUB_OVERRIDE = { userId: "usr_pro_1", laborRatePerHr: 85, materialMarkup: 0.15, notes: "NL rates" };
  const controller = new PricingController(
    {
      async getCurrentPrices() { return []; },
      async getPricingStatus() { return {}; },
      async refreshPrices() { return {}; },
    } as never,
    {
      async getOverride() { return STUB_OVERRIDE; },
      async upsertOverride() { return {}; },
      async deleteOverride() {},
    } as never,
  );

  const result = await controller.getMyRates(makeReq() as never);
  assert.equal(result.data.hasCustomRates, true);
  assert.equal(result.data.override.laborRatePerHr, 85);
});

// ── upsertMyRates ─────────────────────────────────────────────────────────────

test("pricing controller: upsertMyRates saves override for current user", async () => {
  const calls: unknown[] = [];
  const STUB_OVERRIDE = { userId: "usr_pro_1", laborRatePerHr: 90, materialMarkup: 0.2 };
  const controller = new PricingController(
    {
      async getCurrentPrices() { return []; },
      async getPricingStatus() { return {}; },
      async refreshPrices() { return {}; },
    } as never,
    {
      async getOverride() { return null; },
      async upsertOverride(_userId: string, data: unknown) {
        calls.push(data);
        return STUB_OVERRIDE;
      },
      async deleteOverride() {},
    } as never,
  );

  const result = await controller.upsertMyRates(makeReq() as never, { laborRatePerHr: 90, materialMarkup: 0.2 } as never);
  assert.equal(result.data.saved, true);
  assert.equal((result.data.override as Record<string, unknown>).laborRatePerHr, 90);
  assert.equal(calls.length, 1);
});

// ── deleteMyRates ─────────────────────────────────────────────────────────────

test("pricing controller: deleteMyRates reverts to BLS data", async () => {
  let deleteCalled = false;
  const controller = new PricingController(
    {
      async getCurrentPrices() { return []; },
      async getPricingStatus() { return {}; },
      async refreshPrices() { return {}; },
    } as never,
    {
      async getOverride() { return null; },
      async upsertOverride() { return {}; },
      async deleteOverride() { deleteCalled = true; },
    } as never,
  );

  const result = await controller.deleteMyRates(makeReq() as never);
  assert.equal(result.data.deleted, true);
  assert.equal(result.data.revertedToBls, true);
  assert.equal(deleteCalled, true);
});

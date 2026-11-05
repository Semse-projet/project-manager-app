// T-008 diagnostic only: records the currently deployed/indexed formula's discrepancy.
// Does not establish market prices, tax policy or permission to ship a replacement formula.
// Deliberately observes the old algorithm; replace the mismatch assertions with correct
// invariant tests when T-008 implementation is approved. Issue #1087 / spec PR #1075.
import assert from "node:assert/strict";
import test from "node:test";
import { BlsPpiService, BLS_SERIES } from "../dist/modules/pricing/bls-ppi.service.js";
import { MaterialPricingService } from "../dist/modules/pricing/material-pricing.service.js";
import { PricingController } from "../dist/modules/pricing/pricing.controller.js";

const material = BLS_SERIES.find((s) => s.materialKey === "lumber-framing");
assert.ok(material, "known fixture mapping must exist");
const syntheticBaseIndex = 120; // deliberately invented, NOT an observed BLS index
const roundMoney = (value: number) => Math.round(value * 100) / 100;

async function withSyntheticBlsIndex<T>(currentIndex: number, fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    status: "REQUEST_SUCCEEDED",
    Results: {
      series: [{
        seriesID: "WPU081",
        data: [{ year: "2026", period: "M06", value: String(currentIndex) }],
      }],
    },
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

for (const scenario of [
  { name: "rising", now: 126, legacyExpected: 0.82, datedReferenceExpected: 0.68 },
  { name: "unchanged", now: 120, legacyExpected: 0.78, datedReferenceExpected: 0.65 },
  { name: "falling", now: 96, legacyExpected: 0.62, datedReferenceExpected: 0.52 },
]) {
  test("T-008 diagnostic: " + scenario.name + " synthetic PPI reveals legacy index/100 mismatch", async () => {
    await withSyntheticBlsIndex(scenario.now, async () => {
      const service = new BlsPpiService();
      const prices = await service.fetchAllMaterialPrices();
      const actual = prices.find((s) => s.materialKey === material.materialKey);
      assert.ok(actual);
      assert.equal(actual.indexValue, scenario.now);
      assert.equal(actual.basePrice, 0.65);
      const correctFromDatedReference = roundMoney(actual.basePrice * (scenario.now / syntheticBaseIndex));
      assert.equal(correctFromDatedReference, scenario.datedReferenceExpected);

      // Record CURRENT behavior, not an approved target. T-008 must subsequently
      // assert equality to correctFromDatedReference using verifiable dated inputs.
      assert.equal(actual.pricePerUnit, scenario.legacyExpected);
      assert.notEqual(actual.pricePerUnit, correctFromDatedReference);
    });
  });
}

test("T-008 diagnostic: material metadata lacks price date and base-period index", () => {
  const mapping = BLS_SERIES.find((s) => s.materialKey === "lumber-framing");
  assert.ok(mapping);
  const observed = mapping as unknown as Record<string, unknown>;
  assert.equal(observed.observedAt, undefined);
  assert.equal(observed.indexAtBase, undefined);
  assert.equal(observed.basePrice, 0.65);
  // This is evidence of missing provenance, not evidence that 0.65 USD is a market price.
});

test("T-008 diagnostic: negative BLS index is not rejected and yields a negative material price", async () => {
  // Invalid external data must become an error/degraded state in the eventual implementation.
  // This deliberately confirms the current unsafe path without approving its behavior.
  await withSyntheticBlsIndex(-12, async () => {
    const service = new BlsPpiService();
    const prices = await service.fetchAllMaterialPrices();
    const actual = prices.find((s) => s.materialKey === material.materialKey);
    assert.ok(actual);
    assert.equal(actual.indexValue, -12);
    assert.equal(actual.pricePerUnit, -0.08);
  });
});

test("T-008 diagnostic: a BLS outage is persisted as a fresh BLS_PPI snapshot", async () => {
  const writes: Record<string, unknown>[] = [];
  const prisma = {
    materialPriceSnapshot: {
      upsert: async (payload: Record<string, unknown>) => {
        writes.push(payload);
        return payload;
      },
    },
  } as unknown as ConstructorParameters<typeof MaterialPricingService>[0];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError("simulated BLS outage"); }) as typeof fetch;
  try {
    const service = new MaterialPricingService(prisma, new BlsPpiService());
    const counts = await service.refreshPrices();
    assert.deepEqual(counts, { updated: BLS_SERIES.length, failed: 0 });
    assert.equal(writes.length, BLS_SERIES.length);
    const lumberWrite = writes.find((p) => (p.create as { materialKey: string }).materialKey === "lumber-framing");
    assert.ok(lumberWrite);
    const create = lumberWrite.create as {
      source: string;
      pricePerUnit: number;
      indexValue: number;
      basePrice: number;
      validUntil: Date;
      fetchedAt: Date;
    };
    assert.equal(create.source, "BLS_PPI"); // false attribution to live BLS data
    assert.equal(create.pricePerUnit, material.basePrice); // hardcoded price
    assert.equal(create.indexValue, 100); // synthetic fallback, not a BLS reading
    assert.ok(create.validUntil > create.fetchedAt); // newly refreshed TTL
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("T-008 diagnostic: partial BLS response marks absent series as successful cache updates", async () => {
  const writes: Record<string, unknown>[] = [];
  const prisma = {
    materialPriceSnapshot: {
      upsert: async (payload: Record<string, unknown>) => {
        writes.push(payload);
        return payload;
      },
    },
  } as unknown as ConstructorParameters<typeof MaterialPricingService>[0];

  // Only WPU081 is returned; other material series were not observed.
  await withSyntheticBlsIndex(126, async () => {
    const service = new MaterialPricingService(prisma, new BlsPpiService());
    const outcome = await service.refreshPrices();
    assert.deepEqual(outcome, { updated: BLS_SERIES.length, failed: 0 });
    assert.equal(writes.length, BLS_SERIES.length);

    const steel = writes.find((write) => (write.create as { materialKey: string }).materialKey === "steel-rebar");
    assert.ok(steel);
    const created = steel.create as { source: string; indexValue: number; pricePerUnit: number; validUntil: Date };
    assert.equal(created.source, "BLS_PPI");
    assert.equal(created.indexValue, 100); // manufactured for a series ABSENT from this response
    assert.equal(created.pricePerUnit, BLS_SERIES.find((x) => x.materialKey === "steel-rebar")!.basePrice);
    assert.ok(created.validUntil > new Date()); // fallback receives a fresh TTL
  });
});

test("T-008 diagnostic: failed BLS fetch overwrites existing snapshot fields with invented fallback", async () => {
  const writes: Record<string, unknown>[] = [];
  const prisma = {
    materialPriceSnapshot: {
      upsert: async (payload: Record<string, unknown>) => {
        writes.push(payload);
        return payload;
      },
    },
  } as unknown as ConstructorParameters<typeof MaterialPricingService>[0];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError("synthetic total outage"); }) as typeof fetch;
  try {
    const service = new MaterialPricingService(prisma, new BlsPpiService());
    await service.refreshPrices();
    const row = writes.find((p) => (p.where as { materialKey: string }).materialKey === "lumber-framing");
    assert.ok(row);
    const updated = row.update as { pricePerUnit: number; indexValue: number; validUntil: Date };
    assert.equal(updated.indexValue, 100);
    assert.equal(updated.pricePerUnit, material.basePrice);
    assert.ok(updated.validUntil > new Date());
    // A real DB row's historical verified fields would be replaced by the update clause.
    // No real DB was contacted; this test inspects the Prisma upsert payload only.
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("T-008b diagnostic: pricing API reports hardcoded fallback with BLS_PPI_CACHE source", async () => {
  // This reproduces the actual consumer-facing metadata, not a fabricated endpoint.
  // No network, DB, or HTTP listener is involved.
  const prisma = {
    materialPriceSnapshot: { findMany: async () => [] },
  } as unknown as ConstructorParameters<typeof MaterialPricingService>[0];
  const pricing = new MaterialPricingService(prisma, new BlsPpiService());
  const controller = new PricingController(
    pricing,
    {} as ConstructorParameters<typeof PricingController>[1],
  );
  const result = await controller.getMaterialPrices({ headers: { "x-request-id": "t008-fallback" } });
  assert.equal(result.data.source, "BLS_PPI_CACHE"); // misleading: no BLS snapshot exists
  assert.equal(result.data.prices["lumber-framing"], material.basePrice);
  assert.equal(Object.keys(result.data.prices).length, BLS_SERIES.length);
});

test("T-008 diagnostic: unavailable BLS series silently returns unverified hardcoded base price", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError("synthetic network failure"); }) as typeof fetch;
  try {
    const service = new BlsPpiService();
    const prices = await service.fetchAllMaterialPrices();
    const actual = prices.find((s) => s.materialKey === material.materialKey);
    assert.ok(actual);
    assert.equal(actual.pricePerUnit, material.basePrice);
    assert.equal(actual.indexValue, 100); // synthesized fallback; NOT a real BLS observation
    assert.equal(actual.changeYoY, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

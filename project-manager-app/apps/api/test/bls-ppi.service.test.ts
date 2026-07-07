import test from "node:test";
import assert from "node:assert/strict";
import { BlsPpiService } from "../dist/modules/pricing/bls-ppi.service.js";

function blsResponse(series: Array<{ seriesID: string; data: Array<{ year: string; period: string; value: string }> }>) {
  return new Response(
    JSON.stringify({ status: "REQUEST_SUCCEEDED", Results: { series } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

async function withMockedFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

test("computes true year-over-year change from the same period a year ago (not the 2012=100 base)", async () => {
  const service = new BlsPpiService();

  await withMockedFetch(
    (async () => blsResponse([{
      seriesID: "WPU081",
      data: [
        { year: "2026", period: "M06", value: "180" },
        { year: "2025", period: "M06", value: "150" }, // same period, 1 year prior
      ],
    }])) as typeof fetch,
    async () => {
      const results = await service.fetchAllMaterialPrices();
      const lumber = results.find((r) => r.materialKey === "lumber-framing");
      assert.ok(lumber);
      // Real YoY: (180-150)/150*100 = 20.00. The old buggy formula (index/100-1)*100
      // would have reported 80.00 here — this asserts the fix, not the old bug.
      assert.equal(lumber.changeYoY, 20);
    },
  );
});

test("clamps an extreme swing to fit the Decimal(6,4) column instead of overflowing", async () => {
  const service = new BlsPpiService();

  await withMockedFetch(
    (async () => blsResponse([{
      seriesID: "WPU081",
      data: [
        { year: "2026", period: "M06", value: "400" },
        { year: "2025", period: "M06", value: "100" }, // real YoY would be +300%
      ],
    }])) as typeof fetch,
    async () => {
      const results = await service.fetchAllMaterialPrices();
      const lumber = results.find((r) => r.materialKey === "lumber-framing");
      assert.ok(lumber);
      assert.ok(lumber.changeYoY !== null);
      assert.ok(lumber.changeYoY! <= 99.9999, `changeYoY ${lumber.changeYoY} must fit Decimal(6,4)`);
      assert.equal(lumber.changeYoY, 99.9999);
    },
  );
});

test("clamps an extreme negative swing symmetrically", async () => {
  const service = new BlsPpiService();

  await withMockedFetch(
    (async () => blsResponse([{
      seriesID: "WPU081",
      data: [
        { year: "2026", period: "M06", value: "0" },
        { year: "2025", period: "M06", value: "100" }, // real YoY would be exactly -100%
      ],
    }])) as typeof fetch,
    async () => {
      const results = await service.fetchAllMaterialPrices();
      // currentIndex=0 is falsy, so this series takes the "unavailable" fallback path —
      // this exercises that fallback rather than the negative-clamp branch. See below.
      const lumber = results.find((r) => r.materialKey === "lumber-framing");
      assert.ok(lumber);
      assert.equal(lumber.changeYoY, null);
    },
  );
});

test("clamps a negative swing that would exceed -99.9999", async () => {
  const service = new BlsPpiService();

  await withMockedFetch(
    (async () => blsResponse([{
      seriesID: "WPU081",
      data: [
        { year: "2026", period: "M06", value: "0.0001" },
        { year: "2025", period: "M06", value: "1000" }, // real YoY ≈ -99.99999%, must clamp
      ],
    }])) as typeof fetch,
    async () => {
      const results = await service.fetchAllMaterialPrices();
      const lumber = results.find((r) => r.materialKey === "lumber-framing");
      assert.ok(lumber);
      assert.equal(lumber.changeYoY, -99.9999);
    },
  );
});

test("returns null changeYoY when no prior-year reading exists (new series)", async () => {
  const service = new BlsPpiService();

  await withMockedFetch(
    (async () => blsResponse([{
      seriesID: "WPU081",
      data: [
        { year: "2026", period: "M06", value: "180" },
      ],
    }])) as typeof fetch,
    async () => {
      const results = await service.fetchAllMaterialPrices();
      const lumber = results.find((r) => r.materialKey === "lumber-framing");
      assert.ok(lumber);
      assert.equal(lumber.changeYoY, null);
      // pricePerUnit should still be computed from the current index.
      assert.ok(lumber.pricePerUnit > 0);
    },
  );
});

test("ignores the M13 annual-average pseudo-period when picking latest and year-ago readings", async () => {
  const service = new BlsPpiService();

  await withMockedFetch(
    (async () => blsResponse([{
      seriesID: "WPU081",
      data: [
        { year: "2026", period: "M13", value: "999" }, // annual average — must be skipped
        { year: "2026", period: "M06", value: "180" },
        { year: "2025", period: "M13", value: "888" }, // annual average — must be skipped
        { year: "2025", period: "M06", value: "150" },
      ],
    }])) as typeof fetch,
    async () => {
      const results = await service.fetchAllMaterialPrices();
      const lumber = results.find((r) => r.materialKey === "lumber-framing");
      assert.ok(lumber);
      assert.equal(lumber.indexValue, 180);
      assert.equal(lumber.changeYoY, 20);
    },
  );
});

test("falls back to base prices for every material when the BLS API is unreachable", async () => {
  const service = new BlsPpiService();

  await withMockedFetch(
    (async () => { throw new TypeError("network down"); }) as typeof fetch,
    async () => {
      const results = await service.fetchAllMaterialPrices();
      assert.ok(results.length > 0);
      for (const result of results) {
        assert.equal(result.changeYoY, null);
        assert.equal(result.pricePerUnit, result.basePrice);
      }
    },
  );
});

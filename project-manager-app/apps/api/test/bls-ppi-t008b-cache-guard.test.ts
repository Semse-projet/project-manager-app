// T-008b hardening tests: BLS index provenance before writing material-price snapshots.
// The index may be observed while the legacy index/100 unit price is NOT commercially validated.
// This PR must remain a draft; no market price, tax, migration or deployment approval.
import assert from "node:assert/strict";
import test from "node:test";
import { BlsPpiService, BLS_SERIES } from "../dist/modules/pricing/bls-ppi.service.js";
import { MaterialPricingService } from "../dist/modules/pricing/material-pricing.service.js";

type Write = { where: { materialKey: string }; create: { materialKey: string; source: string; pricePerUnit: number; indexValue: number; validUntil: Date }; update: { pricePerUnit: number; indexValue: number; validUntil: Date } };

function prismaCapture(failMaterialKey?: string) {
  const writes: Write[] = [];
  const prisma = {
    materialPriceSnapshot: {
      upsert: async (payload: Write) => {
        if (payload.where.materialKey === failMaterialKey) throw new Error("synthetic DB write failure");
        writes.push(payload);
        return payload;
      },
    },
  } as unknown as ConstructorParameters<typeof MaterialPricingService>[0];
  return { prisma, writes };
}

function mockBls(series: Array<{ seriesID: string; data: Array<{ year: string; period: string; value: string }> }>) {
  return new Response(JSON.stringify({ status: "REQUEST_SUCCEEDED", Results: { series } }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

async function withFetch<T>(impl: typeof fetch, run: () => Promise<T>) {
  const prior = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await run(); } finally { globalThis.fetch = prior; }
}

test("T-008b: total BLS outage causes zero writes and all entries fail to refresh", async () => {
  const { prisma, writes } = prismaCapture();
  await withFetch((async () => { throw new TypeError("network down"); }) as typeof fetch, async () => {
    const result = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
    assert.deepEqual(result, { updated: 0, failed: BLS_SERIES.length });
    assert.equal(writes.length, 0);
  });
});

test("T-008b: partial BLS response refreshes ONLY observed material series", async () => {
  const { prisma, writes } = prismaCapture();
  await withFetch((async () => mockBls([
    { seriesID: "WPU081", data: [{ year: "2026", period: "M06", value: "126" }] },
  ])) as typeof fetch, async () => {
    const result = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
    const observed = BLS_SERIES.filter(s => s.seriesId === "WPU081");
    assert.deepEqual(result, { updated: observed.length, failed: BLS_SERIES.length - observed.length });
    assert.deepEqual(writes.map(w => w.where.materialKey).sort(), observed.map(s => s.materialKey).sort());
    assert.ok(writes.every(w => w.create.source === "BLS_PPI" && w.create.indexValue === 126));
    assert.ok(writes.every(w => w.create.validUntil > new Date()));
  });
});

for (const input of ["-12", "0", "NaN", "Infinity"]) {
  test(`T-008b: invalid BLS index ${input} never triggers an upsert`, async () => {
    const { prisma, writes } = prismaCapture();
    await withFetch((async () => mockBls([
      { seriesID: "WPU081", data: [{ year: "2026", period: "M06", value: input }] },
    ])) as typeof fetch, async () => {
      const service = new BlsPpiService();
      const rows = await service.fetchAllMaterialPrices();
      const target = rows.find(r => r.materialKey === "lumber-framing");
      assert.ok(target);
      assert.equal(target.indexOrigin, "UNVERIFIED_FALLBACK");
      const outcome = await new MaterialPricingService(prisma, service).refreshPrices();
      assert.deepEqual(outcome, { updated: 0, failed: BLS_SERIES.length });
      assert.equal(writes.length, 0);
    });
  });
}

test("T-008b: observed index whose rounded legacy price is zero is not stored", async () => {
  const { prisma, writes } = prismaCapture();
  await withFetch((async () => mockBls([
    { seriesID: "WPU081", data: [{ year: "2026", period: "M06", value: "0.0001" }] },
  ])) as typeof fetch, async () => {
    const result = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
    assert.deepEqual(result, { updated: 0, failed: BLS_SERIES.length });
    assert.equal(writes.length, 0);
  });
});

test("T-008b: failure writing one observed material is reflected in counts", async () => {
  const { prisma, writes } = prismaCapture("lumber-framing");
  await withFetch((async () => mockBls([
    { seriesID: "WPU081", data: [{ year: "2026", period: "M06", value: "126" }] },
  ])) as typeof fetch, async () => {
    const result = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
    assert.deepEqual(result, { updated: 1, failed: BLS_SERIES.length - 1 });
    assert.deepEqual(writes.map(w => w.where.materialKey), ["lumber-plywood"]);
  });
});

test("T-008b: positive index is tagged as observed; fallback is not certified", async () => {
  await withFetch((async () => mockBls([
    { seriesID: "WPU081", data: [{ year: "2026", period: "M06", value: "126" }] },
  ])) as typeof fetch, async () => {
    const results = await new BlsPpiService().fetchAllMaterialPrices();
    assert.equal(results.find(r => r.materialKey === "lumber-framing")?.indexOrigin, "BLS_OBSERVED");
    assert.equal(results.find(r => r.materialKey === "steel-rebar")?.indexOrigin, "UNVERIFIED_FALLBACK");
  });
});

// T-008b hardening tests: BLS index provenance before writing material-price snapshots.
// The index may be observed while the legacy index/100 unit price is NOT commercially validated.
// This PR must remain a draft; no market price, tax, migration or deployment approval.
import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BlsPpiService, BLS_SERIES } from "../dist/modules/pricing/bls-ppi.service.js";
import { MaterialPricingService } from "../dist/modules/pricing/material-pricing.service.js";
import { PricingController } from "../dist/modules/pricing/pricing.controller.js";

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
    { seriesID: "WPU081", data: [{ year: String(new Date().getUTCFullYear()), period: `M${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`, value: "126" }] },
  ])) as typeof fetch, async () => {
    const result = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
    const observed = BLS_SERIES.filter(s => s.seriesId === "WPU081");
    assert.deepEqual(result, { updated: observed.length, failed: BLS_SERIES.length - observed.length });
    assert.deepEqual(writes.map(w => w.where.materialKey).sort(), observed.map(s => s.materialKey).sort());
    assert.ok(writes.every(w => w.create.source === "BLS_PPI" && w.create.indexValue === 126));
    assert.ok(writes.every(w => w.create.validUntil > new Date()));
  });
});

for (const input of ["-12", "0", "NaN", "Infinity", "126invalid", ".", ""]) {
  test(`T-008b: invalid BLS index ${input} never triggers an upsert`, async () => {
    const { prisma, writes } = prismaCapture();
    await withFetch((async () => mockBls([
      { seriesID: "WPU081", data: [{ year: String(new Date().getUTCFullYear()), period: `M${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`, value: input }] },
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
    { seriesID: "WPU081", data: [{ year: String(new Date().getUTCFullYear()), period: `M${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`, value: "0.0001" }] },
  ])) as typeof fetch, async () => {
    const result = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
    assert.deepEqual(result, { updated: 0, failed: BLS_SERIES.length });
    assert.equal(writes.length, 0);
  });
});

test("T-008b: failure writing one observed material is reflected in counts", async () => {
  const { prisma, writes } = prismaCapture("lumber-framing");
  await withFetch((async () => mockBls([
    { seriesID: "WPU081", data: [{ year: String(new Date().getUTCFullYear()), period: `M${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`, value: "126" }] },
  ])) as typeof fetch, async () => {
    const result = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
    assert.deepEqual(result, { updated: 1, failed: BLS_SERIES.length - 1 });
    assert.deepEqual(writes.map(w => w.where.materialKey), ["lumber-plywood"]);
  });
});

test("T-008b: positive index is tagged as observed; fallback is not certified", async () => {
  await withFetch((async () => mockBls([
    { seriesID: "WPU081", data: [{ year: String(new Date().getUTCFullYear()), period: `M${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`, value: "126" }] },
  ])) as typeof fetch, async () => {
    const results = await new BlsPpiService().fetchAllMaterialPrices();
    assert.equal(results.find(r => r.materialKey === "lumber-framing")?.indexOrigin, "BLS_OBSERVED");
    assert.equal(results.find(r => r.materialKey === "steel-rebar")?.indexOrigin, "UNVERIFIED_FALLBACK");
  });
});

test("T-008b: empty cache reports hardcoded values as UNVERIFIED, not BLS PPI", async () => {
  const prisma = {
    materialPriceSnapshot: { findMany: async () => [] },
  } as unknown as ConstructorParameters<typeof MaterialPricingService>[0];
  const service = new MaterialPricingService(prisma, new BlsPpiService());
  const details = await service.getCurrentPricesWithProvenance();
  assert.equal(details.source, "HARDCODED_FALLBACK_UNVERIFIED");
  assert.equal(Object.keys(details.prices).length, BLS_SERIES.length);
  assert.equal(details.prices["lumber-framing"], 0.65);
  assert.equal(details.provenance["lumber-framing"]?.origin, "HARDCODED_FALLBACK");
  assert.equal(details.provenance["lumber-framing"]?.verification, "UNVERIFIED");
  assert.equal(details.provenance["lumber-framing"]?.recordedSource, null);

  const controller = new PricingController(service, {} as ConstructorParameters<typeof PricingController>[1]);
  const response = await controller.getMaterialPrices({ headers: {} });
  assert.equal(response.data.source, "HARDCODED_FALLBACK_UNVERIFIED");
  assert.deepEqual(response.data.prices, details.prices);
});

test("T-008b: legacy BLS cache row remains UNVERIFIED even with valid TTL", async () => {
  const fetchedAt = new Date("2026-10-31T12:00:00Z");
  const validUntil = new Date(Date.now() + 60_000);
  const prisma = {
    materialPriceSnapshot: {
      findMany: async () => [{
        materialKey: "lumber-framing",
        pricePerUnit: 1.11,
        source: "BLS_PPI",
        fetchedAt, validUntil,
      }],
    },
  } as unknown as ConstructorParameters<typeof MaterialPricingService>[0];
  const service = new MaterialPricingService(prisma, new BlsPpiService());
  const details = await service.getCurrentPricesWithProvenance();
  assert.equal(details.source, "LEGACY_CACHE_UNVERIFIED");
  assert.equal(details.prices["lumber-framing"], 1.11);
  assert.equal(details.provenance["lumber-framing"]?.recordedSource, "BLS_PPI");
  assert.equal(details.provenance["lumber-framing"]?.verification, "UNVERIFIED");
  assert.equal(details.provenance["lumber-framing"]?.origin, "LEGACY_CACHE");
  assert.equal(details.provenance["lumber-framing"]?.fetchedAt, fetchedAt.toISOString());
  assert.equal(details.provenance["lumber-framing"]?.validUntil, validUntil.toISOString());
  assert.deepEqual(await service.getCurrentPrices(), details.prices);
});

test("T-008b: partial cache does not fabricate cached observations for missing materials", async () => {
  const prisma = {
    materialPriceSnapshot: {
      findMany: async () => [{
        materialKey: "steel-rebar",
        pricePerUnit: 90,
        source: "MANUAL",
        fetchedAt: new Date("2026-10-31T00:00:00Z"),
        validUntil: new Date(Date.now() + 60_000),
      }],
    },
  } as unknown as ConstructorParameters<typeof MaterialPricingService>[0];
  const details = await new MaterialPricingService(prisma, new BlsPpiService()).getCurrentPricesWithProvenance();
  assert.equal(details.prices["steel-rebar"], 90);
  assert.equal(details.prices["lumber-framing"], undefined);
  assert.equal(details.provenance["steel-rebar"]?.recordedSource, "MANUAL");
  assert.equal(details.provenance["steel-rebar"]?.verification, "UNVERIFIED");
  assert.equal(details.provenance["lumber-framing"], undefined);
});

test("T-008b: BLS monthly observations are ordered by period, not response order", async () => {
  const now = new Date();
  const newest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const newer = `M${String(newest.getUTCMonth() + 1).padStart(2, "0")}`;
  const older = `M${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
  const { prisma, writes } = prismaCapture();
  await withFetch((async () => mockBls([{
    seriesID: "WPU081",
    data: [
      { year: String(previous.getUTCFullYear()), period: older, value: "99" },
      { year: String(newest.getUTCFullYear()), period: "M13", value: "987" },
      { year: String(newest.getUTCFullYear()), period: newer, value: "126" },
    ],
  }])) as typeof fetch, async () => {
    const result = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
    assert.equal(result.updated, BLS_SERIES.filter(s => s.seriesId === "WPU081").length);
    assert.ok(writes.every(row => row.create.indexValue === 126));
  });
});

test("T-008b: annual, malformed, future and stale BLS periods cannot refresh cache", async () => {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const malformed = [
    { year: String(now.getUTCFullYear()), period: "M13", value: "126" },
    { year: String(now.getUTCFullYear()), period: "M00", value: "126" },
    { year: String(now.getUTCFullYear()), period: "M99", value: "126" },
    { year: String(next.getUTCFullYear()), period: `M${String(next.getUTCMonth() + 1).padStart(2, "0")}`, value: "126" },
    { year: String(now.getUTCFullYear() - 3), period: "M06", value: "126" },
  ];
  const { prisma, writes } = prismaCapture();
  await withFetch((async () => mockBls([{ seriesID: "WPU081", data: malformed }])) as typeof fetch, async () => {
    const rows = await new BlsPpiService().fetchAllMaterialPrices();
    assert.equal(rows.find(row => row.materialKey === "lumber-framing")?.indexOrigin, "UNVERIFIED_FALLBACK");
    const refreshed = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
    assert.deepEqual(refreshed, { updated: 0, failed: BLS_SERIES.length });
    assert.equal(writes.length, 0);
  });
});

for (const prior of ["bad-index", "Infinity", "0", "-20", "1e-320"]) {
  test(`T-008b: invalid year-ago BLS reading ${prior} yields null YoY without poisoning valid observed index`, async () => {
    const now = new Date();
    const month = `M${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const observed = BLS_SERIES.filter(x => x.seriesId === "WPU081");
    const { prisma, writes } = prismaCapture();
    await withFetch((async () => mockBls([{
      seriesID: "WPU081",
      data: [
        { year: String(now.getUTCFullYear()), period: month, value: "126" },
        { year: String(now.getUTCFullYear() - 1), period: month, value: prior },
      ],
    }])) as typeof fetch, async () => {
      const values = await new BlsPpiService().fetchAllMaterialPrices();
      const target = values.find(x => x.materialKey === "lumber-framing");
      assert.equal(target?.indexOrigin, "BLS_OBSERVED");
      assert.equal(target?.changeYoY, null);
      const refreshed = await new MaterialPricingService(prisma, new BlsPpiService()).refreshPrices();
      assert.deepEqual(refreshed, {
        updated: observed.length,
        failed: BLS_SERIES.length - observed.length,
      });
      assert.ok(writes.every(w => Number.isFinite(w.create.indexValue)));
    });
  });
}

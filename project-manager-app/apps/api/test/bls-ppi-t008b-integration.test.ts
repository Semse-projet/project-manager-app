// T-008b — actual PostgreSQL acceptance (ephemeral GitHub CI ONLY).
// Uses a real Prisma transaction and ALWAYS rolls it back: no persistent test data.
// Neither Railway nor production nor external BLS can be accessed here.
import test from "node:test";
import assert from "node:assert/strict";
import prismaClientPackage from "../../../node_modules/.prisma/client/index.js";
import { BlsPpiService, BLS_SERIES } from "../dist/modules/pricing/bls-ppi.service.js";
import { MaterialPricingService } from "../dist/modules/pricing/material-pricing.service.js";

const { PrismaClient } = prismaClientPackage;
const ROLLBACK = "T008B_EXPECTED_TRANSACTION_ROLLBACK";

function requireDisposableCiDb() {
  if (process.env.CI !== "true" || process.env.NODE_ENV === "production" ||
      process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_ID) {
    throw new Error("T-008b integration requires disposable GitHub CI Postgres");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("T-008b integration requires DATABASE_URL");
  const url = new URL(raw);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.port !== "5433" || url.pathname !== "/semse") {
    throw new Error("T-008b integration refuses non-CI PostgreSQL destination");
  }
}

async function withFetch(impl, run) {
  const old = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await run(); }
  finally { globalThis.fetch = old; }
}

function responseFor(series) {
  return new Response(JSON.stringify({
    status: "REQUEST_SUCCEEDED",
    Results: { series },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

async function inRolledBackTransaction(db, action) {
  let reachedRollback = false;
  try {
    await db.$transaction(async tx => {
      await action(tx);
      reachedRollback = true;
      throw new Error(ROLLBACK);
    }, { timeout: 15_000 });
    assert.fail("Transaction must roll back");
  } catch (error) {
    // Unexpected failures must never be masked as a successful rollback.
    assert.equal(error?.message, ROLLBACK);
    assert.equal(reachedRollback, true);
  }
}

function normalize(row) {
  return {
    materialKey: row.materialKey,
    pricePerUnit: String(row.pricePerUnit),
    indexValue: row.indexValue === null ? null : String(row.indexValue),
    source: row.source,
    validUntil: row.validUntil.toISOString(),
    fetchedAt: row.fetchedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

test("T-008b isolated PostgreSQL: outage cannot rewrite or renew a pre-existing BLS cache row", async () => {
  requireDisposableCiDb();
  const db = new PrismaClient();
  await db.$connect();
  try {
    await inRolledBackTransaction(db, async tx => {
      const materialKey = "lumber-framing";
      const material = BLS_SERIES.find(s => s.materialKey === materialKey);
      assert.ok(material);
      const saved = await tx.materialPriceSnapshot.upsert({
        where: { materialKey },
        create: {
          materialKey, blsSeriesId: material.seriesId, source: "BLS_PPI",
          pricePerUnit: "0.73", unit: material.unit, basePrice: material.basePrice,
          indexValue: "112.5",
          fetchedAt: new Date("2026-10-15T00:00:00.000Z"),
          validUntil: new Date("2026-12-15T00:00:00.000Z"),
        },
        update: {
          source: "BLS_PPI", pricePerUnit: "0.73", indexValue: "112.5",
          fetchedAt: new Date("2026-10-15T00:00:00.000Z"),
          validUntil: new Date("2026-12-15T00:00:00.000Z"),
        },
      });
      const before = normalize(saved);
      const countBefore = await tx.materialPriceSnapshot.count();
      await withFetch(async () => { throw new TypeError("synthetic BLS outage"); }, async () => {
        const refreshed = await new MaterialPricingService(tx, new BlsPpiService()).refreshPrices();
        assert.deepEqual(refreshed, { updated: 0, failed: BLS_SERIES.length });
      });
      const after = await tx.materialPriceSnapshot.findUniqueOrThrow({ where: { materialKey } });
      assert.deepEqual(normalize(after), before);
      assert.equal(await tx.materialPriceSnapshot.count(), countBefore);
    });
  } finally {
    await db.$disconnect();
  }
});

test("T-008b isolated PostgreSQL: partial BLS data updates observed series only", async () => {
  requireDisposableCiDb();
  const db = new PrismaClient();
  await db.$connect();
  try {
    await inRolledBackTransaction(db, async tx => {
      const missingKey = "steel-rebar"; // WPU101901 not returned by mock BLS
      const missing = BLS_SERIES.find(s => s.materialKey === missingKey);
      assert.ok(missing);
      await tx.materialPriceSnapshot.upsert({
        where: { materialKey: missingKey },
        create: {
          materialKey: missingKey, blsSeriesId: missing.seriesId,
          source: "BLS_PPI", pricePerUnit: "850.00", unit: missing.unit,
          indexValue: "115", basePrice: missing.basePrice,
          fetchedAt: new Date("2026-10-01T00:00:00.000Z"),
          validUntil: new Date("2026-12-01T00:00:00.000Z"),
        },
        update: {
          source: "BLS_PPI", pricePerUnit: "850.00", indexValue: "115",
          fetchedAt: new Date("2026-10-01T00:00:00.000Z"),
          validUntil: new Date("2026-12-01T00:00:00.000Z"),
        },
      });
      const before = await tx.materialPriceSnapshot.findUniqueOrThrow({ where: { materialKey: missingKey } });
      const observed = BLS_SERIES.filter(s => s.seriesId === "WPU081");
      await withFetch(async () => responseFor([{
        seriesID: "WPU081",
        data: [{ year: String(new Date().getUTCFullYear()), period: `M${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`, value: "126" }],
      }]), async () => {
        const result = await new MaterialPricingService(tx, new BlsPpiService()).refreshPrices();
        assert.deepEqual(result, {
          updated: observed.length,
          failed: BLS_SERIES.length - observed.length,
        });
      });
      for (const material of observed) {
        const row = await tx.materialPriceSnapshot.findUniqueOrThrow({ where: { materialKey: material.materialKey } });
        assert.equal(String(row.indexValue), "126");
        assert.equal(row.source, "BLS_PPI");
      }
      const after = await tx.materialPriceSnapshot.findUniqueOrThrow({ where: { materialKey: missingKey } });
      assert.deepEqual(normalize(after), normalize(before));
    });
  } finally {
    await db.$disconnect();
  }
});

test("T-008b isolated PostgreSQL: BLS cannot overwrite a MANUAL price and its origin", async () => {
  requireDisposableCiDb();
  const db = new PrismaClient();
  await db.$connect();
  try {
    await inRolledBackTransaction(db, async tx => {
      const manualKey = "lumber-framing";
      const record = BLS_SERIES.find(s => s.materialKey === manualKey);
      assert.ok(record);
      const original = await tx.materialPriceSnapshot.upsert({
        where: { materialKey: manualKey },
        create: {
          materialKey: manualKey, blsSeriesId: null,
          source: "MANUAL", unit: record.unit,
          pricePerUnit: "2.34", indexValue: null, basePrice: null,
          fetchedAt: new Date("2026-10-01T00:00:00.000Z"),
          validUntil: new Date("2026-12-01T00:00:00.000Z"),
        },
        update: {
          source: "MANUAL", blsSeriesId: null, pricePerUnit: "2.34",
          indexValue: null, basePrice: null,
          fetchedAt: new Date("2026-10-01T00:00:00.000Z"),
          validUntil: new Date("2026-12-01T00:00:00.000Z"),
        },
      });
      const prior = normalize(original);
      const now = new Date();
      await withFetch(async () => responseFor([{
        seriesID: "WPU081",
        data: [{
          year: String(now.getUTCFullYear()),
          period: `M${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
          value: "126",
        }],
      }]), async () => {
        const result = await new MaterialPricingService(tx, new BlsPpiService()).refreshPrices();
        // WPU081 drives two materials; only the non-MANUAL row may refresh.
        assert.deepEqual(result, {
          updated: BLS_SERIES.filter(s => s.seriesId === "WPU081").length - 1,
          failed: BLS_SERIES.length - (BLS_SERIES.filter(s => s.seriesId === "WPU081").length - 1),
        });
      });
      const after = await tx.materialPriceSnapshot.findUniqueOrThrow({ where: { materialKey: manualKey } });
      assert.deepEqual(normalize(after), prior);
      const other = await tx.materialPriceSnapshot.findUniqueOrThrow({ where: { materialKey: "lumber-plywood" } });
      assert.equal(other.source, "BLS_PPI");
      assert.equal(String(other.indexValue), "126");
    });
  } finally {
    await db.$disconnect();
  }
});

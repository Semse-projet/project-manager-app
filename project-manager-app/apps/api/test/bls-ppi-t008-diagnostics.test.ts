// T-008 diagnostic only: records the currently deployed/indexed formula's discrepancy.
// Does not establish market prices, tax policy or permission to ship a replacement formula.
// Deliberately observes the old algorithm; replace the mismatch assertions with correct
// invariant tests when T-008 implementation is approved. Issue #1087 / spec PR #1075.
import assert from "node:assert/strict";
import test from "node:test";
import { BlsPpiService, BLS_SERIES } from "../dist/modules/pricing/bls-ppi.service.js";

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

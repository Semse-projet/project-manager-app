// T-008/T-008b proposed acceptance oracle (TEST-ONLY).
// Independent of production services. Not evidence of correct live prices.
import assert from "node:assert/strict";
import test from "node:test";

const QUOTE_MONTH = "2026-11";
const VALID = Object.freeze({
  materialKey: "synthetic-lumber",
  unit: "board-ft",
  baseUnit: "board-ft",
  priceAtBase: 100,
  observedAt: "2025-06",
  location: "US-FL",
  source: "synthetic-supplier",
  usageAuthorized: true,
  validUntil: "2026-12",
  seriesId: "SYNTHETIC-PPI",
  indexAtBase: { seriesId: "SYNTHETIC-PPI", period: "2025-06", reference: "demo-100", value: 120 },
  indexNow: { seriesId: "SYNTHETIC-PPI", period: "2026-10", reference: "demo-100", value: 126 },
});

function referenceDecision(value) {
  if (!value || !value.materialKey || !value.source || !value.location ||
      !value.usageAuthorized || !value.observedAt || !value.validUntil ||
      !Number.isFinite(value.priceAtBase) || value.priceAtBase <= 0 ||
      !value.unit || value.unit !== value.baseUnit || value.validUntil < QUOTE_MONTH) {
    return { status: "UNVERIFIED_PRICE", pricePerUnit: null };
  }
  const base = value.indexAtBase;
  const current = value.indexNow;
  if (!base || !current || !base.seriesId || !current.seriesId ||
      base.seriesId !== value.seriesId || current.seriesId !== value.seriesId ||
      base.reference !== current.reference || base.period !== value.observedAt ||
      !base.period || !current.period || current.period < base.period || current.period > QUOTE_MONTH ||
      !Number.isFinite(base.value) || base.value <= 0 ||
      !Number.isFinite(current.value) || current.value <= 0) {
    return { status: "PPI_UNAVAILABLE", pricePerUnit: null };
  }
  return {
    status: "CALCULATED_FROM_VERIFIED_INPUTS",
    pricePerUnit: Math.round((value.priceAtBase * current.value / base.value) * 100) / 100,
  };
}

function referencePersistence(previous, decision) {
  if (decision.status !== "CALCULATED_FROM_VERIFIED_INPUTS") {
    // In particular, never renew a verified snapshot's fetchedAt/validUntil in outage.
    return { write: false, currentSnapshot: previous };
  }
  return { write: true, currentSnapshot: { ...previous, pricePerUnit: decision.pricePerUnit } };
}

for (const [name, current, expected] of [
  ["index increases", 126, 105],
  ["index unchanged", 120, 100],
  ["index decreases", 96, 80],
]) {
  test(`T-008 target reference: ${name}`, () => {
    assert.deepEqual(referenceDecision({ ...VALID, indexNow: { ...VALID.indexNow, value: current } }), {
      status: "CALCULATED_FROM_VERIFIED_INPUTS", pricePerUnit: expected,
    });
  });
}

test("T-008 target reference: stable rounding at two decimals", () => {
  assert.equal(referenceDecision({ ...VALID, priceAtBase: 0.65 }).pricePerUnit, 0.68);
});

for (const [name, input] of [
  ["missing source", { source: "" }],
  ["missing observation date", { observedAt: "" }],
  ["unverified license", { usageAuthorized: false }],
  ["expired price", { validUntil: "2026-10" }],
  ["negative price", { priceAtBase: -100 }],
  ["nonfinite price", { priceAtBase: Number.POSITIVE_INFINITY }],
  ["missing location", { location: "" }],
  ["unit mismatch", { baseUnit: "sqft" }],
]) {
  test(`T-008 target rejects ${name} before publishing`, () => {
    assert.equal(referenceDecision({ ...VALID, ...input }).status, "UNVERIFIED_PRICE");
  });
}

for (const [name, input] of [
  ["missing base index", { indexAtBase: null }],
  ["missing current index", { indexNow: null }],
  ["zero base index", { indexAtBase: { ...VALID.indexAtBase, value: 0 } }],
  ["negative current index", { indexNow: { ...VALID.indexNow, value: -12 } }],
  ["nonfinite current index", { indexNow: { ...VALID.indexNow, value: Number.NaN } }],
  ["nonmatching series", { indexNow: { ...VALID.indexNow, seriesId: "OTHER-PPI" } }],
  ["nonmatching index reference", { indexNow: { ...VALID.indexNow, reference: "OTHER-BASE" } }],
  ["wrong observed period", { indexAtBase: { ...VALID.indexAtBase, period: "2024-06" } }],
  ["old current index before base", { indexNow: { ...VALID.indexNow, period: "2024-06" } }],
  ["future index period", { indexNow: { ...VALID.indexNow, period: "2026-12" } }],
]) {
  test(`T-008 target refuses ${name}`, () => {
    const result = referenceDecision({ ...VALID, ...input });
    assert.deepEqual(result, { status: "PPI_UNAVAILABLE", pricePerUnit: null });
  });
}

test("T-008b target: outage preserves a verified snapshot unchanged", () => {
  const snapshot = Object.freeze({
    materialKey: VALID.materialKey, pricePerUnit: 101,
    source: "BLS_PPI", fetchedAt: "2026-10-15", validUntil: "2026-11-15",
  });
  const outcome = referencePersistence(snapshot, { status: "PPI_UNAVAILABLE", pricePerUnit: null });
  assert.equal(outcome.write, false);
  assert.equal(outcome.currentSnapshot, snapshot);
});

test("T-008b target: partial series response updates only fully verified materials", () => {
  const previous = { pricePerUnit: 100, fetchedAt: "2026-10-15", validUntil: "2026-11-15" };
  const confirmed = referenceDecision(VALID);
  const missingSeries = referenceDecision({ ...VALID, indexNow: null });
  assert.equal(referencePersistence(previous, confirmed).write, true);
  const skipped = referencePersistence(previous, missingSeries);
  assert.equal(skipped.write, false);
  assert.equal(skipped.currentSnapshot, previous);
});

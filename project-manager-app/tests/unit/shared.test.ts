/**
 * Unit tests for @semse/shared utilities.
 * Run: node --experimental-strip-types --test tests/unit/shared.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  formatCurrency,
  safeParseDecimal,
  slugify,
  truncate,
  toISODate,
  relativeTime,
  JOB_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  BID_STATUS_LABELS,
  DISPUTE_STATUS_LABELS,
  AGENT_RUN_STATUS_LABELS,
  isNonEmptyString,
  isPositiveNumber,
  pick,
  omit,
  compactObject,
  buildPaginationMeta,
  paginationSkip,
  API_VERSION,
  parseRoleList,
  serializeRoleList,
  buildIdentityHeaders,
  trimToUndefined,
  SEMSE_IDENTITY_HEADER_NAMES,
} from "../../packages/shared/src/index.ts";

// ── formatCurrency ────────────────────────────────────────────────────────────

test("formatCurrency formats USD correctly", () => {
  assert.equal(formatCurrency(1500), "$1,500.00");
  assert.equal(formatCurrency("2000.5"), "$2,000.50");
  assert.equal(formatCurrency(0), "$0.00");
});

test("formatCurrency returns dash for NaN input", () => {
  assert.equal(formatCurrency("not-a-number"), "—");
  assert.equal(formatCurrency(NaN), "—");
});

test("formatCurrency supports other currencies", () => {
  const result = formatCurrency(100, "EUR", "de-DE");
  assert.ok(result.includes("100"), `Expected 100 in: ${result}`);
});

// ── safeParseDecimal ──────────────────────────────────────────────────────────

test("safeParseDecimal converts valid inputs", () => {
  assert.equal(safeParseDecimal("42.5"), 42.5);
  assert.equal(safeParseDecimal(100), 100);
  assert.equal(safeParseDecimal(0), 0);
});

test("safeParseDecimal returns null for invalid inputs", () => {
  assert.equal(safeParseDecimal("abc"), null);
  assert.equal(safeParseDecimal(null), null);
  assert.equal(safeParseDecimal(undefined), null);
  assert.equal(safeParseDecimal(""), null);
  assert.equal(safeParseDecimal(Infinity), null);
  assert.equal(safeParseDecimal(NaN), null);
});

// ── slugify ───────────────────────────────────────────────────────────────────

test("slugify converts to lowercase hyphenated slug", () => {
  assert.equal(slugify("Hello World 2026!"), "hello-world-2026");
  assert.equal(slugify("  Leading Spaces  "), "leading-spaces");
  assert.equal(slugify("múltiple díacríticos"), "multiple-diacriticos");
});

test("slugify handles already-slug strings", () => {
  assert.equal(slugify("already-a-slug"), "already-a-slug");
});

test("slugify strips leading and trailing hyphens", () => {
  assert.equal(slugify("---test---"), "test");
});

// ── truncate ──────────────────────────────────────────────────────────────────

test("truncate shortens long strings", () => {
  // "Hello World".slice(0, 6) + "…" = "Hello …"  (space before ellipsis is intentional)
  assert.equal(truncate("Hello World", 7), "Hello …");
  assert.equal(truncate("Short", 10), "Short");
  assert.equal(truncate("Exactly10!", 10), "Exactly10!");
  // Trim at word boundary — no trailing space before suffix
  assert.equal(truncate("HelloWorld", 6), "Hello…");
});

test("truncate supports custom suffix", () => {
  assert.equal(truncate("Hello World", 8, "..."), "Hello...");
});

// ── toISODate ─────────────────────────────────────────────────────────────────

test("toISODate returns YYYY-MM-DD from various inputs", () => {
  assert.equal(toISODate("2026-04-07T14:00:00Z"), "2026-04-07");
  assert.equal(toISODate(new Date("2026-01-01T00:00:00Z")), "2026-01-01");
});

// ── relativeTime ──────────────────────────────────────────────────────────────

test("relativeTime returns human-readable string", () => {
  const now = new Date("2026-04-07T12:00:00Z");
  const pastHour = new Date("2026-04-07T11:00:00Z");
  const result = relativeTime(pastHour, now);
  assert.ok(typeof result === "string" && result.length > 0, `Got: ${result}`);
});

// ── label maps ────────────────────────────────────────────────────────────────

test("JOB_STATUS_LABELS covers all expected statuses", () => {
  const expected = ["DRAFT","POSTED","PUBLISHED","RESERVED","ACCEPTED","IN_PROGRESS","REVIEW","DISPUTE","COMPLETED","AWARDED","CANCELLED"];
  for (const key of expected) {
    assert.ok(JOB_STATUS_LABELS[key], `Missing JOB_STATUS_LABELS["${key}"]`);
  }
});

test("MILESTONE_STATUS_LABELS covers all expected statuses", () => {
  const expected = ["DRAFT","AWAITING_REVIEW","SUBMITTED","APPROVED","REJECTED","PAID"];
  for (const key of expected) {
    assert.ok(MILESTONE_STATUS_LABELS[key], `Missing MILESTONE_STATUS_LABELS["${key}"]`);
  }
});

test("BID_STATUS_LABELS has SUBMITTED, ACCEPTED, REJECTED", () => {
  assert.ok(BID_STATUS_LABELS["SUBMITTED"]);
  assert.ok(BID_STATUS_LABELS["ACCEPTED"]);
  assert.ok(BID_STATUS_LABELS["REJECTED"]);
});

test("DISPUTE_STATUS_LABELS and AGENT_RUN_STATUS_LABELS are populated", () => {
  assert.ok(Object.keys(DISPUTE_STATUS_LABELS).length >= 4);
  assert.ok(Object.keys(AGENT_RUN_STATUS_LABELS).length >= 4);
});

// ── type guards ───────────────────────────────────────────────────────────────

test("isNonEmptyString rejects blank/falsy values", () => {
  assert.equal(isNonEmptyString("hello"), true);
  assert.equal(isNonEmptyString(""), false);
  assert.equal(isNonEmptyString("  "), false);
  assert.equal(isNonEmptyString(null), false);
  assert.equal(isNonEmptyString(42), false);
});

test("isPositiveNumber rejects zero and non-finite values", () => {
  assert.equal(isPositiveNumber(1), true);
  assert.equal(isPositiveNumber(0), false);
  assert.equal(isPositiveNumber(-5), false);
  assert.equal(isPositiveNumber(Infinity), false);
  assert.equal(isPositiveNumber("5"), false);
});

// ── object utilities ──────────────────────────────────────────────────────────

test("pick selects only specified keys", () => {
  const obj = { a: 1, b: 2, c: 3 };
  assert.deepEqual(pick(obj, ["a", "c"]), { a: 1, c: 3 });
});

test("omit removes specified keys", () => {
  const obj = { a: 1, b: 2, c: 3 };
  assert.deepEqual(omit(obj, ["b"]), { a: 1, c: 3 });
});

test("compactObject strips null and undefined values", () => {
  const result = compactObject({ a: 1, b: null, c: undefined, d: 0, e: "" });
  assert.deepEqual(result, { a: 1, d: 0, e: "" });
});

// ── pagination ────────────────────────────────────────────────────────────────

test("buildPaginationMeta calculates totals correctly", () => {
  const meta = buildPaginationMeta(55, 2, 20);
  assert.equal(meta.total, 55);
  assert.equal(meta.totalPages, 3);
  assert.equal(meta.hasNext, true);
  assert.equal(meta.hasPrev, true);
  assert.equal(meta.page, 2);
  assert.equal(meta.pageSize, 20);
});

test("buildPaginationMeta edge cases — single page and last page", () => {
  const single = buildPaginationMeta(5, 1, 20);
  assert.equal(single.totalPages, 1);
  assert.equal(single.hasNext, false);
  assert.equal(single.hasPrev, false);

  const last = buildPaginationMeta(40, 2, 20);
  assert.equal(last.hasNext, false);
  assert.equal(last.hasPrev, true);
});

test("paginationSkip returns correct offset", () => {
  assert.equal(paginationSkip(1, 20), 0);
  assert.equal(paginationSkip(2, 20), 20);
  assert.equal(paginationSkip(3, 10), 20);
});

// ── API_VERSION constant ──────────────────────────────────────────────────────

test("API_VERSION is v1", () => {
  assert.equal(API_VERSION, "v1");
});

// ── identity header helpers ───────────────────────────────────────────────────

test("parseRoleList splits comma-separated role strings", () => {
  assert.deepEqual(parseRoleList("CLIENT,OPS_ADMIN"), ["CLIENT", "OPS_ADMIN"]);
  assert.deepEqual(parseRoleList("PRO"), ["PRO"]);
  assert.deepEqual(parseRoleList(""), []);
  assert.deepEqual(parseRoleList(null), []);
  assert.deepEqual(parseRoleList(42), []);
});

test("parseRoleList trims whitespace from each entry", () => {
  assert.deepEqual(parseRoleList(" CLIENT , PRO "), ["CLIENT", "PRO"]);
});

test("serializeRoleList joins roles with comma", () => {
  assert.equal(serializeRoleList(["CLIENT", "OPS_ADMIN"]), "CLIENT,OPS_ADMIN");
  assert.equal(serializeRoleList([]), "");
  assert.equal(serializeRoleList(["PRO"]), "PRO");
});

test("buildIdentityHeaders produces correct header map", () => {
  const headers = buildIdentityHeaders({
    tenantId: "t1",
    orgId: "o1",
    userId: "u1",
    roles: ["CLIENT"],
  });

  assert.equal(headers[SEMSE_IDENTITY_HEADER_NAMES.tenantId], "t1");
  assert.equal(headers[SEMSE_IDENTITY_HEADER_NAMES.orgId], "o1");
  assert.equal(headers[SEMSE_IDENTITY_HEADER_NAMES.userId], "u1");
  assert.equal(headers[SEMSE_IDENTITY_HEADER_NAMES.roles], "CLIENT");
});

test("trimToUndefined returns trimmed string or undefined", () => {
  assert.equal(trimToUndefined("  hello  "), "hello");
  assert.equal(trimToUndefined(""), undefined);
  assert.equal(trimToUndefined("  "), undefined);
  assert.equal(trimToUndefined(null), undefined);
  assert.equal(trimToUndefined(42), undefined);
});

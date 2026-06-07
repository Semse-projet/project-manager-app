/**
 * Unit tests for the tools validation engine — pure functions, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/validation-engine.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline validation engine (mirrors packages/tools/src/core/validation-engine.ts) ──

type ValidationSeverity = "error" | "warning" | "info";
type ValidationIssue = { field: string; severity: ValidationSeverity; message: string; suggestion?: string };

function required(field: string, value: unknown): ValidationIssue | null {
  if (value === null || value === undefined || value === "")
    return { field, severity: "error", message: `${field} es requerido.` };
  return null;
}

function positive(field: string, value: number, label = field): ValidationIssue | null {
  if (value <= 0) return { field, severity: "error", message: `${label} debe ser mayor a 0.` };
  return null;
}

function range(field: string, value: number, min: number, max: number, label = field): ValidationIssue | null {
  if (value < min || value > max)
    return { field, severity: "error", message: `${label} debe estar entre ${min} y ${max}.`, suggestion: `Valor actual: ${value}` };
  return null;
}

function warn(field: string, message: string, suggestion?: string): ValidationIssue {
  return { field, severity: "warning", message, suggestion };
}

function info(field: string, message: string): ValidationIssue {
  return { field, severity: "info", message };
}

function collect(...results: (ValidationIssue | null)[]): ValidationIssue[] {
  return results.filter((r): r is ValidationIssue => r !== null);
}

function isValid(issues: ValidationIssue[]): boolean {
  return !issues.some(i => i.severity === "error");
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("required: null → error", () => {
  const r = required("area", null);
  assert.ok(r !== null);
  assert.equal(r.severity, "error");
  assert.equal(r.field, "area");
});

test("required: undefined → error", () => {
  assert.ok(required("area", undefined) !== null);
});

test("required: empty string → error", () => {
  assert.ok(required("title", "") !== null);
});

test("required: 0 (falsy number) → null (0 is a valid value)", () => {
  assert.equal(required("count", 0), null);
});

test("required: non-empty string → null", () => {
  assert.equal(required("title", "Drywall repair"), null);
});

test("required: false (boolean) → null", () => {
  assert.equal(required("flag", false), null);
});

test("positive: 0 → error", () => {
  assert.ok(positive("area", 0) !== null);
});

test("positive: negative → error", () => {
  assert.ok(positive("area", -5) !== null);
});

test("positive: 0.1 → null", () => {
  assert.equal(positive("area", 0.1), null);
});

test("positive: large value → null", () => {
  assert.equal(positive("area", 99999), null);
});

test("range: below min → error with suggestion", () => {
  const r = range("thickness", 2, 3, 12);
  assert.ok(r !== null);
  assert.equal(r.severity, "error");
  assert.ok(r.suggestion?.includes("2"));
});

test("range: above max → error", () => {
  assert.ok(range("thickness", 15, 3, 12) !== null);
});

test("range: at min boundary → null", () => {
  assert.equal(range("thickness", 3, 3, 12), null);
});

test("range: at max boundary → null", () => {
  assert.equal(range("thickness", 12, 3, 12), null);
});

test("range: within range → null", () => {
  assert.equal(range("thickness", 6, 3, 12), null);
});

test("warn: creates warning issue", () => {
  const r = warn("area", "Large area — verify measurement");
  assert.equal(r.severity, "warning");
  assert.equal(r.field, "area");
});

test("info: creates info issue", () => {
  const r = info("mode", "Professional mode enables full output");
  assert.equal(r.severity, "info");
});

test("collect: filters nulls, keeps issues", () => {
  const issues = collect(
    required("title", "ok"),   // null
    required("area", null),    // error
    positive("rooms", -1),     // error
    null,                       // explicit null
  );
  assert.equal(issues.length, 2);
  assert.ok(issues.every(i => i.severity === "error"));
});

test("collect: all nulls → empty array", () => {
  assert.deepEqual(collect(null, null, null), []);
});

test("isValid: no errors → true", () => {
  assert.equal(isValid([warn("area", "big area"), info("mode", "tip")]), true);
});

test("isValid: has error → false", () => {
  assert.equal(isValid([required("area", null)!]), false);
});

test("isValid: empty → true", () => {
  assert.equal(isValid([]), true);
});

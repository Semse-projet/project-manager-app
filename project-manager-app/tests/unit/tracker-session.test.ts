/**
 * Unit tests for field-ops tracker session — pure functions, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/tracker-session.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline pure functions ─────────────────────────────────────────────────────

function computeTrackerElapsedSeconds(
  session: { accumulatedSeconds: number; status: "RUNNING" | "PAUSED" | "STOPPED"; resumedAt: Date | null },
  now: Date
): number {
  if (session.status !== "RUNNING" || !session.resumedAt) return session.accumulatedSeconds;
  const delta = Math.max(0, Math.floor((now.getTime() - session.resumedAt.getTime()) / 1000));
  return session.accumulatedSeconds + delta;
}

function trimTrackerNotes(value?: string): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function mergeTrackerNotes(current?: string | null, next?: string): string | null | undefined {
  const t = next?.trim();
  if (!t) return current ?? undefined;
  return t;
}

// ── computeTrackerElapsedSeconds ──────────────────────────────────────────────

const BASE_TIME = new Date("2026-01-01T10:00:00Z");

test("PAUSED session returns accumulatedSeconds unchanged", () => {
  const s = { accumulatedSeconds: 300, status: "PAUSED" as const, resumedAt: null };
  assert.equal(computeTrackerElapsedSeconds(s, BASE_TIME), 300);
});

test("STOPPED session returns accumulatedSeconds unchanged", () => {
  const s = { accumulatedSeconds: 600, status: "STOPPED" as const, resumedAt: null };
  assert.equal(computeTrackerElapsedSeconds(s, BASE_TIME), 600);
});

test("RUNNING with no resumedAt returns accumulatedSeconds (defensive)", () => {
  const s = { accumulatedSeconds: 100, status: "RUNNING" as const, resumedAt: null };
  assert.equal(computeTrackerElapsedSeconds(s, BASE_TIME), 100);
});

test("RUNNING: adds elapsed seconds since resumedAt", () => {
  const resumed = new Date(BASE_TIME.getTime() - 120_000); // resumed 2 min ago
  const s = { accumulatedSeconds: 300, status: "RUNNING" as const, resumedAt: resumed };
  assert.equal(computeTrackerElapsedSeconds(s, BASE_TIME), 420); // 300 + 120
});

test("RUNNING: rounds down to whole seconds (floor)", () => {
  const resumed = new Date(BASE_TIME.getTime() - 90_500); // 90.5 seconds ago
  const s = { accumulatedSeconds: 0, status: "RUNNING" as const, resumedAt: resumed };
  assert.equal(computeTrackerElapsedSeconds(s, BASE_TIME), 90); // floor 90.5
});

test("RUNNING: negative delta (clock skew) → clamped to 0", () => {
  const resumed = new Date(BASE_TIME.getTime() + 5000); // resumedAt is in the future
  const s = { accumulatedSeconds: 100, status: "RUNNING" as const, resumedAt: resumed };
  assert.equal(computeTrackerElapsedSeconds(s, BASE_TIME), 100); // 0 delta, keeps accumulated
});

test("RUNNING: large accumulated + new session", () => {
  const resumed = new Date(BASE_TIME.getTime() - 3600_000); // 1 hour ago
  const s = { accumulatedSeconds: 7200, status: "RUNNING" as const, resumedAt: resumed };
  assert.equal(computeTrackerElapsedSeconds(s, BASE_TIME), 10800); // 2h + 1h
});

// ── trimTrackerNotes ──────────────────────────────────────────────────────────

test("trimTrackerNotes: non-empty string → trimmed", () => {
  assert.equal(trimTrackerNotes("  note  "), "note");
});

test("trimTrackerNotes: whitespace only → undefined", () => {
  assert.equal(trimTrackerNotes("   "), undefined);
});

test("trimTrackerNotes: empty string → undefined", () => {
  assert.equal(trimTrackerNotes(""), undefined);
});

test("trimTrackerNotes: undefined → undefined", () => {
  assert.equal(trimTrackerNotes(undefined), undefined);
});

// ── mergeTrackerNotes ─────────────────────────────────────────────────────────

test("mergeTrackerNotes: non-empty next → returns trimmed next", () => {
  assert.equal(mergeTrackerNotes("old note", "  new note  "), "new note");
});

test("mergeTrackerNotes: empty next → returns current", () => {
  assert.equal(mergeTrackerNotes("keep this", ""), "keep this");
});

test("mergeTrackerNotes: whitespace next → returns current", () => {
  assert.equal(mergeTrackerNotes("keep this", "   "), "keep this");
});

test("mergeTrackerNotes: no next + no current → undefined", () => {
  assert.equal(mergeTrackerNotes(undefined, undefined), undefined);
});

test("mergeTrackerNotes: null current + empty next → undefined", () => {
  assert.equal(mergeTrackerNotes(null, ""), undefined);
});

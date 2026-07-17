import assert from "node:assert/strict";
import test from "node:test";
import { toVisibleDispute, toVisibleJob } from "../src/common/visible-response.ts";

test("visible job maps PUBLISHED compatibility state to POSTED", () => {
  const visible = toVisibleJob({ id: "job-1", status: "published" });

  assert.equal(visible.status, "POSTED");
  assert.equal(visible.statusRaw, "published");
});

test("visible job maps AWARDED compatibility state to ACCEPTED, never COMPLETED", () => {
  const visible = toVisibleJob({ id: "job-1", status: "awarded" });

  assert.equal(visible.status, "ACCEPTED");
  assert.notEqual(visible.status, "COMPLETED");
  assert.equal(visible.statusRaw, "awarded");
});

test("visible dispute preserves every persisted lifecycle state", () => {
  for (const [raw, expected] of [
    ["open", "OPEN"],
    ["assigned", "ASSIGNED"],
    ["under_review", "UNDER_REVIEW"],
    ["resolved", "RESOLVED"],
    ["rejected", "REJECTED"],
  ] as const) {
    const visible = toVisibleDispute({ id: "dispute-1", status: raw });
    assert.equal(visible.status, expected);
    assert.equal(visible.statusRaw, raw);
  }
});
